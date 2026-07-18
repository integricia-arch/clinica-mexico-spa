-- Auto-provisioning de usuarios: alta de doctor/enfermera → cuenta Auth lista
-- para entrar con Google (identidad se auto-linkea por email confirmado).
-- Reemplaza los borradores 20260718_add_email_to_doctors_nurses.sql y
-- 20260718_auto_user_provisioning.sql (nunca aplicados a prod).
--
-- Piezas:
--   1. Columna email en doctors/nurses.
--   2. Cola user_provisioning_queue (con clinic_id) + triggers de encolado.
--   3. provision_link_user(): núcleo que asigna rol + clinic_membership + vincula user_id.
--   4. Trigger JIT en auth.users: si alguien entra con Google ANTES de ser
--      provisionado, se vincula solo en el primer login.
--   5. RPC provision_link_by_email(): para que la Edge Function vincule
--      usuarios que ya existían en Auth.

-- 1. Email en doctors/nurses -------------------------------------------------

ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE public.nurses  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_doctors_email ON public.doctors(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nurses_email  ON public.nurses(lower(email))  WHERE email IS NOT NULL;

-- 2. Cola de provisioning ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_provisioning_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('doctor', 'nurse')),
  entity_id UUID NOT NULL,
  clinic_id UUID REFERENCES public.clinics(id),
  email TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error_message TEXT,
  UNIQUE(entity_type, entity_id)
);

ALTER TABLE public.user_provisioning_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_access" ON public.user_provisioning_queue;
-- Solo service_role (Edge Function). Ningún cliente lee/escribe la cola.
CREATE POLICY "service_role_access" ON public.user_provisioning_queue
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_user_queue_pending
  ON public.user_provisioning_queue(created_at) WHERE processed_at IS NULL;

-- Triggers de encolado (doctor / nurse)

CREATE OR REPLACE FUNCTION public.enqueue_doctor_user_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.activo AND NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    INSERT INTO public.user_provisioning_queue (entity_type, entity_id, clinic_id, email, nombre_completo)
    VALUES ('doctor', NEW.id, NEW.clinic_id, lower(NEW.email), CONCAT(NEW.nombre, ' ', NEW.apellidos))
    ON CONFLICT (entity_type, entity_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_doctor_user_creation() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.enqueue_nurse_user_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.activo AND NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    INSERT INTO public.user_provisioning_queue (entity_type, entity_id, clinic_id, email, nombre_completo)
    VALUES ('nurse', NEW.id, NEW.clinic_id, lower(NEW.email), CONCAT(NEW.nombre, ' ', NEW.apellidos))
    ON CONFLICT (entity_type, entity_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_nurse_user_creation() FROM PUBLIC;

DROP TRIGGER IF EXISTS doctor_user_enqueue ON public.doctors;
CREATE TRIGGER doctor_user_enqueue
  AFTER INSERT OR UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_doctor_user_creation();

DROP TRIGGER IF EXISTS nurse_user_enqueue ON public.nurses;
CREATE TRIGGER nurse_user_enqueue
  AFTER INSERT OR UPDATE ON public.nurses
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_nurse_user_creation();

-- 3. Núcleo: vincular un auth.users con su doctor/nurse por email ------------

CREATE OR REPLACE FUNCTION public.provision_link_user(_user_id UUID, _email TEXT)
RETURNS TEXT  -- 'doctor' | 'nurse' | NULL si no hubo match
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doctor RECORD;
  _nurse RECORD;
  _role public.app_role;
  _clinic UUID;
  _kind TEXT;
BEGIN
  IF _user_id IS NULL OR _email IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, clinic_id INTO _doctor
  FROM public.doctors
  WHERE lower(email) = lower(_email) AND activo AND user_id IS NULL
  LIMIT 1;

  IF _doctor.id IS NOT NULL THEN
    UPDATE public.doctors SET user_id = _user_id WHERE id = _doctor.id;
    _role := 'doctor'; _clinic := _doctor.clinic_id; _kind := 'doctor';
  ELSE
    SELECT id, clinic_id INTO _nurse
    FROM public.nurses
    WHERE lower(email) = lower(_email) AND activo AND user_id IS NULL
    LIMIT 1;

    IF _nurse.id IS NULL THEN
      RETURN NULL;
    END IF;

    UPDATE public.nurses SET user_id = _user_id WHERE id = _nurse.id;
    _role := 'nurse'; _clinic := _nurse.clinic_id; _kind := 'nurse';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  SELECT _user_id, _role
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );

  IF _clinic IS NOT NULL THEN
    INSERT INTO public.clinic_memberships (user_id, clinic_id, role, status)
    SELECT _user_id, _clinic, _role, 'active'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = _user_id AND clinic_id = _clinic
    );
  END IF;

  -- Marcar cola como procesada si venía de ahí
  UPDATE public.user_provisioning_queue
  SET processed_at = now(), user_id = _user_id
  WHERE lower(email) = lower(_email) AND processed_at IS NULL;

  RETURN _kind;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.provision_link_user(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_link_user(UUID, TEXT) TO service_role;

-- 4. Trigger JIT: primer login con Google se auto-vincula --------------------

CREATE OR REPLACE FUNCTION public.provision_on_auth_user_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.provision_link_user(NEW.id, NEW.email);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear el signup por un fallo de vinculación
  RAISE WARNING '[provision_on_auth_user_created] %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.provision_on_auth_user_created() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created_provision ON auth.users;
CREATE TRIGGER on_auth_user_created_provision
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.provision_on_auth_user_created();

-- 5. RPC para la Edge Function: vincular usuario Auth ya existente -----------

CREATE OR REPLACE FUNCTION public.provision_link_by_email(_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _uid UUID;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN public.provision_link_user(_uid, _email);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.provision_link_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_link_by_email(TEXT) TO service_role;
