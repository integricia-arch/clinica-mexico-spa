-- Task 2: gating real de acceso a módulos por clinica.
-- Paso A: catalogo_modulos no tenía columna slug (solo id/nombre) — se agrega aquí
-- porque Tasks 5 (RLS policies) y 6 (frontend hook) del plan asumen slugs legibles
-- tipo 'compras', 'farmacia' en vez de UUIDs.

ALTER TABLE catalogo_modulos ADD COLUMN IF NOT EXISTS slug text;

UPDATE catalogo_modulos SET slug = 'agenda' WHERE nombre = 'Agenda';
UPDATE catalogo_modulos SET slug = 'almacen' WHERE nombre = 'Almacén';
UPDATE catalogo_modulos SET slug = 'compras' WHERE nombre = 'Compras';
UPDATE catalogo_modulos SET slug = 'facturacion_cfdi' WHERE nombre = 'Facturación CFDI';
UPDATE catalogo_modulos SET slug = 'pos_farmacia' WHERE nombre = 'POS / Farmacia';

ALTER TABLE catalogo_modulos ALTER COLUMN slug SET NOT NULL;
ALTER TABLE catalogo_modulos ADD CONSTRAINT catalogo_modulos_slug_key UNIQUE (slug);

-- Paso B: función de gating, SECURITY DEFINER, usable directo en RLS policies:
-- USING (clinic_has_modulo_access(clinic_id, 'farmacia'))
CREATE OR REPLACE FUNCTION clinic_has_modulo_access(p_clinic_id uuid, p_modulo_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
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

-- REVOKE FROM PUBLIC no basta: Supabase otorga EXECUTE a anon/authenticated/service_role
-- vía default privileges del schema public, independientes de PUBLIC. Hay que revocar
-- explícitamente de anon para que el rol no autenticado no pueda invocarla.
REVOKE EXECUTE ON FUNCTION clinic_has_modulo_access(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION clinic_has_modulo_access(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION clinic_has_modulo_access(uuid, text) TO authenticated;
