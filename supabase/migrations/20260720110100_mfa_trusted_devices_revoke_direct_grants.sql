-- get_advisors: mfa_trusted_devices tenía SELECT por defecto para anon/authenticated
-- (visible en introspección GraphQL) aunque la policy ya lo bloquee con USING(false).
-- Acceso es solo vía las RPCs SECURITY DEFINER — sin necesidad de grant directo en la tabla.
REVOKE ALL ON public.mfa_trusted_devices FROM anon, authenticated;
