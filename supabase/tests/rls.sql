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
    RAISE EXCEPTION '[FAIL] % — esperado % % pero got=%',
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
\set doc_b '''30000000-0000-0000-0000-000000000002'''
\set u_doctor_b '''10000000-0000-0000-0000-000000000006'''
\set u_recep    '''10000000-0000-0000-0000-000000000007'''
\set appt_a     '''50000000-0000-0000-0000-000000000001'''
\set appt_b     '''50000000-0000-0000-0000-000000000002'''

-- Usuarios adicionales para tests cross-clínica de appointments
INSERT INTO auth.users (id, email, aud, role) VALUES
  (:u_doctor_b::uuid, 'doctor.b@test.mx', 'authenticated', 'authenticated'),
  (:u_recep::uuid,    'recep.a@test.mx',  'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  (:u_doctor_b::uuid, 'doctor'),
  (:u_recep::uuid,    'receptionist')
ON CONFLICT DO NOTHING;

-- Receptionist con membership SOLO en clínica A
INSERT INTO public.clinic_memberships (user_id, clinic_id, role, status) VALUES
  (:u_recep::uuid,    :clinic_a::uuid, 'receptionist', 'active'),
  (:u_doctor_b::uuid, :clinic_b::uuid, 'doctor',       'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.doctors (
  id, clinic_id, user_id, nombre, apellidos, especialidad,
  horario_inicio, horario_fin, duracion_cita_min, activo
) VALUES
  (:doc_a::uuid, :clinic_a::uuid, :u_doctor::uuid,   'Doc', 'RLS-A', 'medicina_general', '08:00', '18:00', 30, true),
  (:doc_b::uuid, :clinic_b::uuid, :u_doctor_b::uuid, 'Doc', 'RLS-B', 'medicina_general', '08:00', '18:00', 30, true)
ON CONFLICT (id) DO NOTHING;

-- Appointments seed: una en cada clínica (setup corre como owner → bypass RLS)
INSERT INTO public.appointments (
  id, clinic_id, patient_id, doctor_id, fecha_inicio, fecha_fin, status, motivo_consulta
) VALUES
  (:appt_a::uuid, :clinic_a::uuid, :pat_a::uuid, :doc_a::uuid,
   now() + interval '2 days', now() + interval '2 days 30 minutes', 'confirmada', 'Cita clínica A'),
  (:appt_b::uuid, :clinic_b::uuid, :pat_b::uuid, :doc_b::uuid,
   now() + interval '3 days', now() + interval '3 days 30 minutes', 'confirmada', 'Cita clínica B')
ON CONFLICT (id) DO NOTHING;

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
  IF v_c <> 2 THEN RAISE EXCEPTION '[SEC 1 | GLOBAL_ADMIN | clinics] global admin debería ver pacientes de ambas clínicas, vio %', v_c; END IF;
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
  IF v_c <> 1 THEN RAISE EXCEPTION '[SEC 2 | CLINIC_ADMIN_A | clinics] clinic_admin_A debería ver clínica A, vio %', v_c; END IF;

  -- NO ve clínica B (bloqueado por multiclinic_access_restrictive)
  SELECT count(*) INTO v_c FROM public.clinics WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF v_c <> 0 THEN RAISE EXCEPTION '[SEC 2 | CLINIC_ADMIN_A | clinics] clinic_admin_A no debería ver clínica B, vio %', v_c; END IF;

  -- Ve pacientes clínica A
  SELECT count(*) INTO v_c FROM public.patients WHERE clinic_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_c < 2 THEN RAISE EXCEPTION '[SEC 2 | CLINIC_ADMIN_A | patients] clinic_admin_A debería ver >=2 pacientes A, vio %', v_c; END IF;

  -- NO ve paciente clínica B
  SELECT count(*) INTO v_c FROM public.patients WHERE id = '20000000-0000-0000-0000-000000000002';
  IF v_c <> 0 THEN RAISE EXCEPTION '[SEC 2 | CLINIC_ADMIN_A | patients] clinic_admin_A no debería ver paciente de B, vio %', v_c; END IF;
END $$;

-- Puede insertar paciente en su clínica
INSERT INTO public.patients (clinic_id, nombre, apellidos, sexo, fecha_nacimiento)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nuevo', 'PorAdminA', 'M', '2000-01-01');

-- NO puede insertar paciente en clínica B (bloqueado por restrictive multiclinic)
DO $$
BEGIN
  INSERT INTO public.patients (clinic_id, nombre, apellidos, sexo, fecha_nacimiento)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Malo', 'CrossClinic', 'M', '2000-01-01');
  RAISE EXCEPTION '[SEC 2 | CLINIC_ADMIN_A | clinics] clinic_admin_A NO debería poder insertar paciente en clínica B';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 2 | CLINIC_ADMIN_A | clinics] Error inesperado en insert cross-clínica: % / %', SQLSTATE, SQLERRM;
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
  RAISE EXCEPTION '[SEC 4 | NURSE | medicamentos] nurse NO debería insertar medicamento en clínica B';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 4 | NURSE | medicamentos] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

-- Nurse NO puede borrar medicamentos (solo admin)
DO $$
BEGIN
  DELETE FROM public.medicamentos WHERE nombre = 'Paracetamol RLS';
  IF FOUND THEN
    RAISE EXCEPTION '[SEC 4 | NURSE | medicamentos] nurse NO debería poder eliminar medicamentos (solo admin)';
  END IF;
EXCEPTION WHEN insufficient_privilege OR others THEN
  IF SQLSTATE <> '42501' AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 4 | NURSE | medicamentos] Error inesperado en delete: % / %', SQLSTATE, SQLERRM;
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
  IF v_c <> 0 THEN RAISE EXCEPTION '[SEC 5 | PATIENT | medicamentos] paciente NO debería ver medicamentos, vio %', v_c; END IF;
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
  IF v_c < 1 THEN RAISE EXCEPTION '[SEC 6 | CLINIC_ADMIN_A | prescriptions] admin A debería ver recetas de clínica A, vio %', v_c; END IF;

  SELECT count(*) INTO v_c FROM public.prescriptions WHERE clinic_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF v_c <> 0 THEN RAISE EXCEPTION '[SEC 6 | CLINIC_ADMIN_A | prescriptions] admin A NO debería ver recetas de B, vio %', v_c; END IF;
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
  RAISE EXCEPTION '[SEC 6 | DOCTOR | prescriptions] doctor NO debería insertar receta cross-clínica';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 6 | DOCTOR | prescriptions] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

-- NO puede DELETE (solo admin)
DO $$
BEGIN
  DELETE FROM public.prescriptions WHERE id = '40000000-0000-0000-0000-000000000001';
  IF FOUND THEN RAISE EXCEPTION '[SEC 6 | DOCTOR | prescriptions] doctor NO debería eliminar recetas'; END IF;
EXCEPTION WHEN insufficient_privilege OR others THEN
  IF SQLSTATE <> '42501' AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 6 | DOCTOR | prescriptions] Error inesperado: % / %', SQLSTATE, SQLERRM;
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
  IF v_c <> 1 THEN RAISE EXCEPTION '[SEC 6 | PATIENT | prescriptions] paciente debería ver su receta, vio %', v_c; END IF;

  -- NO ve receta de otro paciente
  SELECT count(*) INTO v_c FROM public.prescriptions
   WHERE id = '40000000-0000-0000-0000-000000000002';
  IF v_c <> 0 THEN RAISE EXCEPTION '[SEC 6 | PATIENT | prescriptions] paciente NO debería ver receta ajena, vio %', v_c; END IF;

  -- Ve prescription_items de su receta
  SELECT count(*) INTO v_c FROM public.prescription_items
   WHERE prescription_id = '40000000-0000-0000-0000-000000000001';
  IF v_c < 1 THEN RAISE EXCEPTION '[SEC 6 | PATIENT | prescriptions] paciente debería ver items de su receta, vio %', v_c; END IF;
END $$;

-- Paciente NO puede crear recetas
DO $$
BEGIN
  INSERT INTO public.prescriptions (clinic_id, patient_id, doctor_id, status, digital_signature_status)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '20000000-0000-0000-0000-000000000003',
          '30000000-0000-0000-0000-000000000001',
          'issued','pending');
  RAISE EXCEPTION '[SEC 6 | PATIENT | prescriptions] paciente NO debería crear recetas';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 6 | PATIENT | prescriptions] Error inesperado: % / %', SQLSTATE, SQLERRM;
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
  IF v_c <> 2 THEN RAISE EXCEPTION '[SEC 7 | GLOBAL_ADMIN | patient_studies] global admin debería ver ambos estudios, vio %', v_c; END IF;
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
  IF v_c < 1 THEN RAISE EXCEPTION '[SEC 7 | CLINIC_ADMIN_A | patient_studies] admin A debería ver estudios A, vio %', v_c; END IF;

  SELECT count(*) INTO v_c FROM public.patient_studies WHERE clinic_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF v_c <> 0 THEN RAISE EXCEPTION '[SEC 7 | CLINIC_ADMIN_A | patient_studies] admin A NO debería ver estudios B, vio %', v_c; END IF;
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
  RAISE EXCEPTION '[SEC 7 | CLINIC_ADMIN_A | patient_studies] admin A NO debería insertar estudio en clínica B';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 7 | CLINIC_ADMIN_A | patient_studies] Error inesperado: % / %', SQLSTATE, SQLERRM;
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
  IF v_c <> 1 THEN RAISE EXCEPTION '[SEC 7 | PATIENT | patient_studies] paciente debería ver su estudio, vio %', v_c; END IF;

  -- NO ve estudio ajeno
  SELECT count(*) INTO v_c FROM public.patient_studies
   WHERE id = '50000000-0000-0000-0000-000000000002';
  IF v_c <> 0 THEN RAISE EXCEPTION '[SEC 7 | PATIENT | patient_studies] paciente NO debería ver estudio ajeno, vio %', v_c; END IF;
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
  RAISE EXCEPTION '[SEC 7 | PATIENT | patient_studies] paciente NO debería crear estudios';
EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
  IF SQLSTATE NOT IN ('42501','23514') AND SQLERRM NOT ILIKE '%row-level security%' THEN
    RAISE EXCEPTION '[SEC 7 | PATIENT | patient_studies] Error inesperado: % / %', SQLSTATE, SQLERRM;
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
    RAISE EXCEPTION '[SEC 7 | PATIENT | audit_logs] paciente NO debería leer audit_logs, leyó %', v_c;
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

\echo '>>> 9. CROSS-CLÍNICA con IDs válidos de otra clínica'
-- =====================================================================
-- 9. Cross-clinic con IDs VÁLIDOS de otra clínica
--
--    Verifica que aunque el atacante conozca UUIDs reales de recursos en
--    otra clínica (pat_b, rx_b, doc_a asignado a A pero con targets B, etc.)
--    las operaciones se bloquean por RLS/restrictive multiclinic — nunca
--    por "no encontrado". Cubre SELECT-por-id, UPDATE, DELETE e INSERT con
--    clinic_id mismatch entre la fila y sus foreign keys.
-- =====================================================================

-- --- 9.1 CLINIC_ADMIN_A no puede tocar recursos con IDs válidos de B ---
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_admin_a, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_c int; v_rows int;
BEGIN
  -- SELECT-por-id: pat_b existe, pero admin A no debe verlo aunque conozca el UUID
  SELECT count(*) INTO v_c FROM public.patients
    WHERE id = '20000000-0000-0000-0000-000000000002';
  IF v_c <> 0 THEN
    RAISE EXCEPTION '[SEC 9 | CLINIC_ADMIN_A | patients] SELECT by-id de pat_b debería devolver 0, vio %', v_c;
  END IF;

  -- UPDATE con id válido de otra clínica: 0 filas afectadas (RLS silencioso)
  UPDATE public.patients SET nombre = 'HACKED'
    WHERE id = '20000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION '[SEC 9 | CLINIC_ADMIN_A | patients] UPDATE cross-clínica by-id afectó % filas', v_rows;
  END IF;

  -- SELECT prescripción rx_b (UUID válido) → 0
  SELECT count(*) INTO v_c FROM public.prescriptions
    WHERE id = '40000000-0000-0000-0000-000000000002';
  IF v_c <> 0 THEN
    RAISE EXCEPTION '[SEC 9 | CLINIC_ADMIN_A | prescriptions] SELECT by-id de rx_b debería devolver 0, vio %', v_c;
  END IF;

  -- DELETE rx_b: 0 filas afectadas
  DELETE FROM public.prescriptions WHERE id = '40000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION '[SEC 9 | CLINIC_ADMIN_A | prescriptions] DELETE cross-clínica by-id afectó % filas', v_rows;
  END IF;
END $$;

-- INSERT prescription con clinic_id=A pero patient_id de B (mismatch multiclínica)
DO $$
BEGIN
  INSERT INTO public.prescriptions (clinic_id, patient_id, doctor_id, status, digital_signature_status)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '20000000-0000-0000-0000-000000000002',  -- pat_b (clínica B)
          '30000000-0000-0000-0000-000000000001',
          'issued','pending');
  RAISE EXCEPTION '[SEC 9 | CLINIC_ADMIN_A | prescriptions] INSERT con patient_id de otra clínica debería fallar';
EXCEPTION WHEN insufficient_privilege OR check_violation OR raise_exception OR others THEN
  IF SQLSTATE NOT IN ('42501','23514','P0001') AND SQLERRM NOT ILIKE '%row-level security%' AND SQLERRM NOT ILIKE '%multi%' THEN
    RAISE EXCEPTION '[SEC 9 | CLINIC_ADMIN_A | prescriptions] Error inesperado en mismatch clinic/patient: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

-- INSERT prescription_item con prescription_id=rx_b pero clinic_id=A (mismatch)
DO $$
BEGIN
  INSERT INTO public.prescription_items (
    prescription_id, clinic_id, generic_name, dose, route, frequency, duration, instructions, is_controlled
  ) VALUES (
    '40000000-0000-0000-0000-000000000002',           -- rx_b
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',           -- pretende ser de A
    'Cross', '1g', 'oral', 'c/24h', '1 día', '-', false
  );
  RAISE EXCEPTION '[SEC 9 | CLINIC_ADMIN_A | prescription_items] INSERT con prescription_id de otra clínica debería fallar';
EXCEPTION WHEN insufficient_privilege OR check_violation OR raise_exception OR others THEN
  IF SQLSTATE NOT IN ('42501','23514','P0001') AND SQLERRM NOT ILIKE '%row-level security%' AND SQLERRM NOT ILIKE '%multi%' THEN
    RAISE EXCEPTION '[SEC 9 | CLINIC_ADMIN_A | prescription_items] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

-- --- 9.2 DOCTOR no puede tocar recursos de B aunque conozca UUIDs ------
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_doctor, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_c int; v_rows int;
BEGIN
  -- SELECT pat_b por id → 0
  SELECT count(*) INTO v_c FROM public.patients
    WHERE id = '20000000-0000-0000-0000-000000000002';
  IF v_c <> 0 THEN
    RAISE EXCEPTION '[SEC 9 | DOCTOR | patients] SELECT by-id de pat_b debería devolver 0, vio %', v_c;
  END IF;

  -- UPDATE rx_b: 0 filas (aunque el doctor sea "doctor_id" de la receta, la clínica bloquea)
  UPDATE public.prescriptions SET status = 'cancelled'
    WHERE id = '40000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION '[SEC 9 | DOCTOR | prescriptions] UPDATE cross-clínica by-id afectó % filas', v_rows;
  END IF;

  -- SELECT patient_studies de B por id → 0
  SELECT count(*) INTO v_c FROM public.patient_studies
    WHERE clinic_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF v_c <> 0 THEN
    RAISE EXCEPTION '[SEC 9 | DOCTOR | patient_studies] doctor NO debería ver estudios de B, vio %', v_c;
  END IF;
END $$;

-- INSERT prescription_item apuntando a rx_b con clinic_id=B (doctor no tiene membership en B)
DO $$
BEGIN
  INSERT INTO public.prescription_items (
    prescription_id, clinic_id, generic_name, dose, route, frequency, duration, instructions, is_controlled
  ) VALUES (
    '40000000-0000-0000-0000-000000000002',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'CrossB', '1g', 'oral', 'c/24h', '1 día', '-', false
  );
  RAISE EXCEPTION '[SEC 9 | DOCTOR | prescription_items] doctor sin membership en B no debería insertar items';
EXCEPTION WHEN insufficient_privilege OR check_violation OR raise_exception OR others THEN
  IF SQLSTATE NOT IN ('42501','23514','P0001') AND SQLERRM NOT ILIKE '%row-level security%' AND SQLERRM NOT ILIKE '%multi%' THEN
    RAISE EXCEPTION '[SEC 9 | DOCTOR | prescription_items] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

-- --- 9.3 NURSE — cross-clínica bloqueado en patient_studies ------------
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_nurse, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_rows int;
BEGIN
  -- UPDATE de un patient_study de B → 0 filas
  UPDATE public.patient_studies SET status = 'cancelled'
    WHERE clinic_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION '[SEC 9 | NURSE | patient_studies] UPDATE cross-clínica afectó % filas', v_rows;
  END IF;
END $$;

-- INSERT patient_study con patient_id de B pero clinic_id=A
DO $$
BEGIN
  INSERT INTO public.patient_studies (patient_id, clinic_id, study_name, status)
  VALUES ('20000000-0000-0000-0000-000000000002',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'Cross study', 'ordered');
  RAISE EXCEPTION '[SEC 9 | NURSE | patient_studies] INSERT con patient_id de otra clínica debería fallar';
EXCEPTION WHEN insufficient_privilege OR check_violation OR raise_exception OR others THEN
  IF SQLSTATE NOT IN ('42501','23514','P0001') AND SQLERRM NOT ILIKE '%row-level security%' AND SQLERRM NOT ILIKE '%multi%' THEN
    RAISE EXCEPTION '[SEC 9 | NURSE | patient_studies] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

-- --- 9.4 PATIENT — no puede acceder a otro paciente aunque tenga UUID --
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_patient, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_c int; v_rows int;
BEGIN
  -- SELECT pat_a (mismo clinic pero no es el suyo) por id → 0
  SELECT count(*) INTO v_c FROM public.patients
    WHERE id = '20000000-0000-0000-0000-000000000001';
  IF v_c <> 0 THEN
    RAISE EXCEPTION '[SEC 9 | PATIENT | patients] SELECT by-id de pat_a (misma clínica) debería devolver 0, vio %', v_c;
  END IF;

  -- SELECT pat_b (clínica ajena) por id → 0
  SELECT count(*) INTO v_c FROM public.patients
    WHERE id = '20000000-0000-0000-0000-000000000002';
  IF v_c <> 0 THEN
    RAISE EXCEPTION '[SEC 9 | PATIENT | patients] SELECT by-id de pat_b (otra clínica) debería devolver 0, vio %', v_c;
  END IF;

  -- SELECT rx_b (receta ajena, clínica ajena) por id → 0
  SELECT count(*) INTO v_c FROM public.prescriptions
    WHERE id = '40000000-0000-0000-0000-000000000002';
  IF v_c <> 0 THEN
    RAISE EXCEPTION '[SEC 9 | PATIENT | prescriptions] SELECT by-id de rx_b debería devolver 0, vio %', v_c;
  END IF;

  -- UPDATE de su propio registro cambiando clinic_id a B → debe fallar o afectar 0
  UPDATE public.patients
     SET clinic_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
   WHERE id = '20000000-0000-0000-0000-000000000003';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION '[SEC 9 | PATIENT | patients] paciente NO debería mover su registro a otra clínica (afectó % filas)', v_rows;
  END IF;
EXCEPTION WHEN insufficient_privilege OR check_violation OR raise_exception THEN
  NULL;  -- bloqueo por policy es aceptable
END $$;

RESET role;

-- =====================================================================
\echo '>>> 10. APPOINTMENTS cross-clínica (Recepción / Admin clínica / Médico / Paciente)'
-- =====================================================================
-- 10. APPOINTMENTS — bloqueo cross-clínica con IDs válidos de la otra clínica
--
--     Un receptionist / clinic admin / doctor / paciente de la clínica A NO
--     puede LEER, CREAR, ACTUALIZAR ni CANCELAR una cita de la clínica B
--     aunque conozca los UUIDs reales (appt_b, pat_b, doc_b). Todas las
--     denegaciones deben ser silenciosas (0 filas) por RLS restrictive, o
--     lanzar 42501 / 23514 / P0001 en INSERT con clinic_id mismatch.
-- =====================================================================

-- Helper repetido: probar los 4 roles con el mismo bloque de asserts. Se
-- expande manual por rol para que el TAG en [SEC 10 | ROL | ...] identifique
-- exacto quién falló sin necesidad de looping dinámico.

-- --- 10.1 RECEPTIONIST (clínica A) -------------------------------------
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_recep, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_c int; v_rows int;
BEGIN
  -- SELECT: appt_a visible, appt_b invisible
  SELECT count(*) INTO v_c FROM public.appointments
    WHERE id = '50000000-0000-0000-0000-000000000001';
  PERFORM pg_temp._assert_count('[SEC 10 | RECEPTIONIST | appointments] SELECT appt_a propio', 1, v_c, '>=');

  SELECT count(*) INTO v_c FROM public.appointments
    WHERE id = '50000000-0000-0000-0000-000000000002';
  PERFORM pg_temp._assert_count('[SEC 10 | RECEPTIONIST | appointments] SELECT appt_b cross-clínica', 0, v_c, '=');

  -- UPDATE cross-clínica → 0 filas
  UPDATE public.appointments SET motivo_consulta = 'HACKED'
    WHERE id = '50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pg_temp._assert_count('[SEC 10 | RECEPTIONIST | appointments] UPDATE cross-clínica by-id', 0, v_rows, '=');

  -- CANCEL cross-clínica (UPDATE status) → 0 filas
  UPDATE public.appointments SET status = 'cancelada'
    WHERE id = '50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pg_temp._assert_count('[SEC 10 | RECEPTIONIST | appointments] CANCEL cross-clínica by-id', 0, v_rows, '=');

  -- DELETE cross-clínica → 0 filas
  DELETE FROM public.appointments WHERE id = '50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pg_temp._assert_count('[SEC 10 | RECEPTIONIST | appointments] DELETE cross-clínica by-id', 0, v_rows, '=');
END $$;

-- INSERT con clinic_id=B (recepcionista sin membership en B) → debe fallar
DO $$
BEGIN
  INSERT INTO public.appointments (clinic_id, patient_id, doctor_id, fecha_inicio, fecha_fin, status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          '20000000-0000-0000-0000-000000000002',
          '30000000-0000-0000-0000-000000000002',
          now() + interval '5 days', now() + interval '5 days 30 minutes', 'solicitada');
  RAISE EXCEPTION '[SEC 10 | RECEPTIONIST | appointments] INSERT en clínica B sin membership debería fallar';
EXCEPTION WHEN insufficient_privilege OR check_violation OR raise_exception OR others THEN
  IF SQLSTATE NOT IN ('42501','23514','P0001') AND SQLERRM NOT ILIKE '%row-level security%' AND SQLERRM NOT ILIKE '%multi%' THEN
    RAISE EXCEPTION '[SEC 10 | RECEPTIONIST | appointments] Error inesperado en INSERT cross-clínica: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

-- INSERT con clinic_id=A pero patient_id/doctor_id de B (mismatch)
DO $$
BEGIN
  INSERT INTO public.appointments (clinic_id, patient_id, doctor_id, fecha_inicio, fecha_fin, status)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '20000000-0000-0000-0000-000000000002',   -- pat_b
          '30000000-0000-0000-0000-000000000002',   -- doc_b
          now() + interval '5 days', now() + interval '5 days 30 minutes', 'solicitada');
  RAISE EXCEPTION '[SEC 10 | RECEPTIONIST | appointments] INSERT clinic=A con pat/doc de B debería fallar';
EXCEPTION WHEN insufficient_privilege OR check_violation OR raise_exception OR others THEN
  IF SQLSTATE NOT IN ('42501','23514','P0001') AND SQLERRM NOT ILIKE '%row-level security%' AND SQLERRM NOT ILIKE '%multi%' THEN
    RAISE EXCEPTION '[SEC 10 | RECEPTIONIST | appointments] Error inesperado en mismatch: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

-- --- 10.2 CLINIC ADMIN A -----------------------------------------------
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_admin_a, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_c int; v_rows int;
BEGIN
  SELECT count(*) INTO v_c FROM public.appointments
    WHERE id = '50000000-0000-0000-0000-000000000002';
  PERFORM pg_temp._assert_count('[SEC 10 | CLINIC_ADMIN_A | appointments] SELECT appt_b cross-clínica', 0, v_c, '=');

  UPDATE public.appointments SET motivo_consulta = 'HACKED'
    WHERE id = '50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pg_temp._assert_count('[SEC 10 | CLINIC_ADMIN_A | appointments] UPDATE cross-clínica', 0, v_rows, '=');

  UPDATE public.appointments SET status = 'cancelada'
    WHERE id = '50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pg_temp._assert_count('[SEC 10 | CLINIC_ADMIN_A | appointments] CANCEL cross-clínica', 0, v_rows, '=');

  DELETE FROM public.appointments WHERE id = '50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pg_temp._assert_count('[SEC 10 | CLINIC_ADMIN_A | appointments] DELETE cross-clínica', 0, v_rows, '=');
END $$;

DO $$
BEGIN
  INSERT INTO public.appointments (clinic_id, patient_id, doctor_id, fecha_inicio, fecha_fin, status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          '20000000-0000-0000-0000-000000000002',
          '30000000-0000-0000-0000-000000000002',
          now() + interval '6 days', now() + interval '6 days 30 minutes', 'solicitada');
  RAISE EXCEPTION '[SEC 10 | CLINIC_ADMIN_A | appointments] INSERT en clínica B debería fallar';
EXCEPTION WHEN insufficient_privilege OR check_violation OR raise_exception OR others THEN
  IF SQLSTATE NOT IN ('42501','23514','P0001') AND SQLERRM NOT ILIKE '%row-level security%' AND SQLERRM NOT ILIKE '%multi%' THEN
    RAISE EXCEPTION '[SEC 10 | CLINIC_ADMIN_A | appointments] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

-- --- 10.3 DOCTOR (clínica A) -------------------------------------------
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_doctor, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_c int; v_rows int;
BEGIN
  SELECT count(*) INTO v_c FROM public.appointments
    WHERE id = '50000000-0000-0000-0000-000000000002';
  PERFORM pg_temp._assert_count('[SEC 10 | DOCTOR | appointments] SELECT appt_b cross-clínica', 0, v_c, '=');

  UPDATE public.appointments SET notas = 'HACKED'
    WHERE id = '50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pg_temp._assert_count('[SEC 10 | DOCTOR | appointments] UPDATE cross-clínica', 0, v_rows, '=');

  UPDATE public.appointments SET status = 'cancelada'
    WHERE id = '50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pg_temp._assert_count('[SEC 10 | DOCTOR | appointments] CANCEL cross-clínica', 0, v_rows, '=');

  DELETE FROM public.appointments WHERE id = '50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pg_temp._assert_count('[SEC 10 | DOCTOR | appointments] DELETE cross-clínica', 0, v_rows, '=');
END $$;

-- Doctor intenta crear cita en clínica B usando doc_b (que no es él)
DO $$
BEGIN
  INSERT INTO public.appointments (clinic_id, patient_id, doctor_id, fecha_inicio, fecha_fin, status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          '20000000-0000-0000-0000-000000000002',
          '30000000-0000-0000-0000-000000000002',
          now() + interval '7 days', now() + interval '7 days 30 minutes', 'solicitada');
  RAISE EXCEPTION '[SEC 10 | DOCTOR | appointments] INSERT en clínica B sin membership debería fallar';
EXCEPTION WHEN insufficient_privilege OR check_violation OR raise_exception OR others THEN
  IF SQLSTATE NOT IN ('42501','23514','P0001') AND SQLERRM NOT ILIKE '%row-level security%' AND SQLERRM NOT ILIKE '%multi%' THEN
    RAISE EXCEPTION '[SEC 10 | DOCTOR | appointments] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

-- --- 10.4 PATIENT ------------------------------------------------------
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :u_patient, 'role', 'authenticated')::text, true);
SET LOCAL role authenticated;

DO $$
DECLARE v_c int; v_rows int;
BEGIN
  -- No debe ver la cita de otra clínica ni siquiera con UUID en mano
  SELECT count(*) INTO v_c FROM public.appointments
    WHERE id = '50000000-0000-0000-0000-000000000002';
  PERFORM pg_temp._assert_count('[SEC 10 | PATIENT | appointments] SELECT appt_b cross-clínica', 0, v_c, '=');

  -- Tampoco puede ver appt_a (paciente pat_a, no es él — mismo clínica)
  SELECT count(*) INTO v_c FROM public.appointments
    WHERE id = '50000000-0000-0000-0000-000000000001';
  PERFORM pg_temp._assert_count('[SEC 10 | PATIENT | appointments] SELECT appt_a de otro paciente', 0, v_c, '=');

  -- UPDATE / CANCEL / DELETE cross-clínica → 0 filas
  UPDATE public.appointments SET notas = 'HACKED'
    WHERE id = '50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pg_temp._assert_count('[SEC 10 | PATIENT | appointments] UPDATE cross-clínica', 0, v_rows, '=');

  UPDATE public.appointments SET status = 'cancelada'
    WHERE id = '50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pg_temp._assert_count('[SEC 10 | PATIENT | appointments] CANCEL cross-clínica', 0, v_rows, '=');

  DELETE FROM public.appointments WHERE id = '50000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pg_temp._assert_count('[SEC 10 | PATIENT | appointments] DELETE cross-clínica', 0, v_rows, '=');
END $$;

-- Paciente intenta agendar en clínica B usando pat_b (no es él) — debe fallar
DO $$
BEGIN
  INSERT INTO public.appointments (clinic_id, patient_id, doctor_id, fecha_inicio, fecha_fin, status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          '20000000-0000-0000-0000-000000000002',
          '30000000-0000-0000-0000-000000000002',
          now() + interval '8 days', now() + interval '8 days 30 minutes', 'solicitada');
  RAISE EXCEPTION '[SEC 10 | PATIENT | appointments] INSERT cross-clínica con pat/doc ajenos debería fallar';
EXCEPTION WHEN insufficient_privilege OR check_violation OR raise_exception OR others THEN
  IF SQLSTATE NOT IN ('42501','23514','P0001') AND SQLERRM NOT ILIKE '%row-level security%' AND SQLERRM NOT ILIKE '%multi%' THEN
    RAISE EXCEPTION '[SEC 10 | PATIENT | appointments] Error inesperado: % / %', SQLSTATE, SQLERRM;
  END IF;
END $$;

RESET role;

-- =====================================================================
\echo '>>> 11. log_phi_access sobre APPOINTMENTS (rol correcto + cross-clínica)'
-- =====================================================================
-- 11. PHI logging para citas — cada rol autenticado registra su acceso a
--     una cita de SU clínica con user_id = auth.uid(), tabla='appointments',
--     clinic_id correcto y event='phi_access'. Cross-clínica: la lectura
--     directa devuelve 0 filas (no genera log espontáneo) y la llamada
--     explícita queda registrada con el clinic_id ajeno para que auditoría
--     detecte abuso. Sin autenticación, la función levanta excepción.
-- =====================================================================

-- Baseline: filas de audit_logs previas para appt_a y appt_b con event=phi_access
DO $$
DECLARE v_a int; v_b int;
BEGIN
  SELECT count(*) INTO v_a FROM public.audit_logs
   WHERE tabla = 'appointments'
     AND registro_id = '50000000-0000-0000-0000-000000000001'
     AND datos_nuevos->>'event' = 'phi_access';
  SELECT count(*) INTO v_b FROM public.audit_logs
   WHERE tabla = 'appointments'
     AND registro_id = '50000000-0000-0000-0000-000000000002'
     AND datos_nuevos->>'event' = 'phi_access';
  PERFORM set_config('rls_test.phi_appt_a_baseline', v_a::text, true);
  PERFORM set_config('rls_test.phi_appt_b_baseline', v_b::text, true);
END $$;

-- 11.1 — Cada rol (global, clinic_admin_a, doctor, nurse, receptionist,
--       patient) autenticado registra acceso PHI a appt_a en clínica A.
DO $$
DECLARE
  v_pairs jsonb := jsonb_build_array(
    jsonb_build_object('role','GLOBAL',       'uid','10000000-0000-0000-0000-000000000001'),
    jsonb_build_object('role','CLINIC_ADMIN', 'uid','10000000-0000-0000-0000-000000000002'),
    jsonb_build_object('role','DOCTOR',       'uid','10000000-0000-0000-0000-000000000003'),
    jsonb_build_object('role','NURSE',        'uid','10000000-0000-0000-0000-000000000004'),
    jsonb_build_object('role','PATIENT',      'uid','10000000-0000-0000-0000-000000000005'),
    jsonb_build_object('role','RECEPTIONIST', 'uid','10000000-0000-0000-0000-000000000007')
  );
  v_item jsonb;
  v_uid uuid;
  v_role text;
  v_hit int;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_pairs) LOOP
    v_role := v_item->>'role';
    v_uid  := (v_item->>'uid')::uuid;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL role authenticated';

    PERFORM public.log_phi_access(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      '50000000-0000-0000-0000-000000000001'::uuid,
      'appointments', 'select'
    );

    EXECUTE 'RESET role';
    PERFORM set_config('request.jwt.claims', NULL, true);

    -- Verifica que quedó exactamente una fila propia con el rol/clinic/tabla correctos
    SELECT count(*) INTO v_hit FROM public.audit_logs
      WHERE tabla = 'appointments'
        AND registro_id = '50000000-0000-0000-0000-000000000001'
        AND user_id = v_uid
        AND clinic_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
        AND datos_nuevos->>'event' = 'phi_access'
        AND datos_nuevos->>'accion' = 'select';
    IF v_hit < 1 THEN
      RAISE EXCEPTION '[SEC 11 | % | appointments] log_phi_access no registró fila para user_id=% (hit=%)',
        v_role, v_uid, v_hit;
    END IF;
  END LOOP;
END $$;

-- 11.2 — Verificar el delta total en appt_a: 6 nuevas filas (una por rol)
DO $$
DECLARE
  v_before int := current_setting('rls_test.phi_appt_a_baseline')::int;
  v_after int;
BEGIN
  SELECT count(*) INTO v_after FROM public.audit_logs
   WHERE tabla = 'appointments'
     AND registro_id = '50000000-0000-0000-0000-000000000001'
     AND datos_nuevos->>'event' = 'phi_access';
  IF v_after - v_before <> 6 THEN
    RAISE EXCEPTION '[SEC 11 | ALL | appointments] Esperaba 6 phi_access nuevas sobre appt_a, hubo %',
      v_after - v_before;
  END IF;
END $$;

-- 11.3 — Cross-clínica: SELECT directo a appt_b desde receptionist devuelve
--        0 filas (RLS), por lo que ningún flujo natural genera log espontáneo
--        sobre appt_b. Confirmamos que appt_b sigue en baseline hasta el
--        siguiente sub-caso.
DO $$
DECLARE
  v_before int := current_setting('rls_test.phi_appt_b_baseline')::int;
  v_now int;
  v_c int;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', '10000000-0000-0000-0000-000000000007', 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL role authenticated';

  SELECT count(*) INTO v_c FROM public.appointments
    WHERE id = '50000000-0000-0000-0000-000000000002';
  PERFORM pg_temp._assert_count('[SEC 11 | RECEPTIONIST | appointments] SELECT appt_b cross-clínica (no genera phi log)', 0, v_c, '=');

  EXECUTE 'RESET role';
  PERFORM set_config('request.jwt.claims', NULL, true);

  SELECT count(*) INTO v_now FROM public.audit_logs
   WHERE tabla = 'appointments'
     AND registro_id = '50000000-0000-0000-0000-000000000002'
     AND datos_nuevos->>'event' = 'phi_access';
  IF v_now <> v_before THEN
    RAISE EXCEPTION '[SEC 11 | RECEPTIONIST | appointments] SELECT bloqueado no debía generar phi log sobre appt_b (delta=%)',
      v_now - v_before;
  END IF;
END $$;

-- 11.4 — Llamada explícita cross-clínica: log_phi_access no valida clinic
--        access (es solo audit-trail), pero la fila resultante debe conservar
--        el clinic_id ajeno y el user_id del abusador para permitir detección.
DO $$
DECLARE v_hit int;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', '10000000-0000-0000-0000-000000000007', 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL role authenticated';

  PERFORM public.log_phi_access(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    '50000000-0000-0000-0000-000000000002'::uuid,
    'appointments', 'select'
  );

  EXECUTE 'RESET role';
  PERFORM set_config('request.jwt.claims', NULL, true);

  SELECT count(*) INTO v_hit FROM public.audit_logs
    WHERE tabla = 'appointments'
      AND registro_id = '50000000-0000-0000-0000-000000000002'
      AND user_id    = '10000000-0000-0000-0000-000000000007'
      AND clinic_id  = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      AND datos_nuevos->>'event' = 'phi_access';
  IF v_hit < 1 THEN
    RAISE EXCEPTION '[SEC 11 | RECEPTIONIST | appointments] log_phi_access cross-clínica no dejó traza auditable (hit=%)', v_hit;
  END IF;
END $$;

-- 11.5 — Sin autenticación: log_phi_access sobre appointments debe fallar
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', NULL, true);
  BEGIN
    PERFORM public.log_phi_access(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      '50000000-0000-0000-0000-000000000001'::uuid,
      'appointments', 'select'
    );
    RAISE EXCEPTION '[SEC 11 | ANON | appointments] log_phi_access debía fallar sin auth.uid()';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM ILIKE '%debía fallar sin auth.uid()%' THEN
      RAISE;
    END IF;
    IF SQLERRM NOT ILIKE '%No autenticado%' THEN
      RAISE EXCEPTION '[SEC 11 | ANON | appointments] Mensaje inesperado: %', SQLERRM;
    END IF;
  END;
END $$;

-- =====================================================================
-- OK: todas las expectativas cumplidas
-- =====================================================================
DO $$ BEGIN RAISE NOTICE '✅ RLS smoke tests OK (5 roles + receptionist × patients, prescriptions, prescription_items, patient_studies, appointments, log_phi_access, cross-clínica, phi_access sobre citas)'; END $$;

ROLLBACK;
