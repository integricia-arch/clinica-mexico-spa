-- Removing hardcoded default UUID from clinic_id columns.
-- After this migration, any INSERT that omits clinic_id will fail loudly with
-- a NOT NULL violation instead of silently using the wrong clinic.

ALTER TABLE public.lotes_medicamento
  ALTER COLUMN clinic_id DROP DEFAULT;

ALTER TABLE public.movimientos_inventario
  ALTER COLUMN clinic_id DROP DEFAULT;

ALTER TABLE public.pharmacy_sales
  ALTER COLUMN clinic_id DROP DEFAULT;

ALTER TABLE public.pharmacy_sale_items
  ALTER COLUMN clinic_id DROP DEFAULT;
