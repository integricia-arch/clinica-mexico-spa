-- Módulo Contable — Fase 4: reportes y KPIs.
-- Plan: docs/superpowers/plans/2026-07-18-modulo-contable.md (Fase 4, tabla de KPIs sección 2)
--
-- 0. Fix MEDIUM heredado de review de Fase 3: los triggers SECURITY DEFINER de
--    20260718170000 no tenían REVOKE FROM PUBLIC explícito (checklist del
--    repo, CLAUDE.md sección "SECURITY DEFINER").
REVOKE EXECUTE ON FUNCTION public.contab_movimiento_caja() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.contab_pharmacy_sale() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.contab_factura_proveedor() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 1. pnl_mensual — Estado de resultados por mes.
--
-- Limitación documentada: costo_ventas_centavos solo incluye insumos
-- consumidos en citas (appointment_insumos, costo snapshot). El costo de
-- medicamentos vendidos en farmacia NO se deriva aquí: pharmacy_sales no
-- guarda un costo unitario snapshot ligado limpiamente a movimientos_inventario
-- en una sola query (movimientos_inventario es de medicamentos completos, sin
-- referencia directa y consistente a pharmacy_sale_items). Se deja para una
-- fase posterior si se agrega ese snapshot de costo en la venta de farmacia.
-- gastos_operativos_centavos = todos los egresos devengados EXCEPTO compras a
-- proveedor (EGR_COMPRAS) — honorarios + fijos + manuales.
-- ---------------------------------------------------------------------------
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
    WHERE mc.clinic_id = p_clinic_id AND cc.tipo = 'egreso' AND cc.codigo <> 'EGR_COMPRAS'
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

REVOKE EXECUTE ON FUNCTION public.pnl_mensual(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pnl_mensual(uuid, date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. flujo_efectivo — cobros/pagos reales por mes (base fecha_pago, no devengo).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.flujo_efectivo(p_clinic_id uuid, p_desde date, p_hasta date)
RETURNS TABLE (
  mes date,
  cobros_centavos bigint,
  pagos_centavos bigint,
  flujo_neto_centavos bigint
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
    SELECT generate_series(date_trunc('month', p_desde), date_trunc('month', p_hasta), interval '1 month')::date AS mes
  ),
  cobros AS (
    SELECT date_trunc('month', mc.fecha_pago)::date AS mes, SUM(mc.monto_centavos) AS total
    FROM public.movimientos_contables mc
    JOIN public.cuentas_contables cc ON cc.id = mc.cuenta_id
    WHERE mc.clinic_id = p_clinic_id AND cc.tipo = 'ingreso'
      AND mc.fecha_pago BETWEEN p_desde AND p_hasta
    GROUP BY 1
  ),
  pagos AS (
    SELECT date_trunc('month', mc.fecha_pago)::date AS mes, SUM(mc.monto_centavos) AS total
    FROM public.movimientos_contables mc
    JOIN public.cuentas_contables cc ON cc.id = mc.cuenta_id
    WHERE mc.clinic_id = p_clinic_id AND cc.tipo = 'egreso'
      AND mc.fecha_pago BETWEEN p_desde AND p_hasta
    GROUP BY 1
  )
  SELECT
    m.mes,
    COALESCE(co.total, 0)::bigint AS cobros_centavos,
    COALESCE(p.total, 0)::bigint AS pagos_centavos,
    (COALESCE(co.total, 0) - COALESCE(p.total, 0))::bigint AS flujo_neto_centavos
  FROM meses m
  LEFT JOIN cobros co ON co.mes = m.mes
  LEFT JOIN pagos p ON p.mes = m.mes
  ORDER BY m.mes;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.flujo_efectivo(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flujo_efectivo(uuid, date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. kpis_dashboard — una fila con los KPIs mínimos del período.
--
-- cxp_vencidas_centavos / cxc_pendientes_centavos son snapshot "hoy" (estado
-- actual de saldos), no se acotan a p_desde/p_hasta — una factura vencida
-- sigue vencida sin importar el período del dashboard.
-- cxc_pendientes_centavos combina: pharmacy_sales.payment_status='pending'
-- (venta de farmacia sin cobrar, status<>'cancelled') + movimientos.estado
-- IN ('parcial','borrador') con total>0 (cobro de caja iniciado sin cerrar).
-- Valores inspeccionados en producción: pharmacy_sales.payment_status ∈
-- {pending,paid,invoiced}; movimientos.estado ∈ {borrador,pagado,cancelado,parcial}.
-- punto_equilibrio_centavos = gastos fijos del período / margen de contribución
-- (= margen_bruto_pct/100). Si el margen bruto es <= 0, no hay punto de
-- equilibrio calculable (aumentar ventas nunca cubre gastos fijos) → NULL.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kpis_dashboard(p_clinic_id uuid, p_desde date, p_hasta date)
RETURNS TABLE (
  ingresos_totales_centavos bigint,
  utilidad_bruta_centavos bigint,
  margen_bruto_pct numeric,
  utilidad_neta_centavos bigint,
  margen_neto_pct numeric,
  flujo_operativo_centavos bigint,
  punto_equilibrio_centavos bigint,
  cxp_vencidas_centavos bigint,
  cxc_pendientes_centavos bigint,
  costo_insumos_por_cita_centavos bigint,
  ingreso_promedio_consulta_centavos bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  WHERE mc.clinic_id = p_clinic_id AND cc.tipo = 'egreso' AND cc.codigo <> 'EGR_COMPRAS'
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
  WHERE mc.clinic_id = p_clinic_id AND cc.codigo = 'ING_CONSULTAS'
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

REVOKE EXECUTE ON FUNCTION public.kpis_dashboard(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kpis_dashboard(uuid, date, date) TO authenticated;
