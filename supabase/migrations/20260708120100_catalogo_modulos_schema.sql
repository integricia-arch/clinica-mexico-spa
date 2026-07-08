-- supabase/migrations/20260708120100_catalogo_modulos_schema.sql

CREATE TABLE IF NOT EXISTS public.catalogo_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  descripcion text,
  precio_centavos integer NOT NULL DEFAULT 0 CHECK (precio_centavos >= 0),
  stripe_price_id text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cliente_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  modulo_id uuid NOT NULL REFERENCES public.catalogo_modulos(id),
  activo_desde timestamptz NOT NULL DEFAULT now(),
  activo_hasta timestamptz,
  UNIQUE (clinic_id, modulo_id, activo_desde)
);
CREATE INDEX IF NOT EXISTS idx_cliente_modulos_clinic ON public.cliente_modulos(clinic_id);

CREATE TABLE IF NOT EXISTS public.costos_reales_mensuales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id uuid NOT NULL REFERENCES public.catalogo_modulos(id),
  mes date NOT NULL,
  costo_centavos integer NOT NULL DEFAULT 0 CHECK (costo_centavos >= 0),
  UNIQUE (modulo_id, mes)
);

ALTER TABLE public.catalogo_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_reales_mensuales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalogo_modulos_staff_all" ON public.catalogo_modulos;
CREATE POLICY "catalogo_modulos_staff_all" ON public.catalogo_modulos
  FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

DROP POLICY IF EXISTS "catalogo_modulos_authenticated_read" ON public.catalogo_modulos;
CREATE POLICY "catalogo_modulos_authenticated_read" ON public.catalogo_modulos
  FOR SELECT TO authenticated
  USING (activo = true);

DROP POLICY IF EXISTS "cliente_modulos_staff_all" ON public.cliente_modulos;
CREATE POLICY "cliente_modulos_staff_all" ON public.cliente_modulos
  FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

DROP POLICY IF EXISTS "cliente_modulos_own_clinic_read" ON public.cliente_modulos;
CREATE POLICY "cliente_modulos_own_clinic_read" ON public.cliente_modulos
  FOR SELECT TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id));

DROP POLICY IF EXISTS "costos_reales_staff_all" ON public.costos_reales_mensuales;
CREATE POLICY "costos_reales_staff_all" ON public.costos_reales_mensuales
  FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

GRANT SELECT ON public.catalogo_modulos TO authenticated;
GRANT ALL ON public.catalogo_modulos TO service_role;
GRANT SELECT ON public.cliente_modulos TO authenticated;
GRANT ALL ON public.cliente_modulos TO service_role;
GRANT ALL ON public.costos_reales_mensuales TO service_role;
