-- REVOKE ... FROM PUBLIC no quita los grants explícitos que Supabase aplica a
-- anon/authenticated/service_role vía ALTER DEFAULT PRIVILEGES al crear la función.
-- get_advisors detectó anon con EXECUTE en las 6 funciones MFA nuevas.

-- Funciones de trigger: nadie debe poder invocarlas directo vía RPC.
REVOKE EXECUTE ON FUNCTION public.mfa_require_for_new_admin() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profiles_protect_mfa_flag() FROM anon, authenticated;

-- RPCs de usuario: solo authenticated (requieren auth.uid(), anon nunca las usa).
REVOKE EXECUTE ON FUNCTION public.mfa_register_trusted_device(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mfa_check_trusted_device(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mfa_list_trusted_devices() FROM anon;
REVOKE EXECUTE ON FUNCTION public.mfa_revoke_trusted_device(uuid) FROM anon;
