-- RLS smoke tests — valida que las políticas permiten y bloquean acceso
-- correctamente por rol. Corre contra la DB efímera de `supabase start`
-- con psql -v ON_ERROR_STOP=1. Todo en una tx que hace ROLLBACK al final.
--
-- Roles cubiertos:
--   1. Global admin      (permanent_admins)
--   2. Clinic admin      (user_roles=admin + clinic_memberships.role=admin en clínica A)
--   3. Doctor            (user_roles=doctor + clinic_memberships.role=doctor en clínica A)
--   4. Farmacia/nurse    (user_roles=nurse + clinic_memberships.role=nurse en clínica A)
--   5. Paciente          (user_roles=patient, patients.user_id = su uid, en clínica A)
--
-- Convenciones:
--   - Denegación silenciosa en SELECT → assert `count(*) = 0`
--   - Denegación en INSERT/UPDATE → assert que se levantó excepción
--   - Impersonación vía `SET LOCAL role authenticated` + request.jwt.claims

BEGIN;

-- =====================================================================
-- Setup: dos clínicas, cinco usuarios, memberships y datos base
-- =====================================================================

-- IDs deterministas para debug fácil
\set clinic_a '''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''
\set clinic_b '''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'''
\set u_global  '''10000000-0000-0000-0000-000000000001'''
\set u_admin_a '''10000000-0000-0000-0000-000000000002'''
\set u_doctor  '''10000000-0000-0000-0000-000000000003'''
\set u_nurse   '''10000000-0000-0000-0000-000000000004'''
\set u_patient '''10000000-0000-0000-0000-000000000005'''
\set pat_a     '''20000000-0000-0000-0000-000000000001'''
\set pat_b     '''20000000-0000-0000-0000-000000000002'''
\set pat_self  '''20000000-0000-0000-0000-000000000003'''

INSERT INTO public.clinics (id, code, name, status) VALUES
  (:clinic_a::uuid, 'rls_test_a', 'Clínica RLS A', 'active'),
  (:clinic_b::uuid, 'rls_test_b', 'Clínica RLS B', 'active')
ON CONFLICT (id) DO NOTHING;

-- Usuarios en auth.users (mínimo requerido — el stack local permite insertar directo)
INSERT INTO auth.users (id, email, aud, role)
VALUES
  (:u_global::uuid,  'global@test.mx',  'authenticated', 'authenticated'),
  (:u_admin_a::uuid, 'admin.a@test.mx', 'authenticated', 'authenticated'),
  (:u_doctor::uuid,  'doctor@test.mx',  'authenticated', 'authenticated'),
  (:u_nurse::uuid,   'nurse@test.mx',   'authenticated', 'authenticated'),
  (:u_patient::uuid, 'patient@test.mx', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Global admin: entra por permanent_admins (match por email)
INSERT INTO public.permanent_admins (email) VALUES ('global@test.mx')
ON CONFLICT DO NOTHING;

-- Roles globales (user_roles)
INSERT INTO public.user_roles (user_id, role) VALUES
  (:u_admin_a::uuid, 'admin'),
  (:u_doctor::uuid,  'doctor'),
  (:u_nurse::uuid,   'nurse'),
  (:u_patient::uuid, 'patient')
ON CONFLICT DO NOTHING;

-- Memberships por clínica (solo clínica A para los 3 staff no-globales)
INSERT INTO public.clinic_memberships (user_id, clinic_id, role, status) VALUES
  (:u_admin_a::uuid, :clinic_a::uuid, 'admin',  'active'),
  (:u_doctor::uuid,  :clinic_a::uuid, 'doctor', 'active'),
  (:u_nurse::uuid,   :clinic_a::uuid, 'nurse',  'active')
ON CONFLICT DO NOTHING;

-- Paciente vinculado a su propio auth user, en clínica A
INSERT INTO public.patients (id, clinic_id, nombre, apellidos, sexo, fecha_nacimiento, user_id) VALUES
  (:pat_a::uuid,    :clinic_a::uuid, 'Pac',  'ClínicaA', 'M', '1990-01-01', NULL),
  (:pat_b::uuid,    :clinic_b::uuid, 'Pac',  'ClínicaB', 'F', '1990-01-01', NULL),
  (:pat_self::uuid, :clinic_a::uuid, 'Pac',  'SelfOwn',  'M', '1990-01-01', :u_patient::uuid)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- Helper para impersonar un uid
-- =====================================================================
-- Uso: SELECT set_config('request.jwt.claims', '{"sub":"<uid>","role":"authenticated"}', true);
--      SET LOCAL role authenticated;

-- =====================================================================
-- 1. GLOBAL ADMIN — ve todo
-- =====================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_global, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM public.clinics WHERE code IN ('rls_test_a','rls_test_b');
  IF v_c <> 2 THEN RAISE EXCEPTION 'global admin debería ver ambas clínicas, vio %', v_c; END IF;

  SELECT count(*) INTO v_c FROM public.patients WHERE id IN
    ('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002');
  IF v_c <> 2 THEN RAISE EXCEPTION 'global admin debería ver pacientes de ambas clínicas, vio %', v_c; END IF;
END $$;

RESET role;

-- =====================================================================
-- 2. CLINIC ADMIN (clínica A) — ve solo su clínica
-- =====================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_admin_a, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_c int;
BEGIN
  -- Ve su propia clínica
  SELECT count(*) INTO v_c FROM public.clinics WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_c <> 1 THEN RAISE EXCEPTION 'clinic_admin_A debería ver clínica A, vio %', v_c; END IF;

  -- NO ve clínica B (bloqueado por multiclinic_access_restrictive)
  SELECT count(*) INTO v_c FROM public.clinics WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF v_c <> 0 THEN RAISE EXCEPTION 'clinic_admin_A no debería ver clínica B, vio %', v_c; END IF;

  -- Ve pacientes clínica A
  SELECT count(*) INTO v_c FROM public.patients WHERE clinic_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_c < 2 THEN RAISE EXCEPTION 'clinic_admin_A debería ver >=2 pacientes A, vio %', v_c; END IF;

  -- NO ve paciente clínica B
  SELECT count(*) INTO v_c FROM public.patients WHERE id = '20000000-0000-0000-0000-000000000002';
  IF v_c <> 0 THEN RAISE EXCEPTION 'clinic_admin_A no debería ver paciente de B, vio %', v_c; END IF;
END $$;

-- Puede insertar paciente en su clínica
INSERT INTO public.patients (clinic_id, nombre, apellidos, sexo, fecha_nacimiento)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nuevo', 'PorAdminA', 'M', '2000-01-01');

-- NO puede insertar paciente en clínica B (bloqueado por restrictive multiclinic)
DO $$
BEGIN
  INSERT INTO public.patients (clinic_id, nombre, apellidos, sexo, fecha_nacimiento)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Malo', 'CrossClinic', 'M', '2000-01-01');
  RAISE EXCEPTION 'clinic_admin_A NO debería poder insertar paciente en clínica B';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION 'Error inesperado en insert cross-clínica: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

-- =====================================================================
-- 3. DOCTOR — ve pacientes de su clínica, no puede crear pacientes
-- =====================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_doctor, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM public.patients WHERE clinic_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_c < 2 THEN RAISE EXCEPTION 'doctor debería leer pacientes A, vio %', v_c; END IF;

  SELECT count(*) INTO v_c FROM public.patients WHERE clinic_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF v_c <> 0 THEN RAISE EXCEPTION 'doctor NO debería leer pacientes B, vio %', v_c; END IF;
END $$;

-- Doctor NO tiene rol admin/receptionist → INSERT patient debe fallar
DO $$
BEGIN
  INSERT INTO public.patients (clinic_id, nombre, apellidos, sexo, fecha_nacimiento)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'X', 'DoctorNoInsert', 'M', '2000-01-01');
  RAISE EXCEPTION 'doctor NO debería poder crear pacientes (Staff create policy exige admin/receptionist)';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION 'Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

-- =====================================================================
-- 4. NURSE (Farmacia) — inserta medicamentos en su clínica, no en otra
-- =====================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_nurse, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

-- Insert medicamento en clínica A → OK
INSERT INTO public.medicamentos (clinic_id, nombre, precio_unitario, activo)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Paracetamol RLS', 10.00, true);

-- Insert medicamento en clínica B → debe fallar
DO $$
BEGIN
  INSERT INTO public.medicamentos (clinic_id, nombre, precio_unitario, activo)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Cross Med', 10.00, true);
  RAISE EXCEPTION 'nurse NO debería insertar medicamento en clínica B';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION 'Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

-- Nurse NO puede borrar medicamentos (solo admin)
DO $$
BEGIN
  DELETE FROM public.medicamentos WHERE nombre = 'Paracetamol RLS';
  IF FOUND THEN
    RAISE EXCEPTION 'nurse NO debería poder eliminar medicamentos (solo admin)';
  END IF;
EXCEPTION WHEN insufficient_privilege OR others THEN
  IF SQLSTATE <> '42501' AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION 'Error inesperado en delete: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

-- =====================================================================
-- 5. PACIENTE — solo ve su propio registro
-- =====================================================================
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_patient, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_c int;
BEGIN
  -- Ve su registro (por policy "Patients read own")
  SELECT count(*) INTO v_c FROM public.patients WHERE id = '20000000-0000-0000-0000-000000000003';
  IF v_c <> 1 THEN RAISE EXCEPTION 'paciente debería ver su propio registro, vio %', v_c; END IF;

  -- NO ve otro paciente
  SELECT count(*) INTO v_c FROM public.patients WHERE id = '20000000-0000-0000-0000-000000000001';
  IF v_c <> 0 THEN RAISE EXCEPTION 'paciente NO debería ver otro paciente, vio %', v_c; END IF;

  -- NO ve medicamentos (no tiene rol staff)
  SELECT count(*) INTO v_c FROM public.medicamentos;
  IF v_c <> 0 THEN RAISE EXCEPTION 'paciente NO debería ver medicamentos, vio %', v_c; END IF;
END $$;

-- Paciente NO puede crear pacientes
DO $$
BEGIN
  INSERT INTO public.patients (clinic_id, nombre, apellidos, sexo, fecha_nacimiento)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'X', 'PatientNoInsert', 'M', '2000-01-01');
  RAISE EXCEPTION 'paciente NO debería crear pacientes';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION 'Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

-- Paciente puede actualizar su propio registro (Patients update own)
UPDATE public.patients SET telefono = '+525500000000'
WHERE id = '20000000-0000-0000-0000-000000000003';

-- Paciente NO puede actualizar registro ajeno
DO $$
DECLARE v_rows int;
BEGIN
  UPDATE public.patients SET telefono = '+525511111111'
  WHERE id = '20000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    RAISE EXCEPTION 'paciente NO debería actualizar registro ajeno (afectó % filas)', v_rows;
  END IF;
END $$;

RESET role;

-- =====================================================================
-- OK: todas las expectativas cumplidas
-- =====================================================================
DO $$ BEGIN RAISE NOTICE '✅ RLS smoke tests OK (5 roles validados)'; END $$;

ROLLBACK;
