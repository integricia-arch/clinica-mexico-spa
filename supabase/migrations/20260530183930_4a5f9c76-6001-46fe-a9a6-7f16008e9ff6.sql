
-- Operational status enum and columns for doctors
DO $$ BEGIN
  CREATE TYPE public.doctor_operational_status AS ENUM ('active','unavailable','vacation','sick_leave','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS operational_status public.doctor_operational_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS operational_status_reason text,
  ADD COLUMN IF NOT EXISTS operational_status_until timestamptz;

-- Audit actions
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'doctor_contact_attempt_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'doctor_confirmo_por_llamada';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'doctor_rechazo_por_llamada';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'doctor_no_contesto';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'doctor_status_changed';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'doctor_unavailable_override';

-- Contact attempts table
DO $$ BEGIN
  CREATE TYPE public.doctor_contact_channel AS ENUM ('phone','whatsapp','email','internal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.doctor_contact_result AS ENUM ('answered','no_answer','busy','could_attend','could_not_attend','callback_requested');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.doctor_contact_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  contacted_by uuid REFERENCES auth.users(id),
  channel public.doctor_contact_channel NOT NULL DEFAULT 'phone',
  status public.doctor_contact_result NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_contact_attempts TO authenticated;
GRANT ALL ON public.doctor_contact_attempts TO service_role;

ALTER TABLE public.doctor_contact_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view contact attempts in their clinic" ON public.doctor_contact_attempts;
CREATE POLICY "Staff can view contact attempts in their clinic"
ON public.doctor_contact_attempts FOR SELECT TO authenticated
USING (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_clinic_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can insert contact attempts in their clinic" ON public.doctor_contact_attempts;
CREATE POLICY "Staff can insert contact attempts in their clinic"
ON public.doctor_contact_attempts FOR INSERT TO authenticated
WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_clinic_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_dca_appointment ON public.doctor_contact_attempts(appointment_id);
CREATE INDEX IF NOT EXISTS idx_dca_doctor ON public.doctor_contact_attempts(doctor_id, created_at DESC);
