-- Hotfix: clinic_has_modulo_access() (Task 2) excluia 'trialing' de los
-- subscription_status permitidos. Con Task 5 recien aplicando RLS RESTRICTIVE
-- sobre esta funcion, el gap paso de teorico a real: ninguna clinica en
-- produccion esta 'active' hoy (todas trialing o canceled), asi que sin este
-- fix TODAS las clinicas trialing pierden acceso a compras/almacen/
-- pos_farmacia/facturacion_cfdi apenas se aplico la migracion anterior.
CREATE OR REPLACE FUNCTION public.clinic_has_modulo_access(p_clinic_id uuid, p_modulo_slug text)
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
        AND c.subscription_status IN ('active', 'trialing', 'past_due', 'canceling')
        AND (c.subscription_status != 'past_due' OR c.grace_period_ends_at > now())
    );
$$;

REVOKE EXECUTE ON FUNCTION clinic_has_modulo_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clinic_has_modulo_access(uuid, text) TO authenticated;
