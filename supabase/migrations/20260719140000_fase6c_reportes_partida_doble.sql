-- Módulo Contable — Fase 6C: reportes en vivo sobre partida doble (pólizas).
-- Plan: docs/superpowers/plans/2026-07-19-fase6-partida-doble.md (sección 6C)
--
-- LECCIÓN 6B (checklist SECURITY DEFINER, CLAUDE.md): en Supabase
-- ALTER DEFAULT PRIVILEGES da EXECUTE directo a anon/authenticated —
-- REVOKE FROM PUBLIC a secas NO lo revoca. Todo REVOKE aquí es explícito
-- FROM PUBLIC, anon, authenticated, con GRANT posterior solo a authenticated.
--
-- Nota de diseño: las partidas de pólizas canceladas NUNCA se excluyen de las
-- sumas — la cancelación es una póliza de reversa (crear_poliza), no un
-- UPDATE/DELETE. Filtrar por estado='contabilizada' rompería la partida doble
-- (dejaría el cargo/abono original sin su reversa compensando).

-- ---------------------------------------------------------------------------
-- 1. balanza_comprobacion — saldo inicial/cargos/abonos/saldo final por cuenta.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.balanza_comprobacion(p_clinic_id uuid, p_desde date, p_hasta date)
RETURNS TABLE (
  cuenta_id uuid,
  codigo text,
  nombre text,
  tipo text,
  naturaleza text,
  saldo_inicial_centavos bigint,
  cargos_centavos bigint,
  abonos_centavos bigint,
  saldo_final_centavos bigint
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
  WITH previo AS (
    SELECT pp.cuenta_id, SUM(pp.debe_centavos) AS debe, SUM(pp.haber_centavos) AS haber
    FROM public.poliza_partidas pp
    JOIN public.polizas p ON p.id = pp.poliza_id
    WHERE p.clinic_id = p_clinic_id AND p.fecha < p_desde
    GROUP BY pp.cuenta_id
  ),
  periodo AS (
    SELECT pp.cuenta_id, SUM(pp.debe_centavos) AS debe, SUM(pp.haber_centavos) AS haber
    FROM public.poliza_partidas pp
    JOIN public.polizas p ON p.id = pp.poliza_id
    WHERE p.clinic_id = p_clinic_id AND p.fecha BETWEEN p_desde AND p_hasta
    GROUP BY pp.cuenta_id
  )
  SELECT
    cc.id,
    cc.codigo,
    cc.nombre,
    cc.tipo,
    cc.naturaleza,
    (CASE WHEN cc.naturaleza = 'deudora'
          THEN COALESCE(pv.debe, 0) - COALESCE(pv.haber, 0)
          ELSE COALESCE(pv.haber, 0) - COALESCE(pv.debe, 0) END)::bigint AS saldo_inicial_centavos,
    COALESCE(pe.debe, 0)::bigint AS cargos_centavos,
    COALESCE(pe.haber, 0)::bigint AS abonos_centavos,
    (CASE WHEN cc.naturaleza = 'deudora'
          THEN (COALESCE(pv.debe, 0) - COALESCE(pv.haber, 0)) + (COALESCE(pe.debe, 0) - COALESCE(pe.haber, 0))
          ELSE (COALESCE(pv.haber, 0) - COALESCE(pv.debe, 0)) + (COALESCE(pe.haber, 0) - COALESCE(pe.debe, 0)) END)::bigint AS saldo_final_centavos
  FROM public.cuentas_contables cc
  LEFT JOIN previo pv ON pv.cuenta_id = cc.id
  LEFT JOIN periodo pe ON pe.cuenta_id = cc.id
  WHERE COALESCE(pv.debe, 0) <> 0 OR COALESCE(pv.haber, 0) <> 0
     OR COALESCE(pe.debe, 0) <> 0 OR COALESCE(pe.haber, 0) <> 0
  ORDER BY cc.codigo;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.balanza_comprobacion(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.balanza_comprobacion(uuid, date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. libro_diario — pólizas con sus partidas, ordenadas por fecha/folio/orden.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.libro_diario(p_clinic_id uuid, p_desde date, p_hasta date)
RETURNS TABLE (
  poliza_id uuid,
  folio integer,
  tipo text,
  fecha date,
  concepto text,
  estado text,
  orden integer,
  cuenta_codigo text,
  cuenta_nombre text,
  debe_centavos bigint,
  haber_centavos bigint,
  descripcion text
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
  SELECT p.id, p.folio, p.tipo, p.fecha, p.concepto, p.estado,
         pp.orden, cc.codigo, cc.nombre, pp.debe_centavos, pp.haber_centavos, pp.descripcion
  FROM public.polizas p
  JOIN public.poliza_partidas pp ON pp.poliza_id = p.id
  JOIN public.cuentas_contables cc ON cc.id = pp.cuenta_id
  WHERE p.clinic_id = p_clinic_id AND p.fecha BETWEEN p_desde AND p_hasta
  ORDER BY p.fecha, p.tipo, p.folio, pp.orden;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.libro_diario(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.libro_diario(uuid, date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. auxiliares_cuenta — movimientos de una cuenta con saldo acumulado (mayor).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auxiliares_cuenta(p_clinic_id uuid, p_cuenta_id uuid, p_desde date, p_hasta date)
RETURNS TABLE (
  poliza_id uuid,
  folio integer,
  fecha date,
  concepto text,
  debe_centavos bigint,
  haber_centavos bigint,
  saldo_acumulado_centavos bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_naturaleza text;
  v_saldo_inicial bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = p_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT naturaleza INTO v_naturaleza FROM public.cuentas_contables WHERE id = p_cuenta_id;
  IF v_naturaleza IS NULL THEN
    RAISE EXCEPTION 'cuenta_no_encontrada';
  END IF;

  SELECT CASE WHEN v_naturaleza = 'deudora'
              THEN COALESCE(SUM(pp.debe_centavos), 0) - COALESCE(SUM(pp.haber_centavos), 0)
              ELSE COALESCE(SUM(pp.haber_centavos), 0) - COALESCE(SUM(pp.debe_centavos), 0) END
  INTO v_saldo_inicial
  FROM public.poliza_partidas pp
  JOIN public.polizas p ON p.id = pp.poliza_id
  WHERE p.clinic_id = p_clinic_id AND pp.cuenta_id = p_cuenta_id AND p.fecha < p_desde;

  RETURN QUERY
  WITH movs AS (
    SELECT p.id AS poliza_id, p.folio, p.fecha, p.concepto,
           pp.debe_centavos, pp.haber_centavos, pp.orden
    FROM public.poliza_partidas pp
    JOIN public.polizas p ON p.id = pp.poliza_id
    WHERE p.clinic_id = p_clinic_id AND pp.cuenta_id = p_cuenta_id AND p.fecha BETWEEN p_desde AND p_hasta
  )
  SELECT
    m.poliza_id, m.folio, m.fecha, m.concepto, m.debe_centavos, m.haber_centavos,
    (v_saldo_inicial + SUM(
      CASE WHEN v_naturaleza = 'deudora' THEN m.debe_centavos - m.haber_centavos
           ELSE m.haber_centavos - m.debe_centavos END
    ) OVER (ORDER BY m.fecha, m.folio, m.orden ROWS UNBOUNDED PRECEDING))::bigint AS saldo_acumulado_centavos
  FROM movs m
  ORDER BY m.fecha, m.folio, m.orden;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.auxiliares_cuenta(uuid, uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auxiliares_cuenta(uuid, uuid, date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. estado_resultados — movimiento neto del período por cuenta de ingreso/egreso.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estado_resultados(p_clinic_id uuid, p_desde date, p_hasta date)
RETURNS TABLE (
  cuenta_id uuid,
  codigo text,
  nombre text,
  tipo text,
  monto_centavos bigint
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
  SELECT
    cc.id, cc.codigo, cc.nombre, cc.tipo,
    (CASE WHEN cc.naturaleza = 'deudora'
          THEN COALESCE(SUM(pp.debe_centavos), 0) - COALESCE(SUM(pp.haber_centavos), 0)
          ELSE COALESCE(SUM(pp.haber_centavos), 0) - COALESCE(SUM(pp.debe_centavos), 0) END)::bigint AS monto_centavos
  FROM public.cuentas_contables cc
  JOIN public.poliza_partidas pp ON pp.cuenta_id = cc.id
  JOIN public.polizas p ON p.id = pp.poliza_id
  WHERE p.clinic_id = p_clinic_id AND p.fecha BETWEEN p_desde AND p_hasta
    AND cc.tipo IN ('ingreso', 'egreso')
  GROUP BY cc.id, cc.codigo, cc.nombre, cc.tipo, cc.naturaleza
  ORDER BY cc.codigo;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.estado_resultados(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estado_resultados(uuid, date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. balance_general — saldo acumulado (histórico completo hasta p_al) por
--    cuenta de activo/pasivo/capital.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.balance_general(p_clinic_id uuid, p_al date)
RETURNS TABLE (
  cuenta_id uuid,
  codigo text,
  nombre text,
  tipo text,
  saldo_centavos bigint
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
  SELECT
    cc.id, cc.codigo, cc.nombre, cc.tipo,
    (CASE WHEN cc.naturaleza = 'deudora'
          THEN COALESCE(SUM(pp.debe_centavos), 0) - COALESCE(SUM(pp.haber_centavos), 0)
          ELSE COALESCE(SUM(pp.haber_centavos), 0) - COALESCE(SUM(pp.debe_centavos), 0) END)::bigint AS saldo_centavos
  FROM public.cuentas_contables cc
  JOIN public.poliza_partidas pp ON pp.cuenta_id = cc.id
  JOIN public.polizas p ON p.id = pp.poliza_id
  WHERE p.clinic_id = p_clinic_id AND p.fecha <= p_al
    AND cc.tipo IN ('activo', 'pasivo', 'capital')
  GROUP BY cc.id, cc.codigo, cc.nombre, cc.tipo, cc.naturaleza
  ORDER BY cc.codigo;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.balance_general(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.balance_general(uuid, date) TO authenticated;
