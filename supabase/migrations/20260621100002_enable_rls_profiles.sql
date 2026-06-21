-- supabase/migrations/20260621100002_enable_rls_profiles.sql
-- Habilitar RLS en profiles y proteger supervisor_pin_hash.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Usuario lee/actualiza solo su propio perfil
CREATE POLICY "profiles_own_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid())
  IF NOT EXISTS;

CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid())
  IF NOT EXISTS;

-- Admin puede leer todos los perfiles
CREATE POLICY "profiles_admin_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  IF NOT EXISTS;

-- Service role mantiene acceso total para RPCs internos
-- (service_role bypasses RLS by default en Supabase)

-- Revocar UPDATE directo de supervisor_pin_hash desde la API pública.
-- El hash solo se modifica via RPC set_supervisor_pin() (SECURITY DEFINER).
REVOKE UPDATE (supervisor_pin_hash) ON public.profiles FROM authenticated;
