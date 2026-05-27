
-- Whitelist de administradores permanentes
CREATE TABLE IF NOT EXISTS public.permanent_admins (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.permanent_admins TO authenticated;
GRANT ALL ON public.permanent_admins TO service_role;

ALTER TABLE public.permanent_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manage permanent_admins" ON public.permanent_admins;
CREATE POLICY "Admin manage permanent_admins" ON public.permanent_admins
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.permanent_admins (email) VALUES ('integric.ia@gmail.com')
  ON CONFLICT (email) DO NOTHING;

-- Asegura rol admin para todos los emails en la whitelist
CREATE OR REPLACE FUNCTION public.ensure_permanent_admins()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  SELECT u.id, 'admin'::app_role
    FROM auth.users u
    JOIN public.permanent_admins pa ON lower(pa.email) = lower(u.email)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_permanent_admins() FROM PUBLIC, anon, authenticated;

-- Ejecutar ahora
SELECT public.ensure_permanent_admins();

-- Trigger: si alguien elimina el rol admin de un usuario whitelisted, se reinserta
CREATE OR REPLACE FUNCTION public.prevent_permanent_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF OLD.role = 'admin'::app_role THEN
    SELECT email INTO v_email FROM auth.users WHERE id = OLD.user_id;
    IF v_email IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.permanent_admins WHERE lower(email) = lower(v_email)
    ) THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (OLD.user_id, 'admin'::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_permanent_admin_removal ON public.user_roles;
CREATE TRIGGER trg_prevent_permanent_admin_removal
  AFTER DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_permanent_admin_removal();

-- Reemplazar handle_new_user_role para asignar admin si el email está en whitelist
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.permanent_admins WHERE lower(email) = lower(NEW.email)) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'patient'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
