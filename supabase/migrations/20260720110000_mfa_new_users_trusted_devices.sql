-- MFA solo obligatorio para usuarios NUEVOS con rol admin (grandfather de existentes)
-- + dispositivos de confianza para no re-pedir TOTP en el mismo dispositivo.

-- 1. Flag por usuario: requiere completar enrolamiento MFA antes de usar la app.
--    Default false => usuarios ya existentes quedan grandfathered (no se les exige retroactivo).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_enrollment_required boolean NOT NULL DEFAULT false;

-- 2. Dispositivos de confianza.
CREATE TABLE IF NOT EXISTS public.mfa_trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token_hash text NOT NULL,
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '60 days',
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS mfa_trusted_devices_user_hash_idx
  ON public.mfa_trusted_devices(user_id, device_token_hash);

ALTER TABLE public.mfa_trusted_devices ENABLE ROW LEVEL SECURITY;

-- Sin acceso directo del cliente: solo vía RPCs SECURITY DEFINER de abajo.
DROP POLICY IF EXISTS "mfa_trusted_devices_no_direct_access" ON public.mfa_trusted_devices;
CREATE POLICY "mfa_trusted_devices_no_direct_access" ON public.mfa_trusted_devices
  FOR ALL USING (false) WITH CHECK (false);

-- 3. Trigger: cualquier NUEVA asignación de rol admin marca al usuario como
--    requerido de MFA. Asignaciones ya existentes (previas a esta migración)
--    no disparan este trigger, así que quedan grandfathered.
CREATE OR REPLACE FUNCTION public.mfa_require_for_new_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    UPDATE public.profiles SET mfa_enrollment_required = true WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mfa_require_for_new_admin() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_mfa_require_for_new_admin ON public.user_roles;
CREATE TRIGGER trg_mfa_require_for_new_admin
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.mfa_require_for_new_admin();

-- 4. Registrar dispositivo de confianza (se llama justo tras un TOTP verify exitoso).
--    El cliente nunca manda el hash: manda el token crudo (uuid random) y aquí se hashea.
CREATE OR REPLACE FUNCTION public.mfa_register_trusted_device(_device_token text, _device_label text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF _device_token IS NULL OR length(_device_token) < 32 THEN
    RAISE EXCEPTION 'Token de dispositivo inválido';
  END IF;

  INSERT INTO public.mfa_trusted_devices (user_id, device_token_hash, device_label)
  VALUES (auth.uid(), encode(extensions.digest(_device_token, 'sha256'), 'hex'), _device_label)
  ON CONFLICT (user_id, device_token_hash)
  DO UPDATE SET last_seen_at = now(), expires_at = now() + interval '60 days', revoked_at = NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mfa_register_trusted_device(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mfa_register_trusted_device(text, text) TO authenticated;

-- 5. Verificar dispositivo de confianza (gate en cada carga de sesión).
--    Renueva la ventana de 60 días en cada check válido (uso activo = sigue confiable).
CREATE OR REPLACE FUNCTION public.mfa_check_trusted_device(_device_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matched uuid;
BEGIN
  IF auth.uid() IS NULL OR _device_token IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.mfa_trusted_devices
     SET last_seen_at = now(), expires_at = now() + interval '60 days'
   WHERE user_id = auth.uid()
     AND device_token_hash = encode(extensions.digest(_device_token, 'sha256'), 'hex')
     AND revoked_at IS NULL
     AND expires_at > now()
   RETURNING id INTO v_matched;

  RETURN v_matched IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mfa_check_trusted_device(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mfa_check_trusted_device(text) TO authenticated;

-- 6. Listar/revocar dispositivos propios (logística de control — self-service en Configuración).
CREATE OR REPLACE FUNCTION public.mfa_list_trusted_devices()
RETURNS TABLE(id uuid, device_label text, created_at timestamptz, last_seen_at timestamptz, expires_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, device_label, created_at, last_seen_at, expires_at
  FROM public.mfa_trusted_devices
  WHERE user_id = auth.uid() AND revoked_at IS NULL AND expires_at > now()
  ORDER BY last_seen_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.mfa_list_trusted_devices() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mfa_list_trusted_devices() TO authenticated;

CREATE OR REPLACE FUNCTION public.mfa_revoke_trusted_device(_device_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mfa_trusted_devices
     SET revoked_at = now()
   WHERE id = _device_id AND user_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mfa_revoke_trusted_device(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mfa_revoke_trusted_device(uuid) TO authenticated;
