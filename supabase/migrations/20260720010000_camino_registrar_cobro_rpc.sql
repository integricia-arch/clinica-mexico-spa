-- El paso "Cobro" de Camino del Paciente (BillingForm.tsx) solo guardaba el
-- monto como nota de texto libre en journey_instance_step_data -- nunca
-- tocaba `movimientos`, la tabla cuyo trigger (contab_movimiento_caja)
-- genera el movimiento contable + la póliza automática. Resultado: "Confirmar
-- cobro" parecía funcionar (toast de éxito) pero no dejaba ningún rastro
-- financiero. Insert directo del cliente no es viable: la policy de
-- `movimientos` solo permite admin/manager/cajero/receptionist, pero el paso
-- de cobro en Camino del Paciente puede cerrarlo cualquier staff con acceso
-- a la cita (doctor, enfermera). RPC SECURITY DEFINER dedicado, valida acceso
-- por clínica del paciente igual que journey_instances.

CREATE OR REPLACE FUNCTION public.camino_registrar_cobro(
  p_journey_instance_id uuid,
  p_monto numeric,
  p_metodo_pago text DEFAULT NULL,
  p_folio text DEFAULT NULL,
  p_notas text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_appointment_id uuid;
  v_patient_id uuid;
  v_clinic_id uuid;
  v_movimiento_id uuid;
BEGIN
  SELECT ji.appointment_id, ji.patient_id
    INTO v_appointment_id, v_patient_id
  FROM journey_instances ji
  WHERE ji.id = p_journey_instance_id;

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Camino del paciente no encontrado';
  END IF;

  IF NOT public.user_can_access_patient_clinic(v_patient_id) THEN
    RAISE EXCEPTION 'Sin permiso para registrar cobro de este paciente';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  SELECT clinic_id INTO v_clinic_id FROM patients WHERE id = v_patient_id;

  INSERT INTO movimientos (
    clinic_id, tipo, estado, patient_id, appointment_id,
    subtotal, descuento, total, notas, cajero_user_id
  ) VALUES (
    v_clinic_id, 'cobro', 'pagado', v_patient_id, v_appointment_id,
    p_monto, 0, p_monto,
    trim(both from coalesce(p_metodo_pago, '') || CASE WHEN p_folio IS NOT NULL AND p_folio <> '' THEN ' · folio ' || p_folio ELSE '' END || CASE WHEN p_notas IS NOT NULL AND p_notas <> '' THEN ' · ' || p_notas ELSE '' END),
    auth.uid()
  )
  RETURNING id INTO v_movimiento_id;

  RETURN v_movimiento_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.camino_registrar_cobro(uuid, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.camino_registrar_cobro(uuid, numeric, text, text, text) TO authenticated;
