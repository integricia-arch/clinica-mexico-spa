-- Fix: autorizado_by recorded cajero instead of supervisor
-- Add p_supervisor_id parameter to turno_close, pharmacy_close_shift, turno_close_with_pin.

-- 1. Drop old 4-param signatures to avoid ambiguity
DROP FUNCTION IF EXISTS public.turno_close(uuid, numeric, text, boolean);
DROP FUNCTION IF EXISTS public.pharmacy_close_shift(uuid, numeric, text, boolean);
DROP FUNCTION IF EXISTS public.turno_close_with_pin(uuid, uuid, text, numeric, text);

-- ─────────────────────────────────────────────────────────────
-- 2. turno_close (with pharmacy fallback + p_supervisor_id)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.turno_close(
  p_turno_id          uuid,
  p_cash_count        numeric,
  p_notes             text    DEFAULT NULL,
  p_supervisor_override boolean DEFAULT false,
  p_supervisor_id     uuid    DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user           uuid := auth.uid();
  v_turno          record;
  v_cash_cobros    numeric(12,2) := 0;
  v_cash_pharmacy  numeric(12,2) := 0;
  v_fondos_net     numeric(12,2) := 0;
  v_expected       numeric(12,2);
  v_diff           numeric(12,2);
  v_umbral         numeric(10,2);
  v_settings       jsonb;
  v_corte_id       uuid;
  v_folio          bigint;
  v_ticket_count   integer := 0;
  v_eff_shift      uuid;
  v_auth_by        uuid;
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

  -- Cobros en efectivo (SAT code '01')
  SELECT COALESCE(SUM(mp.monto), 0)
    INTO v_cash_cobros
  FROM public.movimiento_pagos mp
  JOIN public.movimientos m ON m.id = mp.movimiento_id
  JOIN public.metodos_pago met ON met.id = mp.metodo_pago_id
  WHERE m.turno_id = p_turno_id
    AND m.estado = 'pagado'
    AND m.tipo = 'cobro'
    AND met.codigo_sat = '01';

  -- Pharmacy shift efectivo
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
    -- Validate that whoever is authorizing has the right role
    IF NOT (
      has_role(COALESCE(p_supervisor_id, v_user), 'admin')
      OR has_role(COALESCE(p_supervisor_id, v_user), 'manager')
    ) THEN
      RAISE EXCEPTION 'Solo admin o gerente puede autorizar diferencias que excedan el umbral configurado';
    END IF;
  END IF;

  -- Supervisor who authorized the override (not the cajero who called the RPC)
  v_auth_by := CASE
    WHEN (v_umbral IS NOT NULL AND abs(v_diff) > v_umbral AND p_supervisor_override)
    THEN COALESCE(p_supervisor_id, v_user)
    ELSE NULL
  END;

  v_folio := nextval('public.cortes_folio_seq');

  UPDATE public.turnos
     SET estado = 'cerrado',
         cerrado_at = now(),
         monto_cierre = p_cash_count,
         notas_cierre = p_notes
   WHERE id = p_turno_id;

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
    v_auth_by,
    CASE WHEN v_auth_by IS NOT NULL THEN now() ELSE NULL END,
    v_cash_cobros, v_expected, v_ticket_count,
    v_user,
    jsonb_build_object(
      'opening_amount',      v_turno.monto_apertura,
      'cash_cobros_general', (v_cash_cobros - v_cash_pharmacy),
      'cash_cobros_farmacia', v_cash_pharmacy,
      'cash_cobros_total',   v_cash_cobros,
      'fondos_net',          v_fondos_net,
      'expected',            v_expected,
      'counted',             p_cash_count,
      'difference',          v_diff,
      'supervisor_override', p_supervisor_override,
      'supervisor_id',       p_supervisor_id,
      'is_pharmacy_turno',   (v_eff_shift IS NOT NULL),
      'pharmacy_shift_fallback', (v_turno.pharmacy_shift_id IS NULL AND v_eff_shift IS NOT NULL)
    )
  ) RETURNING id INTO v_corte_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'actualizar', 'turnos', p_turno_id,
          jsonb_build_object(
            'event',           'turno_cerrado',
            'folio_corte',     v_folio,
            'opening_amount',  v_turno.monto_apertura,
            'expected_cash',   v_expected,
            'counted_cash',    p_cash_count,
            'difference',      v_diff,
            'supervisor_id',   p_supervisor_id
          ), v_turno.clinic_id);

  RETURN jsonb_build_object(
    'turno_id',        p_turno_id,
    'corte_id',        v_corte_id,
    'folio',           v_folio,
    'opening_amount',  v_turno.monto_apertura,
    'cash_total',      v_cash_cobros,
    'fondos_net',      v_fondos_net,
    'expected_cash',   v_expected,
    'counted_cash',    p_cash_count,
    'difference',      v_diff,
    'supervisor_override', p_supervisor_override
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.turno_close(uuid, numeric, text, boolean, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. pharmacy_close_shift (with p_supervisor_id)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pharmacy_close_shift(
  p_shift_id          uuid,
  p_cash_count        numeric,
  p_notes             text    DEFAULT NULL,
  p_supervisor_override boolean DEFAULT false,
  p_supervisor_id     uuid    DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user        uuid := auth.uid();
  v_shift       public.pharmacy_cash_shifts;
  v_cash_total  numeric(12,2) := 0;
  v_fondos_net  numeric(12,2) := 0;
  v_expected    numeric(12,2);
  v_diff        numeric(12,2);
  v_umbral      numeric(10,2);
  v_settings    jsonb;
  v_corte_id    uuid;
  v_folio       bigint;
  v_auth_by     uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_shift FROM public.pharmacy_cash_shifts WHERE id = p_shift_id FOR UPDATE;
  IF v_shift IS NULL THEN RAISE EXCEPTION 'Turno no encontrado'; END IF;
  IF v_shift.status <> 'open' THEN RAISE EXCEPTION 'El turno ya no está abierto'; END IF;

  IF NOT (
    v_shift.cashier_user_id = v_user
    OR has_role(v_user,'admin') OR has_role(v_user,'manager')
  ) THEN
    RAISE EXCEPTION 'Sin permiso para cerrar este turno';
  END IF;

  IF p_cash_count IS NULL OR p_cash_count < 0 THEN
    RAISE EXCEPTION 'Efectivo contado inválido';
  END IF;

  SELECT COALESCE(SUM(pay.amount),0) INTO v_cash_total
    FROM public.pharmacy_sale_payments pay
    JOIN public.pharmacy_sales s ON s.id = pay.sale_id
   WHERE s.shift_id = p_shift_id
     AND s.status <> 'cancelled'
     AND pay.payment_method = 'efectivo';

  SELECT COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN -monto ELSE monto END), 0)
    INTO v_fondos_net
    FROM public.fondos_movimientos
   WHERE pharmacy_shift_id = p_shift_id;

  v_expected := v_shift.opening_amount + v_cash_total + v_fondos_net;
  v_diff := p_cash_count - v_expected;

  SELECT data INTO v_settings
    FROM public.clinic_settings
   WHERE clinic_id = v_shift.clinic_id AND section = 'caja';
  v_umbral := (v_settings->>'umbral_diferencia')::numeric;

  IF v_umbral IS NOT NULL AND abs(v_diff) > v_umbral THEN
    IF NOT p_supervisor_override THEN
      RAISE EXCEPTION 'DIFF_EXCEEDS_THRESHOLD|%|%', v_diff, v_umbral;
    END IF;
    IF NOT (
      has_role(COALESCE(p_supervisor_id, v_user), 'admin')
      OR has_role(COALESCE(p_supervisor_id, v_user), 'manager')
    ) THEN
      RAISE EXCEPTION 'Solo admin o gerente puede autorizar diferencias que excedan el umbral configurado';
    END IF;
  END IF;

  v_auth_by := CASE
    WHEN (v_umbral IS NOT NULL AND abs(v_diff) > v_umbral AND p_supervisor_override)
    THEN COALESCE(p_supervisor_id, v_user)
    ELSE NULL
  END;

  v_folio := nextval('public.cortes_folio_seq');

  UPDATE public.pharmacy_cash_shifts
     SET status = 'closed',
         closed_by = v_user,
         closed_at = now(),
         closing_cash_count = p_cash_count,
         expected_cash_amount = v_expected,
         cash_difference = v_diff,
         close_notes = p_notes
   WHERE id = p_shift_id;

  INSERT INTO public.cortes (
    clinic_id, pharmacy_shift_id, tipo,
    folio_secuencial, efectivo_esperado, conteo_ciego, diferencia,
    requiere_autorizacion, autorizado_by, autorizado_at,
    total_efectivo, total_general, conteo_movimientos,
    generado_by, datos_json
  )
  SELECT
    v_shift.clinic_id,
    p_shift_id,
    'Z',
    v_folio,
    v_expected,
    p_cash_count,
    v_diff,
    (v_umbral IS NOT NULL AND abs(v_diff) > v_umbral AND p_supervisor_override),
    v_auth_by,
    CASE WHEN v_auth_by IS NOT NULL THEN now() ELSE NULL END,
    v_cash_total,
    v_expected,
    (SELECT COUNT(*) FROM public.pharmacy_sales
      WHERE shift_id = p_shift_id AND status <> 'cancelled'),
    v_user,
    jsonb_build_object(
      'opening_amount',      v_shift.opening_amount,
      'cash_sales',          v_cash_total,
      'fondos_net',          v_fondos_net,
      'expected',            v_expected,
      'counted',             p_cash_count,
      'difference',          v_diff,
      'supervisor_override', p_supervisor_override,
      'supervisor_id',       p_supervisor_id
    )
  RETURNING id INTO v_corte_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'actualizar', 'pharmacy_cash_shifts', p_shift_id,
          jsonb_build_object(
            'event',          'turno_cerrado',
            'folio_corte',    v_folio,
            'opening_amount', v_shift.opening_amount,
            'expected_cash',  v_expected,
            'counted_cash',   p_cash_count,
            'difference',     v_diff,
            'supervisor_id',  p_supervisor_id
          ), v_shift.clinic_id);

  RETURN jsonb_build_object(
    'shift_id',        p_shift_id,
    'corte_id',        v_corte_id,
    'folio',           v_folio,
    'opening_amount',  v_shift.opening_amount,
    'cash_total_sales', v_cash_total,
    'fondos_net',      v_fondos_net,
    'expected_cash',   v_expected,
    'counted_cash',    p_cash_count,
    'difference',      v_diff,
    'supervisor_override', p_supervisor_override
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.pharmacy_close_shift(uuid, numeric, text, boolean, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. turno_close_with_pin: delegate p_supervisor_id to turno_close
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.turno_close_with_pin(
  p_turno_id      uuid,
  p_supervisor_id uuid,
  p_pin           text,
  p_cash_count    numeric,
  p_notes         text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_hash text;
BEGIN
  SELECT supervisor_pin_hash INTO v_hash
    FROM public.profiles WHERE id = p_supervisor_id;

  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'PIN_NOT_CONFIGURED';
  END IF;

  IF crypt(p_pin, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'PIN_INCORRECT';
  END IF;

  IF NOT (has_role(p_supervisor_id, 'admin'::app_role)
          OR has_role(p_supervisor_id, 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Supervisor sin rol admin/manager';
  END IF;

  RETURN public.turno_close(p_turno_id, p_cash_count, p_notes, true, p_supervisor_id);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.turno_close_with_pin(uuid, uuid, text, numeric, text) TO authenticated;
