-- auth_all_prescriptions / auth_all_prescription_items eran USING(true) WITH CHECK(true)
-- para ALL comandos: cualquier usuario autenticado (paciente incluido, vía PWA)
-- podía leer/editar/borrar recetas de CUALQUIER paciente en CUALQUIER clínica.
-- Fix: personal solo CRUD dentro de su(s) clínica(s) via clinic_memberships;
-- paciente solo SELECT de sus propias recetas (nunca INSERT/UPDATE/DELETE).

DROP POLICY IF EXISTS "auth_all_prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "prescriptions_staff_clinic_scope" ON public.prescriptions;
DROP POLICY IF EXISTS "prescriptions_patient_read_own" ON public.prescriptions;

CREATE POLICY "prescriptions_staff_clinic_scope" ON public.prescriptions
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.clinic_memberships WHERE user_id = auth.uid() AND clinic_id = prescriptions.clinic_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.clinic_memberships WHERE user_id = auth.uid() AND clinic_id = prescriptions.clinic_id)
  );

CREATE POLICY "prescriptions_patient_read_own" ON public.prescriptions
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.patients pat WHERE pat.id = prescriptions.patient_id AND pat.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "auth_all_prescription_items" ON public.prescription_items;
DROP POLICY IF EXISTS "prescription_items_staff_clinic_scope" ON public.prescription_items;
DROP POLICY IF EXISTS "prescription_items_patient_read_own" ON public.prescription_items;

CREATE POLICY "prescription_items_staff_clinic_scope" ON public.prescription_items
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.clinic_memberships WHERE user_id = auth.uid() AND clinic_id = prescription_items.clinic_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.clinic_memberships WHERE user_id = auth.uid() AND clinic_id = prescription_items.clinic_id)
  );

CREATE POLICY "prescription_items_patient_read_own" ON public.prescription_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.prescriptions p
      JOIN public.patients pat ON pat.id = p.patient_id
      WHERE p.id = prescription_items.prescription_id AND pat.user_id = auth.uid()
    )
  );
