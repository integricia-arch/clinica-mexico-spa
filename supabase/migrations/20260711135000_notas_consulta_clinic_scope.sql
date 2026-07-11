ALTER TABLE public.notas_consulta ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);

-- Backfill: preferir appointments.clinic_id (via appointment_id), fallback
-- a patients.clinic_id (via expediente_id -> expedientes.patient_id) para
-- las notas sin appointment_id ligado.
UPDATE public.notas_consulta nc
SET clinic_id = a.clinic_id
FROM public.appointments a
WHERE nc.appointment_id = a.id
  AND nc.clinic_id IS NULL;

UPDATE public.notas_consulta nc
SET clinic_id = p.clinic_id
FROM public.expedientes e
JOIN public.patients p ON p.id = e.patient_id
WHERE nc.expediente_id = e.id
  AND nc.clinic_id IS NULL;

-- Confirmar que el backfill cubrió el 100% de las filas antes de forzar NOT NULL.
DO $$
DECLARE
  v_huerfanas int;
BEGIN
  SELECT count(*) INTO v_huerfanas FROM public.notas_consulta WHERE clinic_id IS NULL;
  IF v_huerfanas > 0 THEN
    RAISE EXCEPTION 'notas_consulta: % filas sin clinic_id tras backfill, revisar antes de continuar', v_huerfanas;
  END IF;
END $$;

ALTER TABLE public.notas_consulta ALTER COLUMN clinic_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notas_consulta_clinic ON public.notas_consulta(clinic_id);

DROP POLICY IF EXISTS multiclinic_access_restrictive ON public.notas_consulta;
CREATE POLICY multiclinic_access_restrictive ON public.notas_consulta
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id));
