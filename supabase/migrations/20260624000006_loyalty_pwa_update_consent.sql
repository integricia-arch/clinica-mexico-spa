-- Allow authenticated PWA user to update ONLY their own marketing consent
DROP POLICY IF EXISTS "loyalty_members_pwa_update_consent" ON loyalty_members;
CREATE POLICY "loyalty_members_pwa_update_consent" ON loyalty_members
  FOR UPDATE TO authenticated
  USING (
    telefono = (SELECT phone FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    telefono = (SELECT phone FROM auth.users WHERE id = auth.uid())
  );