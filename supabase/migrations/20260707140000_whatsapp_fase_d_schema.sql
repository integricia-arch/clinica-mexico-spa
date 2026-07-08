-- supabase/migrations/20260707140000_whatsapp_fase_d_schema.sql

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS whatsapp_status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinics_whatsapp_status_check'
  ) THEN
    ALTER TABLE public.clinics
      ADD CONSTRAINT clinics_whatsapp_status_check
      CHECK (whatsapp_status IN ('pending','verified'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clinics_whatsapp_phone_number_id
  ON public.clinics(whatsapp_phone_number_id)
  WHERE whatsapp_phone_number_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_audit_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('recordatorio_cita','resultado_laboratorio')),
  referencia_id uuid NOT NULL,
  detectado_at timestamptz NOT NULL DEFAULT now(),
  resuelto boolean NOT NULL DEFAULT false,
  resuelto_at timestamptz,
  resuelto_por uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_audit_alertas_abierta
  ON public.whatsapp_audit_alertas(tipo, referencia_id)
  WHERE resuelto = false;

GRANT SELECT, UPDATE ON public.whatsapp_audit_alertas TO authenticated;
GRANT ALL ON public.whatsapp_audit_alertas TO service_role;
ALTER TABLE public.whatsapp_audit_alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic scoped read alertas" ON public.whatsapp_audit_alertas;
CREATE POLICY "clinic scoped read alertas" ON public.whatsapp_audit_alertas
  FOR SELECT TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id));

DROP POLICY IF EXISTS "clinic scoped resolve alertas" ON public.whatsapp_audit_alertas;
CREATE POLICY "clinic scoped resolve alertas" ON public.whatsapp_audit_alertas
  FOR UPDATE TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id));

DROP POLICY IF EXISTS "platform staff read all alertas" ON public.whatsapp_audit_alertas;
CREATE POLICY "platform staff read all alertas" ON public.whatsapp_audit_alertas
  FOR SELECT TO authenticated
  USING (public.is_global_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_clinic_whatsapp_number(
  _clinic_id uuid, _phone_number_id text, _waba_id text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_global_admin(auth.uid())
    OR public.user_has_clinic_role(auth.uid(), _clinic_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  UPDATE public.clinics
  SET whatsapp_phone_number_id = _phone_number_id,
      whatsapp_business_account_id = _waba_id,
      whatsapp_status = 'pending',
      updated_at = now()
  WHERE id = _clinic_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_clinic_whatsapp_number(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_clinic_whatsapp_number(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_clinic_whatsapp_verified(_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_global_admin(auth.uid())
    OR public.user_has_clinic_role(auth.uid(), _clinic_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  UPDATE public.clinics SET whatsapp_status = 'verified', updated_at = now()
  WHERE id = _clinic_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_clinic_whatsapp_verified(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_clinic_whatsapp_verified(uuid) TO authenticated;
