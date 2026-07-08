-- get_advisors (security) tras 20260707140000 mostro que `anon` tenia EXECUTE
-- en set_clinic_whatsapp_number/verified pese al REVOKE ... FROM PUBLIC de esa
-- migracion -- este proyecto tiene default privileges que otorgan EXECUTE a
-- anon/authenticated al crear la funcion, grant que no pasa por PUBLIC (mismo
-- patron ya documentado en 20260704230547_revoke_anon_secret_token_rpcs.sql).
-- Ambas funciones ya validan is_global_admin/user_has_clinic_role internamente,
-- pero anon no debe poder invocarlas en absoluto (no hay caso de uso legitimo
-- sin sesion).
REVOKE EXECUTE ON FUNCTION public.set_clinic_whatsapp_number(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_clinic_whatsapp_verified(uuid) FROM anon;
