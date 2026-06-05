-- Per-row CRUD tables for the last two demo-only /ajustes sections:
--   Checklists clínicos  → public.checklists
--   Inventario y costos   → public.insumos, public.proveedores, public.kits
-- All clinic-scoped (clinic_id), admin-write / authenticated-read RLS,
-- matching the existing servicios/doctors + clinic_settings conventions.
-- Money stored in centavos (integers), mirroring servicios.precio_centavos.

-- Shared trigger to keep updated_at fresh on every write.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 1. checklists  (Checklists clínicos por servicio)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.checklists (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id              uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  servicio               text NOT NULL,
  pasos                  integer NOT NULL DEFAULT 0 CHECK (pasos >= 0),
  responsable            text,
  bloquear_avance        boolean NOT NULL DEFAULT false,
  permitir_justificacion boolean NOT NULL DEFAULT true,
  activo                 boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklists_clinic ON public.checklists (clinic_id);

ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read checklists"
  ON public.checklists FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert checklists"
  ON public.checklists FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update checklists"
  ON public.checklists FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete checklists"
  ON public.checklists FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_checklists_updated_at ON public.checklists;
CREATE TRIGGER trg_checklists_updated_at
  BEFORE UPDATE ON public.checklists
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 2. proveedores  (Inventario → Proveedores)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proveedores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  contacto    text,
  telefono    text,
  email       text,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_clinic ON public.proveedores (clinic_id);

ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read proveedores"
  ON public.proveedores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert proveedores"
  ON public.proveedores FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update proveedores"
  ON public.proveedores FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete proveedores"
  ON public.proveedores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_proveedores_updated_at ON public.proveedores;
CREATE TRIGGER trg_proveedores_updated_at
  BEFORE UPDATE ON public.proveedores
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 3. insumos  (Inventario → Insumos / Catálogo)
--    proveedor_id optional FK; ON DELETE SET NULL keeps the insumo
--    if its supplier is removed.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.insumos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  stock           integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_minimo    integer NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  caducidad       date,
  costo_centavos  integer NOT NULL DEFAULT 0 CHECK (costo_centavos >= 0),
  proveedor_id    uuid REFERENCES public.proveedores(id) ON DELETE SET NULL,
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insumos_clinic ON public.insumos (clinic_id);
CREATE INDEX IF NOT EXISTS idx_insumos_proveedor ON public.insumos (proveedor_id);

ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read insumos"
  ON public.insumos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert insumos"
  ON public.insumos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update insumos"
  ON public.insumos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete insumos"
  ON public.insumos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_insumos_updated_at ON public.insumos;
CREATE TRIGGER trg_insumos_updated_at
  BEFORE UPDATE ON public.insumos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 4. kits  (Inventario → Kits por tratamiento)
--    Flat v1: costo/precio captured directly (no kit_items join yet).
--    Margen is derived in the UI from costo/precio.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  tratamiento     text NOT NULL,
  num_insumos     integer NOT NULL DEFAULT 0 CHECK (num_insumos >= 0),
  costo_centavos  integer NOT NULL DEFAULT 0 CHECK (costo_centavos >= 0),
  precio_centavos integer NOT NULL DEFAULT 0 CHECK (precio_centavos >= 0),
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kits_clinic ON public.kits (clinic_id);

ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read kits"
  ON public.kits FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert kits"
  ON public.kits FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update kits"
  ON public.kits FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete kits"
  ON public.kits FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_kits_updated_at ON public.kits;
CREATE TRIGGER trg_kits_updated_at
  BEFORE UPDATE ON public.kits
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
