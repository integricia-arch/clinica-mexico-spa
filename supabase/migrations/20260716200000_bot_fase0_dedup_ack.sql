-- Fase 0 bot Telegram (plan 2026-07-16-bot-telegram-agente.md)
-- 1) Columna last_bot_ack_at: el código la usa desde v9 (throttle de acks durante
--    escalada) pero nunca existió → UPDATE fallaba silencioso y el bot repetía
--    "Recepción ya fue notificada" en cada mensaje (hallazgo Task 0.1).
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS last_bot_ack_at timestamptz;

-- 2) Dedup persistente de updates de Telegram (reintentos del webhook entre
--    isolates → mensajes procesados doble). Solo escribe el webhook (service_role).
CREATE TABLE IF NOT EXISTS telegram_updates (
  update_id  bigint PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE telegram_updates ENABLE ROW LEVEL SECURITY;
-- Sin policies a propósito: anon/authenticated no tienen acceso; service_role bypassa RLS.

-- 3) Limpieza diaria (la tabla solo sirve para dedup de corto plazo).
DO $$
BEGIN
  PERFORM cron.unschedule('telegram-updates-cleanup');
EXCEPTION WHEN OTHERS THEN
  NULL; -- el job no existía
END $$;

SELECT cron.schedule(
  'telegram-updates-cleanup',
  '17 3 * * *',
  $$DELETE FROM telegram_updates WHERE created_at < now() - interval '48 hours'$$
);
