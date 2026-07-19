-- Módulo Contable — Fase 6A: partida doble (pólizas y catálogo con tipo+naturaleza).
-- Plan: docs/superpowers/plans/2026-07-19-fase6-partida-doble.md (sección 6A)
-- Insumos: memoria/referencias/contpaq-gap-analysis.md, memoria/referencias/contabilidad-marco-legal-mx.md
--
-- Códigos agrupador SAT (Anexo 24, verificados por WebSearch 2026-07-19, sin
-- cambios respecto a 2024): 1 Caja, 2 Bancos, 4 Clientes, 13 Inventarios,
-- 15 Impuestos acreditables pagados, 37 Proveedores, 39 Acreedores diversos,
-- 41 Impuestos trasladados, 52 Capital social, 55 Resultado de ejercicios
-- anteriores, 57 Ventas, 61 Costo de ventas, 65 Gastos Generales.
--
-- No se toca el catálogo simple de Fase 3 (ING_*/EGR_*, usado hoy por los
-- triggers de Fase 3) — esta migración es aditiva; la migración de esos
-- triggers a pólizas es 6B.

-- ---------------------------------------------------------------------------
-- 1. Extender cuentas_contables: tipo ampliado, naturaleza, jerarquía, SAT.
-- ---------------------------------------------------------------------------

-- Rename codigo_sat -> codigo_agrupador_sat (idempotente: solo si la columna
-- vieja existe y la nueva no).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cuentas_contables' AND column_name = 'codigo_sat'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cuentas_contables' AND column_name = 'codigo_agrupador_sat'
  ) THEN
    ALTER TABLE public.cuentas_contables RENAME COLUMN codigo_sat TO codigo_agrupador_sat;
  END IF;
END $$;

ALTER TABLE public.cuentas_contables
  ADD COLUMN IF NOT EXISTS codigo_agrupador_sat text,
  ADD COLUMN IF NOT EXISTS naturaleza text CHECK (naturaleza IN ('deudora', 'acreedora')),
  ADD COLUMN IF NOT EXISTS cuenta_padre_id uuid REFERENCES public.cuentas_contables(id),
  ADD COLUMN IF NOT EXISTS nivel integer NOT NULL DEFAULT 1;

-- Backfill naturaleza de filas existentes (Fase 3: solo ingreso/egreso).
UPDATE public.cuentas_contables SET naturaleza = 'acreedora' WHERE tipo = 'ingreso' AND naturaleza IS NULL;
UPDATE public.cuentas_contables SET naturaleza = 'deudora' WHERE tipo = 'egreso' AND naturaleza IS NULL;

-- Ampliar CHECK de tipo (cuida el CHECK existente: DROP + re-CREATE, nombre
-- default de Postgres para CHECK inline es <tabla>_<columna>_check).
ALTER TABLE public.cuentas_contables DROP CONSTRAINT IF EXISTS cuentas_contables_tipo_check;
ALTER TABLE public.cuentas_contables
  ADD CONSTRAINT cuentas_contables_tipo_check
  CHECK (tipo IN ('activo', 'pasivo', 'capital', 'ingreso', 'egreso'));

-- Todas las filas ya tienen naturaleza (backfill arriba + seed nuevo abajo
-- siempre la especifica) — a partir de aquí es obligatoria.
ALTER TABLE public.cuentas_contables ALTER COLUMN naturaleza SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Seed catálogo mínimo alineado a Anexo 24 (jerarquía padre-hijo).
-- ---------------------------------------------------------------------------

-- Cuentas de nivel 1 (sin padre).
INSERT INTO public.cuentas_contables (codigo, nombre, tipo, naturaleza, codigo_agrupador_sat, nivel, es_fijo) VALUES
  ('101', 'Caja', 'activo', 'deudora', '1', 1, false),
  ('102', 'Bancos', 'activo', 'deudora', '2', 1, false),
  ('105', 'Clientes (CxC)', 'activo', 'deudora', '4', 1, false),
  ('115', 'Inventario - Almacén', 'activo', 'deudora', '13', 1, false),
  ('118', 'IVA acreditable', 'activo', 'deudora', '15', 1, false),
  ('201', 'Proveedores (CxP)', 'pasivo', 'acreedora', '37', 1, false),
  ('205', 'Acreedores diversos', 'pasivo', 'acreedora', '39', 1, false),
  ('209', 'IVA trasladado', 'pasivo', 'acreedora', '41', 1, false),
  ('301', 'Capital social', 'capital', 'acreedora', '52', 1, false),
  ('305', 'Resultados acumulados', 'capital', 'acreedora', '55', 1, false),
  ('399', 'Cuenta puente de migración', 'capital', 'acreedora', NULL, 1, false),
  ('401', 'Ingresos por consultas', 'ingreso', 'acreedora', '57', 1, false),
  ('402', 'Ingresos por farmacia', 'ingreso', 'acreedora', '57', 1, false),
  ('403', 'Otros ingresos', 'ingreso', 'acreedora', '57', 1, false),
  ('501', 'Costo de insumos', 'egreso', 'deudora', '61', 1, false),
  ('502', 'Costo de farmacia', 'egreso', 'deudora', '61', 1, false),
  ('601', 'Honorarios médicos', 'egreso', 'deudora', '65', 1, false),
  ('602', 'Renta', 'egreso', 'deudora', '65', 1, true),
  ('603', 'Nómina administrativa', 'egreso', 'deudora', '65', 1, true),
  ('604', 'Servicios (luz, agua, internet)', 'egreso', 'deudora', '65', 1, true),
  ('699', 'Otros gastos', 'egreso', 'deudora', '65', 1, false)
ON CONFLICT (codigo) DO NOTHING;

-- Subcuentas de nivel 2 (padre por codigo, resuelto por subquery).
INSERT INTO public.cuentas_contables (codigo, nombre, tipo, naturaleza, codigo_agrupador_sat, nivel, cuenta_padre_id, es_fijo)
SELECT '115.01', 'Almacén - Insumos', 'activo', 'deudora', '13', 2, id, false
FROM public.cuentas_contables WHERE codigo = '115'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.cuentas_contables (codigo, nombre, tipo, naturaleza, codigo_agrupador_sat, nivel, cuenta_padre_id, es_fijo)
SELECT '115.02', 'Almacén - Medicamentos', 'activo', 'deudora', '13', 2, id, false
FROM public.cuentas_contables WHERE codigo = '115'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.cuentas_contables (codigo, nombre, tipo, naturaleza, codigo_agrupador_sat, nivel, cuenta_padre_id, es_fijo)
SELECT '205.01', 'Honorarios médicos por pagar', 'pasivo', 'acreedora', '39', 2, id, false
FROM public.cuentas_contables WHERE codigo = '205'
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Tablas polizas + poliza_partidas + contador de folio por clínica+tipo.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.poliza_folios (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  tipo text NOT NULL CHECK (tipo IN ('ingreso', 'egreso', 'diario')),
  ultimo_folio integer NOT NULL DEFAULT 0,
  PRIMARY KEY (clinic_id, tipo)
);

ALTER TABLE public.poliza_folios ENABLE ROW LEVEL SECURITY;
-- Sin policies: tabla interna de contadores, solo tocada por RPCs definer.
-- (default deny para todos los roles no-definer, incluido SELECT)

CREATE TABLE IF NOT EXISTS public.polizas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  folio integer NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('ingreso', 'egreso', 'diario')),
  fecha date NOT NULL DEFAULT current_date,
  concepto text NOT NULL,
  uuid_cfdi uuid,
  reference_type text,
  reference_id uuid,
  evento text NOT NULL DEFAULT 'registro' CHECK (evento IN ('registro', 'cancelacion')),
  estado text NOT NULL DEFAULT 'contabilizada' CHECK (estado IN ('contabilizada', 'cancelada')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT polizas_ref_completa CHECK ((reference_type IS NULL) = (reference_id IS NULL)),
  CONSTRAINT uq_polizas_folio UNIQUE (clinic_id, tipo, folio)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_polizas_ref_evento
  ON public.polizas (reference_type, reference_id, evento)
  WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_polizas_clinic_fecha ON public.polizas (clinic_id, fecha);

ALTER TABLE public.polizas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read polizas" ON public.polizas;
CREATE POLICY "Members read polizas"
  ON public.polizas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND clinic_id = polizas.clinic_id
    )
  );
-- Sin policies de INSERT/UPDATE/DELETE: escritura solo vía RPCs SECURITY
-- DEFINER (crear_poliza/cancelar_poliza) — deny por default para el cliente.

CREATE TABLE IF NOT EXISTS public.poliza_partidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poliza_id uuid NOT NULL REFERENCES public.polizas(id) ON DELETE CASCADE,
  orden integer NOT NULL,
  cuenta_id uuid NOT NULL REFERENCES public.cuentas_contables(id),
  debe_centavos bigint NOT NULL DEFAULT 0 CHECK (debe_centavos >= 0),
  haber_centavos bigint NOT NULL DEFAULT 0 CHECK (haber_centavos >= 0),
  descripcion text,
  CONSTRAINT poliza_partidas_exactamente_uno CHECK (
    (debe_centavos > 0 AND haber_centavos = 0) OR (haber_centavos > 0 AND debe_centavos = 0)
  ),
  CONSTRAINT uq_poliza_partidas_orden UNIQUE (poliza_id, orden)
);

CREATE INDEX IF NOT EXISTS idx_poliza_partidas_cuenta ON public.poliza_partidas (cuenta_id);

ALTER TABLE public.poliza_partidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read poliza_partidas" ON public.poliza_partidas;
CREATE POLICY "Members read poliza_partidas"
  ON public.poliza_partidas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polizas p
      JOIN public.clinic_memberships cm ON cm.clinic_id = p.clinic_id
      WHERE p.id = poliza_partidas.poliza_id AND cm.user_id = auth.uid()
    )
  );
-- Sin policies de escritura: solo RPCs SECURITY DEFINER.

-- ---------------------------------------------------------------------------
-- 4. RPC crear_poliza(jsonb) — valida Σdebe=Σhaber, folio atómico, idempotente.
--
-- Payload esperado:
-- {
--   "clinic_id": uuid, "tipo": "ingreso"|"egreso"|"diario", "fecha": date (opcional),
--   "concepto": text, "uuid_cfdi": uuid (opcional),
--   "reference_type": text (opcional), "reference_id": uuid (opcional),
--   "evento": "registro"|"cancelacion" (opcional, default registro),
--   "partidas": [ { "cuenta_id": uuid, "debe_centavos": int, "haber_centavos": int,
--                   "descripcion": text (opcional) }, ... ]  -- 2+ elementos
-- }
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
  v_partidas jsonb := p_payload->'partidas';
  v_partida jsonb;
  v_folio integer;
  v_poliza_id uuid;
  v_suma_debe bigint := 0;
  v_suma_haber bigint := 0;
  v_orden integer := 0;
BEGIN
  -- 1. Membership PRIMERO (checklist SECURITY DEFINER punto 3).
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

  -- 2. Idempotencia: si ya existe una póliza con esta referencia+evento,
  --    devolver la existente sin duplicar (mismo patrón que movimientos_contables).
  IF v_reference_type IS NOT NULL AND v_reference_id IS NOT NULL THEN
    SELECT id INTO v_poliza_id FROM public.polizas
    WHERE reference_type = v_reference_type AND reference_id = v_reference_id AND evento = v_evento;
    IF v_poliza_id IS NOT NULL THEN
      RETURN v_poliza_id;
    END IF;
  END IF;

  -- 3. Validar cada partida y acumular sumas ANTES de insertar nada.
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

  -- 4. Folio atómico por clinic_id+tipo (UPSERT = row lock, sin advisory lock manual).
  INSERT INTO public.poliza_folios (clinic_id, tipo, ultimo_folio)
  VALUES (v_clinic_id, v_tipo, 1)
  ON CONFLICT (clinic_id, tipo) DO UPDATE SET ultimo_folio = public.poliza_folios.ultimo_folio + 1
  RETURNING ultimo_folio INTO v_folio;

  -- 5. Insertar cabecera.
  INSERT INTO public.polizas
    (clinic_id, folio, tipo, fecha, concepto, uuid_cfdi, reference_type, reference_id, evento, created_by)
  VALUES
    (v_clinic_id, v_folio, v_tipo,
     COALESCE((p_payload->>'fecha')::date, current_date),
     p_payload->>'concepto',
     NULLIF(p_payload->>'uuid_cfdi', '')::uuid,
     v_reference_type, v_reference_id, v_evento, auth.uid())
  RETURNING id INTO v_poliza_id;

  -- 6. Insertar partidas.
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

REVOKE EXECUTE ON FUNCTION public.crear_poliza(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_poliza(jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. RPC cancelar_poliza(uuid) — reversa balanceada, NUNCA UPDATE/DELETE de
--    las partidas originales. Idempotente (reusa la idempotencia de crear_poliza).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_poliza(p_poliza_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_poliza public.polizas%ROWTYPE;
  v_payload jsonb;
  v_partidas jsonb;
  v_reversa_id uuid;
BEGIN
  SELECT * INTO v_poliza FROM public.polizas WHERE id = p_poliza_id;
  IF v_poliza IS NULL THEN
    RAISE EXCEPTION 'poliza_no_encontrada';
  END IF;

  -- 1. Membership PRIMERO (checklist SECURITY DEFINER punto 3).
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = v_poliza.clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 2. Idempotente: si ya existe la reversa, regresarla sin volver a cancelar.
  SELECT id INTO v_reversa_id FROM public.polizas
  WHERE reference_type = 'poliza_reversa' AND reference_id = p_poliza_id AND evento = 'cancelacion';
  IF v_reversa_id IS NOT NULL THEN
    RETURN v_reversa_id;
  END IF;

  IF v_poliza.estado = 'cancelada' THEN
    -- Estado ya marcado pero sin fila de reversa (no debería pasar): no re-cancelar.
    RAISE EXCEPTION 'poliza_ya_cancelada_sin_reversa';
  END IF;

  -- 3. Construir payload de reversa: mismas partidas, debe/haber invertidos.
  SELECT jsonb_agg(jsonb_build_object(
           'cuenta_id', cuenta_id,
           'debe_centavos', haber_centavos,
           'haber_centavos', debe_centavos,
           'descripcion', COALESCE(descripcion, '') || ' (reversa)'
         ) ORDER BY orden)
  INTO v_partidas
  FROM public.poliza_partidas
  WHERE poliza_id = p_poliza_id;

  v_payload := jsonb_build_object(
    'clinic_id', v_poliza.clinic_id,
    'tipo', v_poliza.tipo,
    'fecha', current_date,
    'concepto', 'Cancelación póliza folio ' || v_poliza.folio || ' — ' || v_poliza.concepto,
    'reference_type', 'poliza_reversa',
    'reference_id', p_poliza_id,
    'evento', 'cancelacion',
    'partidas', v_partidas
  );

  v_reversa_id := public.crear_poliza(v_payload);

  UPDATE public.polizas SET estado = 'cancelada' WHERE id = p_poliza_id;

  RETURN v_reversa_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cancelar_poliza(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_poliza(uuid) TO authenticated, service_role;
