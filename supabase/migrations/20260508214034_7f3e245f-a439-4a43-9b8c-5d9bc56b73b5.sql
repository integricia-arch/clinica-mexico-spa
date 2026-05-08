
-- 1) Lock down log_audit RPC: only service_role can call it directly.
REVOKE EXECUTE ON FUNCTION public.log_audit(audit_action, text, uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_audit(audit_action, text, uuid, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_audit(audit_action, text, uuid, jsonb, jsonb) FROM authenticated;

-- 2) Restrictive policy on user_roles: only admins may INSERT/UPDATE/DELETE.
DROP POLICY IF EXISTS "Only admins can write user_roles" ON public.user_roles;
CREATE POLICY "Only admins can write user_roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
