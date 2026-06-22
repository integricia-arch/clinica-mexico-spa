-- M2: Add clinic_id to patient_studies + fix RLS + create Storage bucket
-- Security: old RLS used is_clinic_staff (role-only, not clinic-scoped)

-- 1. Add clinic_id column (nullable first, then backfill, then NOT NULL)
ALTER TABLE public.patient_studies
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT;

-- 2. Backfill from patients.clinic_id
UPDATE public.patient_studies ps
SET clinic_id = p.clinic_id
FROM public.patients p
WHERE ps.patient_id = p.id
  AND ps.clinic_id IS NULL;

-- 3. Enforce NOT NULL now that backfill is done
ALTER TABLE public.patient_studies
  ALTER COLUMN clinic_id SET NOT NULL;

-- 4. Index for clinic-scoped queries
CREATE INDEX IF NOT EXISTS idx_patient_studies_clinic_patient
  ON public.patient_studies(clinic_id, patient_id, solicitado_at DESC);

-- 5. Drop old RLS policies (role-only, not clinic-scoped)
DROP POLICY IF EXISTS "Staff manage patient_studies" ON public.patient_studies;
DROP POLICY IF EXISTS "Patient view own studies" ON public.patient_studies;

-- 6. New RLS: clinic_memberships-based (proper multi-tenant scope)
CREATE POLICY "Clinic staff manage patient_studies"
ON public.patient_studies FOR ALL TO authenticated
USING (
  clinic_id IN (
    SELECT clinic_id FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
)
WITH CHECK (
  clinic_id IN (
    SELECT clinic_id FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Patient view own studies"
ON public.patient_studies FOR SELECT TO authenticated
USING (
  patient_id IN (
    SELECT id FROM public.patients WHERE user_id = auth.uid()
  )
);

-- 7. Storage bucket: estudios-resultados (private, 50 MB, specific MIME types)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'estudios-resultados',
  'estudios-resultados',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/zip',
    'application/xml',
    'application/dicom'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 8. Storage RLS: clinic staff can upload (path must start with their clinic_id)
CREATE POLICY "Clinic staff upload estudios"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'estudios-resultados'
  AND (storage.foldername(name))[1] IN (
    SELECT clinic_id::text FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- 9. Storage RLS: clinic members can read their clinic's files
CREATE POLICY "Clinic staff read estudios"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'estudios-resultados'
  AND (storage.foldername(name))[1] IN (
    SELECT clinic_id::text FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
