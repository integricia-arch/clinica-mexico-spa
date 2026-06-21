-- Task 5: COFEPRIS libro de control — folio_secuencial por clínica

ALTER TABLE public.recetas_capturadas
  ADD COLUMN IF NOT EXISTS folio_secuencial integer;

-- Trigger: asigna folio_secuencial secuencial por clinic_id en cada INSERT
CREATE OR REPLACE FUNCTION public.assign_receta_folio()
  RETURNS trigger
  LANGUAGE plpgsql
AS $trigger$
BEGIN
  IF NEW.folio_secuencial IS NULL THEN
    SELECT COALESCE(MAX(folio_secuencial), 0) + 1
      INTO NEW.folio_secuencial
      FROM public.recetas_capturadas
     WHERE clinic_id = NEW.clinic_id;
  END IF;
  RETURN NEW;
END;
$trigger$;

DROP TRIGGER IF EXISTS trg_assign_receta_folio ON public.recetas_capturadas;
CREATE TRIGGER trg_assign_receta_folio
  BEFORE INSERT ON public.recetas_capturadas
  FOR EACH ROW EXECUTE FUNCTION public.assign_receta_folio();

-- Backfill de registros existentes: asignar folios ordenados por created_at dentro de cada clínica
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY clinic_id ORDER BY created_at ASC) AS rn
    FROM public.recetas_capturadas
   WHERE folio_secuencial IS NULL
)
UPDATE public.recetas_capturadas rc
   SET folio_secuencial = n.rn
  FROM numbered n
 WHERE rc.id = n.id;
