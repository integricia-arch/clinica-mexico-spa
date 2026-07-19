-- Módulo Contable — Fase 7: cierre mensual y control.
-- Plan: docs/superpowers/plans/2026-07-19-modulo-contable-completo.md (sección 4, Fase 7)

-- ---------------------------------------------------------------------------
-- 1. contab_cierres — un registro por clínica+mes cerrado.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contab_cierres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  periodo date NOT NULL, -- siempre primer día del mes
  poliza_cierre_id uuid REFERENCES public.polizas(id),
  cerrado_by uuid DEFAULT auth.uid(),
  cerrado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_contab_cierres_periodo UNIQUE (clinic_id, periodo)
);

ALTER TABLE public.contab_cierres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read contab_cierres" ON public.contab_cierres;
CREATE POLICY "Members read contab_cierres"
  ON public.contab_cierres FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND clinic_id = contab_cierres.clinic_id
    )
  );
-- Sin policies de escritura: solo RPC cierre_mensual (SECURITY DEFINER).

-- ---------------------------------------------------------------------------
-- 2. Candado de período: crear_poliza rechaza fecha dentro de un período
--    cerrado (cerrado_at IS NOT NULL). Se re-crea completa (CREATE OR REPLACE
--    no permite insertar solo el bloque nuevo) — cuerpo idéntico a 6A/6B más
--    el chequeo del candado, insertado antes del folio atómico.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_poliza(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_clinic_id uuid := (p_payload->>'clinic_id')::uuid;
  v_tipo text := p_payload->>'tipo';
  v_reference_type text := p_payload->>'reference_type';
  v_reference_id uuid := NULLIF(p_payload->>'reference_id', '')::uuid;
  v_evento text := COALESCE(p_payload->>'evento', 'registro');
  v_fecha date := COALESCE((p_payload->>'fecha')::date, current_date);
  v_partidas jsonb := p_payload->'partidas';
  v_partida jsonb;
  v_folio integer;
  v_poliza_id uuid;
  v_suma_debe bigint := 0;
  v_suma_haber bigint := 0;
  v_orden integer := 0;
BEGIN
  IF v_clinic_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_tipo NOT IN ('ingreso', 'egreso', 'diario') THEN
    RAISE EXCEPTION 'tipo_poliza_invalido: %', v_tipo;
  END IF;

  IF v_partidas IS NULL OR jsonb_array_length(v_partidas) < 2 THEN
    RAISE EXCEPTION 'poliza_requiere_al_menos_2_partidas';
  END IF;

  IF v_reference_type IS NOT NULL AND v_reference_id IS NOT NULL THEN
    SELECT id INTO v_poliza_id FROM public.polizas
    WHERE reference_type = v_reference_type AND reference_id = v_reference_id AND evento = v_evento;
    IF v_poliza_id IS NOT NULL THEN
      RETURN v_poliza_id;
    END IF;
  END IF;

  -- Candado de período (Fase 7): rechaza pólizas nuevas con fecha en un mes
  -- ya cerrado. cierre_mensual crea su propia póliza de cierre ANTES de
  -- marcar el período como cerrado, así que no se autobloquea.
  IF EXISTS (
    SELECT 1 FROM public.contab_cierres cc
    WHERE cc.clinic_id = v_clinic_id AND cc.cerrado_at IS NOT NULL
      AND cc.periodo = date_trunc('month', v_fecha)::date
  ) THEN
    RAISE EXCEPTION 'periodo_cerrado: % está cerrado, usa una fecha del período abierto', to_char(v_fecha, 'YYYY-MM');
  END IF;

  FOR v_partida IN SELECT * FROM jsonb_array_elements(v_partidas)
  LOOP
    DECLARE
      v_debe bigint := COALESCE((v_partida->>'debe_centavos')::bigint, 0);
      v_haber bigint := COALESCE((v_partida->>'haber_centavos')::bigint, 0);
    BEGIN
      IF v_partida->>'cuenta_id' IS NULL THEN
        RAISE EXCEPTION 'partida_sin_cuenta_id';
      END IF;
      IF NOT ((v_debe > 0 AND v_haber = 0) OR (v_haber > 0 AND v_debe = 0)) THEN
        RAISE EXCEPTION 'partida_debe_tener_exactamente_un_lado_positivo';
      END IF;
      v_suma_debe := v_suma_debe + v_debe;
      v_suma_haber := v_suma_haber + v_haber;
    END;
  END LOOP;

  IF v_suma_debe <> v_suma_haber THEN
    RAISE EXCEPTION 'poliza_desbalanceada: debe=% haber=%', v_suma_debe, v_suma_haber;
  END IF;

  INSERT INTO public.poliza_folios (clinic_id, tipo, ultimo_folio)
  VALUES (v_clinic_id, v_tipo, 1)
  ON CONFLICT (clinic_id, tipo) DO UPDATE SET ultimo_folio = public.poliza_folios.ultimo_folio + 1
  RETURNING ultimo_folio INTO v_folio;

  INSERT INTO public.polizas
    (clinic_id, folio, tipo, fecha, concepto, uuid_cfdi, reference_type, reference_id, evento, created_by)
  VALUES
    (v_clinic_id, v_folio, v_tipo, v_fecha,
     p_payload->>'concepto',
     NULLIF(p_payload->>'uuid_cfdi', '')::uuid,
     v_reference_type, v_reference_id, v_evento, auth.uid())
  RETURNING id INTO v_poliza_id;

  FOR v_partida IN SELECT * FROM jsonb_array_elements(v_partidas)
  LOOP
    v_orden := v_orden + 1;
    INSERT INTO public.poliza_partidas (poliza_id, orden, cuenta_id, debe_centavos, haber_centavos, descripcion)
    VALUES (
      v_poliza_id, v_orden, (v_partida->>'cuenta_id')::uuid,
      COALESCE((v_partida->>'debe_centavos')::bigint, 0),
      COALESCE((v_partida->>'haber_centavos')::bigint, 0),
      v_partida->>'descripcion'
    );
  END LOOP;

  RETURN v_poliza_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.crear_poliza(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_poliza(jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. cierre_mensual — congela el período: póliza de cierre de resultados
--    (ingresos/egresos → 305 Resultados acumulados) + marca contab_cierres.
--    Solo admin/manager de la clínica. Solo períodos ya terminados (mes < actual).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cierre_mensual(p_clinic_id uuid, p_periodo date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_periodo date := date_trunc('month', p_periodo)::date;
  v_fin date := (date_trunc('month', p_periodo) + interval '1 month - 1 day')::date;
  v_cierre_id uuid := gen_random_uuid();
  v_partidas jsonb := '[]'::jsonb;
  v_utilidad bigint := 0;
  v_cuenta_resultado uuid;
  v_poliza_id uuid := NULL;
  v_row record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = p_clinic_id AND role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_fin >= current_date THEN
    RAISE EXCEPTION 'periodo_no_terminado: % aún no concluye', to_char(v_periodo, 'YYYY-MM');
  END IF;

  IF EXISTS (SELECT 1 FROM public.contab_cierres WHERE clinic_id = p_clinic_id AND periodo = v_periodo AND cerrado_at IS NOT NULL) THEN
    RAISE EXCEPTION 'periodo_ya_cerrado: %', to_char(v_periodo, 'YYYY-MM');
  END IF;

  SELECT id INTO v_cuenta_resultado FROM public.cuentas_contables WHERE codigo = '305';
  IF v_cuenta_resultado IS NULL THEN
    RAISE EXCEPTION 'cuenta_305_resultados_no_encontrada';
  END IF;

  -- Movimiento neto del período por cuenta de ingreso/egreso (misma lógica
  -- que estado_resultados): debe zerarse cada una contra 305.
  FOR v_row IN
    SELECT cc.id AS cuenta_id, cc.tipo,
           (CASE WHEN cc.naturaleza = 'deudora'
                 THEN COALESCE(SUM(pp.debe_centavos), 0) - COALESCE(SUM(pp.haber_centavos), 0)
                 ELSE COALESCE(SUM(pp.haber_centavos), 0) - COALESCE(SUM(pp.debe_centavos), 0) END)::bigint AS neto
    FROM public.cuentas_contables cc
    JOIN public.poliza_partidas pp ON pp.cuenta_id = cc.id
    JOIN public.polizas p ON p.id = pp.poliza_id
    WHERE p.clinic_id = p_clinic_id AND p.fecha BETWEEN v_periodo AND v_fin
      AND cc.tipo IN ('ingreso', 'egreso')
    GROUP BY cc.id, cc.tipo, cc.naturaleza
    HAVING (CASE WHEN cc.naturaleza = 'deudora'
                 THEN COALESCE(SUM(pp.debe_centavos), 0) - COALESCE(SUM(pp.haber_centavos), 0)
                 ELSE COALESCE(SUM(pp.haber_centavos), 0) - COALESCE(SUM(pp.debe_centavos), 0) END) <> 0
  LOOP
    IF v_row.tipo = 'ingreso' THEN
      -- Ingreso (acreedora): saldo neto está en haber, se cancela con un cargo.
      v_partidas := v_partidas || jsonb_build_object('cuenta_id', v_row.cuenta_id, 'debe_centavos', v_row.neto, 'haber_centavos', 0, 'descripcion', 'Cierre — cancela saldo');
      v_utilidad := v_utilidad + v_row.neto;
    ELSE
      -- Egreso (deudora): saldo neto está en debe, se cancela con un abono.
      v_partidas := v_partidas || jsonb_build_object('cuenta_id', v_row.cuenta_id, 'debe_centavos', 0, 'haber_centavos', v_row.neto, 'descripcion', 'Cierre — cancela saldo');
      v_utilidad := v_utilidad - v_row.neto;
    END IF;
  END LOOP;

  IF jsonb_array_length(v_partidas) > 0 THEN
    IF v_utilidad > 0 THEN
      v_partidas := v_partidas || jsonb_build_object('cuenta_id', v_cuenta_resultado, 'debe_centavos', 0, 'haber_centavos', v_utilidad, 'descripcion', 'Utilidad del período a resultados acumulados');
    ELSIF v_utilidad < 0 THEN
      v_partidas := v_partidas || jsonb_build_object('cuenta_id', v_cuenta_resultado, 'debe_centavos', -v_utilidad, 'haber_centavos', 0, 'descripcion', 'Pérdida del período a resultados acumulados');
    END IF;

    v_poliza_id := public.crear_poliza(jsonb_build_object(
      'clinic_id', p_clinic_id, 'tipo', 'diario', 'fecha', v_fin,
      'concepto', 'Cierre mensual ' || to_char(v_periodo, 'YYYY-MM'),
      'reference_type', 'cierre_mensual', 'reference_id', v_cierre_id, 'evento', 'registro',
      'partidas', v_partidas
    ));
  END IF;

  INSERT INTO public.contab_cierres (id, clinic_id, periodo, poliza_cierre_id, cerrado_by, cerrado_at)
  VALUES (v_cierre_id, p_clinic_id, v_periodo, v_poliza_id, auth.uid(), now());

  RETURN v_cierre_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cierre_mensual(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cierre_mensual(uuid, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. contab_auditoria_huecos — pólizas sin referencia trazable y movimientos
--    contables sin póliza correspondiente (gaps del motor de asientos).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_auditoria_huecos(p_clinic_id uuid, p_desde date, p_hasta date)
RETURNS TABLE (
  tipo_hueco text,
  fecha date,
  origen_id uuid,
  descripcion text,
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
  SELECT 'sin_referencia'::text, p.fecha, p.id, p.concepto,
         (SELECT COALESCE(SUM(pp.debe_centavos), 0) FROM public.poliza_partidas pp WHERE pp.poliza_id = p.id)::bigint
  FROM public.polizas p
  WHERE p.clinic_id = p_clinic_id AND p.fecha BETWEEN p_desde AND p_hasta AND p.reference_type IS NULL

  UNION ALL

  SELECT 'sin_poliza'::text, mc.fecha_devengo, mc.id, COALESCE(mc.descripcion, mc.origen), mc.monto_centavos
  FROM public.movimientos_contables mc
  WHERE mc.clinic_id = p_clinic_id AND mc.fecha_devengo BETWEEN p_desde AND p_hasta
    AND mc.reference_type IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.polizas p
      WHERE p.reference_type = mc.reference_type AND p.reference_id = mc.reference_id AND p.evento = mc.evento
    )
  ORDER BY 2;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_auditoria_huecos(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contab_auditoria_huecos(uuid, date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. contab_concilia_cortes — total corte Z de caja general vs pólizas de
--    caja (cuenta 101, reference_type='movimiento_caja') del mismo turno.
--    Alcance: solo turnos de caja general (cortes.turno_id) — los turnos de
--    farmacia usan pharmacy_shift_id, sin ligar a cortes; fuera de v1.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_concilia_cortes(p_clinic_id uuid, p_desde date, p_hasta date)
RETURNS TABLE (
  turno_id uuid,
  corte_id uuid,
  corte_tipo text,
  fecha_corte timestamptz,
  total_corte_centavos bigint,
  total_polizas_centavos bigint,
  diferencia_centavos bigint
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
  WITH polizas_turno AS (
    SELECT m.turno_id, SUM(pp.debe_centavos) AS total
    FROM public.polizas p
    JOIN public.poliza_partidas pp ON pp.poliza_id = p.id
    JOIN public.cuentas_contables cc ON cc.id = pp.cuenta_id AND cc.codigo = '101'
    JOIN public.movimientos m ON m.id = p.reference_id AND p.reference_type = 'movimiento_caja'
    WHERE p.clinic_id = p_clinic_id
    GROUP BY m.turno_id
  )
  SELECT
    c.turno_id, c.id, c.tipo, c.created_at,
    ROUND(c.total_general * 100)::bigint AS total_corte_centavos,
    COALESCE(pt.total, 0)::bigint AS total_polizas_centavos,
    (ROUND(c.total_general * 100)::bigint - COALESCE(pt.total, 0))::bigint AS diferencia_centavos
  FROM public.cortes c
  LEFT JOIN polizas_turno pt ON pt.turno_id = c.turno_id
  WHERE c.clinic_id = p_clinic_id AND c.tipo = 'Z' AND c.created_at::date BETWEEN p_desde AND p_hasta
  ORDER BY c.created_at DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_concilia_cortes(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contab_concilia_cortes(uuid, date, date) TO authenticated;
