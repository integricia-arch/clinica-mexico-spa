-- ============================================================
-- Corte de Caja: Opción B
-- 1. Folio secuencial (SEQUENCE) para cortes
-- 2. Columnas de conteo ciego en cortes
-- 3. fondos_movimientos: egresos/ingresos de fondo durante turno
-- 4. pharmacy_close_shift: threshold + corte Z + folio
-- 5. pharmacy_corte_x: Corte X intra-turno sin cerrar
-- 6. pharmacy_fondo_movimiento: egreso/ingreso RPC
-- ============================================================

-- 1. Sequence for corte folio
CREATE SEQUENCE IF NOT EXISTS public.cortes_folio_seq
  START WITH 1 INCREMENT BY 1 NO CYCLE;

GRANT USAGE, SELECT ON SEQUENCE public.cortes_folio_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.cortes_folio_seq TO service_role;

-- 2. Alter cortes: turno_id nullable + pharmacy link + blind-count columns
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

CREATE INDEX IF NOT EXISTS idx_cortes_pharmacy_shift ON public.cortes(pharmacy_shift_id);

-- 3. fondos_movimientos: retiros/ingresos de efectivo durante turno
CREATE TABLE IF NOT EXISTS public.fondos_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  pharmacy_shift_id uuid NOT NULL REFERENCES public.pharmacy_cash_shifts(id),
  tipo text NOT NULL CHECK (tipo IN ('egreso','ingreso')),
  monto numeric(10,2) NOT NULL CHECK (monto > 0),
  motivo text NOT NULL,
  registrado_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fondos_movimientos_shift ON public.fondos_movimientos(pharmacy_shift_id);
CREATE INDEX IF NOT EXISTS idx_fondos_movimientos_clinic ON public.fondos_movimientos(clinic_id);

ALTER TABLE public.fondos_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Caja staff ve fondos" ON public.fondos_movimientos;
CREATE POLICY "Caja staff ve fondos" ON public.fondos_movimientos
  FOR SELECT TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_caja_staff(auth.uid()));

DROP POLICY IF EXISTS "Caja staff registra fondos" ON public.fondos_movimientos;
CREATE POLICY "Caja staff registra fondos" ON public.fondos_movimientos
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_caja_staff(auth.uid()));

GRANT SELECT, INSERT ON public.fondos_movimientos TO authenticated;
GRANT ALL ON public.fondos_movimientos TO service_role;

-- 4. pharmacy_close_shift: blind count + threshold + corte Z
CREATE OR REPLACE FUNCTION public.pharmacy_close_shift(
  p_shift_id uuid,
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
  v_shift public.pharmacy_cash_shifts;
  v_cash_total numeric(12,2) := 0;
  v_fondos_net numeric(12,2) := 0;
  v_expected numeric(12,2);
  v_diff numeric(12,2);
  v_umbral numeric(10,2);
  v_settings jsonb;
  v_corte_id uuid;
  v_folio bigint;
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

  -- Efectivo de ventas
  SELECT COALESCE(SUM(pay.amount),0) INTO v_cash_total
    FROM public.pharmacy_sale_payments pay
    JOIN public.pharmacy_sales s ON s.id = pay.sale_id
   WHERE s.shift_id = p_shift_id
     AND s.status <> 'cancelled'
     AND pay.payment_method = 'efectivo';

  -- Neto de fondos (egresos restan, ingresos suman respecto al efectivo esperado)
  SELECT COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN -monto ELSE monto END), 0)
    INTO v_fondos_net
    FROM public.fondos_movimientos
   WHERE pharmacy_shift_id = p_shift_id;

  v_expected := v_shift.opening_amount + v_cash_total + v_fondos_net;
  v_diff := p_cash_count - v_expected;

  -- Umbral de diferencia desde clinic_settings section='caja'
  SELECT data INTO v_settings
    FROM public.clinic_settings
   WHERE clinic_id = v_shift.clinic_id AND section = 'caja';
  v_umbral := (v_settings->>'umbral_diferencia')::numeric;

  IF v_umbral IS NOT NULL AND abs(v_diff) > v_umbral THEN
    IF NOT p_supervisor_override THEN
      -- Mensaje parseable: DIFF_EXCEEDS_THRESHOLD|{diff}|{umbral}
      RAISE EXCEPTION 'DIFF_EXCEEDS_THRESHOLD|%|%', v_diff, v_umbral;
    END IF;
    IF NOT (has_role(v_user,'admin') OR has_role(v_user,'manager')) THEN
      RAISE EXCEPTION 'Solo admin o gerente puede autorizar diferencias que excedan el umbral configurado';
    END IF;
  END IF;

  -- Folio secuencial
  v_folio := nextval('public.cortes_folio_seq');

  -- Cerrar turno
  UPDATE public.pharmacy_cash_shifts
     SET status = 'closed',
         closed_by = v_user,
         closed_at = now(),
         closing_cash_count = p_cash_count,
         expected_cash_amount = v_expected,
         cash_difference = v_diff,
         close_notes = p_notes
   WHERE id = p_shift_id;

  -- Insertar Corte Z
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
    CASE WHEN (v_umbral IS NOT NULL AND abs(v_diff) > v_umbral AND p_supervisor_override)
         THEN v_user ELSE NULL END,
    CASE WHEN (v_umbral IS NOT NULL AND abs(v_diff) > v_umbral AND p_supervisor_override)
         THEN now() ELSE NULL END,
    v_cash_total,
    v_expected,
    (SELECT COUNT(*) FROM public.pharmacy_sales
      WHERE shift_id = p_shift_id AND status <> 'cancelled'),
    v_user,
    jsonb_build_object(
      'opening_amount', v_shift.opening_amount,
      'cash_sales', v_cash_total,
      'fondos_net', v_fondos_net,
      'expected', v_expected,
      'counted', p_cash_count,
      'difference', v_diff,
      'supervisor_override', p_supervisor_override
    )
  RETURNING id INTO v_corte_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'actualizar', 'pharmacy_cash_shifts', p_shift_id,
          jsonb_build_object(
            'event','turno_cerrado',
            'folio_corte', v_folio,
            'opening_amount', v_shift.opening_amount,
            'cash_total_sales', v_cash_total,
            'fondos_net', v_fondos_net,
            'expected_cash', v_expected,
            'counted_cash', p_cash_count,
            'difference', v_diff,
            'supervisor_override', p_supervisor_override
          ), v_shift.clinic_id);

  RETURN jsonb_build_object(
    'shift_id', p_shift_id,
    'corte_id', v_corte_id,
    'folio', v_folio,
    'opening_amount', v_shift.opening_amount,
    'cash_total_sales', v_cash_total,
    'expected_cash', v_expected,
    'counted_cash', p_cash_count,
    'difference', v_diff,
    'supervisor_override', p_supervisor_override
  );
END;
$func$;

-- 5. pharmacy_corte_x: Corte X intra-turno (no cierra el turno)
CREATE OR REPLACE FUNCTION public.pharmacy_corte_x(
  p_shift_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user uuid := auth.uid();
  v_shift public.pharmacy_cash_shifts;
  v_cash_total numeric(12,2) := 0;
  v_card_total numeric(12,2) := 0;
  v_transfer_total numeric(12,2) := 0;
  v_other_total numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_count integer := 0;
  v_corte_id uuid;
  v_folio bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_shift FROM public.pharmacy_cash_shifts WHERE id = p_shift_id;
  IF v_shift IS NULL THEN RAISE EXCEPTION 'Turno no encontrado'; END IF;
  IF v_shift.status <> 'open' THEN RAISE EXCEPTION 'El turno no está abierto'; END IF;

  IF NOT (
    v_shift.cashier_user_id = v_user
    OR has_role(v_user,'admin') OR has_role(v_user,'manager')
  ) THEN
    RAISE EXCEPTION 'Sin permiso para generar Corte X';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN pay.payment_method = 'efectivo' THEN pay.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN pay.payment_method = 'tarjeta' THEN pay.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN pay.payment_method = 'transferencia' THEN pay.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN pay.payment_method NOT IN ('efectivo','tarjeta','transferencia') THEN pay.amount ELSE 0 END), 0),
    COUNT(DISTINCT s.id)::integer
  INTO v_cash_total, v_card_total, v_transfer_total, v_other_total, v_count
  FROM public.pharmacy_sale_payments pay
  JOIN public.pharmacy_sales s ON s.id = pay.sale_id
  WHERE s.shift_id = p_shift_id AND s.status <> 'cancelled';

  v_total := v_cash_total + v_card_total + v_transfer_total + v_other_total;
  v_folio := nextval('public.cortes_folio_seq');

  INSERT INTO public.cortes (
    clinic_id, pharmacy_shift_id, tipo, folio_secuencial,
    total_efectivo, total_tarjeta, total_transferencia, total_otros, total_general,
    conteo_movimientos, generado_by, datos_json
  ) VALUES (
    v_shift.clinic_id, p_shift_id, 'X', v_folio,
    v_cash_total, v_card_total, v_transfer_total, v_other_total, v_total,
    v_count, v_user,
    jsonb_build_object(
      'opening_amount', v_shift.opening_amount,
      'cash_sales', v_cash_total,
      'card_sales', v_card_total,
      'transfer_sales', v_transfer_total,
      'other_sales', v_other_total,
      'total', v_total,
      'tickets', v_count
    )
  ) RETURNING id INTO v_corte_id;

  RETURN jsonb_build_object(
    'corte_id', v_corte_id,
    'folio', v_folio,
    'tipo', 'X',
    'total_efectivo', v_cash_total,
    'total_tarjeta', v_card_total,
    'total_transferencia', v_transfer_total,
    'total_otros', v_other_total,
    'total_general', v_total,
    'tickets', v_count,
    'opening_amount', v_shift.opening_amount
  );
END;
$func$;

-- 6. pharmacy_fondo_movimiento: egreso/ingreso de efectivo durante turno
CREATE OR REPLACE FUNCTION public.pharmacy_fondo_movimiento(
  p_shift_id uuid,
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
  v_shift public.pharmacy_cash_shifts;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_tipo NOT IN ('egreso','ingreso') THEN RAISE EXCEPTION 'tipo debe ser egreso o ingreso'; END IF;
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

  INSERT INTO public.fondos_movimientos
    (clinic_id, pharmacy_shift_id, tipo, monto, motivo, registrado_by)
  VALUES
    (v_shift.clinic_id, p_shift_id, p_tipo, p_monto, p_motivo, v_user)
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'crear', 'fondos_movimientos', v_id,
          jsonb_build_object(
            'event', 'fondo_movimiento',
            'tipo', p_tipo,
            'monto', p_monto,
            'motivo', p_motivo
          ), v_shift.clinic_id);

  RETURN v_id;
END;
$func$;
