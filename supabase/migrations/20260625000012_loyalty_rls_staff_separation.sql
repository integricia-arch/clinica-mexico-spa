-- Separación seguridad: clientes lealtad (OTP) NO pueden ver datos operativos.
-- Estrategia: is_staff() verifica clinic_memberships — imposible de falsificar por un cliente.
-- Los loyalty clients que se autentican por OTP no tienen registros en clinic_memberships.

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM clinic_memberships WHERE user_id = auth.uid()
  )
$$;

-- ─── doctors ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone views doctors" ON public.doctors;
CREATE POLICY "Staff views doctors" ON public.doctors
  FOR SELECT TO authenticated
  USING (is_staff());

-- ─── rooms ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone views rooms" ON public.rooms;
CREATE POLICY "Staff views rooms" ON public.rooms
  FOR SELECT TO authenticated
  USING (is_staff());

-- ─── doctor_servicios ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff view doctor services" ON public.doctor_servicios;
CREATE POLICY "Staff view doctor services" ON public.doctor_servicios
  FOR SELECT TO authenticated
  USING (is_staff());

-- ─── clinic_settings ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can read clinic_settings" ON public.clinic_settings;
CREATE POLICY "Staff can read clinic_settings" ON public.clinic_settings
  FOR SELECT TO authenticated
  USING (is_staff());

-- ─── checklists ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can read checklists" ON public.checklists;
CREATE POLICY "Staff can read checklists" ON public.checklists
  FOR SELECT TO authenticated
  USING (is_staff());

-- ─── proveedores ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can read proveedores" ON public.proveedores;
CREATE POLICY "Staff can read proveedores" ON public.proveedores
  FOR SELECT TO authenticated
  USING (is_staff());

-- ─── insumos ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can read insumos" ON public.insumos;
CREATE POLICY "Staff can read insumos" ON public.insumos
  FOR SELECT TO authenticated
  USING (is_staff());

-- ─── kits ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can read kits" ON public.kits;
CREATE POLICY "Staff can read kits" ON public.kits
  FOR SELECT TO authenticated
  USING (is_staff());

-- ─── kit_items ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can read kit_items" ON public.kit_items;
CREATE POLICY "Staff can read kit_items" ON public.kit_items
  FOR SELECT TO authenticated
  USING (is_staff());

-- ─── nurses ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "View nurses" ON public.nurses;
CREATE POLICY "Staff view nurses" ON public.nurses
  FOR SELECT TO authenticated
  USING (is_staff());

-- faq_items y privacy_notice_versions se dejan con USING(true) — son contenido público.
