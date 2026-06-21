-- Drop legacy columns after sync verification
-- IMPORTANT: Run only after verifying that frontend code does NOT reference:
-- - medicamentos.requiere_receta
-- - medicamentos.controlado
--
-- Verify with:
--   grep -r "requiere_receta\|\.controlado" src/ --include="*.ts" --include="*.tsx"
--
-- Expected: zero results before applying this migration.
--
-- Also drops domicilio_ciudad from patients (CLAUDE.md invariant: city maps to municipio, not domicilio_ciudad)

BEGIN;

-- Drop CHECK constraint added by previous migration
ALTER TABLE public.medicamentos
DROP CONSTRAINT IF EXISTS medicamentos_prescription_sync;

-- Drop legacy Spanish columns from medicamentos
-- (canonical: requires_prescription, is_controlled now have complete data)
ALTER TABLE public.medicamentos
DROP COLUMN IF EXISTS requiere_receta,
DROP COLUMN IF EXISTS controlado;

-- Drop non-canonical city column from patients
-- CLAUDE.md invariant: Address decomposed into direccion, colonia, municipio, estado, codigo_postal
-- City must map to municipio, not domicilio_ciudad
ALTER TABLE public.patients
DROP COLUMN IF EXISTS domicilio_ciudad;

COMMIT;
