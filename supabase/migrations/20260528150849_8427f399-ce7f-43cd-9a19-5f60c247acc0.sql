
DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'patients','doctors','rooms','servicios','appointments','appointment_resources',
    'expedientes','notas_consulta','consentimientos','patient_studies',
    'journey_templates','journey_template_versions','journey_instances',
    'journey_instance_steps','journey_instance_step_data','journey_instance_documents',
    'journey_instance_overrides','journey_instance_audit',
    'prescriptions','prescription_items','doctor_prescription_templates','doctor_prescription_template_versions',
    'medicamentos','lotes_medicamento','movimientos_inventario',
    'conversaciones','mensajes','identidades_canal','recordatorios_cita',
    'post_consultation_followups','patient_checkout_events','bot_sesiones'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "multiclinic_access_restrictive" ON public.%I', v_table);
    EXECUTE format(
      'CREATE POLICY "multiclinic_access_restrictive" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.user_has_clinic_access(auth.uid(), clinic_id)) WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id))',
      v_table
    );
  END LOOP;
END $$;

-- audit_logs: misma protección pero permitiendo nulls (eventos sistémicos)
DROP POLICY IF EXISTS "multiclinic_access_restrictive" ON public.audit_logs;
CREATE POLICY "multiclinic_access_restrictive" ON public.audit_logs
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (clinic_id IS NULL OR public.user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (clinic_id IS NULL OR public.user_has_clinic_access(auth.uid(), clinic_id));
