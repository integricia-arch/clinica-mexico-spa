-- pg_cron: auditoria pasiva de mensajes WhatsApp esperados (recordatorios
-- de cita vencidos sin envio). Corre cada 15 min. Idempotente
-- (unschedule + schedule), secret leido del vault -- nunca en claro aqui.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'whatsapp-audit-mensajes';

SELECT cron.schedule(
  'whatsapp-audit-mensajes',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kyfkvdyxpvpiacyymldc.supabase.co/functions/v1/whatsapp-audit-mensajes',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'whatsapp_audit_cron_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
