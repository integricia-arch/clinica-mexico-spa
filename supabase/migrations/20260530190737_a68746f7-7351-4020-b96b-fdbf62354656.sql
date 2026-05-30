-- Insistencia de pacientes escalados
ALTER TABLE public.conversaciones
  ADD COLUMN IF NOT EXISTS escalated_followup_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_patient_followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_bot_ack_at timestamptz,
  ADD COLUMN IF NOT EXISTS insiste boolean NOT NULL DEFAULT false;

-- Nuevos eventos de auditoría
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'patient_followed_up_after_escalation' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'patient_followed_up_after_escalation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'reception_notified_again' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'reception_notified_again';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'reception_case_opened' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'reception_case_opened';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'reception_case_closed' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'reception_case_closed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'patient_insistence_detected' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'patient_insistence_detected';
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_conversaciones_escalada_insiste
  ON public.conversaciones (clinic_id, status, insiste, last_message_at DESC);