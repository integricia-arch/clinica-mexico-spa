-- supabase/migrations/20260708120000_clinics_saas_billing_columns.sql

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS stripe_customer_id_saas text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id_saas text,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinics_subscription_status_check'
  ) THEN
    ALTER TABLE public.clinics
      ADD CONSTRAINT clinics_subscription_status_check
      CHECK (subscription_status IN ('trialing','active','past_due','canceled'));
  END IF;
END $$;

-- Extiende el gate ya usado por las 16 policies RESTRICTIVE de Fase A
-- (20260707130000_multiclinic_restrictive_gate_extension.sql) y por
-- storage.objects — misma firma, mismo nombre, sin tocar esas policies.
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
        AND c.subscription_status <> 'canceled'
        AND (c.subscription_status <> 'past_due' OR c.grace_period_ends_at > now())
    );
$$;

REVOKE EXECUTE ON FUNCTION public.user_has_clinic_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_clinic_access(uuid, uuid) TO authenticated;
