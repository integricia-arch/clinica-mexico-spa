-- 1. clinic_settings
CREATE TABLE IF NOT EXISTS public.clinic_settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  section    text NOT NULL,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (clinic_id, section)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_settings TO authenticated;
GRANT ALL ON public.clinic_settings TO service_role;

CREATE INDEX IF NOT EXISTS idx_clinic_settings_clinic
  ON public.clinic_settings (clinic_id);

ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read clinic_settings" ON public.clinic_settings;
CREATE POLICY "Authenticated can read clinic_settings"
  ON public.clinic_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert clinic_settings" ON public.clinic_settings;
CREATE POLICY "Admins can insert clinic_settings"
  ON public.clinic_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update clinic_settings" ON public.clinic_settings;
CREATE POLICY "Admins can update clinic_settings"
  ON public.clinic_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete clinic_settings" ON public.clinic_settings;
CREATE POLICY "Admins can delete clinic_settings"
  ON public.clinic_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_clinic_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinic_settings_updated_at ON public.clinic_settings;
CREATE TRIGGER trg_clinic_settings_updated_at
  BEFORE UPDATE ON public.clinic_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_clinic_settings_updated_at();

-- 2. clinics UPDATE policy
DROP POLICY IF EXISTS "Admins can update clinics" ON public.clinics;
CREATE POLICY "Admins can update clinics"
  ON public.clinics FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));