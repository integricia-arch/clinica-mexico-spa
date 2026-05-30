-- Estado de confirmación del doctor
DO $$ BEGIN
  CREATE TYPE doctor_confirmation_status AS ENUM ('pending','confirmed','declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS doctor_confirmation_status doctor_confirmation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS doctor_confirmation_at    timestamptz,
  ADD COLUMN IF NOT EXISTS doctor_confirmation_reason text;

-- Marcar como confirmadas las citas existentes para no estorbar al doctor
UPDATE public.appointments
   SET doctor_confirmation_status = 'confirmed',
       doctor_confirmation_at = COALESCE(doctor_confirmation_at, updated_at)
 WHERE created_at < now() - interval '1 minute'
   AND doctor_confirmation_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_appt_doctor_pending
  ON public.appointments (doctor_id, doctor_confirmation_status)
  WHERE doctor_confirmation_status = 'pending';

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'doctor_confirmo_cita';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'doctor_rechazo_cita';