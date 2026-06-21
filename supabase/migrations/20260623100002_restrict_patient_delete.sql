-- Migration: Change ON DELETE CASCADE → RESTRICT on tables referencing patients
-- Rationale: NOM-004-SSA3-2012 requires minimum 5-year retention of clinical records
-- This prevents accidental cascade deletion of medical history when a patient is deleted

-- =====================================================
-- APPOINTMENTS table
-- =====================================================
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE RESTRICT;

-- =====================================================
-- EXPEDIENTES table
-- =====================================================
ALTER TABLE public.expedientes
  DROP CONSTRAINT IF EXISTS expedientes_patient_id_fkey;

ALTER TABLE public.expedientes
  ADD CONSTRAINT expedientes_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE RESTRICT;

-- =====================================================
-- CONSENTIMIENTOS table
-- =====================================================
ALTER TABLE public.consentimientos
  DROP CONSTRAINT IF EXISTS consentimientos_patient_id_fkey;

ALTER TABLE public.consentimientos
  ADD CONSTRAINT consentimientos_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE RESTRICT;

-- =====================================================
-- RLS: Remove hard-delete policy on patients
-- =====================================================
-- Deletes should now fail with RESTRICT error from FK constraints
-- Soft deletes via UPDATE activo=false remain available to admin
-- Hard delete with cascade cleanup reserved for GDPR (Phase 6)
DROP POLICY IF EXISTS "Admin deletes patients" ON public.patients;
