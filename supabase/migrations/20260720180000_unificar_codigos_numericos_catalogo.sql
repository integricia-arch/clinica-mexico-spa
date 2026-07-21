-- Unifica el catálogo de cuentas a código numérico consistente.
-- El catálogo tenía dos esquemas mezclados: numérico (101-502, partida doble)
-- y texto EGR_*/ING_* (devengo simple). Reasigna numérico y actualiza las
-- funciones SECURITY DEFINER que buscaban cuentas por el código de texto
-- hardcodeado (cuenta_contable_id() y comparaciones cc.codigo = ...).

UPDATE public.cuentas_contables SET codigo = '401' WHERE codigo = 'ING_CONSULTAS';
UPDATE public.cuentas_contables SET codigo = '402' WHERE codigo = 'ING_FARMACIA';
UPDATE public.cuentas_contables SET codigo = '403' WHERE codigo = 'ING_OTROS';
-- 5xx = costo de ventas/servicio (costo directo). 6xx = gastos de
-- administración y operación (NIF C — catálogo estándar mexicano).
UPDATE public.cuentas_contables SET codigo = '503' WHERE codigo = 'EGR_COMPRAS';
UPDATE public.cuentas_contables SET codigo = '504' WHERE codigo = 'EGR_HONORARIOS';
UPDATE public.cuentas_contables SET codigo = '601' WHERE codigo = 'EGR_NOMINA';
UPDATE public.cuentas_contables SET codigo = '602' WHERE codigo = 'EGR_RENTA';
UPDATE public.cuentas_contables SET codigo = '603' WHERE codigo = 'EGR_SERVICIOS';
UPDATE public.cuentas_contables SET codigo = '604' WHERE codigo = 'EGR_OTROS';

CREATE OR REPLACE FUNCTION public.contab_devengar_honorarios()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_row record;
BEGIN
  FOR v_row IN
    WITH ins AS (
      INSERT INTO public.movimientos_contables
        (clinic_id, cuenta_id, origen, monto_centavos, fecha_devengo, fecha_pago,
         evento, reference_type, reference_id, descripcion)
      SELECT d.clinic_id, public.cuenta_contable_id('504'), 'honorario',
             d.honorario_centavos, d.fecha, NULL,
             'devengo', 'honorario_appointment', d.appointment_id,
             'Honorario médico devengado'
      FROM public.doctor_honorarios_detalle d
      WHERE d.honorario_centavos > 0
        AND d.fecha < (now() AT TIME ZONE 'America/Mexico_City')::date
      ON CONFLICT (reference_type, reference_id, evento) WHERE reference_id IS NOT NULL
      DO NOTHING
      RETURNING clinic_id, reference_id, monto_centavos, fecha_devengo
    )
    SELECT * FROM ins
  LOOP
    v_count := v_count + 1;
    BEGIN
      PERFORM public.contab_generar_poliza_evento(
        v_row.clinic_id, 'honorario_devengo', v_row.monto_centavos, v_row.fecha_devengo,
        'Honorario médico devengado', 'honorario_appointment', v_row.reference_id, 'registro', 'diario'
      );
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.contab_encolar_pendiente(
        v_row.clinic_id, 'honorario_devengo', 'honorario_appointment', v_row.reference_id,
        v_row.monto_centavos, v_row.fecha_devengo, 'Honorario médico devengado',
        'registro', 'diario', NULL, SQLERRM
      );
    END;
  END LOOP;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.contab_factura_proveedor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_regla_sub record;
  v_regla_iva record;
  v_partidas jsonb;
BEGIN
  IF TG_OP = 'INSERT' AND COALESCE(NEW.total_centavos, 0) > 0 THEN
    INSERT INTO public.movimientos_contables
      (clinic_id, cuenta_id, origen, monto_centavos, fecha_devengo, fecha_pago,
       evento, reference_type, reference_id, descripcion, created_by)
    VALUES
      (NEW.clinic_id, public.cuenta_contable_id('503'), 'compra',
       NEW.total_centavos,
       COALESCE(NEW.fecha_factura, (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date),
       CASE WHEN COALESCE(NEW.saldo_pendiente_centavos, NEW.total_centavos) = 0
            THEN (now() AT TIME ZONE 'America/Mexico_City')::date END,
       'devengo', 'factura_proveedor', NEW.id,
       'Factura proveedor ' || COALESCE(NEW.folio_interno, NEW.id::text),
       NEW.created_by)
    ON CONFLICT (reference_type, reference_id, evento) WHERE reference_id IS NOT NULL
    DO NOTHING;

    BEGIN
      SELECT * INTO v_regla_sub FROM public.contab_resolver_regla(NEW.clinic_id, 'factura_proveedor_subtotal');
      IF v_regla_sub.cuenta_cargo_id IS NULL THEN
        RAISE EXCEPTION 'regla_no_encontrada: factura_proveedor_subtotal';
      END IF;

      v_partidas := jsonb_build_array(
        jsonb_build_object('cuenta_id', v_regla_sub.cuenta_cargo_id, 'debe_centavos', NEW.subtotal_centavos, 'haber_centavos', 0, 'descripcion', 'Subtotal factura')
      );

      IF COALESCE(NEW.iva_centavos, 0) > 0 THEN
        SELECT * INTO v_regla_iva FROM public.contab_resolver_regla(NEW.clinic_id, 'factura_proveedor_iva');
        IF v_regla_iva.cuenta_cargo_id IS NULL THEN
          RAISE EXCEPTION 'regla_no_encontrada: factura_proveedor_iva';
        END IF;
        v_partidas := v_partidas || jsonb_build_array(
          jsonb_build_object('cuenta_id', v_regla_iva.cuenta_cargo_id, 'debe_centavos', NEW.iva_centavos, 'haber_centavos', 0, 'descripcion', 'IVA acreditable')
        );
      END IF;

      v_partidas := v_partidas || jsonb_build_array(
        jsonb_build_object('cuenta_id', v_regla_sub.cuenta_abono_id, 'debe_centavos', 0, 'haber_centavos', NEW.total_centavos, 'descripcion', 'Proveedores')
      );

      PERFORM public.crear_poliza(jsonb_build_object(
        'clinic_id', NEW.clinic_id, 'tipo', 'diario',
        'fecha', COALESCE(NEW.fecha_factura, current_date),
        'concepto', 'Factura proveedor ' || COALESCE(NEW.folio_interno, NEW.id::text),
        'uuid_cfdi', NULLIF(NEW.uuid_sat, '')::uuid,
        'reference_type', 'factura_proveedor', 'reference_id', NEW.id, 'evento', 'registro',
        'partidas', v_partidas
      ));
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.contab_encolar_pendiente(
        NEW.clinic_id, 'factura_proveedor', 'factura_proveedor', NEW.id, NEW.total_centavos,
        COALESCE(NEW.fecha_factura, current_date),
        'Factura proveedor ' || COALESCE(NEW.folio_interno, NEW.id::text),
        'registro', 'diario',
        jsonb_build_object('subtotal_centavos', NEW.subtotal_centavos, 'iva_centavos', NEW.iva_centavos,
                            'total_centavos', NEW.total_centavos, 'uuid_cfdi', NEW.uuid_sat),
        SQLERRM
      );
    END;
  ELSIF TG_OP = 'UPDATE'
        AND COALESCE(NEW.saldo_pendiente_centavos, 1) = 0
        AND COALESCE(OLD.saldo_pendiente_centavos, 1) <> 0 THEN
    UPDATE public.movimientos_contables
    SET fecha_pago = (now() AT TIME ZONE 'America/Mexico_City')::date
    WHERE reference_type = 'factura_proveedor' AND reference_id = NEW.id
      AND evento = 'devengo' AND fecha_pago IS NULL;

    BEGIN
      PERFORM public.contab_generar_poliza_evento(
        NEW.clinic_id, 'pago_factura', NEW.total_centavos,
        (now() AT TIME ZONE 'America/Mexico_City')::date,
        'Pago factura ' || COALESCE(NEW.folio_interno, NEW.id::text),
        'factura_proveedor_pago', NEW.id, 'registro', 'egreso'
      );
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.contab_encolar_pendiente(
        NEW.clinic_id, 'pago_factura', 'factura_proveedor_pago', NEW.id, NEW.total_centavos,
        (now() AT TIME ZONE 'America/Mexico_City')::date,
        'Pago factura ' || COALESCE(NEW.folio_interno, NEW.id::text),
        'registro', 'egreso', NULL, SQLERRM
      );
    END;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.contab_movimiento_caja()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_evento text;
BEGIN
  IF NEW.estado = 'pagado' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'pagado')
     AND NEW.tipo IN ('cobro', 'ingreso') AND NEW.total > 0 THEN
    v_evento := CASE WHEN NEW.appointment_id IS NOT NULL THEN 'cobro_caja_consulta' ELSE 'cobro_caja_otros' END;

    INSERT INTO public.movimientos_contables
      (clinic_id, cuenta_id, origen, monto_centavos, fecha_devengo, fecha_pago,
       evento, reference_type, reference_id, descripcion, created_by)
    VALUES
      (NEW.clinic_id,
       public.cuenta_contable_id(CASE WHEN NEW.appointment_id IS NOT NULL THEN '401' ELSE '403' END),
       CASE WHEN NEW.appointment_id IS NOT NULL THEN 'consulta' ELSE 'manual' END,
       ROUND(NEW.total * 100)::bigint,
       (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date,
       (now() AT TIME ZONE 'America/Mexico_City')::date,
       'devengo', 'movimiento_caja', NEW.id,
       'Cobro caja folio ' || COALESCE(NEW.folio, NEW.id::text),
       NEW.cajero_user_id)
    ON CONFLICT (reference_type, reference_id, evento) WHERE reference_id IS NOT NULL
    DO NOTHING;

    BEGIN
      PERFORM public.contab_generar_poliza_evento(
        NEW.clinic_id, v_evento, ROUND(NEW.total * 100)::bigint,
        (now() AT TIME ZONE 'America/Mexico_City')::date,
        'Cobro caja folio ' || COALESCE(NEW.folio, NEW.id::text),
        'movimiento_caja', NEW.id, 'registro', 'ingreso'
      );
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.contab_encolar_pendiente(
        NEW.clinic_id, v_evento, 'movimiento_caja', NEW.id, ROUND(NEW.total * 100)::bigint,
        (now() AT TIME ZONE 'America/Mexico_City')::date,
        'Cobro caja folio ' || COALESCE(NEW.folio, NEW.id::text),
        'registro', 'ingreso', NULL, SQLERRM
      );
    END;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.contab_pharmacy_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_poliza_id uuid;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'cancelled' AND NEW.total > 0 THEN
    INSERT INTO public.movimientos_contables
      (clinic_id, cuenta_id, origen, monto_centavos, fecha_devengo, fecha_pago,
       evento, reference_type, reference_id, descripcion, created_by)
    VALUES
      (NEW.clinic_id, public.cuenta_contable_id('402'), 'farmacia',
       ROUND(NEW.total * 100)::bigint,
       (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date,
       (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date,
       'devengo', 'pharmacy_sale', NEW.id,
       'Venta farmacia', NEW.created_by)
    ON CONFLICT (reference_type, reference_id, evento) WHERE reference_id IS NOT NULL
    DO NOTHING;

    BEGIN
      PERFORM public.contab_generar_poliza_evento(
        NEW.clinic_id, 'venta_farmacia', ROUND(NEW.total * 100)::bigint,
        (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date,
        'Venta farmacia', 'pharmacy_sale', NEW.id, 'registro', 'ingreso'
      );
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.contab_encolar_pendiente(
        NEW.clinic_id, 'venta_farmacia', 'pharmacy_sale', NEW.id, ROUND(NEW.total * 100)::bigint,
        (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date, 'Venta farmacia',
        'registro', 'ingreso', NULL, SQLERRM
      );
    END;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    INSERT INTO public.movimientos_contables
      (clinic_id, cuenta_id, origen, monto_centavos, fecha_devengo, fecha_pago,
       evento, reference_type, reference_id, descripcion, created_by)
    SELECT clinic_id, cuenta_id, origen, -monto_centavos,
           (now() AT TIME ZONE 'America/Mexico_City')::date,
           (now() AT TIME ZONE 'America/Mexico_City')::date,
           'cancelacion', reference_type, reference_id,
           'Cancelación venta farmacia', auth.uid()
    FROM public.movimientos_contables
    WHERE reference_type = 'pharmacy_sale' AND reference_id = NEW.id AND evento = 'devengo'
    ON CONFLICT (reference_type, reference_id, evento) WHERE reference_id IS NOT NULL
    DO NOTHING;

    BEGIN
      SELECT id INTO v_poliza_id FROM public.polizas
      WHERE reference_type = 'pharmacy_sale' AND reference_id = NEW.id AND evento = 'registro' AND estado = 'contabilizada';
      IF v_poliza_id IS NOT NULL THEN
        PERFORM public.cancelar_poliza(v_poliza_id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.contab_encolar_pendiente(
        NEW.clinic_id, 'venta_farmacia_cancelacion', 'pharmacy_sale', NEW.id, NULL, current_date,
        'Cancelación venta farmacia', 'cancelacion', 'ingreso', NULL, SQLERRM
      );
    END;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.kpis_dashboard(p_clinic_id uuid, p_desde date, p_hasta date)
 RETURNS TABLE(ingresos_totales_centavos bigint, utilidad_bruta_centavos bigint, margen_bruto_pct numeric, utilidad_neta_centavos bigint, margen_neto_pct numeric, flujo_operativo_centavos bigint, punto_equilibrio_centavos bigint, cxp_vencidas_centavos bigint, cxc_pendientes_centavos bigint, costo_insumos_por_cita_centavos bigint, ingreso_promedio_consulta_centavos bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ingresos bigint;
  v_costo_ventas bigint;
  v_gastos_operativos bigint;
  v_gastos_fijos bigint;
  v_utilidad_bruta bigint;
  v_utilidad_neta bigint;
  v_margen_bruto_pct numeric;
  v_margen_neto_pct numeric;
  v_cobros bigint;
  v_pagos bigint;
  v_punto_equilibrio bigint;
  v_cxp bigint;
  v_cxc bigint;
  v_costo_insumos_neto bigint;
  v_citas_con_consumo bigint;
  v_ingresos_consulta bigint;
  v_citas_atendidas bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = p_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(SUM(mc.monto_centavos), 0) INTO v_ingresos
  FROM public.movimientos_contables mc
  JOIN public.cuentas_contables cc ON cc.id = mc.cuenta_id
  WHERE mc.clinic_id = p_clinic_id AND cc.tipo = 'ingreso'
    AND mc.fecha_devengo BETWEEN p_desde AND p_hasta;

  SELECT COALESCE(SUM(CASE WHEN ai.tipo = 'consumo' THEN ai.costo_unitario_centavos * ai.cantidad
                            ELSE -ai.costo_unitario_centavos * ai.cantidad END), 0)
  INTO v_costo_ventas
  FROM public.appointment_insumos ai
  WHERE ai.clinic_id = p_clinic_id AND ai.created_at::date BETWEEN p_desde AND p_hasta;

  SELECT COALESCE(SUM(mc.monto_centavos), 0) INTO v_gastos_operativos
  FROM public.movimientos_contables mc
  JOIN public.cuentas_contables cc ON cc.id = mc.cuenta_id
  WHERE mc.clinic_id = p_clinic_id AND cc.tipo = 'egreso' AND cc.codigo <> '503'
    AND mc.fecha_devengo BETWEEN p_desde AND p_hasta;

  SELECT COALESCE(SUM(mc.monto_centavos), 0) INTO v_gastos_fijos
  FROM public.movimientos_contables mc
  JOIN public.cuentas_contables cc ON cc.id = mc.cuenta_id
  WHERE mc.clinic_id = p_clinic_id AND cc.tipo = 'egreso' AND cc.es_fijo
    AND mc.fecha_devengo BETWEEN p_desde AND p_hasta;

  v_utilidad_bruta := v_ingresos - v_costo_ventas;
  v_utilidad_neta := v_utilidad_bruta - v_gastos_operativos;
  v_margen_bruto_pct := CASE WHEN v_ingresos = 0 THEN NULL ELSE ROUND(v_utilidad_bruta::numeric / v_ingresos * 100, 2) END;
  v_margen_neto_pct := CASE WHEN v_ingresos = 0 THEN NULL ELSE ROUND(v_utilidad_neta::numeric / v_ingresos * 100, 2) END;

  SELECT COALESCE(SUM(mc.monto_centavos) FILTER (WHERE cc.tipo = 'ingreso'), 0),
         COALESCE(SUM(mc.monto_centavos) FILTER (WHERE cc.tipo = 'egreso'), 0)
  INTO v_cobros, v_pagos
  FROM public.movimientos_contables mc
  JOIN public.cuentas_contables cc ON cc.id = mc.cuenta_id
  WHERE mc.clinic_id = p_clinic_id AND mc.fecha_pago BETWEEN p_desde AND p_hasta;

  v_punto_equilibrio := CASE
    WHEN v_margen_bruto_pct IS NULL OR v_margen_bruto_pct <= 0 THEN NULL
    ELSE ROUND(v_gastos_fijos::numeric / (v_margen_bruto_pct / 100))::bigint
  END;

  SELECT COALESCE(SUM(fp.saldo_pendiente_centavos), 0) INTO v_cxp
  FROM public.facturas_proveedor fp
  WHERE fp.clinic_id = p_clinic_id AND fp.saldo_pendiente_centavos > 0
    AND fp.fecha_vencimiento < current_date;

  SELECT
    COALESCE((SELECT SUM(ROUND(ps.total * 100)) FROM public.pharmacy_sales ps
              WHERE ps.clinic_id = p_clinic_id AND ps.payment_status = 'pending' AND ps.status <> 'cancelled'), 0)
    +
    COALESCE((SELECT SUM(ROUND(m.total * 100)) FROM public.movimientos m
              WHERE m.clinic_id = p_clinic_id AND m.estado IN ('parcial', 'borrador') AND m.total > 0), 0)
  INTO v_cxc;

  SELECT
    COALESCE(SUM(CASE WHEN ai.tipo = 'consumo' THEN ai.costo_unitario_centavos * ai.cantidad
                       ELSE -ai.costo_unitario_centavos * ai.cantidad END), 0),
    COUNT(DISTINCT ai.appointment_id) FILTER (WHERE ai.tipo = 'consumo')
  INTO v_costo_insumos_neto, v_citas_con_consumo
  FROM public.appointment_insumos ai
  WHERE ai.clinic_id = p_clinic_id AND ai.created_at::date BETWEEN p_desde AND p_hasta;

  SELECT COALESCE(SUM(mc.monto_centavos), 0) INTO v_ingresos_consulta
  FROM public.movimientos_contables mc
  JOIN public.cuentas_contables cc ON cc.id = mc.cuenta_id
  WHERE mc.clinic_id = p_clinic_id AND cc.codigo = '401'
    AND mc.fecha_devengo BETWEEN p_desde AND p_hasta;

  SELECT COUNT(DISTINCT m.appointment_id) INTO v_citas_atendidas
  FROM public.movimientos_contables mc
  JOIN public.movimientos m ON m.id = mc.reference_id AND mc.reference_type = 'movimiento_caja'
  WHERE mc.clinic_id = p_clinic_id AND mc.fecha_devengo BETWEEN p_desde AND p_hasta
    AND m.appointment_id IS NOT NULL;

  RETURN QUERY SELECT
    v_ingresos,
    v_utilidad_bruta,
    v_margen_bruto_pct,
    v_utilidad_neta,
    v_margen_neto_pct,
    (v_cobros - v_pagos)::bigint,
    v_punto_equilibrio,
    v_cxp,
    v_cxc,
    CASE WHEN v_citas_con_consumo = 0 THEN NULL ELSE ROUND(v_costo_insumos_neto::numeric / v_citas_con_consumo)::bigint END,
    CASE WHEN v_citas_atendidas = 0 THEN NULL ELSE ROUND(v_ingresos_consulta::numeric / v_citas_atendidas)::bigint END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pnl_mensual(p_clinic_id uuid, p_desde date, p_hasta date)
 RETURNS TABLE(mes date, ingresos_centavos bigint, costo_ventas_centavos bigint, utilidad_bruta_centavos bigint, gastos_operativos_centavos bigint, utilidad_neta_centavos bigint, margen_bruto_pct numeric, margen_neto_pct numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = p_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH meses AS (
    SELECT generate_series(date_trunc('month', p_desde), date_trunc('month', p_hasta), interval '1 month')::date AS mes
  ),
  ingresos AS (
    SELECT date_trunc('month', mc.fecha_devengo)::date AS mes, SUM(mc.monto_centavos) AS total
    FROM public.movimientos_contables mc
    JOIN public.cuentas_contables cc ON cc.id = mc.cuenta_id
    WHERE mc.clinic_id = p_clinic_id AND cc.tipo = 'ingreso'
      AND mc.fecha_devengo BETWEEN p_desde AND p_hasta
    GROUP BY 1
  ),
  costos AS (
    SELECT date_trunc('month', ai.created_at)::date AS mes,
           SUM(CASE WHEN ai.tipo = 'consumo' THEN ai.costo_unitario_centavos * ai.cantidad
                    ELSE -ai.costo_unitario_centavos * ai.cantidad END) AS total
    FROM public.appointment_insumos ai
    WHERE ai.clinic_id = p_clinic_id
      AND ai.created_at::date BETWEEN p_desde AND p_hasta
    GROUP BY 1
  ),
  gastos AS (
    SELECT date_trunc('month', mc.fecha_devengo)::date AS mes, SUM(mc.monto_centavos) AS total
    FROM public.movimientos_contables mc
    JOIN public.cuentas_contables cc ON cc.id = mc.cuenta_id
    WHERE mc.clinic_id = p_clinic_id AND cc.tipo = 'egreso' AND cc.codigo <> '503'
      AND mc.fecha_devengo BETWEEN p_desde AND p_hasta
    GROUP BY 1
  )
  SELECT
    m.mes,
    COALESCE(i.total, 0)::bigint AS ingresos_centavos,
    COALESCE(c.total, 0)::bigint AS costo_ventas_centavos,
    (COALESCE(i.total, 0) - COALESCE(c.total, 0))::bigint AS utilidad_bruta_centavos,
    COALESCE(g.total, 0)::bigint AS gastos_operativos_centavos,
    (COALESCE(i.total, 0) - COALESCE(c.total, 0) - COALESCE(g.total, 0))::bigint AS utilidad_neta_centavos,
    CASE WHEN COALESCE(i.total, 0) = 0 THEN NULL
         ELSE ROUND((COALESCE(i.total, 0) - COALESCE(c.total, 0))::numeric / i.total * 100, 2) END AS margen_bruto_pct,
    CASE WHEN COALESCE(i.total, 0) = 0 THEN NULL
         ELSE ROUND((COALESCE(i.total, 0) - COALESCE(c.total, 0) - COALESCE(g.total, 0))::numeric / i.total * 100, 2) END AS margen_neto_pct
  FROM meses m
  LEFT JOIN ingresos i ON i.mes = m.mes
  LEFT JOIN costos c ON c.mes = m.mes
  LEFT JOIN gastos g ON g.mes = m.mes
  ORDER BY m.mes;
END;
$function$;
