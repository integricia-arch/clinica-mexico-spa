-- Módulo Contable — Fase 8: conciliación bancaria (gerencial, sin API bancaria).
-- Plan: docs/superpowers/plans/2026-07-19-modulo-contable-completo.md (sección 4, Fase 8)

-- ---------------------------------------------------------------------------
-- 1. contab_estados_cuenta — líneas importadas de un estado de cuenta (CSV).
--    monto_centavos: positivo = depósito, negativo = retiro. line_hash evita
--    duplicar líneas si el mismo CSV se reimporta.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contab_estados_cuenta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  cuenta_id uuid NOT NULL REFERENCES public.cuentas_contables(id),
  fecha date NOT NULL,
  concepto text,
  monto_centavos bigint NOT NULL CHECK (monto_centavos <> 0),
  referencia_banco text,
  -- Calculado en contab_importar_estado_cuenta al insertar (no GENERATED:
  -- castear date/bigint a text vía casteo implícito de columna no es
  -- IMMUTABLE para Postgres — 42P17). Evita duplicar líneas al reimportar
  -- el mismo CSV.
  line_hash text NOT NULL,
  conciliado boolean NOT NULL DEFAULT false,
  poliza_partida_id uuid REFERENCES public.poliza_partidas(id),
  imported_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_contab_estados_cuenta_hash UNIQUE (line_hash)
);

CREATE INDEX IF NOT EXISTS idx_contab_estados_cuenta_pendientes
  ON public.contab_estados_cuenta (clinic_id, cuenta_id, conciliado);

-- Una partida solo puede quedar conciliada contra una línea a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_contab_estados_cuenta_partida
  ON public.contab_estados_cuenta (poliza_partida_id)
  WHERE conciliado AND poliza_partida_id IS NOT NULL;

ALTER TABLE public.contab_estados_cuenta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read contab_estados_cuenta" ON public.contab_estados_cuenta;
CREATE POLICY "Members read contab_estados_cuenta"
  ON public.contab_estados_cuenta FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND clinic_id = contab_estados_cuenta.clinic_id
    )
  );
-- Sin policies de escritura: solo RPCs SECURITY DEFINER de abajo.

-- ---------------------------------------------------------------------------
-- 2. contab_importar_estado_cuenta — inserta líneas en lote (CSV parseado en
--    cliente). Idempotente por line_hash (reimportar el mismo CSV no duplica).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_importar_estado_cuenta(p_clinic_id uuid, p_cuenta_id uuid, p_lineas jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_linea jsonb;
  v_insertadas integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = p_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cuentas_contables WHERE id = p_cuenta_id) THEN
    RAISE EXCEPTION 'cuenta_no_encontrada';
  END IF;

  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    INSERT INTO public.contab_estados_cuenta (clinic_id, cuenta_id, fecha, concepto, monto_centavos, referencia_banco, line_hash, imported_by)
    VALUES (
      p_clinic_id, p_cuenta_id,
      (v_linea->>'fecha')::date,
      v_linea->>'concepto',
      (v_linea->>'monto_centavos')::bigint,
      v_linea->>'referencia_banco',
      md5(p_clinic_id::text || '|' || p_cuenta_id::text || '|' || (v_linea->>'fecha') || '|' ||
          (v_linea->>'monto_centavos') || '|' || COALESCE(v_linea->>'concepto', '') || '|' || COALESCE(v_linea->>'referencia_banco', '')),
      auth.uid()
    )
    ON CONFLICT (line_hash) DO NOTHING;
    IF FOUND THEN
      v_insertadas := v_insertadas + 1;
    END IF;
  END LOOP;

  RETURN v_insertadas;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_importar_estado_cuenta(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contab_importar_estado_cuenta(uuid, uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. contab_matching_bancario — para cada línea pendiente, sugiere la partida
--    de póliza más cercana (mismo monto, fecha ±2 días, misma cuenta, aún sin
--    conciliar) para que el usuario confirme o descarte.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_matching_bancario(p_clinic_id uuid, p_cuenta_id uuid)
RETURNS TABLE (
  estado_cuenta_id uuid,
  fecha date,
  concepto text,
  monto_centavos bigint,
  sugerido_poliza_partida_id uuid,
  sugerido_poliza_id uuid,
  sugerido_folio integer,
  sugerido_fecha date,
  dias_diferencia integer
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
    ec.id, ec.fecha, ec.concepto, ec.monto_centavos,
    match.pp_id, match.poliza_id, match.folio, match.p_fecha,
    ABS(match.p_fecha - ec.fecha)
  FROM public.contab_estados_cuenta ec
  LEFT JOIN LATERAL (
    SELECT pp.id AS pp_id, p.id AS poliza_id, p.folio, p.fecha AS p_fecha
    FROM public.poliza_partidas pp
    JOIN public.polizas p ON p.id = pp.poliza_id
    WHERE pp.cuenta_id = ec.cuenta_id AND p.clinic_id = ec.clinic_id
      AND ABS(p.fecha - ec.fecha) <= 2
      AND ((ec.monto_centavos > 0 AND pp.debe_centavos = ec.monto_centavos)
        OR (ec.monto_centavos < 0 AND pp.haber_centavos = -ec.monto_centavos))
      AND NOT EXISTS (
        SELECT 1 FROM public.contab_estados_cuenta ec2
        WHERE ec2.poliza_partida_id = pp.id AND ec2.conciliado
      )
    ORDER BY ABS(p.fecha - ec.fecha) ASC
    LIMIT 1
  ) match ON true
  WHERE ec.clinic_id = p_clinic_id AND ec.cuenta_id = p_cuenta_id AND NOT ec.conciliado
  ORDER BY ec.fecha;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_matching_bancario(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contab_matching_bancario(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. contab_conciliar_linea / contab_desconciliar_linea — confirmar o
--    deshacer un match entre línea de banco y partida de póliza.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_conciliar_linea(p_estado_cuenta_id uuid, p_poliza_partida_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_clinic_id uuid;
  v_monto bigint;
  v_debe bigint;
  v_haber bigint;
BEGIN
  SELECT clinic_id, monto_centavos INTO v_clinic_id, v_monto
  FROM public.contab_estados_cuenta WHERE id = p_estado_cuenta_id;
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'linea_no_encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT debe_centavos, haber_centavos INTO v_debe, v_haber
  FROM public.poliza_partidas WHERE id = p_poliza_partida_id;
  IF v_debe IS NULL THEN
    RAISE EXCEPTION 'partida_no_encontrada';
  END IF;

  IF NOT ((v_monto > 0 AND v_debe = v_monto) OR (v_monto < 0 AND v_haber = -v_monto)) THEN
    RAISE EXCEPTION 'monto_no_coincide';
  END IF;

  UPDATE public.contab_estados_cuenta
  SET conciliado = true, poliza_partida_id = p_poliza_partida_id
  WHERE id = p_estado_cuenta_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_conciliar_linea(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contab_conciliar_linea(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.contab_desconciliar_linea(p_estado_cuenta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_clinic_id uuid;
BEGIN
  SELECT clinic_id INTO v_clinic_id FROM public.contab_estados_cuenta WHERE id = p_estado_cuenta_id;
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'linea_no_encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.contab_estados_cuenta
  SET conciliado = false, poliza_partida_id = NULL
  WHERE id = p_estado_cuenta_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_desconciliar_linea(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contab_desconciliar_linea(uuid) TO authenticated;
