-- Fix multi-tenant RLS gap in inventory tables.
-- checklists
DROP POLICY IF EXISTS "Authenticated can read checklists" ON public.checklists;
CREATE POLICY "Staff read own checklists" ON public.checklists FOR SELECT TO authenticated
  USING (public.is_clinic_staff(auth.uid()) AND public.user_has_clinic_access(auth.uid(), clinic_id));
DROP POLICY IF EXISTS "Admins can insert checklists" ON public.checklists;
CREATE POLICY "Admins can insert checklists" ON public.checklists FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id));
DROP POLICY IF EXISTS "Admins can update checklists" ON public.checklists;
CREATE POLICY "Admins can update checklists" ON public.checklists FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id));
DROP POLICY IF EXISTS "Admins can delete checklists" ON public.checklists;
CREATE POLICY "Admins can delete checklists" ON public.checklists FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id));

-- proveedores
DROP POLICY IF EXISTS "Authenticated can read proveedores" ON public.proveedores;
CREATE POLICY "Staff read own proveedores" ON public.proveedores FOR SELECT TO authenticated
  USING (public.is_clinic_staff(auth.uid()) AND public.user_has_clinic_access(auth.uid(), clinic_id));
DROP POLICY IF EXISTS "Admins can insert proveedores" ON public.proveedores;
CREATE POLICY "Admins can insert proveedores" ON public.proveedores FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id));
DROP POLICY IF EXISTS "Admins can update proveedores" ON public.proveedores;
CREATE POLICY "Admins can update proveedores" ON public.proveedores FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id));
DROP POLICY IF EXISTS "Admins can delete proveedores" ON public.proveedores;
CREATE POLICY "Admins can delete proveedores" ON public.proveedores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id));

-- insumos
DROP POLICY IF EXISTS "Authenticated can read insumos" ON public.insumos;
CREATE POLICY "Staff read own insumos" ON public.insumos FOR SELECT TO authenticated
  USING (public.is_clinic_staff(auth.uid()) AND public.user_has_clinic_access(auth.uid(), clinic_id));
DROP POLICY IF EXISTS "Admins can insert insumos" ON public.insumos;
CREATE POLICY "Admins can insert insumos" ON public.insumos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id));
DROP POLICY IF EXISTS "Admins can update insumos" ON public.insumos;
CREATE POLICY "Admins can update insumos" ON public.insumos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id));
DROP POLICY IF EXISTS "Admins can delete insumos" ON public.insumos;
CREATE POLICY "Admins can delete insumos" ON public.insumos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id));

-- kits
DROP POLICY IF EXISTS "Authenticated can read kits" ON public.kits;
CREATE POLICY "Staff read own kits" ON public.kits FOR SELECT TO authenticated
  USING (public.is_clinic_staff(auth.uid()) AND public.user_has_clinic_access(auth.uid(), clinic_id));
DROP POLICY IF EXISTS "Admins can insert kits" ON public.kits;
CREATE POLICY "Admins can insert kits" ON public.kits FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id));
DROP POLICY IF EXISTS "Admins can update kits" ON public.kits;
CREATE POLICY "Admins can update kits" ON public.kits FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id));
DROP POLICY IF EXISTS "Admins can delete kits" ON public.kits;
CREATE POLICY "Admins can delete kits" ON public.kits FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id));

-- kit_items
DROP POLICY IF EXISTS "Authenticated can read kit_items" ON public.kit_items;
CREATE POLICY "Staff read own kit_items" ON public.kit_items FOR SELECT TO authenticated
  USING (public.is_clinic_staff(auth.uid()) AND public.user_has_clinic_access(auth.uid(), clinic_id));
DROP POLICY IF EXISTS "Admins can insert kit_items" ON public.kit_items;
CREATE POLICY "Admins can insert kit_items" ON public.kit_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id));
DROP POLICY IF EXISTS "Admins can update kit_items" ON public.kit_items;
CREATE POLICY "Admins can update kit_items" ON public.kit_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id));
DROP POLICY IF EXISTS "Admins can delete kit_items" ON public.kit_items;
CREATE POLICY "Admins can delete kit_items" ON public.kit_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.user_has_clinic_access(auth.uid(), clinic_id));