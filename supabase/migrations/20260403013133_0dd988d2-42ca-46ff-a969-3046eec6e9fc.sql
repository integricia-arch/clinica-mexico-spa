
-- ===========================================
-- ENUMS
-- ===========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'receptionist', 'doctor', 'nurse', 'patient');

CREATE TYPE public.appointment_status AS ENUM (
  'solicitada', 'tentativa', 'pendiente_formulario', 'confirmada',
  'recordatorio_enviado', 'confirmada_paciente', 'confirmada_medico',
  'cancelada', 'liberada'
);

CREATE TYPE public.audit_action AS ENUM ('crear', 'actualizar', 'cancelar');
CREATE TYPE public.reminder_channel AS ENUM ('whatsapp', 'sms', 'email');
CREATE TYPE public.reminder_status AS ENUM ('pendiente', 'enviado', 'fallido');

-- ===========================================
-- TABLES FIRST
-- ===========================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nombre text NOT NULL,
  apellidos text NOT NULL,
  especialidad text NOT NULL,
  cedula_profesional text,
  telefono text,
  horario_inicio time NOT NULL DEFAULT '08:00',
  horario_fin time NOT NULL DEFAULT '18:00',
  duracion_cita_min integer NOT NULL DEFAULT 30,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  apellidos text NOT NULL,
  fecha_nacimiento date,
  sexo text CHECK (sexo IN ('M', 'F', 'Otro')),
  curp text,
  rfc text,
  telefono text,
  email text,
  direccion text,
  colonia text,
  municipio text,
  estado text,
  codigo_postal text,
  contacto_emergencia_nombre text,
  contacto_emergencia_telefono text,
  tipo_sangre text,
  alergias text,
  notas text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  piso text,
  capacidad integer NOT NULL DEFAULT 1,
  equipamiento text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  fecha_inicio timestamptz NOT NULL,
  fecha_fin timestamptz NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'solicitada',
  motivo_consulta text,
  notas text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_dates CHECK (fecha_fin > fecha_inicio)
);

CREATE TABLE public.appointment_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  tipo_recurso text NOT NULL,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  canal public.reminder_channel NOT NULL DEFAULT 'whatsapp',
  mensaje text,
  programado_para timestamptz NOT NULL,
  enviado_en timestamptz,
  estado public.reminder_status NOT NULL DEFAULT 'pendiente',
  intentos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  accion public.audit_action NOT NULL,
  tabla text NOT NULL,
  registro_id uuid,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_doctors_user ON public.doctors(user_id);
CREATE INDEX idx_patients_user ON public.patients(user_id);
CREATE INDEX idx_appointments_doctor ON public.appointments(doctor_id);
CREATE INDEX idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX idx_appointments_room ON public.appointments(room_id);
CREATE INDEX idx_appointments_fecha ON public.appointments(fecha_inicio, fecha_fin);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_reminders_appointment ON public.reminders(appointment_id);
CREATE INDEX idx_reminders_estado ON public.reminders(estado, programado_para);
CREATE INDEX idx_audit_logs_tabla ON public.audit_logs(tabla, registro_id);

-- ===========================================
-- HELPER FUNCTIONS (after tables exist)
-- ===========================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_appointment_participant(_appointment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.appointments a
    JOIN public.patients p ON a.patient_id = p.id
    WHERE a.id = _appointment_id
    AND (
      p.user_id = auth.uid()
      OR a.doctor_id IN (SELECT d.id FROM public.doctors d WHERE d.user_id = auth.uid())
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.log_audit(
  _accion public.audit_action,
  _tabla text,
  _registro_id uuid,
  _datos_anteriores jsonb DEFAULT NULL,
  _datos_nuevos jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_anteriores, datos_nuevos)
  VALUES (auth.uid(), _accion, _tabla, _registro_id, _datos_anteriores, _datos_nuevos);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===========================================
-- TRIGGERS
-- ===========================================
CREATE TRIGGER trg_doctors_updated_at BEFORE UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- ENABLE RLS
-- ===========================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- RLS: user_roles
-- ===========================================
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ===========================================
-- RLS: doctors
-- ===========================================
CREATE POLICY "Anyone views doctors" ON public.doctors
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage doctors" ON public.doctors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Doctors update own" ON public.doctors
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ===========================================
-- RLS: patients
-- ===========================================
CREATE POLICY "Patients read own" ON public.patients
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff read patients" ON public.patients
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'receptionist')
    OR public.has_role(auth.uid(), 'doctor')
    OR public.has_role(auth.uid(), 'nurse')
  );

CREATE POLICY "Staff create patients" ON public.patients
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'receptionist')
  );

CREATE POLICY "Patients update own" ON public.patients
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin updates patients" ON public.patients
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin deletes patients" ON public.patients
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ===========================================
-- RLS: rooms
-- ===========================================
CREATE POLICY "Anyone views rooms" ON public.rooms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/reception manage rooms" ON public.rooms
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'receptionist'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'receptionist'));

-- ===========================================
-- RLS: appointments
-- ===========================================
CREATE POLICY "View appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'receptionist')
    OR public.has_role(auth.uid(), 'nurse')
    OR public.is_appointment_participant(id)
  );

CREATE POLICY "Create appointments" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'receptionist')
    OR public.has_role(auth.uid(), 'patient')
  );

CREATE POLICY "Update appointments" ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'receptionist')
    OR public.is_appointment_participant(id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'receptionist')
    OR public.is_appointment_participant(id)
  );

CREATE POLICY "Admin deletes appointments" ON public.appointments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ===========================================
-- RLS: appointment_resources
-- ===========================================
CREATE POLICY "View resources" ON public.appointment_resources
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'receptionist')
    OR public.is_appointment_participant(appointment_id)
  );

CREATE POLICY "Staff manage resources" ON public.appointment_resources
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'receptionist'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'receptionist'));

-- ===========================================
-- RLS: reminders
-- ===========================================
CREATE POLICY "Staff view reminders" ON public.reminders
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'receptionist')
    OR public.has_role(auth.uid(), 'doctor')
  );

CREATE POLICY "Staff manage reminders" ON public.reminders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'receptionist'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'receptionist'));

-- ===========================================
-- RLS: audit_logs (append-only via function)
-- ===========================================
CREATE POLICY "Staff read audit" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'receptionist')
  );
