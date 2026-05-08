
-- Tipo de expediente
DO $$ BEGIN
  CREATE TYPE public.expediente_tipo AS ENUM ('primera_vez','seguimiento','urgencia','cirugia','cronico');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabla expedientes
CREATE TABLE IF NOT EXISTS public.expedientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
  tipo public.expediente_tipo NOT NULL DEFAULT 'primera_vez',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS expedientes_patient_activo_uniq
  ON public.expedientes(patient_id) WHERE activo = true;

ALTER TABLE public.expedientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view expedientes" ON public.expedientes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'doctor')
    OR public.has_role(auth.uid(),'nurse')
    OR public.has_role(auth.uid(),'receptionist')
  );

CREATE POLICY "Patient can view own expediente" ON public.expedientes FOR SELECT TO authenticated
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Admin/doctor can insert expedientes" ON public.expedientes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor'));

CREATE POLICY "Admin/doctor can update expedientes" ON public.expedientes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor'));

CREATE POLICY "Admin can delete expedientes" ON public.expedientes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_expedientes_updated_at
  BEFORE UPDATE ON public.expedientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla notas_consulta (SOAP)
CREATE TABLE IF NOT EXISTS public.notas_consulta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS notas_consulta_exp_idx ON public.notas_consulta(expediente_id, fecha_consulta DESC);

ALTER TABLE public.notas_consulta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view notas" ON public.notas_consulta FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'doctor')
    OR public.has_role(auth.uid(),'nurse')
    OR public.has_role(auth.uid(),'receptionist')
  );

CREATE POLICY "Patient can view own notas" ON public.notas_consulta FOR SELECT TO authenticated
  USING (
    expediente_id IN (
      SELECT e.id FROM public.expedientes e
      JOIN public.patients p ON p.id = e.patient_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin/doctor can insert notas" ON public.notas_consulta FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor'));

CREATE POLICY "Admin/doctor can update notas" ON public.notas_consulta FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor'));

CREATE POLICY "Admin can delete notas" ON public.notas_consulta FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_notas_consulta_updated_at
  BEFORE UPDATE ON public.notas_consulta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
