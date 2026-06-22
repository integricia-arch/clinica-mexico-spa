-- Security fix for M3 expediente permissions
-- Problem 1: expedientes SELECT/UPDATE don't honor expediente_permissions (shared access invisible due to RLS)
-- Problem 2: expediente_permissions allows self-grant by any clinic member (privilege escalation)

-- ============================================================
-- FIX 1: Add shared-access policies on expedientes
-- ============================================================

-- Allow doctors to SELECT expedientes shared with them
DROP POLICY IF EXISTS "Shared expediente select" ON public.expedientes;
CREATE POLICY "Shared expediente select"
ON public.expedientes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.expediente_permissions ep
    JOIN public.doctors d ON d.id = ep.doctor_id
    WHERE ep.expediente_id = expedientes.id
      AND d.user_id = auth.uid()
      AND ep.clinic_id IN (
        SELECT clinic_id FROM public.clinic_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
  )
);

-- Allow doctors with edit permission to UPDATE expedientes shared with them
DROP POLICY IF EXISTS "Shared expediente edit" ON public.expedientes;
CREATE POLICY "Shared expediente edit"
ON public.expedientes FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.expediente_permissions ep
    JOIN public.doctors d ON d.id = ep.doctor_id
    WHERE ep.expediente_id = expedientes.id
      AND d.user_id = auth.uid()
      AND ep.permission = 'edit'
      AND ep.clinic_id IN (
        SELECT clinic_id FROM public.clinic_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.expediente_permissions ep
    JOIN public.doctors d ON d.id = ep.doctor_id
    WHERE ep.expediente_id = expedientes.id
      AND d.user_id = auth.uid()
      AND ep.permission = 'edit'
      AND ep.clinic_id IN (
        SELECT clinic_id FROM public.clinic_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
  )
);

-- ============================================================
-- FIX 2: Tighten expediente_permissions RLS
-- Drop the overly-permissive FOR ALL policy and replace with
-- separate per-operation policies.
-- Only admins OR the owning doctor of the expediente can
-- INSERT/UPDATE/DELETE. Any active clinic member can SELECT.
-- ============================================================

DROP POLICY IF EXISTS "Clinic staff manage expediente_permissions" ON public.expediente_permissions;

-- SELECT: any active clinic member can see permissions for their clinic
DROP POLICY IF EXISTS "Clinic staff read expediente_permissions" ON public.expediente_permissions;
CREATE POLICY "Clinic staff read expediente_permissions"
ON public.expediente_permissions FOR SELECT TO authenticated
USING (
  clinic_id IN (
    SELECT clinic_id FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- INSERT: only admin OR the owning doctor of the expediente
DROP POLICY IF EXISTS "Admin or owner insert expediente_permissions" ON public.expediente_permissions;
CREATE POLICY "Admin or owner insert expediente_permissions"
ON public.expediente_permissions FOR INSERT TO authenticated
WITH CHECK (
  (
    public.has_role(auth.uid(), 'admin')
    AND clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.expedientes e
    JOIN public.doctors d ON d.id = e.doctor_id
    WHERE e.id = expediente_permissions.expediente_id
      AND d.user_id = auth.uid()
  )
);

-- UPDATE: only admin OR the owning doctor of the expediente
DROP POLICY IF EXISTS "Admin or owner update expediente_permissions" ON public.expediente_permissions;
CREATE POLICY "Admin or owner update expediente_permissions"
ON public.expediente_permissions FOR UPDATE TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'admin')
    AND clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.expedientes e
    JOIN public.doctors d ON d.id = e.doctor_id
    WHERE e.id = expediente_permissions.expediente_id
      AND d.user_id = auth.uid()
  )
)
WITH CHECK (
  (
    public.has_role(auth.uid(), 'admin')
    AND clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.expedientes e
    JOIN public.doctors d ON d.id = e.doctor_id
    WHERE e.id = expediente_permissions.expediente_id
      AND d.user_id = auth.uid()
  )
);

-- DELETE: only admin OR the owning doctor of the expediente
DROP POLICY IF EXISTS "Admin or owner delete expediente_permissions" ON public.expediente_permissions;
CREATE POLICY "Admin or owner delete expediente_permissions"
ON public.expediente_permissions FOR DELETE TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'admin')
    AND clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.expedientes e
    JOIN public.doctors d ON d.id = e.doctor_id
    WHERE e.id = expediente_permissions.expediente_id
      AND d.user_id = auth.uid()
  )
);
