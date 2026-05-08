-- ===========================================
-- EXPEDIENTES CLÍNICOS
-- ===========================================

CREATE TYPE public.expediente_tipo AS ENUM (
  'primera_vez', 'seguimiento', 'urgencia', 'cirugia', 'cronico'
);

CREATE TABLE public.expedientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
  tipo public.expediente_tipo NOT NULL DEFAULT 'primera_vez',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id)
);

CREATE TABLE public.notas_consulta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
  fecha_consulta timestamptz NOT NULL DEFAULT now(),
  subjetivo text,
  objetivo text,
  analisis text,
  plan text,
  diagnostico_principal text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_expedientes_patient ON public.expedientes(patient_id);
CREATE INDEX idx_expedientes_doctor ON public.expedientes(doctor_id);
CREATE INDEX idx_notas_expediente ON public.notas_consulta(expediente_id);
CREATE INDEX idx_notas_fecha ON public.notas_consulta(fecha_consulta DESC);

-- Triggers
CREATE TRIGGER trg_expedientes_updated_at BEFORE UPDATE ON public.expedientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_notas_updated_at BEFORE UPDATE ON public.notas_consulta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.expedientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_consulta ENABLE ROW LEVEL SECURITY;

-- expedientes: staff puede leer, admin/doctor pueden escribir
CREATE POLICY "Staff read expedientes" ON public.expedientes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor') OR
    public.has_role(auth.uid(), 'nurse') OR
    public.has_role(auth.uid(), 'receptionist')
  );

CREATE POLICY "Admin/doctor create expedientes" ON public.expedientes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor')
  );

CREATE POLICY "Admin/doctor update expedientes" ON public.expedientes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor')
  );

-- notas_consulta: staff puede leer, solo doctor/admin escriben
CREATE POLICY "Staff read notas" ON public.notas_consulta
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor') OR
    public.has_role(auth.uid(), 'nurse')
  );

CREATE POLICY "Doctor/admin create notas" ON public.notas_consulta
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor')
  );

CREATE POLICY "Doctor/admin update notas" ON public.notas_consulta
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor')
  );
