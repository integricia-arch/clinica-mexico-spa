-- supabase/migrations/20260711144403_phi_access_log_revoke_anon.sql

-- Supabase otorga privilegios por defecto a "anon" a nivel de schema
-- (ALTER DEFAULT PRIVILEGES). El brief original solo revocaba PUBLIC,
-- authenticated y service_role — se detecto en la verificacion manual que
-- "anon" (usuarios sin sesion) tenia INSERT/SELECT/UPDATE/DELETE/TRUNCATE
-- de fabrica. Se revoca explicitamente tambien de anon.
REVOKE ALL ON public.phi_access_log FROM anon;
