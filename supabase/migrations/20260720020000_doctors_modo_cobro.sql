-- Modelo de cobro por doctor, pedido por Pablo:
-- 'clinica' (default, comportamiento actual): el paciente paga a la clínica
--   (caja), la clínica genera el ingreso/póliza y después paga honorarios al
--   doctor por % o fijo (doctor_honorarios_config) -- la clínica se queda con
--   el margen de insumos.
-- 'directo': el paciente paga honorarios + insumos directo al doctor, fuera
--   de caja de la clínica -- no se genera ingreso ni honorario en el sistema
--   contable. La clínica SÍ sigue registrando el costo de insumos consumidos
--   (trigger trg_contab_consumo_insumo, ya existente e independiente del
--   cobro) para efectos de inventario/reposición.

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS modo_cobro text NOT NULL DEFAULT 'clinica'
  CHECK (modo_cobro IN ('clinica', 'directo'));

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
  v_doctor_id uuid;
  v_modo_cobro text;
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

  IF v_appointment_id IS NOT NULL THEN
    SELECT a.doctor_id INTO v_doctor_id FROM appointments a WHERE a.id = v_appointment_id;
  END IF;
  IF v_doctor_id IS NOT NULL THEN
    SELECT d.modo_cobro INTO v_modo_cobro FROM doctors d WHERE d.id = v_doctor_id;
  END IF;

  -- Cobro directo al doctor: no toca caja/pólizas de la clínica. Los insumos
  -- ya se registraron aparte (trigger independiente al consumirlos).
  IF v_modo_cobro = 'directo' THEN
    RETURN NULL;
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
