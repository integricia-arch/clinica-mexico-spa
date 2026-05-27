
CREATE TABLE public.patient_studies (
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

CREATE POLICY "Staff manage patient_studies"
ON public.patient_studies FOR ALL TO authenticated
USING (public.is_clinic_staff(auth.uid()))
WITH CHECK (public.is_clinic_staff(auth.uid()));

CREATE POLICY "Patient view own studies"
ON public.patient_studies FOR SELECT TO authenticated
USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE INDEX idx_patient_studies_patient ON public.patient_studies(patient_id, solicitado_at DESC);
CREATE INDEX idx_patient_studies_doctor_status ON public.patient_studies(doctor_id, status);
CREATE INDEX idx_patient_studies_journey ON public.patient_studies(journey_instance_id);
CREATE INDEX idx_patient_studies_appointment ON public.patient_studies(appointment_id);

CREATE TRIGGER trg_patient_studies_updated
BEFORE UPDATE ON public.patient_studies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_patient_studies_audit
AFTER INSERT OR UPDATE OR DELETE ON public.patient_studies
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
