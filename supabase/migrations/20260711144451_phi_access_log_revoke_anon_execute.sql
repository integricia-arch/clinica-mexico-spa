-- supabase/migrations/20260711144451_phi_access_log_revoke_anon_execute.sql

-- Igual que con la tabla: Supabase otorga EXECUTE por defecto a "anon" a
-- nivel de schema, y REVOKE ... FROM PUBLIC no lo alcanza porque el grant
-- a "anon" es explicito, no heredado de PUBLIC. Se detecto via
-- get_advisors (anon_security_definer_function_executable) y se revoca
-- explicitamente.
REVOKE EXECUTE ON FUNCTION public.log_phi_access(uuid, uuid, text, text) FROM anon;
