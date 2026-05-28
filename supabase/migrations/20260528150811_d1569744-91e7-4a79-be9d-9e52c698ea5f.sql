
DO $$
DECLARE
  v_default uuid := '106cc686-a333-4ec1-83ea-84eaafbf2e90'::uuid;
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
    'audit_logs','post_consultation_followups','patient_checkout_events','bot_sesiones'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN clinic_id SET DEFAULT %L::uuid',
      v_table, v_default
    );
  END LOOP;
END $$;
