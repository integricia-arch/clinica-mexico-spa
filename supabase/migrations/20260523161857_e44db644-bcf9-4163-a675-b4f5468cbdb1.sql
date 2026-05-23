
DROP TABLE IF EXISTS public.bot_sesiones CASCADE;

CREATE TABLE public.bot_sesiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid NOT NULL UNIQUE REFERENCES public.conversaciones(id) ON DELETE CASCADE,
  borrador_paciente jsonb NOT NULL DEFAULT '{}'::jsonb,
  consentimiento_dado boolean NOT NULL DEFAULT false,
  consentimiento_fecha timestamptz,
  servicio_id uuid REFERENCES public.servicios(id),
  doctor_id uuid REFERENCES public.doctors(id),
  slot_propuesto timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_sesiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage bot_sesiones" ON public.bot_sesiones
FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));

CREATE TRIGGER trg_bot_sesiones_updated_at BEFORE UPDATE ON public.bot_sesiones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.consentimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  identidad_canal_id uuid REFERENCES public.identidades_canal(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  version_texto text NOT NULL,
  otorgado boolean NOT NULL,
  otorgado_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consentimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage consentimientos" ON public.consentimientos
FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));

CREATE POLICY "Patient view own consentimientos" ON public.consentimientos
FOR SELECT TO authenticated
USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
