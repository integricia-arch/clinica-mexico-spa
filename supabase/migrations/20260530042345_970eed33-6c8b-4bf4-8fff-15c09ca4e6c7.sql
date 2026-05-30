
ALTER TABLE public.medicamentos
  ADD COLUMN IF NOT EXISTS indicaciones_uso text,
  ADD COLUMN IF NOT EXISTS contraindicaciones text,
  ADD COLUMN IF NOT EXISTS advertencias text,
  ADD COLUMN IF NOT EXISTS interacciones_relevantes text,
  ADD COLUMN IF NOT EXISTS fuente_info text,
  ADD COLUMN IF NOT EXISTS equivalence_group_key text;

CREATE INDEX IF NOT EXISTS idx_medicamentos_clinic_equiv
  ON public.medicamentos(clinic_id, equivalence_group_key)
  WHERE equivalence_group_key IS NOT NULL;
