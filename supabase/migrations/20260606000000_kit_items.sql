-- Kit pricing v2 (Opción A): líneas de insumo por kit.
--   public.kit_items  → (kit_id, insumo_id, cantidad)
-- El costo del kit deja de teclearse: se deriva de SUMA(insumo.costo × cantidad)
-- en la app (live join). Las columnas kits.costo_centavos / kits.num_insumos
-- quedan como caché heredado (no se escriben desde la UI v2); B las usará para
-- precio sugerido. Clinic-scoped, admin-write / authenticated-read, igual que
-- checklists/insumos (migración 20260605010000).
-- Idempotente: seguro re-pegar en el SQL Editor.

-- ─────────────────────────────────────────────────────────────
-- kit_items  (una fila por insumo dentro de un kit)
--   kit_id     → kits, ON DELETE CASCADE (borrar kit borra sus líneas)
--   insumo_id  → insumos, ON DELETE RESTRICT (no dejar líneas huérfanas:
--                primero quita la línea, luego borra el insumo)
--   cantidad   → entero > 0
--   UNIQUE(kit_id, insumo_id) → un insumo aparece máximo una vez por kit
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kit_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  kit_id      uuid NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE,
  insumo_id   uuid NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
  cantidad    integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kit_id, insumo_id)
);

CREATE INDEX IF NOT EXISTS idx_kit_items_kit ON public.kit_items (kit_id);
CREATE INDEX IF NOT EXISTS idx_kit_items_insumo ON public.kit_items (insumo_id);
CREATE INDEX IF NOT EXISTS idx_kit_items_clinic ON public.kit_items (clinic_id);

ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read kit_items" ON public.kit_items;
CREATE POLICY "Authenticated can read kit_items"
  ON public.kit_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert kit_items" ON public.kit_items;
CREATE POLICY "Admins can insert kit_items"
  ON public.kit_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can update kit_items" ON public.kit_items;
CREATE POLICY "Admins can update kit_items"
  ON public.kit_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can delete kit_items" ON public.kit_items;
CREATE POLICY "Admins can delete kit_items"
  ON public.kit_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_kit_items_updated_at ON public.kit_items;
CREATE TRIGGER trg_kit_items_updated_at
  BEFORE UPDATE ON public.kit_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
