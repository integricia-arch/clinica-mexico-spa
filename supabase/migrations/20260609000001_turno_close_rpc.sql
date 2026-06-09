-- turno_close: blind count + Corte Z + threshold for general turnos (non-pharmacy)
-- Idempotent: CREATE OR REPLACE, IF NOT EXISTS throughout

-- Ensure sequence exists (created in _tmp_corte_caja_opcion_b.sql but may not be present)
CREATE SEQUENCE IF NOT EXISTS public.cortes_folio_seq
  START WITH 1 INCREMENT BY 1 NO CYCLE;
GRANT USAGE, SELECT ON SEQUENCE public.cortes_folio_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.cortes_folio_seq TO service_role;

-- Ensure cortes reconciliation columns exist
ALTER TABLE public.cortes
  ALTER COLUMN turno_id DROP NOT NULL;

ALTER TABLE public.cortes
  ADD COLUMN IF NOT EXISTS pharmacy_shift_id uuid REFERENCES public.pharmacy_cash_shifts(id),
  ADD COLUMN IF NOT EXISTS folio_secuencial bigint,
  ADD COLUMN IF NOT EXISTS efectivo_esperado numeric(12,2),
  ADD COLUMN IF NOT EXISTS conteo_ciego numeric(12,2),
  ADD COLUMN IF NOT EXISTS diferencia numeric(12,2),
  ADD COLUMN IF NOT EXISTS requiere_autorizacion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS autorizado_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS autorizado_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_cortes_turno_tipo ON public.cortes(turno_id, tipo);

-- RPC: turno_close
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
  v_cash_ingresos numeric(12,2) := 0;
  v_cash_egresos numeric(12,2) := 0;
  v_expected numeric(12,2);
  v_diff numeric(12,2);
  v_umbral numeric(10,2);
  v_settings jsonb;
  v_corte_id uuid;
  v_folio bigint;
  v_ticket_count integer := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT t.*
    INTO v_turno
    FROM public.turnos t
   WHERE t.id = p_turno_id
     FOR UPDATE;

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

  -- Cobros en efectivo (SAT code '01' = Efectivo)
  SELECT COALESCE(SUM(mp.monto), 0)
    INTO v_cash_cobros
  FROM public.movimiento_pagos mp
  JOIN public.movimientos m ON m.id = mp.movimiento_id
  JOIN public.metodos_pago met ON met.id = mp.metodo_pago_id
  WHERE m.turno_id = p_turno_id
    AND m.estado = 'pagado'
    AND m.tipo = 'cobro'
    AND met.codigo_sat = '01';

  -- Ingresos de efectivo durante turno
  SELECT COALESCE(SUM(total), 0)
    INTO v_cash_ingresos
  FROM public.movimientos
  WHERE turno_id = p_turno_id AND tipo = 'ingreso' AND estado = 'pagado';

  -- Egresos de efectivo durante turno
  SELECT COALESCE(SUM(total), 0)
    INTO v_cash_egresos
  FROM public.movimientos
  WHERE turno_id = p_turno_id AND tipo = 'egreso' AND estado = 'pagado';

  -- Tickets cobrados
  SELECT COUNT(*)::integer INTO v_ticket_count
  FROM public.movimientos
  WHERE turno_id = p_turno_id AND tipo = 'cobro' AND estado = 'pagado';

  v_expected := v_turno.monto_apertura + v_cash_cobros + v_cash_ingresos - v_cash_egresos;
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
    v_turno.clinic_id,
    p_turno_id,
    'Z',
    v_folio,
    v_expected,
    p_cash_count,
    v_diff,
    (v_umbral IS NOT NULL AND abs(v_diff) > v_umbral AND p_supervisor_override),
    CASE WHEN (v_umbral IS NOT NULL AND abs(v_diff) > v_umbral AND p_supervisor_override)
         THEN v_user ELSE NULL END,
    CASE WHEN (v_umbral IS NOT NULL AND abs(v_diff) > v_umbral AND p_supervisor_override)
         THEN now() ELSE NULL END,
    v_cash_cobros,
    v_expected,
    v_ticket_count,
    v_user,
    jsonb_build_object(
      'opening_amount', v_turno.monto_apertura,
      'cash_cobros', v_cash_cobros,
      'cash_ingresos', v_cash_ingresos,
      'cash_egresos', v_cash_egresos,
      'expected', v_expected,
      'counted', p_cash_count,
      'difference', v_diff,
      'supervisor_override', p_supervisor_override
    )
  ) RETURNING id INTO v_corte_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'actualizar', 'turnos', p_turno_id,
          jsonb_build_object(
            'event', 'turno_cerrado',
            'folio_corte', v_folio,
            'opening_amount', v_turno.monto_apertura,
            'expected_cash', v_expected,
            'counted_cash', p_cash_count,
            'difference', v_diff
          ), v_turno.clinic_id);

  RETURN jsonb_build_object(
    'turno_id', p_turno_id,
    'corte_id', v_corte_id,
    'folio', v_folio,
    'opening_amount', v_turno.monto_apertura,
    'cash_total', v_cash_cobros,
    'expected_cash', v_expected,
    'counted_cash', p_cash_count,
    'difference', v_diff,
    'supervisor_override', p_supervisor_override
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.turno_close(uuid, numeric, text, boolean) TO authenticated;
