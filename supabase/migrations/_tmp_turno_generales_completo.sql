-- Item 6: Turnos generales con reconciliación completa
-- 1. fondos_movimientos: agrega turno_id para turnos no-farmacia
-- 2. turno_fondo_movimiento RPC (egreso/ingreso durante turno general)
-- 3. turno_close: incluye fondos_movimientos.turno_id en cálculo
-- 4. turno_corte_x RPC (snapshot sin cerrar)

-- 1. Columna turno_id en fondos_movimientos (nullable, FK a turnos)
ALTER TABLE public.fondos_movimientos
  ADD COLUMN IF NOT EXISTS turno_id uuid REFERENCES public.turnos(id);

-- Índice
CREATE INDEX IF NOT EXISTS idx_fondos_movimientos_turno ON public.fondos_movimientos(turno_id);

-- 2. RPC: turno_fondo_movimiento
CREATE OR REPLACE FUNCTION public.turno_fondo_movimiento(
  p_turno_id uuid,
  p_tipo text,
  p_monto numeric,
  p_motivo text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user uuid := auth.uid();
  v_turno record;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_tipo NOT IN ('egreso','ingreso') THEN RAISE EXCEPTION 'tipo debe ser egreso o ingreso'; END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN RAISE EXCEPTION 'Monto debe ser mayor a cero'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN RAISE EXCEPTION 'Motivo requerido'; END IF;

  SELECT * INTO v_turno FROM public.turnos WHERE id = p_turno_id;
  IF v_turno IS NULL THEN RAISE EXCEPTION 'Turno no encontrado'; END IF;
  IF v_turno.estado <> 'abierto' THEN RAISE EXCEPTION 'El turno no está abierto'; END IF;

  IF NOT (
    v_turno.cajero_user_id = v_user
    OR has_role(v_user,'admin') OR has_role(v_user,'manager')
  ) THEN
    RAISE EXCEPTION 'Sin permiso para registrar movimiento de fondo';
  END IF;

  INSERT INTO public.fondos_movimientos
    (clinic_id, turno_id, pharmacy_shift_id, tipo, monto, motivo, registrado_by)
  VALUES
    (v_turno.clinic_id, p_turno_id, NULL, p_tipo, p_monto, p_motivo, v_user)
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'crear', 'fondos_movimientos', v_id,
          jsonb_build_object(
            'event','turno_fondo_movimiento','tipo',p_tipo,'monto',p_monto,'motivo',p_motivo
          ), v_turno.clinic_id);

  RETURN v_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.turno_fondo_movimiento(uuid, text, numeric, text) TO authenticated;

-- 3. Actualizar turno_close para incluir fondos de fondos_movimientos.turno_id
CREATE OR REPLACE FUNCTION public.turno_close(
  p_turno_id uuid,
  p_cash_count numeric,
  p_notes text DEFAULT NULL,
  p_supervisor_override boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user uuid := auth.uid();
  v_turno record;
  v_cash_cobros numeric(12,2) := 0;
  v_fondos_net numeric(12,2) := 0;
  v_expected numeric(12,2);
  v_diff numeric(12,2);
  v_umbral numeric(10,2);
  v_settings jsonb;
  v_corte_id uuid;
  v_folio bigint;
  v_ticket_count integer := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT t.* INTO v_turno FROM public.turnos t WHERE t.id = p_turno_id FOR UPDATE;

  IF v_turno IS NULL THEN RAISE EXCEPTION 'Turno no encontrado'; END IF;
  IF v_turno.estado <> 'abierto' THEN RAISE EXCEPTION 'El turno no está abierto'; END IF;

  IF NOT (
    v_turno.cajero_user_id = v_user
    OR has_role(v_user, 'admin') OR has_role(v_user, 'manager')
  ) THEN
    RAISE EXCEPTION 'Sin permiso para cerrar este turno';
  END IF;

  IF p_cash_count IS NULL OR p_cash_count < 0 THEN
    RAISE EXCEPTION 'Efectivo contado inválido';
  END IF;

  -- Cobros en efectivo via movimiento_pagos (SAT code '01' = Efectivo)
  SELECT COALESCE(SUM(mp.monto), 0)
    INTO v_cash_cobros
  FROM public.movimiento_pagos mp
  JOIN public.movimientos m ON m.id = mp.movimiento_id
  JOIN public.metodos_pago met ON met.id = mp.metodo_pago_id
  WHERE m.turno_id = p_turno_id
    AND m.estado = 'pagado'
    AND m.tipo = 'cobro'
    AND met.codigo_sat = '01';

  -- Neto de fondos: fondos_movimientos vinculados al turno
  SELECT COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN -monto ELSE monto END), 0)
    INTO v_fondos_net
  FROM public.fondos_movimientos
  WHERE turno_id = p_turno_id;

  -- Tickets cobrados
  SELECT COUNT(*)::integer INTO v_ticket_count
  FROM public.movimientos
  WHERE turno_id = p_turno_id AND tipo = 'cobro' AND estado = 'pagado';

  v_expected := v_turno.monto_apertura + v_cash_cobros + v_fondos_net;
  v_diff := p_cash_count - v_expected;

  -- Umbral configurable desde clinic_settings section='caja'
  SELECT data INTO v_settings
    FROM public.clinic_settings
   WHERE clinic_id = v_turno.clinic_id AND section = 'caja';
  v_umbral := (v_settings->>'umbral_diferencia')::numeric;

  IF v_umbral IS NOT NULL AND abs(v_diff) > v_umbral THEN
    IF NOT p_supervisor_override THEN
      RAISE EXCEPTION 'DIFF_EXCEEDS_THRESHOLD|%|%', v_diff, v_umbral;
    END IF;
    IF NOT (has_role(v_user, 'admin') OR has_role(v_user, 'manager')) THEN
      RAISE EXCEPTION 'Solo admin o gerente puede autorizar diferencias que excedan el umbral configurado';
    END IF;
  END IF;

  v_folio := nextval('public.cortes_folio_seq');

  UPDATE public.turnos
     SET estado = 'cerrado',
         cerrado_at = now(),
         monto_cierre = p_cash_count,
         notas_cierre = p_notes
   WHERE id = p_turno_id;

  INSERT INTO public.cortes (
    clinic_id, turno_id, tipo,
    folio_secuencial, efectivo_esperado, conteo_ciego, diferencia,
    requiere_autorizacion, autorizado_by, autorizado_at,
    total_efectivo, total_general, conteo_movimientos,
    generado_by, datos_json
  ) VALUES (
    v_turno.clinic_id, p_turno_id, 'Z',
    v_folio, v_expected, p_cash_count, v_diff,
    (v_umbral IS NOT NULL AND abs(v_diff) > v_umbral AND p_supervisor_override),
    CASE WHEN (v_umbral IS NOT NULL AND abs(v_diff) > v_umbral AND p_supervisor_override) THEN v_user ELSE NULL END,
    CASE WHEN (v_umbral IS NOT NULL AND abs(v_diff) > v_umbral AND p_supervisor_override) THEN now() ELSE NULL END,
    v_cash_cobros, v_expected, v_ticket_count,
    v_user,
    jsonb_build_object(
      'opening_amount', v_turno.monto_apertura,
      'cash_cobros', v_cash_cobros,
      'fondos_net', v_fondos_net,
      'expected', v_expected,
      'counted', p_cash_count,
      'difference', v_diff,
      'supervisor_override', p_supervisor_override
    )
  ) RETURNING id INTO v_corte_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'actualizar', 'turnos', p_turno_id,
          jsonb_build_object(
            'event','turno_cerrado','folio_corte',v_folio,
            'opening_amount',v_turno.monto_apertura,'expected_cash',v_expected,
            'counted_cash',p_cash_count,'difference',v_diff
          ), v_turno.clinic_id);

  RETURN jsonb_build_object(
    'turno_id', p_turno_id,
    'corte_id', v_corte_id,
    'folio', v_folio,
    'opening_amount', v_turno.monto_apertura,
    'cash_total', v_cash_cobros,
    'fondos_net', v_fondos_net,
    'expected_cash', v_expected,
    'counted_cash', p_cash_count,
    'difference', v_diff,
    'supervisor_override', p_supervisor_override
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.turno_close(uuid, numeric, text, boolean) TO authenticated;

-- 4. turno_corte_x: snapshot sin cerrar
CREATE OR REPLACE FUNCTION public.turno_corte_x(
  p_turno_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user uuid := auth.uid();
  v_turno record;
  v_cash_cobros numeric(12,2) := 0;
  v_fondos_net numeric(12,2) := 0;
  v_expected numeric(12,2);
  v_ticket_count integer := 0;
  v_corte_id uuid;
  v_folio bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_turno FROM public.turnos WHERE id = p_turno_id;
  IF v_turno IS NULL THEN RAISE EXCEPTION 'Turno no encontrado'; END IF;
  IF v_turno.estado <> 'abierto' THEN RAISE EXCEPTION 'El turno no está abierto'; END IF;

  IF NOT (
    v_turno.cajero_user_id = v_user
    OR has_role(v_user,'admin') OR has_role(v_user,'manager')
  ) THEN
    RAISE EXCEPTION 'Sin permiso para generar Corte X';
  END IF;

  SELECT COALESCE(SUM(mp.monto), 0)
    INTO v_cash_cobros
  FROM public.movimiento_pagos mp
  JOIN public.movimientos m ON m.id = mp.movimiento_id
  JOIN public.metodos_pago met ON met.id = mp.metodo_pago_id
  WHERE m.turno_id = p_turno_id
    AND m.estado = 'pagado'
    AND m.tipo = 'cobro'
    AND met.codigo_sat = '01';

  SELECT COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN -monto ELSE monto END), 0)
    INTO v_fondos_net
  FROM public.fondos_movimientos
  WHERE turno_id = p_turno_id;

  SELECT COUNT(*)::integer INTO v_ticket_count
  FROM public.movimientos
  WHERE turno_id = p_turno_id AND tipo = 'cobro' AND estado = 'pagado';

  v_expected := v_turno.monto_apertura + v_cash_cobros + v_fondos_net;
  v_folio := nextval('public.cortes_folio_seq');

  INSERT INTO public.cortes (
    clinic_id, turno_id, tipo, folio_secuencial,
    total_efectivo, total_general, conteo_movimientos,
    efectivo_esperado, generado_by, datos_json
  ) VALUES (
    v_turno.clinic_id, p_turno_id, 'X', v_folio,
    v_cash_cobros, v_expected, v_ticket_count,
    v_expected, v_user,
    jsonb_build_object(
      'opening_amount', v_turno.monto_apertura,
      'cash_cobros', v_cash_cobros,
      'fondos_net', v_fondos_net,
      'expected', v_expected,
      'tickets', v_ticket_count
    )
  ) RETURNING id INTO v_corte_id;

  RETURN jsonb_build_object(
    'corte_id', v_corte_id,
    'folio', v_folio,
    'tipo', 'X',
    'opening_amount', v_turno.monto_apertura,
    'cash_cobros', v_cash_cobros,
    'fondos_net', v_fondos_net,
    'expected_cash', v_expected,
    'tickets', v_ticket_count
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.turno_corte_x(uuid) TO authenticated;
