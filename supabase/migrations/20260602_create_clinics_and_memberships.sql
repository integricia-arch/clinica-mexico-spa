-- Create clinics table
CREATE TABLE IF NOT EXISTS public.clinics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  name        text NOT NULL,
  legal_name  text,
  rfc         text,
  address     text,
  city        text,
  state       text,
  country     text NOT NULL DEFAULT 'MX',
  timezone    text,
  phone       text,
  email       text,
  logo_url    text,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read clinics"
  ON public.clinics FOR SELECT
  TO authenticated
  USING (true);

-- Create clinic_memberships table
CREATE TABLE IF NOT EXISTS public.clinic_memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  status     text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, user_id)
);

ALTER TABLE public.clinic_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own memberships"
  ON public.clinic_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Seed default clinic
INSERT INTO public.clinics (code, name, country, status)
VALUES ('salud_integral_mx', 'Clínica Salud Integral MX', 'MX', 'active')
ON CONFLICT (code) DO NOTHING;
