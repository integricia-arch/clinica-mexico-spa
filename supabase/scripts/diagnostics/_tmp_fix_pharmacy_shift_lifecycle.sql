-- Fix: pharmacy shift lifecycle completo
-- Problema: pharmacy_open_shift rechazaba abrir si ya había shift abierto →
--   cajero veía toast warning y pharmacy_shift_id quedaba NULL en turnos
-- Causa raíz: turno_close no cerraba pharmacy_cash_shifts → shift quedaba estancado
--
-- Cambios:
-- 1. Shift estancado d484c4aa cerrado manualmente
-- 2. pharmacy_open_shift: idempotente — retorna shift existente si ya hay uno abierto
--    (también agrega rol cajero que faltaba en el check de permisos)
-- 3. turno_close: cierra pharmacy_cash_shift al cerrar turno

-- 1. Shift estancado (one-time fix)
UPDATE public.pharmacy_cash_shifts
SET status = 'closed', closed_at = now()
WHERE id = 'd484c4aa-ec56-41d2-8ae9-5b195f3b4269'
  AND status = 'open';

-- 2. pharmacy_open_shift idempotente
CREATE OR REPLACE FUNCTION public.pharmacy_open_shift(
  p_clinic_id uuid,
  p_opening_amount numeric,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_shift_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF NOT (has_role(v_user,'admin') OR has_role(v_user,'manager') OR has_role(v_user,'nurse')
          OR has_role(v_user,'receptionist') OR has_role(v_user,'cajero')) THEN
    RAISE EXCEPTION 'Sin permiso para abrir turno';
  END IF;
  IF p_opening_amount IS NULL OR p_opening_amount < 0 THEN
    RAISE EXCEPTION 'Monto inicial invalido';
  END IF;

  SELECT id INTO v_shift_id
  FROM public.pharmacy_cash_shifts
  WHERE cashier_user_id = v_user AND clinic_id = p_clinic_id AND status = 'open'
  LIMIT 1;

  IF v_shift_id IS NOT NULL THEN
    RETURN v_shift_id;
  END IF;

  INSERT INTO public.pharmacy_cash_shifts
    (clinic_id, cashier_user_id, opened_by, opening_amount, notes)
  VALUES (p_clinic_id, v_user, v_user, p_opening_amount, p_notes)
  RETURNING id INTO v_shift_id;

  RETURN v_shift_id;
END;
$function$;

-- 3. turno_close con cierre de pharmacy shift (ver _tmp_fix_turno_close_fallback.sql para contexto)
CREATE OR REPLACE FUNCTION public.turno_close(
  p_turno_id uuid,
  p_cash_count numeric,
  p_notes text DEFAULT NULL,
  p_supervisor_override boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_turno record;
  v_cash_cobros numeric(12,2) := 0;
  v_cash_pharmacy numeric(12,2) := 0;
  v_fondos_net numeric(12,2) := 0;
  v_expected numeric(12,2);
  v_diff numeric(12,2);
  v_umbral numeric(10,2);
  v_settings jsonb;
  v_corte_id uuid;
  v_folio bigint;
  v_ticket_count integer := 0;
  v_eff_shift uuid;
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

  SELECT COALESCE(SUM(mp.monto), 0)
    INTO v_cash_cobros
  FROM public.movimiento_pagos mp
  JOIN public.movimientos m ON m.id = mp.movimiento_id
  JOIN public.metodos_pago met ON met.id = mp.metodo_pago_id
  WHERE m.turno_id = p_turno_id
    AND m.estado = 'pagado'
    AND m.tipo = 'cobro'
    AND met.codigo_sat = '01';

  IF v_turno.pharmacy_shift_id IS NOT NULL THEN
    v_eff_shift := v_turno.pharmacy_shift_id;
  ELSE
    SELECT id INTO v_eff_shift
    FROM public.pharmacy_cash_shifts
    WHERE cashier_user_id = v_turno.cajero_user_id
      AND clinic_id = v_turno.clinic_id
    ORDER BY opened_at DESC
    LIMIT 1;
  END IF;

  IF v_eff_shift IS NOT NULL THEN
    SELECT COALESCE(SUM(psp.amount), 0)
      INTO v_cash_pharmacy
    FROM public.pharmacy_sale_payments psp
    JOIN public.pharmacy_sales ps ON ps.id = psp.sale_id
    WHERE ps.shift_id = v_eff_shift
      AND psp.payment_method = 'efectivo'
      AND ps.status = 'completed'
      AND ps.created_at BETWEEN v_turno.abierto_at AND now();

    v_cash_cobros := v_cash_cobros + v_cash_pharmacy;

    SELECT COUNT(*)::integer INTO v_ticket_count
    FROM public.pharmacy_sales
    WHERE shift_id = v_eff_shift AND status = 'completed'
      AND created_at BETWEEN v_turno.abierto_at AND now();
  ELSE
    SELECT COUNT(*)::integer INTO v_ticket_count
    FROM public.movimientos
    WHERE turno_id = p_turno_id AND tipo = 'cobro' AND estado = 'pagado';
  END IF;

  SELECT COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN -monto ELSE monto END), 0)
    INTO v_fondos_net
  FROM public.fondos_movimientos
  WHERE turno_id = p_turno_id;

  v_expected := v_turno.monto_apertura + v_cash_cobros + v_fondos_net;
  v_diff := p_cash_count - v_expected;

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

  -- Cerrar pharmacy shift vinculado
  IF v_eff_shift IS NOT NULL THEN
    UPDATE public.pharmacy_cash_shifts
       SET status = 'closed', closed_at = now()
     WHERE id = v_eff_shift AND status = 'open';
  END IF;

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
      'cash_cobros_general', (v_cash_cobros - v_cash_pharmacy),
      'cash_cobros_farmacia', v_cash_pharmacy,
      'cash_cobros_total', v_cash_cobros,
      'fondos_net', v_fondos_net,
      'expected', v_expected,
      'counted', p_cash_count,
      'difference', v_diff,
      'supervisor_override', p_supervisor_override,
      'is_pharmacy_turno', (v_eff_shift IS NOT NULL),
      'pharmacy_shift_fallback', (v_turno.pharmacy_shift_id IS NULL AND v_eff_shift IS NOT NULL)
    )
  ) RETURNING id INTO v_corte_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'actualizar', 'turnos', p_turno_id,
          jsonb_build_object(
            'event','turno_cerrado','folio_corte',v_folio,
            'opening_amount',v_turno.monto_apertura,'expected_cash',v_expected,
            'counted_cash',p_cash_count,'difference',v_diff,
            'pharmacy_shift_id', v_turno.pharmacy_shift_id,
            'eff_shift_id', v_eff_shift
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
$function$;
