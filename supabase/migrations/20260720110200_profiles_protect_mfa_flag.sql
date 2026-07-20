-- profiles_own_update permite a cualquier usuario actualizar CUALQUIER columna
-- de su propia fila, incluida mfa_enrollment_required — un usuario podría
-- desactivar su propio requisito de MFA vía supabase.from("profiles").update().
-- Trigger: solo un admin (o el service_role/trigger de alta) puede cambiar el flag.
CREATE OR REPLACE FUNCTION public.profiles_protect_mfa_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mfa_enrollment_required IS DISTINCT FROM OLD.mfa_enrollment_required
     AND NOT public.is_global_admin(auth.uid()) THEN
    NEW.mfa_enrollment_required := OLD.mfa_enrollment_required;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.profiles_protect_mfa_flag() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_profiles_protect_mfa_flag ON public.profiles;
CREATE TRIGGER trg_profiles_protect_mfa_flag
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_protect_mfa_flag();
