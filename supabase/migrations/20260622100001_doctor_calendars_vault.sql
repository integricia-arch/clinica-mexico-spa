-- supabase/migrations/20260622100001_doctor_calendars_vault.sql
-- Migrar OAuth tokens de doctor_calendars a Supabase Vault.
-- Adds vault reference columns and RPC helpers (service_role only).

-- 1. Agregar columnas para referencias a Vault
ALTER TABLE public.doctor_calendars
  ADD COLUMN IF NOT EXISTS vault_access_token_id  uuid,
  ADD COLUMN IF NOT EXISTS vault_refresh_token_id uuid;

-- 2. RPC para upsert de token OAuth (solo service_role puede llamar)
--    Crea o actualiza el secreto en vault.secrets y devuelve su id.
CREATE OR REPLACE FUNCTION public.doctor_calendar_upsert_token(
  p_doctor_id   uuid,
  p_token_type  text,  -- 'access' | 'refresh'
  p_token_value text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret_name text;
  v_existing_id uuid;
  v_vault_id    uuid;
BEGIN
  v_secret_name := 'doctor_calendar_' || p_token_type || '_' || p_doctor_id;

  -- Check if a secret with this name already exists
  SELECT id INTO v_existing_id
  FROM vault.secrets
  WHERE name = v_secret_name
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Update in place; vault.update_secret handles re-encryption
    PERFORM vault.update_secret(v_existing_id, p_token_value, v_secret_name, 'Google OAuth token');
    v_vault_id := v_existing_id;
  ELSE
    v_vault_id := vault.create_secret(p_token_value, v_secret_name, 'Google OAuth token');
  END IF;

  RETURN v_vault_id;
END;
$$;

REVOKE ALL ON FUNCTION public.doctor_calendar_upsert_token(uuid, text, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_calendar_upsert_token(uuid, text, text) TO service_role;

-- 3. RPC para leer token OAuth descifrado (solo service_role puede llamar)
CREATE OR REPLACE FUNCTION public.doctor_calendar_get_token(
  p_doctor_id  uuid,
  p_token_type text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret_name text;
  v_decrypted   text;
BEGIN
  v_secret_name := 'doctor_calendar_' || p_token_type || '_' || p_doctor_id;
  SELECT decrypted_secret INTO v_decrypted
  FROM vault.decrypted_secrets
  WHERE name = v_secret_name
  LIMIT 1;
  RETURN v_decrypted;
END;
$$;

REVOKE ALL ON FUNCTION public.doctor_calendar_get_token(uuid, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_calendar_get_token(uuid, text) TO service_role;
