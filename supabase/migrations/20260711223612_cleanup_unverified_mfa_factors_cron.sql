-- Housekeeping (no seguridad): factores TOTP unverified abandonados se
-- acumulan en auth.mfa_factors sin limpieza automatica de Supabase (ver
-- memoria/STATE.md sesion 40 -- bug de enroll con friendlyName vacio ya
-- resuelto en el codigo, esto es solo limpieza de residuos historicos y
-- futuros). Un factor unverified nunca se usa para autenticar -- borrar
-- despues de 7 dias es seguro, sin downgrade de seguridad.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-unverified-mfa-factors';

SELECT cron.schedule(
  'cleanup-unverified-mfa-factors',
  '0 3 * * *',
  $$
  DELETE FROM auth.mfa_factors
  WHERE status = 'unverified'
    AND created_at < now() - interval '7 days';
  $$
);
