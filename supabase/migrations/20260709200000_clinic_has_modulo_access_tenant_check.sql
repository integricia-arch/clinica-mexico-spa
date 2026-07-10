-- Fix (security review, Important): clinic_has_modulo_access(p_clinic_id, p_modulo_slug)
-- era SECURITY DEFINER + GRANT EXECUTE TO authenticated SIN verificar que el usuario que
-- llama pertenece a p_clinic_id. Cualquier usuario autenticado (de cualquier clínica) podía
-- invocar la función vía RPC con un p_clinic_id arbitrario y aprender el estado de
-- suscripción/módulos de OTRO tenant (oráculo de disclosure cross-tenant).
--
-- Fix: reusar el helper ya establecido del proyecto para "el usuario autenticado actual
-- pertenece a esta clínica" (public.user_has_clinic_access, usado en todas las policies RLS
-- de clinic-scoping desde 20260528150545) como PRIMERA operación del body — ver CLAUDE.md,
-- checklist SECURITY DEFINER item 3. Si el usuario no pertenece a la clínica, retorna false
-- de inmediato sin evaluar módulos/suscripción de esa clínica.
CREATE OR REPLACE FUNCTION clinic_has_modulo_access(p_clinic_id uuid, p_modulo_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_has_clinic_access(auth.uid(), p_clinic_id)
    AND EXISTS (
      SELECT 1
      FROM cliente_modulos cm
      JOIN catalogo_modulos m ON m.id = cm.modulo_id
      JOIN clinics c ON c.id = cm.clinic_id
      WHERE cm.clinic_id = p_clinic_id
        AND m.slug = p_modulo_slug
        AND (cm.activo_hasta IS NULL OR cm.activo_hasta > now())
        AND c.subscription_status IN ('active', 'past_due', 'canceling')
        AND (c.subscription_status != 'past_due' OR c.grace_period_ends_at > now())
    );
$$;

-- Grants sin cambio de intención (ya correctos desde la migración original), reafirmados
-- por si el REPLACE reseteara privilegios por defecto del schema.
REVOKE EXECUTE ON FUNCTION clinic_has_modulo_access(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION clinic_has_modulo_access(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION clinic_has_modulo_access(uuid, text) TO authenticated;
