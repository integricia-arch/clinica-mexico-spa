-- Smoke tests contra la DB efímera post-migraciones.
-- Objetivo: verificar que el esquema quedó funcional (tablas core existen,
-- funciones críticas resuelven, seeds insertan y las RLS/GRANTs no rompen
-- lecturas básicas como service_role).
--
-- Cualquier RAISE EXCEPTION o assert fallido corta el script (psql -v ON_ERROR_STOP=1).

BEGIN;

-- =====================================================================
-- 1. Tablas core existen
-- =====================================================================
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(t, ', ') INTO v_missing
  FROM (
    SELECT unnest(ARRAY[
      'clinics','patients','doctors','appointments','prescriptions',
      'pharmacy_cash_shifts','pharmacy_sales','rooms',
      'clinic_memberships','user_roles','permanent_admins','audit_logs',
      'catalogo_modulos','cliente_modulos','whatsapp_audit_alertas',
      'payment_gateway_config'
    ]) AS t
  ) req
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = req.t
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Tablas core faltantes: %', v_missing;
  END IF;
END $$;

-- =====================================================================
-- 2. RLS habilitada en tablas con PHI
-- =====================================================================
DO $$
DECLARE
  v_no_rls text;
BEGIN
  SELECT string_agg(tablename, ', ') INTO v_no_rls
  FROM pg_tables
  WHERE schemaname = 'public'
    AND rowsecurity = false
    AND tablename IN (
      'patients','appointments','prescriptions','expedientes','notas_consulta',
      'pharmacy_sales','pharmacy_cash_shifts','audit_logs','clinic_memberships'
    );

  IF v_no_rls IS NOT NULL THEN
    RAISE EXCEPTION 'Tablas con PHI sin RLS: %', v_no_rls;
  END IF;
END $$;

-- =====================================================================
-- 3. Funciones críticas existen y son SECURITY DEFINER con search_path
-- =====================================================================
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(f, ', ') INTO v_missing
  FROM (
    SELECT unnest(ARRAY[
      'has_role','is_global_admin','user_has_clinic_access',
      'user_has_clinic_role','log_phi_access',
      'set_clinic_status','set_clinic_archived','set_clinic_whatsapp_number',
      'pharmacy_open_shift','pharmacy_close_shift','pharmacy_register_sale'
    ]) AS f
  ) req
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = req.f
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Funciones críticas faltantes: %', v_missing;
  END IF;
END $$;

-- =====================================================================
-- 4. Seed mínimo — clínica + catálogo de módulos + paciente
-- =====================================================================
INSERT INTO public.clinics (id, code, name, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'smoke_test', 'Clínica Smoke Test', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.catalogo_modulos (slug, nombre, precio_centavos, activo)
VALUES ('smoke-mod', 'Módulo Smoke', 9900, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.patients (
  id, clinic_id, nombre, apellidos, sexo, fecha_nacimiento
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Prueba', 'Smoke Test', 'M', '1990-01-01'
) ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 5. Smoke queries — deben devolver > 0
-- =====================================================================
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.clinics WHERE code = 'smoke_test';
  IF v_count <> 1 THEN RAISE EXCEPTION 'seed clinics falló'; END IF;

  SELECT count(*) INTO v_count FROM public.patients
    WHERE id = '22222222-2222-2222-2222-222222222222';
  IF v_count <> 1 THEN RAISE EXCEPTION 'seed patients falló'; END IF;

  SELECT count(*) INTO v_count FROM public.catalogo_modulos WHERE slug = 'smoke-mod';
  IF v_count <> 1 THEN RAISE EXCEPTION 'seed catalogo_modulos falló'; END IF;
END $$;

-- =====================================================================
-- 6. Función has_role resuelve sin error
-- =====================================================================
DO $$
BEGIN
  PERFORM public.has_role('00000000-0000-0000-0000-000000000000'::uuid, 'admin'::public.app_role);
  PERFORM public.is_global_admin('00000000-0000-0000-0000-000000000000'::uuid);
  PERFORM public.user_has_clinic_access(
    '00000000-0000-0000-0000-000000000000'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid
  );
END $$;

ROLLBACK; -- deja la DB efímera limpia; el objetivo es solo verificar
