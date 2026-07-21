-- Farmacia COGS (pendiente #4, memoria técnica §5.1). El gap estaba documentado
-- como "movimientos_inventario no guarda costo ligado limpiamente a la venta" --
-- ya no es cierto: pharmacy_register_sale() (fase previa) ya inserta
-- movimientos_inventario con reference_type='pharmacy_sale'/reference_id=sale_id
-- y lote_id, y lotes_medicamento.costo_unitario_centavos ya existe (snapshot de
-- compra). Solo faltaba usar ese dato. Cierra el gap en ambos sistemas: partida
-- doble (póliza nueva) y devengo simple (pnl_mensual/kpis_dashboard).

-- 1. Regla de asiento: 502 Costo de farmacia / 115.02 Almacén-Medicamentos.
INSERT INTO public.contab_reglas_asiento (clinic_id, evento, cuenta_cargo_id, cuenta_abono_id, activo)
SELECT c.id, 'costo_venta_farmacia', public.cuenta_contable_id('502'), public.cuenta_contable_id('115.02'), true
FROM public.clinics c
WHERE NOT EXISTS (
  SELECT 1 FROM public.contab_reglas_asiento r
  WHERE r.clinic_id = c.id AND r.evento = 'costo_venta_farmacia'
);

-- 2. Trigger: por cada salida de inventario ligada a una venta de farmacia,
--    genera la póliza de costo. Simétrico a contab_consumo_insumo (fase 10).
--    No hay reversión automática si se cancela la venta -- mismo alcance que
--    consumo_insumo ya tiene hoy (no se ataca aquí, es límite preexistente).
CREATE OR REPLACE FUNCTION public.contab_costo_venta_farmacia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_costo_unitario bigint;
  v_monto bigint;
BEGIN
  IF NEW.reference_type = 'pharmacy_sale' AND NEW.tipo IN ('salida_venta', 'salida_surtido_receta') THEN
    SELECT costo_unitario_centavos INTO v_costo_unitario
    FROM public.lotes_medicamento WHERE id = NEW.lote_id;

    IF COALESCE(v_costo_unitario, 0) > 0 AND NEW.cantidad > 0 THEN
      v_monto := v_costo_unitario * NEW.cantidad;
      BEGIN
        PERFORM public.contab_generar_poliza_evento(
          NEW.clinic_id, 'costo_venta_farmacia', v_monto,
          (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date,
          'Costo de venta de farmacia', 'movimiento_inventario_farmacia', NEW.id, 'registro', 'diario'
        );
      EXCEPTION WHEN OTHERS THEN
        PERFORM public.contab_encolar_pendiente(
          NEW.clinic_id, 'costo_venta_farmacia', 'movimiento_inventario_farmacia', NEW.id, v_monto,
          (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date, 'Costo de venta de farmacia',
          'registro', 'diario', NULL, SQLERRM
        );
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_contab_costo_venta_farmacia ON public.movimientos_inventario;
CREATE TRIGGER trg_contab_costo_venta_farmacia
  AFTER INSERT ON public.movimientos_inventario
  FOR EACH ROW EXECUTE FUNCTION public.contab_costo_venta_farmacia();

REVOKE EXECUTE ON FUNCTION public.contab_costo_venta_farmacia() FROM PUBLIC, anon, authenticated;

-- 3. Devengo simple: pnl_mensual() y kpis_dashboard() sumaban costo_ventas
--    SOLO de appointment_insumos. Se agrega el costo de farmacia con la misma
--    fuente que usa el trigger (movimientos_inventario + lotes_medicamento).
--    Devoluciones (tipo='entrada_devolucion') no llevan reference_type propio
--    en el esquema actual -- no se netean contra la venta original aquí, límite
--    conocido, no bloquea el cierre del gap principal (costo nunca contado).
CREATE OR REPLACE FUNCTION public.pnl_mensual(p_clinic_id uuid, p_desde date, p_hasta date)
RETURNS TABLE (
  mes date,
  ingresos_centavos bigint,
  costo_ventas_centavos bigint,
  utilidad_bruta_centavos bigint,
  gastos_operativos_centavos bigint,
  utilidad_neta_centavos bigint,
  margen_bruto_pct numeric,
  margen_neto_pct numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    SELECT generate_series(date_trunc('month', p_desde), date_trunc('month', p_hasta), '1 month'::interval)::date AS mes
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
    WHERE ai.clinic_id = p_clinic_id AND ai.created_at::date BETWEEN p_desde AND p_hasta
    GROUP BY 1
  ),
  costos_farmacia AS (
    SELECT date_trunc('month', mi.created_at)::date AS mes,
           SUM(mi.cantidad * lm.costo_unitario_centavos) AS total
    FROM public.movimientos_inventario mi
    JOIN public.lotes_medicamento lm ON lm.id = mi.lote_id
    WHERE mi.clinic_id = p_clinic_id AND mi.reference_type = 'pharmacy_sale'
      AND mi.tipo IN ('salida_venta', 'salida_surtido_receta')
      AND mi.created_at::date BETWEEN p_desde AND p_hasta
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
    (COALESCE(c.total, 0) + COALESCE(cf.total, 0))::bigint AS costo_ventas_centavos,
    (COALESCE(i.total, 0) - COALESCE(c.total, 0) - COALESCE(cf.total, 0))::bigint AS utilidad_bruta_centavos,
    COALESCE(g.total, 0)::bigint AS gastos_operativos_centavos,
    (COALESCE(i.total, 0) - COALESCE(c.total, 0) - COALESCE(cf.total, 0) - COALESCE(g.total, 0))::bigint AS utilidad_neta_centavos,
    CASE WHEN COALESCE(i.total, 0) = 0 THEN NULL
         ELSE ROUND((COALESCE(i.total, 0) - COALESCE(c.total, 0) - COALESCE(cf.total, 0))::numeric / i.total * 100, 2) END AS margen_bruto_pct,
    CASE WHEN COALESCE(i.total, 0) = 0 THEN NULL
         ELSE ROUND((COALESCE(i.total, 0) - COALESCE(c.total, 0) - COALESCE(cf.total, 0) - COALESCE(g.total, 0))::numeric / i.total * 100, 2) END AS margen_neto_pct
  FROM meses m
  LEFT JOIN ingresos i ON i.mes = m.mes
  LEFT JOIN costos c ON c.mes = m.mes
  LEFT JOIN costos_farmacia cf ON cf.mes = m.mes
  LEFT JOIN gastos g ON g.mes = m.mes
  ORDER BY m.mes;
END;
$function$;

-- 4. kpis_dashboard() mismo gap, mismo fix (v_costo_ventas).
CREATE OR REPLACE FUNCTION public.kpis_dashboard(p_clinic_id uuid, p_desde date, p_hasta date)
RETURNS TABLE(ingresos_totales_centavos bigint, utilidad_bruta_centavos bigint, margen_bruto_pct numeric, utilidad_neta_centavos bigint, margen_neto_pct numeric, flujo_operativo_centavos bigint, punto_equilibrio_centavos bigint, cxp_vencidas_centavos bigint, cxc_pendientes_centavos bigint, costo_insumos_por_cita_centavos bigint, ingreso_promedio_consulta_centavos bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ingresos bigint;
  v_costo_ventas bigint;
  v_costo_farmacia bigint;
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

  SELECT COALESCE(SUM(mi.cantidad * lm.costo_unitario_centavos), 0) INTO v_costo_farmacia
  FROM public.movimientos_inventario mi
  JOIN public.lotes_medicamento lm ON lm.id = mi.lote_id
  WHERE mi.clinic_id = p_clinic_id AND mi.reference_type = 'pharmacy_sale'
    AND mi.tipo IN ('salida_venta', 'salida_surtido_receta')
    AND mi.created_at::date BETWEEN p_desde AND p_hasta;

  v_costo_ventas := v_costo_ventas + v_costo_farmacia;

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
