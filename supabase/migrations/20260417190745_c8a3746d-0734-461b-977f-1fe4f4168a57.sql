-- Restrictive policies to deny ALL client-side writes to audit_logs.
-- The log_audit() SECURITY DEFINER function bypasses RLS, so server-side audit logging continues to work.

CREATE POLICY "Deny all inserts on audit_logs"
ON public.audit_logs
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "Deny all updates on audit_logs"
ON public.audit_logs
AS RESTRICTIVE
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny all deletes on audit_logs"
ON public.audit_logs
AS RESTRICTIVE
FOR DELETE
TO authenticated, anon
USING (false);