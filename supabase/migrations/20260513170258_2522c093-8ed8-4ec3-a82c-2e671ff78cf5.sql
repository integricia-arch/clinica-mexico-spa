-- Create servicios table
CREATE TABLE IF NOT EXISTS public.servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  especialidad text,
  duracion_minutos integer NOT NULL DEFAULT 30,
  precio_centavos integer NOT NULL DEFAULT 0,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view servicios" ON public.servicios FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'receptionist'::app_role) OR has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'nurse'::app_role) OR has_role(auth.uid(), 'patient'::app_role));

CREATE POLICY "Admin manage servicios" ON public.servicios FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add columns to appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS servicio_id uuid REFERENCES public.servicios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'web' CHECK (origen IN ('telegram','whatsapp','web','walk_in')),
  ADD COLUMN IF NOT EXISTS creada_por_bot boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_appointments_servicio_id ON public.appointments(servicio_id);

-- Seed a few servicios
INSERT INTO public.servicios (nombre, especialidad, duracion_minutos, precio_centavos, descripcion)
VALUES
  ('Limpieza dental', 'Odontología', 45, 80000, 'Profilaxis y limpieza dental'),
  ('Consulta general', 'Medicina general', 30, 50000, 'Consulta médica de primera vez'),
  ('Seguimiento', 'Medicina general', 20, 35000, 'Consulta de seguimiento'),
  ('Control prenatal', 'Ginecología', 40, 90000, 'Control de embarazo'),
  ('Estudios de laboratorio', 'Laboratorio', 15, 25000, 'Toma de muestras')
ON CONFLICT DO NOTHING;