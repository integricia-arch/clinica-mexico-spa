-- supabase/migrations/20260707120100_clinics_saas_columns.sql

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'estandar',
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id text,
  ADD COLUMN IF NOT EXISTS whatsapp_business_account_id text,
  ADD COLUMN IF NOT EXISTS contacto_facturacion_email text;

CREATE OR REPLACE FUNCTION public.set_clinic_status(_clinic_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_global_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF _status NOT IN ('active','inactive','suspended') THEN
    RAISE EXCEPTION 'Estado inválido: %', _status;
  END IF;
  UPDATE public.clinics SET status = _status, updated_at = now() WHERE id = _clinic_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_clinic_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_clinic_status(uuid, text) TO authenticated;
