
DO $$
DECLARE
  v_default uuid;
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
  SELECT id INTO v_default FROM public.clinics WHERE code = 'salud_integral_mx';
  IF v_default IS NULL THEN
    RAISE EXCEPTION 'Default clinic salud_integral_mx not found';
  END IF;

  FOREACH v_table IN ARRAY v_tables LOOP
    -- add column
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id)',
      v_table
    );
    -- backfill
    EXECUTE format(
      'UPDATE public.%I SET clinic_id = %L WHERE clinic_id IS NULL',
      v_table, v_default
    );
    -- index
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(clinic_id)',
      'idx_' || v_table || '_clinic_id', v_table
    );
  END LOOP;
END $$;

-- NOT NULL en tablas donde es seguro (todas las backfilleadas)
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
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN clinic_id SET NOT NULL', v_table);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'No se pudo poner NOT NULL en %: %', v_table, SQLERRM;
    END;
  END LOOP;
END $$;

-- audit_logs queda nullable (eventos sistémicos/login pueden no tener clinic_id)

-- Índices compuestos
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_fecha ON public.appointments(clinic_id, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_doctor ON public.appointments(clinic_id, doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_apellidos ON public.patients(clinic_id, apellidos);
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic_patient ON public.prescriptions(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic_doctor ON public.prescriptions(clinic_id, doctor_id);
CREATE INDEX IF NOT EXISTS idx_journey_instances_clinic_patient ON public.journey_instances(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_clinic_identidad ON public.conversaciones(clinic_id, identidad_canal_id);
CREATE INDEX IF NOT EXISTS idx_recordatorios_clinic_prog_status ON public.recordatorios_cita(clinic_id, programado_para, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic ON public.audit_logs(clinic_id);
