-- Agregar columnas para IDs de secretos en Vault
ALTER TABLE public.cfdi_config
  ADD COLUMN IF NOT EXISTS pac_secret_id uuid,
  ADD COLUMN IF NOT EXISTS csd_secret_id uuid;

-- Wrapper: upsert un secreto en vault.secrets (solo service_role puede llamar)
CREATE OR REPLACE FUNCTION public.cfdi_upsert_secret(
  p_existing_id uuid,
  p_secret      text,
  p_name        text,
  p_description text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  IF p_existing_id IS NOT NULL THEN
    PERFORM vault.update_secret(p_existing_id, p_secret, p_name, p_description);
    RETURN p_existing_id;
  ELSE
    RETURN vault.create_secret(p_secret, p_name, p_description);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cfdi_upsert_secret(uuid, text, text, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.cfdi_upsert_secret(uuid, text, text, text) TO service_role;

-- Wrapper: leer un secreto descifrado (solo service_role)
CREATE OR REPLACE FUNCTION public.cfdi_get_secret(p_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.cfdi_get_secret(uuid) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.cfdi_get_secret(uuid) TO service_role;
