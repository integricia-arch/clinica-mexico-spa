-- Cash drop con doble firma para turnos de farmacia (twin de 20260716150200_cash_drop.sql,
-- que ya cubrió turnos generales vía turno_fondo_movimiento).
--
-- fondos_movimientos ya tiene columna destino + constraint tipo IN ('egreso','ingreso','cash_drop')
-- (agregadas en 20260716150200_cash_drop.sql) y la policy "Caja staff registra fondos" ya
-- bloquea inserts directos de cash_drop (AND tipo <> 'cash_drop') para la misma tabla —
-- aplica igual a filas con pharmacy_shift_id, no requiere tocar RLS de nuevo aquí.

-- La firma vieja (4 args, sin destino/supervisor) es una identidad de función distinta en
-- Postgres — CREATE OR REPLACE no la reemplaza, hay que tumbarla explícitamente.
DROP FUNCTION IF EXISTS public.pharmacy_fondo_movimiento(uuid, text, numeric, text);

CREATE OR REPLACE FUNCTION public.pharmacy_fondo_movimiento(
  p_shift_id uuid,
  p_tipo text,
  p_monto numeric,
  p_motivo text,
  p_destino text DEFAULT NULL,
  p_supervisor_id uuid DEFAULT NULL,
  p_supervisor_pin text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_user uuid := auth.uid();
  v_shift public.pharmacy_cash_shifts;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_tipo NOT IN ('egreso','ingreso','cash_drop') THEN
    RAISE EXCEPTION 'tipo debe ser egreso, ingreso o cash_drop';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN RAISE EXCEPTION 'Monto debe ser mayor a cero'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN RAISE EXCEPTION 'Motivo requerido'; END IF;

  SELECT * INTO v_shift FROM public.pharmacy_cash_shifts WHERE id = p_shift_id;
  IF v_shift IS NULL THEN RAISE EXCEPTION 'Turno no encontrado'; END IF;
  IF v_shift.status <> 'open' THEN RAISE EXCEPTION 'El turno no está abierto'; END IF;

  IF NOT (
    v_shift.cashier_user_id = v_user
    OR has_role(v_user,'admin') OR has_role(v_user,'manager')
  ) THEN
    RAISE EXCEPTION 'Sin permiso para registrar movimiento de fondo';
  END IF;

  IF p_tipo = 'cash_drop' THEN
    IF p_destino IS NULL OR length(trim(p_destino)) = 0 THEN
      RAISE EXCEPTION 'Cash drop requiere destino (ej. caja fuerte, banco)';
    END IF;
    IF p_supervisor_id IS NULL OR p_supervisor_pin IS NULL THEN
      RAISE EXCEPTION 'Cash drop requiere doble firma: supervisor_id y supervisor_pin';
    END IF;
    PERFORM public.verify_supervisor_pin(v_shift.clinic_id, p_supervisor_id, p_supervisor_pin);
  END IF;

  INSERT INTO public.fondos_movimientos
    (clinic_id, pharmacy_shift_id, tipo, monto, motivo, destino, registrado_by)
  VALUES
    (v_shift.clinic_id, p_shift_id, p_tipo, p_monto, p_motivo, p_destino, v_user)
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'crear', 'fondos_movimientos', v_id,
          jsonb_build_object(
            'event', 'fondo_movimiento', 'tipo', p_tipo, 'monto', p_monto,
            'motivo', p_motivo, 'destino', p_destino, 'supervisor_id', p_supervisor_id
          ), v_shift.clinic_id);

  RETURN v_id;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.pharmacy_fondo_movimiento(uuid, text, numeric, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_fondo_movimiento(uuid, text, numeric, text, text, uuid, text) TO authenticated;
