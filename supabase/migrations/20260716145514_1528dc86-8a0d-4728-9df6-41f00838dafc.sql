-- ================================================================
-- Esquema faltante: suscripciones, módulos, alertas WhatsApp, PHI log
-- ================================================================

-- 1) Columnas nuevas en clinics
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'basico',
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_status text,
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id text;

-- 2) Tabla catalogo_modulos (módulos comercializables)
CREATE TABLE IF NOT EXISTS public.catalogo_modulos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  nombre text NOT NULL,
  descripcion text,
  precio_centavos integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.catalogo_modulos TO authenticated;
GRANT ALL ON public.catalogo_modulos TO service_role;

ALTER TABLE public.catalogo_modulos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalogo_modulos_select_authenticated" ON public.catalogo_modulos;
CREATE POLICY "catalogo_modulos_select_authenticated"
  ON public.catalogo_modulos FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "catalogo_modulos_admin_write" ON public.catalogo_modulos;
CREATE POLICY "catalogo_modulos_admin_write"
  ON public.catalogo_modulos FOR ALL
  TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

-- 3) Tabla cliente_modulos (módulos contratados por clínica)
CREATE TABLE IF NOT EXISTS public.cliente_modulos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  modulo_id uuid NOT NULL REFERENCES public.catalogo_modulos(id) ON DELETE CASCADE,
  activo_desde timestamptz NOT NULL DEFAULT now(),
  activo_hasta timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, modulo_id)
);

CREATE INDEX IF NOT EXISTS idx_cliente_modulos_clinic ON public.cliente_modulos(clinic_id);

GRANT SELECT ON public.cliente_modulos TO authenticated;
GRANT ALL ON public.cliente_modulos TO service_role;

ALTER TABLE public.cliente_modulos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cliente_modulos_select_own_clinic" ON public.cliente_modulos;
CREATE POLICY "cliente_modulos_select_own_clinic"
  ON public.cliente_modulos FOR SELECT
  TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id));

DROP POLICY IF EXISTS "cliente_modulos_admin_write" ON public.cliente_modulos;
CREATE POLICY "cliente_modulos_admin_write"
  ON public.cliente_modulos FOR ALL
  TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

-- 4) Tabla whatsapp_audit_alertas
CREATE TABLE IF NOT EXISTS public.whatsapp_audit_alertas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  referencia_id text,
  detalle jsonb,
  detectado_at timestamptz NOT NULL DEFAULT now(),
  resuelto boolean NOT NULL DEFAULT false,
  resuelto_at timestamptz,
  resuelto_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_alertas_clinic ON public.whatsapp_audit_alertas(clinic_id, resuelto);

GRANT SELECT, INSERT, UPDATE ON public.whatsapp_audit_alertas TO authenticated;
GRANT ALL ON public.whatsapp_audit_alertas TO service_role;

ALTER TABLE public.whatsapp_audit_alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_alertas_admin_all" ON public.whatsapp_audit_alertas;
CREATE POLICY "whatsapp_alertas_admin_all"
  ON public.whatsapp_audit_alertas FOR ALL
  TO authenticated
  USING (public.is_global_admin(auth.uid()) OR public.user_has_clinic_role(auth.uid(), clinic_id, 'admin'::app_role))
  WITH CHECK (public.is_global_admin(auth.uid()) OR public.user_has_clinic_role(auth.uid(), clinic_id, 'admin'::app_role));

-- 5) Tabla payment_gateway_config
CREATE TABLE IF NOT EXISTS public.payment_gateway_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL UNIQUE REFERENCES public.clinics(id) ON DELETE CASCADE,
  proveedor text NOT NULL DEFAULT 'stripe',
  ambiente text NOT NULL DEFAULT 'sandbox',
  stripe_publishable_key text,
  stripe_terminal_habilitado boolean NOT NULL DEFAULT false,
  metodos_habilitados text[] NOT NULL DEFAULT ARRAY['card']::text[],
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_gateway_config TO authenticated;
GRANT ALL ON public.payment_gateway_config TO service_role;

ALTER TABLE public.payment_gateway_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_gateway_config_clinic_admin" ON public.payment_gateway_config;
CREATE POLICY "payment_gateway_config_clinic_admin"
  ON public.payment_gateway_config FOR ALL
  TO authenticated
  USING (public.is_global_admin(auth.uid()) OR public.user_has_clinic_role(auth.uid(), clinic_id, 'admin'::app_role))
  WITH CHECK (public.is_global_admin(auth.uid()) OR public.user_has_clinic_role(auth.uid(), clinic_id, 'admin'::app_role));

-- Triggers updated_at
DROP TRIGGER IF EXISTS trg_catalogo_modulos_updated_at ON public.catalogo_modulos;
CREATE TRIGGER trg_catalogo_modulos_updated_at BEFORE UPDATE ON public.catalogo_modulos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_cliente_modulos_updated_at ON public.cliente_modulos;
CREATE TRIGGER trg_cliente_modulos_updated_at BEFORE UPDATE ON public.cliente_modulos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_payment_gateway_config_updated_at ON public.payment_gateway_config;
CREATE TRIGGER trg_payment_gateway_config_updated_at BEFORE UPDATE ON public.payment_gateway_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ================================================================
-- RPCs
-- ================================================================

-- log_phi_access: registra un acceso a PHI en audit_logs
CREATE OR REPLACE FUNCTION public.log_phi_access(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_tabla text,
  p_accion text DEFAULT 'select'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (
    auth.uid(),
    'consultar'::public.audit_action,
    p_tabla,
    p_patient_id,
    jsonb_build_object('event', 'phi_access', 'accion', p_accion, 'patient_id', p_patient_id),
    p_clinic_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_phi_access(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_phi_access(uuid, uuid, text, text) TO authenticated;

-- set_clinic_status: admin global cambia status de una clínica
CREATE OR REPLACE FUNCTION public.set_clinic_status(
  _clinic_id uuid,
  _status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_global_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo administradores globales pueden cambiar el estado de una clínica';
  END IF;

  UPDATE public.clinics SET status = _status, updated_at = now() WHERE id = _clinic_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (auth.uid(), 'actualizar'::public.audit_action, 'clinics', _clinic_id,
          jsonb_build_object('event','clinic_status_changed','status',_status), _clinic_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_clinic_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_clinic_status(uuid, text) TO authenticated;

-- set_clinic_archived: admin global archiva/desarchiva una clínica
CREATE OR REPLACE FUNCTION public.set_clinic_archived(
  _clinic_id uuid,
  _archived boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_global_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo administradores globales pueden archivar clínicas';
  END IF;

  UPDATE public.clinics
     SET archived_at = CASE WHEN _archived THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = _clinic_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (auth.uid(), 'actualizar'::public.audit_action, 'clinics', _clinic_id,
          jsonb_build_object('event','clinic_archived_changed','archived',_archived), _clinic_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_clinic_archived(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_clinic_archived(uuid, boolean) TO authenticated;

-- set_clinic_whatsapp_number: admin global registra el phone_number_id de WhatsApp de una clínica
CREATE OR REPLACE FUNCTION public.set_clinic_whatsapp_number(
  _clinic_id uuid,
  _phone_number_id text,
  _waba_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_global_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo administradores globales pueden configurar WhatsApp';
  END IF;

  UPDATE public.clinics
     SET whatsapp_phone_number_id = NULLIF(_phone_number_id, ''),
         whatsapp_status = CASE
           WHEN NULLIF(_phone_number_id, '') IS NULL THEN NULL
           ELSE 'configurado'
         END,
         updated_at = now()
   WHERE id = _clinic_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (auth.uid(), 'actualizar'::public.audit_action, 'clinics', _clinic_id,
          jsonb_build_object('event','clinic_whatsapp_configured','phone_number_id',_phone_number_id,'waba_id',_waba_id),
          _clinic_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_clinic_whatsapp_number(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_clinic_whatsapp_number(uuid, text, text) TO authenticated;