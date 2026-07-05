DROP POLICY IF EXISTS "Cashier/manager updates shift" ON public.pharmacy_cash_shifts;
CREATE POLICY "Cashier/manager updates shift" ON public.pharmacy_cash_shifts
  FOR UPDATE
  USING (
    (cashier_user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    user_has_clinic_access(auth.uid(), clinic_id)
    AND (
      (cashier_user_id = auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  );

DROP POLICY IF EXISTS "turnos_update_own_or_admin" ON public.turnos;
CREATE POLICY "turnos_update_own_or_admin" ON public.turnos
  FOR UPDATE
  USING (
    user_has_clinic_access(auth.uid(), clinic_id)
    AND (
      (cajero_user_id = auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
  WITH CHECK (
    user_has_clinic_access(auth.uid(), clinic_id)
    AND (
      (cajero_user_id = auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  );