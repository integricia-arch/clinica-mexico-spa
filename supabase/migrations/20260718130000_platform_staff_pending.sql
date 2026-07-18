-- platform_staff por email pendiente: se asigna solo en el primer login
-- (mismo patrón JIT que provision_link_user, para staff de plataforma).
-- Alta: INSERT del email aquí; cuando esa persona entra con Google (o confirma
-- su email), el trigger la promueve a platform_staff y borra el pendiente.

CREATE TABLE IF NOT EXISTS public.platform_staff_pending (
  email TEXT PRIMARY KEY CHECK (email = lower(email)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_staff_pending ENABLE ROW LEVEL SECURITY;
-- Sin policies para clientes: solo service_role / SQL directo.
GRANT ALL ON public.platform_staff_pending TO service_role;

CREATE OR REPLACE FUNCTION public.provision_on_auth_user_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.provision_link_user(NEW.id, NEW.email);

    -- Staff de plataforma pendiente por email
    IF EXISTS (SELECT 1 FROM public.platform_staff_pending WHERE email = lower(NEW.email)) THEN
      INSERT INTO public.platform_staff (user_id)
      VALUES (NEW.id)
      ON CONFLICT (user_id) DO NOTHING;
      DELETE FROM public.platform_staff_pending WHERE email = lower(NEW.email);
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[provision_on_auth_user_created] %', SQLERRM;
  RETURN NEW;
END;
$$;

-- (Triggers de 20260718120000 siguen apuntando a esta función; REVOKE previo se conserva)
