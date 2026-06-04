-- Persistence foundation for the /ajustes settings module.
-- 1) clinic_settings: key/value JSONB store for singleton config sections
--    (horarios, citas, recordatorios, CFDI, políticas, etc.) keyed per clinic.
-- 2) clinics UPDATE policy: the table only had a SELECT policy, so saving the
--    "General" section silently returned 0 rows. Admins may now update.

-- ─────────────────────────────────────────────────────────────
-- 1. clinic_settings
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinic_settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  section    text NOT NULL,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (clinic_id, section)
);

CREATE INDEX IF NOT EXISTS idx_clinic_settings_clinic
  ON public.clinic_settings (clinic_id);

ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may read settings (UI is read-mostly).
CREATE POLICY "Authenticated can read clinic_settings"
  ON public.clinic_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins may create/modify settings.
CREATE POLICY "Admins can insert clinic_settings"
  ON public.clinic_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update clinic_settings"
  ON public.clinic_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete clinic_settings"
  ON public.clinic_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Keep updated_at fresh on write.
CREATE OR REPLACE FUNCTION public.touch_clinic_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
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

-- ─────────────────────────────────────────────────────────────
-- 2. clinics UPDATE policy (SELECT policy already exists)
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Admins can update clinics"
  ON public.clinics FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
