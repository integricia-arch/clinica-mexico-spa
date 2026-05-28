
-- ============================================
-- FASE A: Tablas clinics y clinic_memberships
-- ============================================

CREATE TABLE IF NOT EXISTS public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  legal_name text,
  rfc text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  country text NOT NULL DEFAULT 'México',
  timezone text NOT NULL DEFAULT 'America/Mexico_City',
  logo_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinics_code ON public.clinics(code);
CREATE INDEX IF NOT EXISTS idx_clinics_status ON public.clinics(status);

GRANT SELECT ON public.clinics TO authenticated;
GRANT ALL ON public.clinics TO service_role;

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_clinics_updated_at ON public.clinics;
CREATE TRIGGER trg_clinics_updated_at
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insertar clínica default
INSERT INTO public.clinics (code, name, country, timezone, status)
VALUES ('salud_integral_mx', 'Salud Integral MX', 'México', 'America/Mexico_City', 'active')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- Tabla clinic_memberships
-- ============================================

CREATE TABLE IF NOT EXISTS public.clinic_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_clinic_memberships_user ON public.clinic_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_clinic ON public.clinic_memberships(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_clinic_role ON public.clinic_memberships(clinic_id, role);
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_user_clinic ON public.clinic_memberships(user_id, clinic_id);

GRANT SELECT ON public.clinic_memberships TO authenticated;
GRANT ALL ON public.clinic_memberships TO service_role;

ALTER TABLE public.clinic_memberships ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_clinic_memberships_updated_at ON public.clinic_memberships;
CREATE TRIGGER trg_clinic_memberships_updated_at
  BEFORE UPDATE ON public.clinic_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- FASE B: Helpers de seguridad
-- ============================================

CREATE OR REPLACE FUNCTION public.is_global_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.user_has_clinic_access(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _clinic_id IS NULL
    OR public.is_global_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = _user_id
        AND clinic_id = _clinic_id
        AND status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_clinic_role(_user_id uuid, _clinic_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_global_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = _user_id
        AND clinic_id = _clinic_id
        AND role = _role
        AND status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.current_user_clinic_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT clinic_id FROM public.clinic_memberships
  WHERE user_id = auth.uid() AND status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.is_global_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_clinic_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_clinic_role(uuid, uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_clinic_ids() TO authenticated;

-- ============================================
-- Policies clinics
-- ============================================

DROP POLICY IF EXISTS "View accessible clinics" ON public.clinics;
CREATE POLICY "View accessible clinics" ON public.clinics
  FOR SELECT TO authenticated
  USING (public.is_global_admin(auth.uid()) OR public.user_has_clinic_access(auth.uid(), id));

DROP POLICY IF EXISTS "Admin manage clinics" ON public.clinics;
CREATE POLICY "Admin manage clinics" ON public.clinics
  FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

-- ============================================
-- Policies clinic_memberships
-- ============================================

DROP POLICY IF EXISTS "User view own memberships" ON public.clinic_memberships;
CREATE POLICY "User view own memberships" ON public.clinic_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_global_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin manage memberships" ON public.clinic_memberships;
CREATE POLICY "Admin manage memberships" ON public.clinic_memberships
  FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

-- ============================================
-- Backfill: memberships desde user_roles
-- ============================================

INSERT INTO public.clinic_memberships (clinic_id, user_id, role, status)
SELECT c.id, ur.user_id, ur.role, 'active'
FROM public.user_roles ur
CROSS JOIN public.clinics c
WHERE c.code = 'salud_integral_mx'
ON CONFLICT (clinic_id, user_id, role) DO NOTHING;
