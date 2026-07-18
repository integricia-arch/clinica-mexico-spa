-- Hardening de auto-provisioning (hallazgos de code review):
--
-- 1. CRITICAL: el trigger JIT vinculaba rol + clinic_membership en el INSERT de
--    auth.users sin verificar email_confirmed_at. Un atacante podía hacer signup
--    por password con el email de un doctor activo (Turnstile no prueba propiedad
--    del buzón) y quedarse con el user_id vinculado — escalación de privilegios o
--    DoS permanente de la cuenta médica. Ahora solo vincula con email confirmado:
--    Google OAuth llega confirmado en el INSERT; signup por password vincula hasta
--    que el usuario confirma (UPDATE de email_confirmed_at NULL → NOT NULL).
--
-- 2. MEDIUM: provision_link_user marcaba TODA la cola con ese email como
--    procesada, aunque la entidad no vinculada (email duplicado doctor+nurse)
--    quedara huérfana. Ahora filtra por entity_type.
--
-- 3. MEDIUM: baja de doctor/enfermera (activo → false) no revocaba acceso.
--    Ahora desactiva su clinic_membership del rol correspondiente.

-- 1. JIT solo con email confirmado ------------------------------------------

CREATE OR REPLACE FUNCTION public.provision_on_auth_user_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nunca vincular una cuenta cuyo email no esté confirmado.
  IF NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.provision_link_user(NEW.id, NEW.email);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[provision_on_auth_user_created] %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_provision ON auth.users;
CREATE TRIGGER on_auth_user_created_provision
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.provision_on_auth_user_created();

-- Cubre signup por password: vincula al momento de confirmar el email.
DROP TRIGGER IF EXISTS on_auth_user_confirmed_provision ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_provision
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.provision_on_auth_user_created();

-- 2. Cola: marcar procesada solo la entidad realmente vinculada --------------

CREATE OR REPLACE FUNCTION public.provision_link_user(_user_id UUID, _email TEXT)
RETURNS TEXT
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

  UPDATE public.user_provisioning_queue
  SET processed_at = now(), user_id = _user_id
  WHERE lower(email) = lower(_email)
    AND entity_type = _kind
    AND processed_at IS NULL;

  RETURN _kind;
END;
$$;

-- (REVOKE/GRANT ya aplicados en 20260718110000; CREATE OR REPLACE los conserva)

-- 3. Baja revoca membership ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.revoke_membership_on_deactivate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
BEGIN
  IF OLD.activo AND NOT NEW.activo AND NEW.user_id IS NOT NULL THEN
    _role := CASE TG_TABLE_NAME WHEN 'doctors' THEN 'doctor'::public.app_role
                                 ELSE 'nurse'::public.app_role END;
    -- Solo la membership de ESTE rol en ESTA clínica; si la persona tiene otra
    -- membership (ej. admin) no se toca. user_roles global se conserva: el
    -- acceso real lo gatea clinic_memberships.
    UPDATE public.clinic_memberships
    SET status = 'inactive', updated_at = now()
    WHERE user_id = NEW.user_id
      AND clinic_id = NEW.clinic_id
      AND role = _role
      AND status = 'active';
  ELSIF NOT OLD.activo AND NEW.activo AND NEW.user_id IS NOT NULL THEN
    -- Reactivación: restaurar la membership que esta misma función desactivó.
    _role := CASE TG_TABLE_NAME WHEN 'doctors' THEN 'doctor'::public.app_role
                                 ELSE 'nurse'::public.app_role END;
    UPDATE public.clinic_memberships
    SET status = 'active', updated_at = now()
    WHERE user_id = NEW.user_id
      AND clinic_id = NEW.clinic_id
      AND role = _role
      AND status = 'inactive';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_membership_on_deactivate() FROM PUBLIC;

DROP TRIGGER IF EXISTS doctor_deactivate_revoke ON public.doctors;
CREATE TRIGGER doctor_deactivate_revoke
  AFTER UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.revoke_membership_on_deactivate();

DROP TRIGGER IF EXISTS nurse_deactivate_revoke ON public.nurses;
CREATE TRIGGER nurse_deactivate_revoke
  AFTER UPDATE ON public.nurses
  FOR EACH ROW EXECUTE FUNCTION public.revoke_membership_on_deactivate();
