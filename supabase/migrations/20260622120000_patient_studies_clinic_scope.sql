-- M2: Create patient_studies (if missing) + add clinic_id + fix RLS + Storage bucket
-- Context: 20260527213529 was repair-marked without running — table may not exist in prod.
-- This migration is idempotent: safe whether or not the table already exists.

-- 1. Create table if it doesn't exist (DDL from 20260527213529)
CREATE TABLE IF NOT EXISTS public.patient_studies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  appointment_id uuid,
  journey_instance_id uuid,
  expediente_id uuid,
  consultation_note_id uuid,
  tipo text NOT NULL DEFAULT 'lab',
  nombre text NOT NULL,
  motivo text,
  prioridad text NOT NULL DEFAULT 'rutina',
  area_laboratorio text,
  requiere_ayuno boolean NOT NULL DEFAULT false,
  indicaciones_paciente text,
  observaciones text,
  status text NOT NULL DEFAULT 'solicitado',
  solicitado_at timestamptz NOT NULL DEFAULT now(),
  solicitado_por uuid,
  recibido_at timestamptz,
  recibido_por uuid,
  revisado_at timestamptz,
  revisado_por uuid,
  resultado_resumen text,
  interpretacion_medica text,
  archivo_url text,
  laboratorio_origen text,
  replaces_study_id uuid REFERENCES public.patient_studies(id),
  justificacion_repeticion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_studies_tipo_check CHECK (tipo IN ('lab','imagen','otro')),
  CONSTRAINT patient_studies_prioridad_check CHECK (prioridad IN ('rutina','urgente','stat')),
  CONSTRAINT patient_studies_status_check CHECK (status IN ('solicitado','recibido','revisado','reutilizado','descartado'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_studies TO authenticated;
GRANT ALL ON public.patient_studies TO service_role;

ALTER TABLE public.patient_studies ENABLE ROW LEVEL SECURITY;

-- Indexes from 20260527213529 (IF NOT EXISTS for idempotency)
CREATE INDEX IF NOT EXISTS idx_patient_studies_patient
  ON public.patient_studies(patient_id, solicitado_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_studies_doctor_status
  ON public.patient_studies(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_patient_studies_journey
  ON public.patient_studies(journey_instance_id);
CREATE INDEX IF NOT EXISTS idx_patient_studies_appointment
  ON public.patient_studies(appointment_id);

-- Triggers from 20260527213529 (DROP IF EXISTS for idempotency)
DROP TRIGGER IF EXISTS trg_patient_studies_updated ON public.patient_studies;
CREATE TRIGGER trg_patient_studies_updated
BEFORE UPDATE ON public.patient_studies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_patient_studies_audit ON public.patient_studies;
CREATE TRIGGER trg_patient_studies_audit
AFTER INSERT OR UPDATE OR DELETE ON public.patient_studies
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- 2. Add clinic_id column (M2 addition, IF NOT EXISTS)
ALTER TABLE public.patient_studies
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT;

-- 3. Backfill from patients.clinic_id (no-op on empty table; handles pre-existing rows)
UPDATE public.patient_studies ps
SET clinic_id = p.clinic_id
FROM public.patients p
WHERE ps.patient_id = p.id
  AND ps.clinic_id IS NULL;

-- 4. Enforce NOT NULL
ALTER TABLE public.patient_studies
  ALTER COLUMN clinic_id SET NOT NULL;

-- 5. Index for clinic-scoped queries
CREATE INDEX IF NOT EXISTS idx_patient_studies_clinic_patient
  ON public.patient_studies(clinic_id, patient_id, solicitado_at DESC);

-- 6. Drop old RLS policies (IF EXISTS for idempotency)
DROP POLICY IF EXISTS "Staff manage patient_studies" ON public.patient_studies;
DROP POLICY IF EXISTS "Patient view own studies" ON public.patient_studies;
DROP POLICY IF EXISTS "Clinic staff manage patient_studies" ON public.patient_studies;

-- 7. New RLS: clinic_memberships-based (proper multi-tenant scope)
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

-- Dual-grant: staff policy covers SELECT for staff; this adds SELECT for the patient themselves.
-- Permissive RLS OR-combines these — intentional.
DROP POLICY IF EXISTS "Patient view own studies" ON public.patient_studies;
CREATE POLICY "Patient view own studies"
ON public.patient_studies FOR SELECT TO authenticated
USING (
  patient_id IN (
    SELECT id FROM public.patients WHERE user_id = auth.uid()
  )
);

-- 8. Storage bucket: estudios-resultados (private, 50 MB, specific MIME types)
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

-- 9. Storage RLS: clinic staff can upload (path must start with their clinic_id)
DROP POLICY IF EXISTS "Clinic staff upload estudios" ON storage.objects;
CREATE POLICY "Clinic staff upload estudios"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'estudios-resultados'
  AND (storage.foldername(name))[1] IN (
    SELECT clinic_id::text FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- 10. Storage RLS: clinic members can read their clinic's files
DROP POLICY IF EXISTS "Clinic staff read estudios" ON storage.objects;
CREATE POLICY "Clinic staff read estudios"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'estudios-resultados'
  AND (storage.foldername(name))[1] IN (
    SELECT clinic_id::text FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
