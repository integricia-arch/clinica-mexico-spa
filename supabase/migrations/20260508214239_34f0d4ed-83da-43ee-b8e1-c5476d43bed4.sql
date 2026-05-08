
-- 1) DOCTORS: restrict sensitive columns
DROP POLICY IF EXISTS "Anyone views doctors" ON public.doctors;

-- Staff (admin, receptionist, doctor, nurse) can see all columns
CREATE POLICY "Staff view all doctor fields"
ON public.doctors FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'receptionist'::app_role)
  OR has_role(auth.uid(), 'doctor'::app_role)
  OR has_role(auth.uid(), 'nurse'::app_role)
);

-- Create a public-safe view exposing only non-sensitive fields for patients/others
CREATE OR REPLACE VIEW public.doctors_public
WITH (security_invoker = true) AS
SELECT id, nombre, apellidos, especialidad, horario_inicio, horario_fin, duracion_cita_min, activo
FROM public.doctors
WHERE activo = true;

GRANT SELECT ON public.doctors_public TO authenticated, anon;

-- Allow patients (and any other authenticated user) to read only non-sensitive base columns via RLS
CREATE POLICY "Authenticated view non-sensitive doctor fields"
ON public.doctors FOR SELECT TO authenticated
USING (
  activo = true
  AND NOT (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'receptionist'::app_role)
    OR has_role(auth.uid(), 'doctor'::app_role)
    OR has_role(auth.uid(), 'nurse'::app_role)
  )
);
-- Note: column-level restriction enforced by app via doctors_public view.
REVOKE SELECT (telefono, cedula_profesional) ON public.doctors FROM authenticated;
GRANT SELECT (id, user_id, nombre, apellidos, especialidad, horario_inicio, horario_fin, duracion_cita_min, activo, created_at, updated_at)
  ON public.doctors TO authenticated;

-- 2) EXPEDIENTES: doctors only see/edit own
DROP POLICY IF EXISTS "Staff can view expedientes" ON public.expedientes;
DROP POLICY IF EXISTS "Admin/doctor can update expedientes" ON public.expedientes;
DROP POLICY IF EXISTS "Admin/doctor can insert expedientes" ON public.expedientes;

CREATE POLICY "Staff can view expedientes"
ON public.expedientes FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'receptionist'::app_role)
  OR has_role(auth.uid(), 'nurse'::app_role)
  OR (
    has_role(auth.uid(), 'doctor'::app_role)
    AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Admin or assigned doctor can update expedientes"
ON public.expedientes FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'doctor'::app_role)
    AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'doctor'::app_role)
    AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Admin or self doctor can insert expedientes"
ON public.expedientes FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'doctor'::app_role)
    AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  )
);

-- 3) NOTAS_CONSULTA: doctors only own notes
DROP POLICY IF EXISTS "Staff can view notas" ON public.notas_consulta;
DROP POLICY IF EXISTS "Admin/doctor can update notas" ON public.notas_consulta;
DROP POLICY IF EXISTS "Admin/doctor can insert notas" ON public.notas_consulta;

CREATE POLICY "Staff can view notas"
ON public.notas_consulta FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'receptionist'::app_role)
  OR has_role(auth.uid(), 'nurse'::app_role)
  OR (
    has_role(auth.uid(), 'doctor'::app_role)
    AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Admin or author doctor can update notas"
ON public.notas_consulta FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'doctor'::app_role)
    AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'doctor'::app_role)
    AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Admin or author doctor can insert notas"
ON public.notas_consulta FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'doctor'::app_role)
    AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  )
);
