-- clinic_settings: restrict SELECT to clinic staff scoped to their clinic
DROP POLICY IF EXISTS "Authenticated can read clinic_settings" ON public.clinic_settings;
CREATE POLICY "Staff read own clinic_settings"
  ON public.clinic_settings FOR SELECT TO authenticated
  USING (
    public.is_clinic_staff(auth.uid())
    AND public.user_has_clinic_access(auth.uid(), clinic_id)
  );

-- doctor_servicios: restrict SELECT to clinic staff only (was: any authenticated)
DROP POLICY IF EXISTS "Authenticated view doctor_servicios" ON public.doctor_servicios;
CREATE POLICY "Staff view doctor_servicios"
  ON public.doctor_servicios FOR SELECT TO authenticated
  USING (public.is_clinic_staff(auth.uid()));

-- permanent_admins: restrict to global admins only (was: any admin role)
DROP POLICY IF EXISTS "Admin manage permanent_admins" ON public.permanent_admins;
CREATE POLICY "Global admins manage permanent_admins"
  ON public.permanent_admins FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));
