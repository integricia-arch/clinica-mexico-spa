-- Kit pricing v2 · Opción B: precio sugerido por margen objetivo.
--   kits.margen_objetivo → % meta de margen para sugerir precio en la UI.
-- Precio sugerido (calculado en la app, no se persiste):
--   precio_sug = costo / (1 - margen_objetivo/100)
-- El precio real (precio_centavos) sigue siendo manual/editable; el margen
-- objetivo solo alimenta el botón "usar precio sugerido". margen_objetivo en
-- [0, 99] — 100 daría división por cero (margen del 100% imposible).
-- Idempotente: seguro re-pegar en el SQL Editor.

ALTER TABLE public.kits
  ADD COLUMN IF NOT EXISTS margen_objetivo integer NOT NULL DEFAULT 50
    CHECK (margen_objetivo >= 0 AND margen_objetivo < 100);
