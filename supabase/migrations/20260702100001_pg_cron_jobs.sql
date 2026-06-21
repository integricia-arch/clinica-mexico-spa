-- pg_cron jobs for maintenance: cleanup abandoned bot sessions + VACUUM ANALYZE
-- Idempotent: uses cron.unschedule + cron.schedule pattern for safe re-runs

BEGIN;

-- 1. Cleanup abandoned bot_sesiones (PII/GDPR) — hourly
-- Drop existing job if present, then schedule
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-bot-sesiones';

SELECT cron.schedule(
  'cleanup-bot-sesiones',
  '0 * * * *',
  'SELECT public.cleanup_abandoned_bot_sesiones()'
);

-- 2. VACUUM ANALYZE audit_logs — Sunday 3 AM UTC
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'vacuum-audit-logs';

SELECT cron.schedule(
  'vacuum-audit-logs',
  '0 3 * * 0',
  'VACUUM ANALYZE public.audit_logs'
);

-- 3. VACUUM ANALYZE movimientos_inventario — Sunday 3 AM UTC
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'vacuum-movimientos';

SELECT cron.schedule(
  'vacuum-movimientos',
  '0 3 * * 0',
  'VACUUM ANALYZE public.movimientos_inventario'
);

-- 4. VACUUM ANALYZE pharmacy_sales — Sunday 3 AM UTC
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'vacuum-pharmacy-sales';

SELECT cron.schedule(
  'vacuum-pharmacy-sales',
  '0 3 * * 0',
  'VACUUM ANALYZE public.pharmacy_sales'
);

COMMIT;
