-- supabase/migrations/20260624100003_fix_receta_folio_sequence.sql
-- Reemplazar MAX()+1 por SEQUENCE atómica para folios COFEPRIS.
-- recetas_capturadas existe en producción (via _tmp_cofepris_libro.sql) pero no en migrations formales.
-- Este migration es seguro si recetas_capturadas existe o no.

BEGIN;

-- 1. Tabla de contadores por clínica (atómica con ON CONFLICT DO UPDATE)
CREATE TABLE IF NOT EXISTS public.recetas_folio_contadores (
  clinic_id    uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE RESTRICT,
  ultimo_folio bigint NOT NULL DEFAULT 0
);

-- 2. Inicializar contadores con el MAX actual por clínica (solo si la tabla existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'recetas_capturadas'
  ) THEN
    INSERT INTO public.recetas_folio_contadores (clinic_id, ultimo_folio)
    SELECT clinic_id, COALESCE(MAX(folio_secuencial), 0)
    FROM public.recetas_capturadas
    GROUP BY clinic_id
    ON CONFLICT (clinic_id) DO UPDATE
      SET ultimo_folio = GREATEST(recetas_folio_contadores.ultimo_folio, EXCLUDED.ultimo_folio);
  END IF;
END $$;

-- 3. Función atómica de asignación de folio
--    Usa INSERT ... ON CONFLICT DO UPDATE para garantizar atomicidad sin locks explícitos.
CREATE OR REPLACE FUNCTION public.next_receta_folio(p_clinic_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folio bigint;
BEGIN
  INSERT INTO public.recetas_folio_contadores (clinic_id, ultimo_folio)
  VALUES (p_clinic_id, 1)
  ON CONFLICT (clinic_id) DO UPDATE
    SET ultimo_folio = recetas_folio_contadores.ultimo_folio + 1
  RETURNING ultimo_folio INTO v_folio;
  RETURN v_folio;
END;
$$;

REVOKE ALL ON FUNCTION public.next_receta_folio(uuid) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.next_receta_folio(uuid) TO service_role;

-- 4. Trigger function (reemplaza la versión MAX()+1 existente en producción)
CREATE OR REPLACE FUNCTION public.assign_receta_folio()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.folio_secuencial IS NULL THEN
    NEW.folio_secuencial := public.next_receta_folio(NEW.clinic_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Re-registrar el trigger sobre recetas_capturadas (solo si la tabla existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'recetas_capturadas'
  ) THEN
    DROP TRIGGER IF EXISTS receta_folio_trigger ON public.recetas_capturadas;
    CREATE TRIGGER receta_folio_trigger
      BEFORE INSERT ON public.recetas_capturadas
      FOR EACH ROW EXECUTE FUNCTION public.assign_receta_folio();
  END IF;
END $$;

COMMIT;
