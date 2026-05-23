
-- Drop old reminders table and its enums
DROP TABLE IF EXISTS public.reminders CASCADE;
DROP TYPE IF EXISTS public.reminder_status CASCADE;
DROP TYPE IF EXISTS public.reminder_channel CASCADE;

-- New enums
CREATE TYPE public.recordatorio_status AS ENUM ('pendiente', 'enviado', 'fallido', 'cancelado');
CREATE TYPE public.recordatorio_tipo AS ENUM ('t24h', 't2h', 'manual');

-- recordatorios_cita
CREATE TABLE public.recordatorios_cita (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  identidad_canal_id uuid REFERENCES public.identidades_canal(id) ON DELETE SET NULL,
  programado_para timestamptz NOT NULL,
  status public.recordatorio_status NOT NULL DEFAULT 'pendiente',
  tipo public.recordatorio_tipo NOT NULL DEFAULT 'manual',
  enviado_at timestamptz,
  ultimo_error text,
  mensaje text,
  intentos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recordatorios_cita_appointment ON public.recordatorios_cita(appointment_id);
CREATE INDEX idx_recordatorios_cita_status_prog ON public.recordatorios_cita(status, programado_para);

ALTER TABLE public.recordatorios_cita ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage recordatorios_cita"
ON public.recordatorios_cita
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'receptionist'::app_role)
  OR has_role(auth.uid(), 'doctor'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'receptionist'::app_role)
  OR has_role(auth.uid(), 'doctor'::app_role)
);

CREATE TRIGGER update_recordatorios_cita_updated_at
BEFORE UPDATE ON public.recordatorios_cita
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- raw_payload en mensajes
ALTER TABLE public.mensajes ADD COLUMN IF NOT EXISTS raw_payload jsonb;
