-- supabase/scripts/migrate_doctor_tokens_to_vault.sql
-- EJECUTAR MANUALMENTE — no es una migración automática.
--
-- Prerequisito: migración 20260622100001_doctor_calendars_vault.sql ya aplicada.
-- Comando: supabase db query --linked --file supabase/scripts/migrate_doctor_tokens_to_vault.sql
--
-- Este script mueve los tokens OAuth en plaintext de doctor_calendars
-- a Supabase Vault y actualiza las columnas vault_*_id en cada fila.
-- Luego de verificar que total = con_vault, aplicar la migración
-- 20260622100002_drop_plaintext_oauth_tokens.sql.

DO $$
DECLARE
  r            RECORD;
  v_access_id  uuid;
  v_refresh_id uuid;
  v_count      integer := 0;
BEGIN
  FOR r IN
    SELECT id, doctor_id, clinic_id, access_token, refresh_token
    FROM public.doctor_calendars
    WHERE access_token IS NOT NULL
  LOOP
    -- Upsert access token into vault
    v_access_id := public.doctor_calendar_upsert_token(r.doctor_id, r.clinic_id, 'access', r.access_token);
    -- Upsert refresh token into vault
    v_refresh_id := public.doctor_calendar_upsert_token(r.doctor_id, r.clinic_id, 'refresh', r.refresh_token);

    -- Store vault UUIDs back in the row
    UPDATE public.doctor_calendars
    SET
      vault_access_token_id  = v_access_id,
      vault_refresh_token_id = v_refresh_id
    WHERE id = r.id;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Tokens migrados a Vault: % filas procesadas.', v_count;
END;
$$;

-- Verificación post-migración (opcional, ejecutar por separado):
-- SELECT COUNT(*) AS total, COUNT(vault_access_token_id) AS con_vault
-- FROM public.doctor_calendars;
-- Expected: total = con_vault
