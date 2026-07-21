-- check_rate_limit() seguía llamable por anon/authenticated tras REVOKE FROM PUBLIC:
-- Supabase otorga EXECUTE a esos roles directamente (no solo vía PUBLIC).
-- get_advisors(security) lo marcó (anon_security_definer_function_executable /
-- authenticated_security_definer_function_executable). Fix explícito:

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, int, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, int, int) TO service_role;
