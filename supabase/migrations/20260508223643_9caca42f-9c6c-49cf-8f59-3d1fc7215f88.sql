
-- 1. Fix RESTRICTIVE policy on user_roles so users can still SELECT their own row.
DROP POLICY IF EXISTS "Only admins can write user_roles" ON public.user_roles;
CREATE POLICY "Only admins can write user_roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can update user_roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can delete user_roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Convert has_role to SECURITY INVOKER (users can read own roles via existing policy).
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 3. Replace is_appointment_participant usage with inline EXISTS (no recursion since
--    the inline expressions don't re-query appointments table).
DROP POLICY IF EXISTS "View appointments" ON public.appointments;
CREATE POLICY "View appointments" ON public.appointments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'receptionist')
  OR has_role(auth.uid(), 'nurse')
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = appointments.patient_id AND p.user_id = auth.uid())
  OR appointments.doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Update appointments" ON public.appointments;
CREATE POLICY "Update appointments" ON public.appointments FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'receptionist')
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = appointments.patient_id AND p.user_id = auth.uid())
  OR appointments.doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'receptionist')
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = appointments.patient_id AND p.user_id = auth.uid())
  OR appointments.doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "View resources" ON public.appointment_resources;
CREATE POLICY "View resources" ON public.appointment_resources FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'receptionist')
  OR EXISTS (
    SELECT 1 FROM public.appointments a
    LEFT JOIN public.patients p ON p.id = a.patient_id
    WHERE a.id = appointment_resources.appointment_id
    AND (p.user_id = auth.uid() OR a.doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()))
  )
);

-- Drop the now-unused SECURITY DEFINER function.
DROP FUNCTION IF EXISTS public.is_appointment_participant(uuid);

-- 4. update_updated_at_column is only used by triggers; revoke EXECUTE from all roles.
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
