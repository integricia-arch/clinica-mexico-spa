-- supabase/migrations/20260707120000_platform_staff_and_admin_leak_fix.sql

CREATE TABLE IF NOT EXISTS public.platform_staff (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_staff_self_read" ON public.platform_staff;
CREATE POLICY "platform_staff_self_read" ON public.platform_staff
  FOR SELECT TO authenticated
  USING (public.is_global_admin(auth.uid()));

GRANT SELECT ON public.platform_staff TO authenticated;
GRANT ALL ON public.platform_staff TO service_role;

CREATE OR REPLACE FUNCTION public.is_global_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_staff WHERE user_id = _user_id);
$$;

REVOKE EXECUTE ON FUNCTION public.is_global_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_global_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.user_has_clinic_access(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _clinic_id IS NULL
    OR public.is_global_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      JOIN public.clinics c ON c.id = cm.clinic_id
      WHERE cm.user_id = _user_id
        AND cm.clinic_id = _clinic_id
        AND cm.status = 'active'
        AND c.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_clinic_role(_user_id uuid, _clinic_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_global_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      JOIN public.clinics c ON c.id = cm.clinic_id
      WHERE cm.user_id = _user_id
        AND cm.clinic_id = _clinic_id
        AND cm.role = _role
        AND cm.status = 'active'
        AND c.status = 'active'
    );
$$;

REVOKE EXECUTE ON FUNCTION public.user_has_clinic_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_clinic_access(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_clinic_role(uuid, uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_clinic_role(uuid, uuid, public.app_role) TO authenticated;
