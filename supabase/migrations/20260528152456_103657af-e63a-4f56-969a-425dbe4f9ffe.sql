CREATE OR REPLACE FUNCTION public.multiclinic_diagnostics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_default_clinic uuid;
  v_tables jsonb := '[]'::jsonb;
  v_rec record;
  v_count_total bigint;
  v_count_null bigint;
  v_count_non_default bigint;
  v_crosses jsonb := '{}'::jsonb;
  v_rls jsonb := '[]'::jsonb;
  v_memberships jsonb;
BEGIN
  -- Solo admin global
  IF NOT public.is_global_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo administradores globales pueden ejecutar este diagnóstico';
  END IF;

  SELECT id INTO v_default_clinic FROM public.clinics WHERE code = 'salud_integral_mx';

  -- Tablas con clinic_id
  FOR v_rec IN
    SELECT c.table_name
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.column_name = 'clinic_id'
     ORDER BY c.table_name
  LOOP
    EXECUTE format(
      'SELECT count(*), count(*) FILTER (WHERE clinic_id IS NULL), count(*) FILTER (WHERE clinic_id IS NOT NULL AND clinic_id <> %L) FROM public.%I',
      v_default_clinic, v_rec.table_name
    ) INTO v_count_total, v_count_null, v_count_non_default;

    v_tables := v_tables || jsonb_build_object(
      'table', v_rec.table_name,
      'total', v_count_total,
      'null_clinic_id', v_count_null,
      'non_default_clinic_id', v_count_non_default
    );
  END LOOP;

  -- Cruces de clínica
  SELECT jsonb_build_object(
    'appointments_vs_patients', (SELECT count(*) FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE a.clinic_id<>p.clinic_id),
    'appointments_vs_doctors',  (SELECT count(*) FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE a.clinic_id<>d.clinic_id),
    'appointments_vs_rooms',    (SELECT count(*) FROM appointments a JOIN rooms r ON r.id=a.room_id WHERE a.clinic_id<>r.clinic_id),
    'appointments_vs_servicios',(SELECT count(*) FROM appointments a JOIN servicios s ON s.id=a.servicio_id WHERE a.clinic_id<>s.clinic_id),
    'prescriptions_vs_patients',(SELECT count(*) FROM prescriptions r JOIN patients p ON p.id=r.patient_id WHERE r.clinic_id<>p.clinic_id),
    'prescriptions_vs_doctors', (SELECT count(*) FROM prescriptions r JOIN doctors d ON d.id=r.doctor_id WHERE r.clinic_id<>d.clinic_id),
    'prescriptions_vs_appointments', (SELECT count(*) FROM prescriptions r JOIN appointments a ON a.id=r.appointment_id WHERE r.clinic_id<>a.clinic_id),
    'expedientes_vs_patients',  (SELECT count(*) FROM expedientes e JOIN patients p ON p.id=e.patient_id WHERE e.clinic_id<>p.clinic_id),
    'journey_instances_vs_patients', (SELECT count(*) FROM journey_instances j JOIN patients p ON p.id=j.patient_id WHERE j.clinic_id<>p.clinic_id),
    'journey_instances_vs_appointments', (SELECT count(*) FROM journey_instances j JOIN appointments a ON a.id=j.appointment_id WHERE j.clinic_id<>a.clinic_id),
    'recordatorios_vs_appointments', (SELECT count(*) FROM recordatorios_cita rc JOIN appointments a ON a.id=rc.appointment_id WHERE rc.clinic_id<>a.clinic_id),
    'mensajes_vs_conversaciones', (SELECT count(*) FROM mensajes m JOIN conversaciones c ON c.id=m.conversacion_id WHERE m.clinic_id<>c.clinic_id)
  ) INTO v_crosses;

  -- RLS: tablas public sin RLS
  FOR v_rec IN
    SELECT t.tablename
      FROM pg_tables t
     WHERE t.schemaname = 'public'
       AND t.rowsecurity = false
     ORDER BY t.tablename
  LOOP
    v_rls := v_rls || to_jsonb(v_rec.tablename);
  END LOOP;

  -- Memberships por rol
  SELECT jsonb_object_agg(role, c) INTO v_memberships
    FROM (SELECT role::text AS role, count(*) AS c FROM clinic_memberships GROUP BY role) s;

  v_result := jsonb_build_object(
    'generated_at', now(),
    'default_clinic_id', v_default_clinic,
    'tables', v_tables,
    'cross_checks', v_crosses,
    'tables_without_rls', v_rls,
    'memberships_by_role', COALESCE(v_memberships, '{}'::jsonb),
    'helpers_present', jsonb_build_object(
      'is_global_admin', EXISTS(SELECT 1 FROM pg_proc WHERE proname='is_global_admin'),
      'user_has_clinic_access', EXISTS(SELECT 1 FROM pg_proc WHERE proname='user_has_clinic_access'),
      'user_has_clinic_role', EXISTS(SELECT 1 FROM pg_proc WHERE proname='user_has_clinic_role'),
      'current_user_clinic_ids', EXISTS(SELECT 1 FROM pg_proc WHERE proname='current_user_clinic_ids')
    )
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.multiclinic_diagnostics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.multiclinic_diagnostics() TO authenticated;