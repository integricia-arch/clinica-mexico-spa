
-- clinics UPDATE: require clinic-scoped admin membership on that clinic (or global admin)
DROP POLICY IF EXISTS "Admins can update clinics" ON public.clinics;
CREATE POLICY "Admins can update clinics"
  ON public.clinics
  FOR UPDATE
  TO authenticated
  USING (
    public.is_global_admin(auth.uid())
    OR public.user_has_clinic_role(auth.uid(), id, 'admin'::public.app_role)
  )
  WITH CHECK (
    public.is_global_admin(auth.uid())
    OR public.user_has_clinic_role(auth.uid(), id, 'admin'::public.app_role)
  );

-- pharmacy_cash_shifts UPDATE: restrict role to authenticated
DROP POLICY IF EXISTS "Cashier/manager updates shift" ON public.pharmacy_cash_shifts;
CREATE POLICY "Cashier/manager updates shift"
  ON public.pharmacy_cash_shifts
  FOR UPDATE
  TO authenticated
  USING (
    (cashier_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
  WITH CHECK (
    public.user_has_clinic_access(auth.uid(), clinic_id)
    AND (
      (cashier_user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
    )
  );

-- rooms SELECT: scope to clinic access instead of USING(true)
DROP POLICY IF EXISTS "Anyone views rooms" ON public.rooms;
CREATE POLICY "Staff view rooms in their clinic"
  ON public.rooms
  FOR SELECT
  TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id));
