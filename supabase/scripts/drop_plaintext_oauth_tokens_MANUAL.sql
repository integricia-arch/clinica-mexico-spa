-- MANUAL ONLY: Run AFTER verifying migrate_doctor_tokens_to_vault.sql completed on all rows.
--
-- supabase/scripts/drop_plaintext_oauth_tokens_MANUAL.sql
-- Eliminar columnas plaintext de OAuth tokens en doctor_calendars.
--
-- ADVERTENCIA: Aplicar ÚNICAMENTE después de:
--   1. Ejecutar supabase/scripts/migrate_doctor_tokens_to_vault.sql
--   2. Verificar que COUNT(*) = COUNT(vault_access_token_id) en doctor_calendars
--      (es decir, todos los tokens ya están en Vault y vault_*_id poblados)
--
-- Comando: supabase db query --linked --file supabase/scripts/drop_plaintext_oauth_tokens_MANUAL.sql
--
-- Si se aplica antes de migrar los datos, los tokens se perderán permanentemente.

ALTER TABLE public.doctor_calendars
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token;
