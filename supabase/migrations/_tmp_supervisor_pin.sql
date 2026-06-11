-- 0. Ensure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create profiles table if it doesn't exist, then add column
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS supervisor_pin_hash text;

-- 2. RPC set_supervisor_pin (admin-only, bcrypt PIN)
CREATE OR REPLACE FUNCTION public.set_supervisor_pin(
  p_user_id uuid,
  p_pin     text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $func$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Solo administradores pueden configurar PINs';
  END IF;
  IF p_pin !~ '^\d{4,6}$' THEN
    RAISE EXCEPTION 'PIN_INVALID: debe ser 4-6 dígitos numéricos';
  END IF;
  -- Upsert profile row so the PIN can always be set
  INSERT INTO public.profiles (id)
    VALUES (p_user_id)
    ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles
     SET supervisor_pin_hash = crypt(p_pin, gen_salt('bf'))
   WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;
END;
$func$;

-- 3. RPC get_clinic_supervisors (returns admins/managers with has_pin flag)
-- Uses clinic_memberships (actual table name in this DB)
CREATE OR REPLACE FUNCTION public.get_clinic_supervisors(
  p_clinic_id uuid
) RETURNS TABLE(user_id uuid, email text, full_name text, has_pin boolean)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cm.user_id,
    u.email,
    COALESCE(p.full_name, u.email) AS full_name,
    (p.supervisor_pin_hash IS NOT NULL) AS has_pin
  FROM public.clinic_memberships cm
  JOIN auth.users u ON u.id = cm.user_id
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  WHERE cm.clinic_id = p_clinic_id
    AND cm.role IN ('admin', 'manager');
$$;

-- 4. RPC turno_close_with_pin (verifies PIN then delegates to turno_close)
CREATE OR REPLACE FUNCTION public.turno_close_with_pin(
  p_turno_id      uuid,
  p_supervisor_id uuid,
  p_pin           text,
  p_cash_count    numeric,
  p_notes         text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_hash text;
BEGIN
  SELECT supervisor_pin_hash INTO v_hash
    FROM public.profiles WHERE id = p_supervisor_id;

  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'PIN_NOT_CONFIGURED';
  END IF;

  IF crypt(p_pin, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'PIN_INCORRECT';
  END IF;

  IF NOT (has_role(p_supervisor_id, 'admin'::app_role)
          OR has_role(p_supervisor_id, 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Supervisor sin rol admin/manager';
  END IF;

  RETURN public.turno_close(p_turno_id, p_cash_count, p_notes, true);
END;
$func$;

-- 5. Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.set_supervisor_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_clinic_supervisors(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.turno_close_with_pin(uuid, uuid, text, numeric, text) TO authenticated;
