ALTER TABLE public.medicamentos
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS codigo_interno text,
  ADD COLUMN IF NOT EXISTS laboratorio text,
  ADD COLUMN IF NOT EXISTS principio_activo text,
  ADD COLUMN IF NOT EXISTS forma_farmaceutica text,
  ADD COLUMN IF NOT EXISTS concentracion text,
  ADD COLUMN IF NOT EXISTS presentacion text,
  ADD COLUMN IF NOT EXISTS registro_sanitario text;

CREATE UNIQUE INDEX IF NOT EXISTS medicamentos_clinic_barcode_uniq
  ON public.medicamentos (clinic_id, barcode)
  WHERE barcode IS NOT NULL AND length(trim(barcode)) > 0;

CREATE INDEX IF NOT EXISTS idx_medicamentos_clinic_barcode ON public.medicamentos (clinic_id, barcode);
CREATE INDEX IF NOT EXISTS idx_medicamentos_clinic_sku ON public.medicamentos (clinic_id, sku);
CREATE INDEX IF NOT EXISTS idx_medicamentos_clinic_nombre ON public.medicamentos (clinic_id, nombre);
CREATE INDEX IF NOT EXISTS idx_medicamentos_clinic_laboratorio ON public.medicamentos (clinic_id, laboratorio);
CREATE INDEX IF NOT EXISTS idx_medicamentos_clinic_principio ON public.medicamentos (clinic_id, principio_activo);