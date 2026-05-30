
-- 1) Extender enum audit_action con eventos del flujo inbox/operativo
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'conv_escalada';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'msg_durante_escalamiento';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'prioridad_urgente';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'cita_desde_inbox';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'notif_doctor';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'notif_paciente';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'conv_cerrada';

-- 2) Conversaciones: priorización y resumen para inbox
ALTER TABLE public.conversaciones
  ADD COLUMN IF NOT EXISTS prioridad text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS motivo_resumen text,
  ADD COLUMN IF NOT EXISTS dolor_intensidad smallint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversaciones_prioridad_check'
  ) THEN
    ALTER TABLE public.conversaciones
      ADD CONSTRAINT conversaciones_prioridad_check
      CHECK (prioridad IN ('normal','alta','urgente'));
  END IF;
END$$;

-- 3) Appointments: vínculo opcional a conversación de origen
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS conversacion_id uuid REFERENCES public.conversaciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_conversacion
  ON public.appointments(conversacion_id);
