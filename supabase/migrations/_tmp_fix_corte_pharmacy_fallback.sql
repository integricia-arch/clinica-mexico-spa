-- Fix cobros efectivo $0 en turno_corte_x y turno_close
-- Problema: turnos.pharmacy_shift_id = NULL cuando caja no es es_farmacia = true
-- Solución: fallback por tiempo — buscar turno farmacia activo del cajero
--           y filtrar ventas por ventana de tiempo del turno

CREATE OR REPLACE FUNCTION public.turno_corte_x(p_turno_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_turno           public.turnos%ROWTYPE;
  v_fondo_inicial   numeric := 0;
  v_cash_cobros     numeric := 0;
  v_cash_pharmacy   numeric := 0;
  v_neto_fondos     numeric := 0;
  v_ticket_count    int := 0;
  v_folio           text;
  v_seq             bigint;
  v_corte_id        uuid;
  v_eff_shift       uuid;
BEGIN
  SELECT * INTO v_turno FROM public.turnos WHERE id = p_turno_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Turno no encontrado');
  END IF;
  IF v_turno.estado != 'abierto' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Turno no está abierto');
  END IF;

  -- Fondo inicial
  SELECT COALESCE(monto_inicial, 0) INTO v_fondo_inicial FROM public.turnos WHERE id = p_turno_id;

  -- Cobros efectivo desde movimiento_pagos (ventas generales)
  SELECT COALESCE(SUM(mp.monto), 0)
    INTO v_cash_cobros
  FROM public.movimiento_pagos mp
  WHERE mp.turno_id = p_turno_id
    AND mp.metodo_pago = 'efectivo';

  -- Cobros efectivo farmacia
  -- Primero intentar pharmacy_shift_id directo; si NULL, fallback por cajero+tiempo
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
      AND ps.created_at BETWEEN v_turno.abierto_at AND COALESCE(v_turno.cerrado_at, now());

    v_cash_cobros := v_cash_cobros + v_cash_pharmacy;

    -- Ticket count
    SELECT COUNT(DISTINCT ps.id)
      INTO v_ticket_count
    FROM public.pharmacy_sales ps
    WHERE ps.shift_id = v_eff_shift
      AND ps.status = 'completed'
      AND ps.created_at BETWEEN v_turno.abierto_at AND COALESCE(v_turno.cerrado_at, now());
  END IF;

  -- Neto fondos (egresos/ingresos manuales del turno)
  SELECT COALESCE(SUM(
    CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END
  ), 0)
    INTO v_neto_fondos
  FROM public.fondos_movimientos
  WHERE turno_id = p_turno_id;

  -- Generar folio X
  SELECT nextval('public.cortes_folio_seq') INTO v_seq;
  v_folio := 'X-' || LPAD(v_seq::text, 6, '0');

  -- Insertar corte X
  INSERT INTO public.cortes (
    turno_id, clinic_id, tipo, folio,
    fondo_inicial, cobros_efectivo, neto_fondos, efectivo_esperado,
    ticket_count, cajero_user_id, created_at
  ) VALUES (
    p_turno_id, v_turno.clinic_id, 'X', v_folio,
    v_fondo_inicial, v_cash_cobros, v_neto_fondos,
    v_fondo_inicial + v_cash_cobros + v_neto_fondos,
    v_ticket_count, v_turno.cajero_user_id, now()
  )
  RETURNING id INTO v_corte_id;

  RETURN jsonb_build_object(
    'ok', true,
    'folio', v_folio,
    'corte_id', v_corte_id,
    'fondo_inicial', v_fondo_inicial,
    'cobros_efectivo', v_cash_cobros,
    'neto_fondos', v_neto_fondos,
    'efectivo_esperado', v_fondo_inicial + v_cash_cobros + v_neto_fondos,
    'ticket_count', v_ticket_count
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.turno_close(
  p_turno_id   uuid,
  p_contado    numeric DEFAULT 0,
  p_notas      text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_turno           public.turnos%ROWTYPE;
  v_fondo_inicial   numeric := 0;
  v_cash_cobros     numeric := 0;
  v_cash_pharmacy   numeric := 0;
  v_neto_fondos     numeric := 0;
  v_ticket_count    int := 0;
  v_efectivo_esp    numeric := 0;
  v_diferencia      numeric := 0;
  v_folio           text;
  v_seq             bigint;
  v_corte_id        uuid;
  v_eff_shift       uuid;
BEGIN
  SELECT * INTO v_turno FROM public.turnos WHERE id = p_turno_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Turno no encontrado');
  END IF;
  IF v_turno.estado != 'abierto' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Turno ya cerrado');
  END IF;

  -- Fondo inicial
  SELECT COALESCE(monto_inicial, 0) INTO v_fondo_inicial FROM public.turnos WHERE id = p_turno_id;

  -- Cobros efectivo ventas generales
  SELECT COALESCE(SUM(mp.monto), 0)
    INTO v_cash_cobros
  FROM public.movimiento_pagos mp
  WHERE mp.turno_id = p_turno_id
    AND mp.metodo_pago = 'efectivo';

  -- Cobros efectivo farmacia (directo o fallback)
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

    SELECT COUNT(DISTINCT ps.id)
      INTO v_ticket_count
    FROM public.pharmacy_sales ps
    WHERE ps.shift_id = v_eff_shift
      AND ps.status = 'completed'
      AND ps.created_at BETWEEN v_turno.abierto_at AND now();
  END IF;

  -- Neto fondos
  SELECT COALESCE(SUM(
    CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END
  ), 0)
    INTO v_neto_fondos
  FROM public.fondos_movimientos
  WHERE turno_id = p_turno_id;

  v_efectivo_esp := v_fondo_inicial + v_cash_cobros + v_neto_fondos;
  v_diferencia   := p_contado - v_efectivo_esp;

  -- Generar folio Z
  SELECT nextval('public.cortes_folio_seq') INTO v_seq;
  v_folio := 'Z-' || LPAD(v_seq::text, 6, '0');

  -- Insertar corte Z
  INSERT INTO public.cortes (
    turno_id, clinic_id, tipo, folio,
    fondo_inicial, cobros_efectivo, neto_fondos, efectivo_esperado,
    contado_ciego, diferencia, notas, ticket_count,
    cajero_user_id, created_at
  ) VALUES (
    p_turno_id, v_turno.clinic_id, 'Z', v_folio,
    v_fondo_inicial, v_cash_cobros, v_neto_fondos, v_efectivo_esp,
    p_contado, v_diferencia, p_notas, v_ticket_count,
    v_turno.cajero_user_id, now()
  )
  RETURNING id INTO v_corte_id;

  -- Cerrar turno
  UPDATE public.turnos
  SET estado = 'cerrado', cerrado_at = now()
  WHERE id = p_turno_id;

  RETURN jsonb_build_object(
    'ok', true,
    'folio', v_folio,
    'corte_id', v_corte_id,
    'fondo_inicial', v_fondo_inicial,
    'cobros_efectivo', v_cash_cobros,
    'neto_fondos', v_neto_fondos,
    'efectivo_esperado', v_efectivo_esp,
    'contado', p_contado,
    'diferencia', v_diferencia,
    'ticket_count', v_ticket_count
  );
END;
$function$;
