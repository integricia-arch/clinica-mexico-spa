-- Harden PWA RLS: require authenticated session (Phone OTP)
-- Members can only read their own data

DROP POLICY IF EXISTS "loyalty_members_pwa_read" ON loyalty_members;
CREATE POLICY "loyalty_members_pwa_auth_read" ON loyalty_members
  FOR SELECT TO authenticated
  USING (
    telefono = (SELECT phone FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "loyalty_mov_pwa_read" ON loyalty_movimientos;
CREATE POLICY "loyalty_mov_pwa_auth_read" ON loyalty_movimientos
  FOR SELECT TO authenticated
  USING (
    member_id IN (
      SELECT id FROM loyalty_members lm
      WHERE lm.telefono = (SELECT phone FROM auth.users WHERE id = auth.uid())
        AND lm.clinic_id = loyalty_movimientos.clinic_id
    )
  );

-- loyalty_config remains readable by anon (public program info)
-- loyalty_config_pwa_read stays unchanged
