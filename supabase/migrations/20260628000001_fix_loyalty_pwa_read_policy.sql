-- Fix: loyalty_members_pwa_auth_read queried auth.users directly, which
-- the authenticated role cannot access. Replace with JWT claims — available
-- to all authenticated users without direct table access.
DROP POLICY IF EXISTS "loyalty_members_pwa_auth_read" ON public.loyalty_members;

CREATE POLICY "loyalty_members_pwa_auth_read" ON public.loyalty_members
  FOR SELECT TO authenticated
  USING (
    telefono = (auth.jwt() ->> 'phone')
    OR email  = auth.email()
  );
