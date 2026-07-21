-- Mismo bug que tenía crear_poliza() antes de 20260721180000: exige auth.uid()
-- real, sin bypass para llamadas cron/service_role. Si algún cron o Edge Function
-- necesita cerrar/recalcular un journey sin sesión de usuario, fallaba con
-- "No autorizado para esta clínica". Fix: solo exige membership/admin cuando
-- SÍ hay un auth.uid() real (llamada de cliente autenticado); service_role
-- (auth.uid() IS NULL) pasa directo, igual que crear_poliza().
CREATE OR REPLACE FUNCTION public.update_journey_progress(_journey_instance_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total     integer;
  v_completed integer;
  v_percent   integer;
  v_current   text;
  v_clinic_id uuid;
BEGIN
  SELECT p.clinic_id INTO v_clinic_id
    FROM journey_instances ji
    JOIN patients p ON p.id = ji.patient_id
   WHERE ji.id = _journey_instance_id;

  IF v_clinic_id IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND clinic_id = v_clinic_id AND status = 'active'
    ) OR public.is_global_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'No autorizado para esta clínica';
  END IF;

  SELECT COUNT(*) INTO v_total
    FROM journey_instance_steps
   WHERE journey_instance_id = _journey_instance_id;

  SELECT COUNT(*) INTO v_completed
    FROM journey_instance_steps
   WHERE journey_instance_id = _journey_instance_id
     AND status IN ('completed','skipped','override_authorized');

  v_percent := CASE WHEN v_total = 0 THEN 0
                    ELSE ROUND((v_completed::numeric / v_total) * 100)
               END;

  SELECT step_key INTO v_current
    FROM journey_instance_steps
   WHERE journey_instance_id = _journey_instance_id
     AND status NOT IN ('completed','skipped','override_authorized')
   ORDER BY step_order
   LIMIT 1;

  UPDATE journey_instances
     SET snapshot_json = jsonb_build_object(
           'total_steps',      v_total,
           'completed_steps',  v_completed,
           'progress_percent', v_percent,
           'current_step_key', v_current
         ),
         updated_at = now(),
         status = CASE WHEN v_completed = v_total AND v_total > 0 THEN 'completado'
                       ELSE status
                  END
   WHERE id = _journey_instance_id;
END;
$function$;
