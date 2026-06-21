-- Sync legacy medicamentos flags to canonical columns
-- Legacy (Spanish): requiere_receta, controlado (catalog-only)
-- Canonical (English): requires_prescription, is_controlled (used by pharmacy_register_sale RPC)
--
-- Strategy: Use OR semantics (more conservative for controlled substances)
-- If either column has TRUE, both get TRUE. This ensures pharmacy logic
-- doesn't accidentally allow restricted meds.

BEGIN;

-- Update: where columns differ, prefer whichever is TRUE (OR semantics)
UPDATE public.medicamentos
SET
  requires_prescription = (requires_prescription OR requiere_receta),
  is_controlled = (is_controlled OR controlado),
  requiere_receta = (requires_prescription OR requiere_receta),
  controlado = (is_controlled OR controlado)
WHERE
  requires_prescription <> requiere_receta
  OR is_controlled <> controlado;

-- Add CHECK constraint to prevent future divergence
-- (will be removed when legacy columns are dropped)
ALTER TABLE public.medicamentos
ADD CONSTRAINT medicamentos_prescription_sync
CHECK (requires_prescription = requiere_receta AND is_controlled = controlado);

COMMIT;
