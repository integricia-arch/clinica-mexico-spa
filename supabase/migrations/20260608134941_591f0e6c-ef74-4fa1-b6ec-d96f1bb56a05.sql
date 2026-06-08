
-- 1) Fix is_global_admin to check permanent_admins strictly
CREATE OR REPLACE FUNCTION public.is_global_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.permanent_admins pa
    JOIN auth.users u ON lower(u.email) = lower(pa.email)
    WHERE u.id = _user_id
  );
$$;

-- 2) Restrict user_roles writes to global admins only
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can delete user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can write user_roles" ON public.user_roles;

CREATE POLICY "Global admins insert user_roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_global_admin(auth.uid()));

CREATE POLICY "Global admins update user_roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

CREATE POLICY "Global admins delete user_roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_global_admin(auth.uid()));

-- 3) Fix touch_updated_at search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 4) Tighten realtime broadcast policy: restrict to global admins
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'realtime.messages'::regclass
      AND polname = 'Staff can receive realtime broadcasts'
  ) THEN
    EXECUTE 'DROP POLICY "Staff can receive realtime broadcasts" ON realtime.messages';
  END IF;

  EXECUTE $p$
    CREATE POLICY "Only global admins receive realtime broadcasts"
      ON realtime.messages FOR SELECT TO authenticated
      USING (public.is_global_admin(auth.uid()))
  $p$;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping realtime.messages policy change (insufficient privilege)';
END $$;
