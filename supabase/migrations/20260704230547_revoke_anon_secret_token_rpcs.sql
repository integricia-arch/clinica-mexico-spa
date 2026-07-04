-- cfdi_get_secret / cfdi_upsert_secret / doctor_calendar_get_token /
-- doctor_calendar_upsert_token no tenían NINGÚN check interno (ni auth.uid(),
-- ni rol) y estaban granted a `anon` -- cualquiera con la anon key pública
-- (embebida en el bundle del frontend) podía leer secretos del vault por
-- UUID o robar/sobreescribir tokens OAuth de Google Calendar de cualquier
-- doctor, sin necesidad de sesión ni login. Todos sus callers reales son
-- Edge Functions (service_role) -- ningún caso de uso legítimo desde el
-- frontend. Fix: revocar de anon, dejar solo postgres + service_role.
REVOKE EXECUTE ON FUNCTION public.cfdi_get_secret(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cfdi_upsert_secret(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.doctor_calendar_get_token(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.doctor_calendar_upsert_token(uuid, uuid, text, text) FROM anon;
