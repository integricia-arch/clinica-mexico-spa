-- Asignación de enfermera por cita (espejo de doctor_id), vínculo Telegram
-- de personal, entrega de turno y solicitud de insumos a farmacia.

ALTER TABLE public.appointments
  ADD COLUMN assigned_nurse_id uuid REFERENCES auth.users(id);

CREATE INDEX idx_appointments_nurse_horario
  ON public.appointments(assigned_nurse_id, fecha_inicio, fecha_fin);

-- Vínculo Telegram para personal (identidades_canal.patient_id solo cubre
-- pacientes; esta es la versión para staff que recibe avisos de asignación).
CREATE TABLE public.staff_identidades_canal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canal_id text NOT NULL DEFAULT 'telegram',
  external_id text NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canal_id, external_id),
  UNIQUE (user_id, canal_id)
);

ALTER TABLE public.staff_identidades_canal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff ve y vincula su propio chat_id" ON public.staff_identidades_canal
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Entrega de turno: por sala/turno, no por paciente.
CREATE TABLE public.entregas_turno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  sala text NOT NULL,
  turno text NOT NULL CHECK (turno IN ('matutino', 'vespertino', 'nocturno')),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  enfermera_entrega uuid REFERENCES auth.users(id),
  enfermera_recibe uuid REFERENCES auth.users(id),
  resumen text,
  pacientes_json jsonb NOT NULL DEFAULT '[]',
  pendientes_json jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX idx_entregas_turno_clinic_fecha ON public.entregas_turno(clinic_id, fecha DESC);

ALTER TABLE public.entregas_turno ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nurse manage entregas_turno" ON public.entregas_turno
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'nurse')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'nurse')
  );

CREATE POLICY "multiclinic_access_restrictive_entregas_turno" ON public.entregas_turno
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id));

-- Solicitud de insumos a farmacia: enfermería solicita, manager/admin aprueba.
CREATE TABLE public.solicitudes_insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  medicamento_id uuid NOT NULL REFERENCES public.medicamentos(id),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  motivo text,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobada', 'rechazada')),
  solicitado_por uuid REFERENCES auth.users(id),
  aprobado_por uuid REFERENCES auth.users(id),
  movimiento_id uuid REFERENCES public.movimientos_inventario(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_solicitudes_insumos_status ON public.solicitudes_insumos(clinic_id, status);

ALTER TABLE public.solicitudes_insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nurse create solicitudes" ON public.solicitudes_insumos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'nurse') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff read solicitudes" ON public.solicitudes_insumos
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'nurse')
    OR public.has_role(auth.uid(), 'cajero')
  );

CREATE POLICY "Manager/admin approve solicitudes" ON public.solicitudes_insumos
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "multiclinic_access_restrictive_solicitudes_insumos" ON public.solicitudes_insumos
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id));
