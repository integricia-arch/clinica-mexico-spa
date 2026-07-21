-- Fix: el botón "Ver cobro" en Citas.tsx pasaba reference_type='consulta' con
-- reference_id=appointment_id, pero el trigger real (contab_movimiento_caja)
-- guarda reference_type='movimiento_caja' con reference_id = movimientos.id (la
-- fila de caja), no el id de la cita. Esta función puentea: dado un appointment_id,
-- encuentra el movimiento de caja más reciente ligado a esa cita y de ahí resuelve
-- el asiento contable real, reusando contab_resolver_asiento.
CREATE OR REPLACE FUNCTION public.contab_resolver_cobro_cita(p_appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_clinic_id uuid;
  v_movimiento_id uuid;
BEGIN
  SELECT clinic_id INTO v_clinic_id FROM public.appointments WHERE id = p_appointment_id;
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'cita_no_encontrada';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO v_movimiento_id FROM public.movimientos
  WHERE appointment_id = p_appointment_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_movimiento_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN public.contab_resolver_asiento('movimiento_caja', v_movimiento_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_resolver_cobro_cita(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contab_resolver_cobro_cita(uuid) TO authenticated;
