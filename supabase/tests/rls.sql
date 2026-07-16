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

-- ---------------------------------------------------------------------
-- Helpers de aserción — mensajes uniformes para debugging rápido en CI.
-- Cada fallo emite:
--   [FAIL] <TAG> — esperado <op> <expected> pero got=<actual>
-- donde TAG es "SEC N | ROL | TABLA | CASO".
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp._assert_count(
  _tag text, _expected int, _actual int, _op text DEFAULT '='
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF (_op = '='  AND _actual <> _expected)
     OR (_op = '>=' AND _actual <  _expected)
     OR (_op = '>'  AND _actual <= _expected)
     OR (_op = '<>' AND _actual =  _expected)
  THEN
    RAISE EXCEPTION '[FAIL] % — esperado %%%% pero got=%',
      _tag, _op, _expected, _actual;
  END IF;
END $$;

-- Marca sección en la salida psql

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

-- Doctor vinculado a u_doctor en clínica A (necesario para INSERT prescriptions
-- ya que la policy exige doctor_id ∈ doctors WHERE user_id = auth.uid())
\set doc_a '''30000000-0000-0000-0000-000000000001'''
INSERT INTO public.doctors (
  id, clinic_id, user_id, nombre, apellidos, especialidad,
  horario_inicio, horario_fin, duracion_cita_min, activo
) VALUES (
  :doc_a::uuid, :clinic_a::uuid, :u_doctor::uuid,
  'Doc', 'RLS', 'medicina_general',
  '08:00', '18:00', 30, true
) ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- Helper para impersonar un uid
-- =====================================================================
-- Uso: SELECT set_config('request.jwt.claims', '{"sub":"<uid>","role":"authenticated"}', true);
--      SET LOCAL role authenticated;

\echo '>>> 1. GLOBAL ADMIN — ve todo'
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
  IF v_c <> 2 THEN RAISE EXCEPTION '[SEC 1 | GLOBAL_ADMIN | clinics] global admin debería ver ambas clínicas, vio %', v_c; END IF;

  SELECT count(*) INTO v_c FROM public.patients WHERE id IN
    ('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002');
  IF v_c <> 2 THEN RAISE EXCEPTION '[SEC 1 | GLOBAL_ADMIN | patients] global admin debería ver pacientes de ambas clínicas, vio %', v_c; END IF;
END $$;

RESET role;

\echo '>>> 2. CLINIC ADMIN (clínica A) — ve solo su clínica'
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
  IF v_c <> 1 THEN RAISE EXCEPTION '[SEC 2 | GLOBAL_ADMIN | clinics] clinic_admin_A debería ver clínica A, vio %', v_c; END IF;

  -- NO ve clínica B (bloqueado por multiclinic_access_restrictive)
  SELECT count(*) INTO v_c FROM public.clinics WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF v_c <> 0 THEN RAISE EXCEPTION '[SEC 2 | GLOBAL_ADMIN | clinics] clinic_admin_A no debería ver clínica B, vio %', v_c; END IF;

  -- Ve pacientes clínica A
  SELECT count(*) INTO v_c FROM public.patients WHERE clinic_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_c < 2 THEN RAISE EXCEPTION '[SEC 2 | GLOBAL_ADMIN | patients] clinic_admin_A debería ver >=2 pacientes A, vio %', v_c; END IF;

  -- NO ve paciente clínica B
  SELECT count(*) INTO v_c FROM public.patients WHERE id = '20000000-0000-0000-0000-000000000002';
  IF v_c <> 0 THEN RAISE EXCEPTION '[SEC 2 | GLOBAL_ADMIN | patients] clinic_admin_A no debería ver paciente de B, vio %', v_c; END IF;
END $$;

-- Puede insertar paciente en su clínica
INSERT INTO public.patients (clinic_id, nombre, apellidos, sexo, fecha_nacimiento)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nuevo', 'PorAdminA', 'M', '2000-01-01');

-- NO puede insertar paciente en clínica B (bloqueado por restrictive multiclinic)
DO $$
BEGIN
  INSERT INTO public.patients (clinic_id, nombre, apellidos, sexo, fecha_nacimiento)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Malo', 'CrossClinic', 'M', '2000-01-01');
  RAISE EXCEPTION '[SEC 2 | GLOBAL_ADMIN | patients] clinic_admin_A NO debería poder insertar paciente en clínica B';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 2 | GLOBAL_ADMIN | patients] Error inesperado en insert cross-clínica: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

\echo '>>> 3. DOCTOR — ve pacientes de su clínica, no puede crear pacientes'
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
  IF v_c < 2 THEN RAISE EXCEPTION '[SEC 3 | DOCTOR | patients] doctor debería leer pacientes A, vio %', v_c; END IF;

  SELECT count(*) INTO v_c FROM public.patients WHERE clinic_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF v_c <> 0 THEN RAISE EXCEPTION '[SEC 3 | DOCTOR | patients] doctor NO debería leer pacientes B, vio %', v_c; END IF;
END $$;

-- Doctor NO tiene rol admin/receptionist → INSERT patient debe fallar
DO $$
BEGIN
  INSERT INTO public.patients (clinic_id, nombre, apellidos, sexo, fecha_nacimiento)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'X', 'DoctorNoInsert', 'M', '2000-01-01');
  RAISE EXCEPTION '[SEC 3 | DOCTOR | patients] doctor NO debería poder crear pacientes (Staff create policy exige admin/receptionist)';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 3 | DOCTOR | patients] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

\echo '>>> 4. NURSE (Farmacia) — inserta medicamentos en su clínica, no en otra'
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
  RAISE EXCEPTION '[SEC 4 | DOCTOR | medicamentos] nurse NO debería insertar medicamento en clínica B';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 4 | DOCTOR | medicamentos] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

-- Nurse NO puede borrar medicamentos (solo admin)
DO $$
BEGIN
  DELETE FROM public.medicamentos WHERE nombre = 'Paracetamol RLS';
  IF FOUND THEN
    RAISE EXCEPTION '[SEC 4 | DOCTOR | medicamentos] nurse NO debería poder eliminar medicamentos (solo admin)';
  END IF;
EXCEPTION WHEN insufficient_privilege OR others THEN
  IF SQLSTATE <> '42501' AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 4 | DOCTOR | medicamentos] Error inesperado en delete: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

\echo '>>> 5. PACIENTE — solo ve su propio registro'
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
  IF v_c <> 1 THEN RAISE EXCEPTION '[SEC 5 | PATIENT | patients] paciente debería ver su propio registro, vio %', v_c; END IF;

  -- NO ve otro paciente
  SELECT count(*) INTO v_c FROM public.patients WHERE id = '20000000-0000-0000-0000-000000000001';
  IF v_c <> 0 THEN RAISE EXCEPTION '[SEC 5 | PATIENT | patients] paciente NO debería ver otro paciente, vio %', v_c; END IF;

  -- NO ve medicamentos (no tiene rol staff)
  SELECT count(*) INTO v_c FROM public.medicamentos;
  IF v_c <> 0 THEN RAISE EXCEPTION '[SEC 5 | PATIENT | patients] paciente NO debería ver medicamentos, vio %', v_c; END IF;
END $$;

-- Paciente NO puede crear pacientes
DO $$
BEGIN
  INSERT INTO public.patients (clinic_id, nombre, apellidos, sexo, fecha_nacimiento)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'X', 'PatientNoInsert', 'M', '2000-01-01');
  RAISE EXCEPTION '[SEC 5 | PATIENT | patients] paciente NO debería crear pacientes';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 5 | PATIENT | patients] Error inesperado: % / %', SQLSTATE, SQLERRM;
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
    RAISE EXCEPTION '[SEC 5 | PATIENT | patients] paciente NO debería actualizar registro ajeno (afectó % filas)', v_rows;
  END IF;
END $$;

RESET role;

\echo '>>> 6. PRESCRIPTIONS + PRESCRIPTION_ITEMS por rol'
-- =====================================================================
-- 6. PRESCRIPTIONS + PRESCRIPTION_ITEMS por rol
-- =====================================================================

-- Seed base: una receta creada como service_role (bypass) para probar SELECT/UPDATE
\set rx_a '''40000000-0000-0000-0000-000000000001'''
\set rx_b '''40000000-0000-0000-0000-000000000002'''
INSERT INTO public.prescriptions (id, clinic_id, patient_id, doctor_id, status, digital_signature_status)
VALUES
  (:rx_a::uuid, :clinic_a::uuid, :pat_self::uuid, :doc_a::uuid, 'issued', 'pending'),
  (:rx_b::uuid, :clinic_b::uuid, :pat_b::uuid,   :doc_a::uuid, 'issued', 'pending')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.prescription_items (
  prescription_id, clinic_id, generic_name, dose, route, frequency, duration, instructions, is_controlled
) VALUES
  (:rx_a::uuid, :clinic_a::uuid, 'Paracetamol', '500mg', 'oral', 'c/8h', '3 días', 'Tomar con alimentos', false),
  (:rx_b::uuid, :clinic_b::uuid, 'Ibuprofeno',  '400mg', 'oral', 'c/8h', '3 días', 'Tomar con alimentos', false);

-- --- Clinic admin (has_role admin) -----------------------------------
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_admin_a, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM public.prescriptions WHERE clinic_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_c < 1 THEN RAISE EXCEPTION '[SEC 6 | PATIENT | prescriptions] admin A debería ver recetas de clínica A, vio %', v_c; END IF;

  SELECT count(*) INTO v_c FROM public.prescriptions WHERE clinic_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF v_c <> 0 THEN RAISE EXCEPTION '[SEC 6 | PATIENT | prescriptions] admin A NO debería ver recetas de B, vio %', v_c; END IF;
END $$;

-- Admin puede INSERT prescription en su clínica (policy exige has_role admin)
INSERT INTO public.prescriptions (clinic_id, patient_id, doctor_id, status, digital_signature_status)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '20000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000001',
        'issued','pending');

RESET role;

-- --- Doctor (dueño de doc_a) -----------------------------------------
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_doctor, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

-- Puede INSERT usando su propio doctor_id
INSERT INTO public.prescriptions (clinic_id, patient_id, doctor_id, status, digital_signature_status)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '20000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000001',
        'issued','pending');

-- Puede agregar items a una receta existente (Doctor/admin manage prescription_items)
INSERT INTO public.prescription_items (
  prescription_id, clinic_id, generic_name, dose, route, frequency, duration, instructions, is_controlled
) VALUES (
  '40000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Amoxicilina', '500mg', 'oral', 'c/8h', '7 días', 'Terminar tratamiento', false
);

-- NO puede insertar prescription en clínica B (restrictive multiclinic bloquea)
DO $$
BEGIN
  INSERT INTO public.prescriptions (clinic_id, patient_id, doctor_id, status, digital_signature_status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          '20000000-0000-0000-0000-000000000002',
          '30000000-0000-0000-0000-000000000001',
          'issued','pending');
  RAISE EXCEPTION '[SEC 6 | PATIENT | prescriptions] doctor NO debería insertar receta cross-clínica';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 6 | PATIENT | prescriptions] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

-- NO puede DELETE (solo admin)
DO $$
BEGIN
  DELETE FROM public.prescriptions WHERE id = '40000000-0000-0000-0000-000000000001';
  IF FOUND THEN RAISE EXCEPTION '[SEC 6 | PATIENT | prescriptions] doctor NO debería eliminar recetas'; END IF;
EXCEPTION WHEN insufficient_privilege OR others THEN
  IF SQLSTATE <> '42501' AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 6 | PATIENT | prescriptions] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

-- --- Nurse / Farmacia -------------------------------------------------
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_nurse, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

-- Puede LEER recetas (is_clinic_staff incluye nurse)
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM public.prescriptions WHERE clinic_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_c < 1 THEN RAISE EXCEPTION '[SEC 6 | NURSE | prescriptions] nurse debería leer recetas de A, vio %', v_c; END IF;
END $$;

-- NO puede INSERT prescription (INSERT policy exige admin OR doctor)
DO $$
BEGIN
  INSERT INTO public.prescriptions (clinic_id, patient_id, doctor_id, status, digital_signature_status)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '20000000-0000-0000-0000-000000000001',
          '30000000-0000-0000-0000-000000000001',
          'issued','pending');
  RAISE EXCEPTION '[SEC 6 | NURSE | prescriptions] nurse NO debería crear recetas';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 6 | NURSE | prescriptions] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

-- NO puede INSERT prescription_items (policy exige admin/doctor)
DO $$
BEGIN
  INSERT INTO public.prescription_items (
    prescription_id, clinic_id, generic_name, dose, route, frequency, duration, instructions, is_controlled
  ) VALUES (
    '40000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Diazepam', '5mg', 'oral', 'c/12h', '5 días', 'Con supervisión', true
  );
  RAISE EXCEPTION '[SEC 6 | NURSE | prescription_items] nurse NO debería insertar prescription_items';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 6 | NURSE | prescription_items] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

-- --- Paciente ---------------------------------------------------------
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_patient, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_c int;
BEGIN
  -- Ve solo su propia receta (patient_id = pat_self)
  SELECT count(*) INTO v_c FROM public.prescriptions
   WHERE id = '40000000-0000-0000-0000-000000000001';
  IF v_c <> 1 THEN RAISE EXCEPTION '[SEC 6 | PATIENT | patients] paciente debería ver su receta, vio %', v_c; END IF;

  -- NO ve receta de otro paciente
  SELECT count(*) INTO v_c FROM public.prescriptions
   WHERE id = '40000000-0000-0000-0000-000000000002';
  IF v_c <> 0 THEN RAISE EXCEPTION '[SEC 6 | PATIENT | patients] paciente NO debería ver receta ajena, vio %', v_c; END IF;

  -- Ve prescription_items de su receta
  SELECT count(*) INTO v_c FROM public.prescription_items
   WHERE prescription_id = '40000000-0000-0000-0000-000000000001';
  IF v_c < 1 THEN RAISE EXCEPTION '[SEC 6 | PATIENT | patients] paciente debería ver items de su receta, vio %', v_c; END IF;
END $$;

-- Paciente NO puede crear recetas
DO $$
BEGIN
  INSERT INTO public.prescriptions (clinic_id, patient_id, doctor_id, status, digital_signature_status)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '20000000-0000-0000-0000-000000000003',
          '30000000-0000-0000-0000-000000000001',
          'issued','pending');
  RAISE EXCEPTION '[SEC 6 | PATIENT | patients] paciente NO debería crear recetas';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 6 | PATIENT | patients] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

\echo '>>> 7. PATIENT_STUDIES por rol'
-- =====================================================================
-- 7. PATIENT_STUDIES por rol
-- =====================================================================

\set st_a '''50000000-0000-0000-0000-000000000001'''
\set st_b '''50000000-0000-0000-0000-000000000002'''
INSERT INTO public.patient_studies (
  id, clinic_id, patient_id, doctor_id, tipo, nombre, prioridad, requiere_ayuno, status, solicitado_at
) VALUES
  (:st_a::uuid, :clinic_a::uuid, :pat_self::uuid, :doc_a::uuid,
   'laboratorio', 'BH completa', 'normal', false, 'solicitado', now()),
  (:st_b::uuid, :clinic_b::uuid, :pat_b::uuid,   :doc_a::uuid,
   'laboratorio', 'Química', 'normal', false, 'solicitado', now());

-- --- Global admin: ve ambos ------------------------------------------
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_global, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM public.patient_studies
   WHERE id IN ('50000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002');
  IF v_c <> 2 THEN RAISE EXCEPTION '[SEC 7 | PATIENT | patient_studies] global admin debería ver ambos estudios, vio %', v_c; END IF;
END $$;
RESET role;

-- --- Clinic admin A: solo clínica A ----------------------------------
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_admin_a, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM public.patient_studies WHERE clinic_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_c < 1 THEN RAISE EXCEPTION '[SEC 7 | PATIENT | patient_studies] admin A debería ver estudios A, vio %', v_c; END IF;

  SELECT count(*) INTO v_c FROM public.patient_studies WHERE clinic_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF v_c <> 0 THEN RAISE EXCEPTION '[SEC 7 | PATIENT | patient_studies] admin A NO debería ver estudios B, vio %', v_c; END IF;
END $$;

-- Admin puede INSERT estudio en su clínica (is_clinic_staff)
INSERT INTO public.patient_studies (
  clinic_id, patient_id, doctor_id, tipo, nombre, prioridad, requiere_ayuno, status, solicitado_at
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'imagen', 'Rx tórax', 'normal', false, 'solicitado', now()
);

-- Admin NO puede insertar cross-clínica
DO $$
BEGIN
  INSERT INTO public.patient_studies (
    clinic_id, patient_id, doctor_id, tipo, nombre, prioridad, requiere_ayuno, status, solicitado_at
  ) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '20000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    'imagen', 'Rx cross', 'normal', false, 'solicitado', now()
  );
  RAISE EXCEPTION '[SEC 7 | PATIENT | patient_studies] admin A NO debería insertar estudio en clínica B';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 7 | PATIENT | patient_studies] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;
RESET role;

-- --- Doctor: staff, puede manage estudios de su clínica --------------
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_doctor, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

INSERT INTO public.patient_studies (
  clinic_id, patient_id, doctor_id, tipo, nombre, prioridad, requiere_ayuno, status, solicitado_at
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'laboratorio', 'PFH', 'normal', false, 'solicitado', now()
);

UPDATE public.patient_studies SET status = 'en_proceso'
 WHERE id = '50000000-0000-0000-0000-000000000001';

RESET role;

-- --- Nurse / Farmacia: staff, puede manage --------------------------
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_nurse, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

INSERT INTO public.patient_studies (
  clinic_id, patient_id, doctor_id, tipo, nombre, prioridad, requiere_ayuno, status, solicitado_at
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'laboratorio', 'EGO', 'normal', false, 'solicitado', now()
);
RESET role;

-- --- Paciente: solo lee sus propios estudios, no puede insertar ------
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_patient, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_c int;
BEGIN
  -- Ve su estudio (pat_self)
  SELECT count(*) INTO v_c FROM public.patient_studies
   WHERE id = '50000000-0000-0000-0000-000000000001';
  IF v_c <> 1 THEN RAISE EXCEPTION '[SEC 7 | PATIENT | patients] paciente debería ver su estudio, vio %', v_c; END IF;

  -- NO ve estudio ajeno
  SELECT count(*) INTO v_c FROM public.patient_studies
   WHERE id = '50000000-0000-0000-0000-000000000002';
  IF v_c <> 0 THEN RAISE EXCEPTION '[SEC 7 | PATIENT | patients] paciente NO debería ver estudio ajeno, vio %', v_c; END IF;
END $$;

-- Paciente NO puede crear estudios (no es staff)
DO $$
BEGIN
  INSERT INTO public.patient_studies (
    clinic_id, patient_id, doctor_id, tipo, nombre, prioridad, requiere_ayuno, status, solicitado_at
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '20000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000001',
    'laboratorio', 'Auto-estudio', 'normal', false, 'solicitado', now()
  );
  RAISE EXCEPTION '[SEC 7 | PATIENT | patients] paciente NO debería crear estudios';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 7 | PATIENT | patients] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

-- =====================================================================
-- 8. log_phi_access — cada rol autenticado registra en audit_logs
--     y solo staff (admin/receptionist) puede LEER esos logs
-- =====================================================================

-- Baseline: rows previas de audit_logs para el paciente pat_self
DO $$
DECLARE v_before int;
BEGIN
  SELECT count(*) INTO v_before FROM public.audit_logs
   WHERE registro_id = '20000000-0000-0000-0000-000000000003'
     AND datos_nuevos->>'event' = 'phi_access';
  PERFORM set_config('rls_test.phi_baseline', v_before::text, true);
END $$;

-- Cada uno de los 5 roles llama log_phi_access. La función es SECURITY DEFINER
-- y solo exige auth.uid() no nulo → todas deben succeed e insertar audit_log.
DO $$
DECLARE
  v_uids uuid[] := ARRAY[
    '10000000-0000-0000-0000-000000000001',  -- global admin
    '10000000-0000-0000-0000-000000000002',  -- clinic admin A
    '10000000-0000-0000-0000-000000000003',  -- doctor
    '10000000-0000-0000-0000-000000000004',  -- nurse/farmacia
    '10000000-0000-0000-0000-000000000005'   -- paciente
  ];
  v_uid uuid;
BEGIN
  FOREACH v_uid IN ARRAY v_uids LOOP
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL role authenticated';
    PERFORM public.log_phi_access(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      '20000000-0000-0000-0000-000000000003'::uuid,
      'patients', 'select'
    );
    EXECUTE 'RESET role';
  END LOOP;
END $$;

-- Verificar que se registraron los 5 eventos (leyendo como service_role, sin RLS)
DO $$
DECLARE
  v_before int := current_setting('rls_test.phi_baseline')::int;
  v_after int;
BEGIN
  SELECT count(*) INTO v_after FROM public.audit_logs
   WHERE registro_id = '20000000-0000-0000-0000-000000000003'
     AND datos_nuevos->>'event' = 'phi_access';
  IF v_after - v_before <> 5 THEN
    RAISE EXCEPTION '[SEC 7 | PATIENT | audit_logs] log_phi_access debía insertar 5 filas, insertó %', v_after - v_before;
  END IF;

  -- Verifica que la fila contiene los campos esperados
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE registro_id = '20000000-0000-0000-0000-000000000003'
      AND datos_nuevos->>'event' = 'phi_access'
      AND datos_nuevos->>'accion' = 'select'
      AND tabla = 'patients'
      AND clinic_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  ) THEN
    RAISE EXCEPTION '[SEC 7 | PATIENT | audit_logs] audit_log de phi_access no tiene los campos esperados';
  END IF;
END $$;

-- Sin autenticación → RAISE 'No autenticado'
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', NULL, true);
  -- role sigue en postgres (service_role) → auth.uid() devuelve NULL
  BEGIN
    PERFORM public.log_phi_access(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      '20000000-0000-0000-0000-000000000003'::uuid,
      'patients', 'select'
    );
    RAISE EXCEPTION '[SEC 7 | PATIENT | audit_logs] log_phi_access debía fallar sin auth.uid()';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT ILIKE '%No autenticado%' AND SQLERRM NOT ILIKE '%log_phi_access debía fallar%' THEN
      RAISE EXCEPTION '[SEC 7 | PATIENT | audit_logs] Mensaje inesperado: %', SQLERRM;
    END IF;
    -- Si es el mensaje propio de "debía fallar" → re-raise
    IF SQLERRM ILIKE '%log_phi_access debía fallar%' THEN
      RAISE EXCEPTION '[SEC 7 | PATIENT | audit_logs] %', SQLERRM;
    END IF;
  END;
END $$;

-- Lectura de audit_logs por rol
-- Staff read audit exige has_role admin OR receptionist
-- + restrictive multiclinic (clinic_id null OR user_has_clinic_access)

-- Clinic admin A → puede leer logs de clínica A
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_admin_a, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM public.audit_logs
   WHERE registro_id = '20000000-0000-0000-0000-000000000003'
     AND datos_nuevos->>'event' = 'phi_access'
     AND clinic_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_c < 5 THEN
    RAISE EXCEPTION '[SEC 7 | PATIENT | audit_logs] clinic_admin debería leer >=5 phi_access de A, leyó %', v_c;
  END IF;
END $$;
RESET role;

-- Doctor NO puede leer audit_logs (no tiene has_role admin/receptionist)
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_doctor, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM public.audit_logs
   WHERE datos_nuevos->>'event' = 'phi_access';
  IF v_c <> 0 THEN
    RAISE EXCEPTION '[SEC 7 | PATIENT | audit_logs] doctor NO debería leer audit_logs, leyó %', v_c;
  END IF;
END $$;
RESET role;

-- Nurse NO puede leer audit_logs
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_nurse, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM public.audit_logs
   WHERE datos_nuevos->>'event' = 'phi_access';
  IF v_c <> 0 THEN
    RAISE EXCEPTION '[SEC 7 | PATIENT | audit_logs] nurse NO debería leer audit_logs, leyó %', v_c;
  END IF;
END $$;
RESET role;

-- Paciente NO puede leer audit_logs (aunque sean sobre él)
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_patient, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;
DO $$
DECLARE v_c int;
BEGIN
  SELECT count(*) INTO v_c FROM public.audit_logs
   WHERE registro_id = '20000000-0000-0000-0000-000000000003';
  IF v_c <> 0 THEN
    RAISE EXCEPTION '[SEC 7 | PATIENT | patients] paciente NO debería leer audit_logs, leyó %', v_c;
  END IF;
END $$;
RESET role;

-- Denegación de INSERT/UPDATE/DELETE directo en audit_logs para cualquier rol
-- (las policies "Deny all" cubren INSERT/UPDATE/DELETE con qual/with_check=false)
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_admin_a, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;
DO $$
BEGIN
  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES ('10000000-0000-0000-0000-000000000002', 'consultar', 'patients',
          '20000000-0000-0000-0000-000000000003',
          jsonb_build_object('event','forged_phi_access'),
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  RAISE EXCEPTION '[SEC 7 | PATIENT | audit_logs] clinic_admin NO debería insertar audit_logs directo (solo vía SECURITY DEFINER)';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 7 | PATIENT | audit_logs] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;
RESET role;

-- =====================================================================
-- OK: todas las expectativas cumplidas
-- =====================================================================
DO $$ BEGIN RAISE NOTICE '✅ RLS smoke tests OK (5 roles × patients, prescriptions, prescription_items, patient_studies, log_phi_access)'; END $$;

ROLLBACK;
