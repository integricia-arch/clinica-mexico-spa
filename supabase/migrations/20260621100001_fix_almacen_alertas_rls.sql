-- supabase/migrations/20260621100001_fix_almacen_alertas_rls.sql
-- Fix: RLS policy referenciaba 'clinic_members' (inexistente).
-- Tabla correcta: clinic_memberships.
-- Columns en clinic_memberships: user_id, clinic_id, status, role.
-- Columns en almacen_alertas: clinic_id, etc.

-- DROP todas las versiones posibles (idempotent)
DROP POLICY IF EXISTS "almacen_alertas_clinic_member_select" ON public.almacen_alertas;
DROP POLICY IF EXISTS "almacen_alertas_clinic_member_insert" ON public.almacen_alertas;
DROP POLICY IF EXISTS "almacen_alertas_clinic_member_update" ON public.almacen_alertas;
DROP POLICY IF EXISTS "almacen_alertas_clinic_member_delete" ON public.almacen_alertas;
DROP POLICY IF EXISTS "almacen_alertas_select" ON public.almacen_alertas;
DROP POLICY IF EXISTS "almacen_alertas_insert" ON public.almacen_alertas;
DROP POLICY IF EXISTS "almacen_alertas_update" ON public.almacen_alertas;
DROP POLICY IF EXISTS "almacen_alertas_delete" ON public.almacen_alertas;

-- CREAR políticas correctas
CREATE POLICY "almacen_alertas_select" ON public.almacen_alertas
  FOR SELECT TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR public.is_global_admin(auth.uid())
  );

CREATE POLICY "almacen_alertas_insert" ON public.almacen_alertas
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('admin', 'nurse')
    )
    OR public.is_global_admin(auth.uid())
  );

CREATE POLICY "almacen_alertas_update" ON public.almacen_alertas
  FOR UPDATE TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('admin', 'nurse')
    )
    OR public.is_global_admin(auth.uid())
  );

CREATE POLICY "almacen_alertas_delete" ON public.almacen_alertas
  FOR DELETE TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('admin', 'nurse')
    )
    OR public.is_global_admin(auth.uid())
  );
