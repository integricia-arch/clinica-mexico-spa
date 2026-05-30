
-- 1) shift_id en pharmacy_sales
ALTER TABLE public.pharmacy_sales
  ADD COLUMN IF NOT EXISTS shift_id uuid;

CREATE INDEX IF NOT EXISTS pharmacy_sales_clinic_shift_created_idx
  ON public.pharmacy_sales(clinic_id, shift_id, created_at);

-- 2) tabla pharmacy_cash_shifts
CREATE TABLE IF NOT EXISTS public.pharmacy_cash_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  cashier_user_id uuid NOT NULL,
  opened_by uuid NOT NULL,
  closed_by uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','cancelled')),
  opening_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  closing_cash_count numeric(12,2),
  expected_cash_amount numeric(12,2),
  cash_difference numeric(12,2),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  notes text,
  close_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.pharmacy_cash_shifts TO authenticated;
GRANT ALL ON public.pharmacy_cash_shifts TO service_role;

ALTER TABLE public.pharmacy_cash_shifts ENABLE ROW LEVEL SECURITY;

-- Un turno abierto por cajero y clínica
CREATE UNIQUE INDEX IF NOT EXISTS pharmacy_cash_shifts_one_open_per_cashier
  ON public.pharmacy_cash_shifts(clinic_id, cashier_user_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS pharmacy_cash_shifts_clinic_status_idx
  ON public.pharmacy_cash_shifts(clinic_id, status, opened_at DESC);

-- Policies
CREATE POLICY "Cashier reads own shifts"
  ON public.pharmacy_cash_shifts FOR SELECT TO authenticated
  USING (
    cashier_user_id = auth.uid()
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'manager'::app_role)
  );

CREATE POLICY "Cashier inserts own shift"
  ON public.pharmacy_cash_shifts FOR INSERT TO authenticated
  WITH CHECK (
    (cashier_user_id = auth.uid()
     OR has_role(auth.uid(),'admin'::app_role)
     OR has_role(auth.uid(),'manager'::app_role))
    AND user_has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "Cashier/manager updates shift"
  ON public.pharmacy_cash_shifts FOR UPDATE TO authenticated
  USING (
    cashier_user_id = auth.uid()
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'manager'::app_role)
  )
  WITH CHECK (user_has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "multiclinic_access_restrictive"
  ON public.pharmacy_cash_shifts AS RESTRICTIVE FOR ALL TO authenticated
  USING (user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (user_has_clinic_access(auth.uid(), clinic_id));

-- updated_at
DROP TRIGGER IF EXISTS trg_pharmacy_cash_shifts_updated_at ON public.pharmacy_cash_shifts;
CREATE TRIGGER trg_pharmacy_cash_shifts_updated_at
  BEFORE UPDATE ON public.pharmacy_cash_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Helper: turno actual del usuario
CREATE OR REPLACE FUNCTION public.pharmacy_current_shift(p_clinic uuid DEFAULT NULL)
RETURNS public.pharmacy_cash_shifts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.pharmacy_cash_shifts
  WHERE cashier_user_id = auth.uid()
    AND status = 'open'
    AND (p_clinic IS NULL OR clinic_id = p_clinic)
  ORDER BY opened_at DESC
  LIMIT 1;
$$;

-- 4) Abrir turno
CREATE OR REPLACE FUNCTION public.pharmacy_open_shift(
  p_clinic_id uuid,
  p_opening_amount numeric,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_shift_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF NOT (has_role(v_user,'admin') OR has_role(v_user,'manager') OR has_role(v_user,'nurse') OR has_role(v_user,'receptionist')) THEN
    RAISE EXCEPTION 'Sin permiso para abrir turno';
  END IF;
  IF p_opening_amount IS NULL OR p_opening_amount < 0 THEN
    RAISE EXCEPTION 'Monto inicial inválido';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pharmacy_cash_shifts
    WHERE cashier_user_id = v_user AND clinic_id = p_clinic_id AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Ya tienes un turno abierto en esta clínica';
  END IF;

  INSERT INTO public.pharmacy_cash_shifts
    (clinic_id, cashier_user_id, opened_by, opening_amount, notes)
  VALUES (p_clinic_id, v_user, v_user, p_opening_amount, p_notes)
  RETURNING id INTO v_shift_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'crear', 'pharmacy_cash_shifts', v_shift_id,
          jsonb_build_object('event','turno_abierto','opening_amount',p_opening_amount), p_clinic_id);

  RETURN v_shift_id;
END;
$$;

-- 5) Cerrar turno (corte de caja)
CREATE OR REPLACE FUNCTION public.pharmacy_close_shift(
  p_shift_id uuid,
  p_cash_count numeric,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_shift public.pharmacy_cash_shifts;
  v_cash_total numeric(12,2) := 0;
  v_expected numeric(12,2);
  v_diff numeric(12,2);
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

  -- Suma efectivo de pharmacy_sale_payments de ventas de este turno (no canceladas).
  SELECT COALESCE(SUM(pay.amount),0) INTO v_cash_total
    FROM public.pharmacy_sale_payments pay
    JOIN public.pharmacy_sales s ON s.id = pay.sale_id
   WHERE s.shift_id = p_shift_id
     AND s.status <> 'cancelled'
     AND pay.payment_method = 'efectivo';

  v_expected := v_shift.opening_amount + v_cash_total;
  v_diff := p_cash_count - v_expected;

  UPDATE public.pharmacy_cash_shifts
     SET status = 'closed',
         closed_by = v_user,
         closed_at = now(),
         closing_cash_count = p_cash_count,
         expected_cash_amount = v_expected,
         cash_difference = v_diff,
         close_notes = p_notes
   WHERE id = p_shift_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'actualizar', 'pharmacy_cash_shifts', p_shift_id,
          jsonb_build_object(
            'event','turno_cerrado',
            'opening_amount', v_shift.opening_amount,
            'cash_total_sales', v_cash_total,
            'expected_cash', v_expected,
            'counted_cash', p_cash_count,
            'difference', v_diff
          ), v_shift.clinic_id);

  IF v_diff <> 0 THEN
    INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
    VALUES (v_user, 'consultar', 'pharmacy_cash_shifts', p_shift_id,
            jsonb_build_object('event','diferencia_caja_detectada','difference',v_diff), v_shift.clinic_id);
  END IF;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'consultar', 'pharmacy_cash_shifts', p_shift_id,
          jsonb_build_object('event','corte_caja_generado'), v_shift.clinic_id);

  RETURN jsonb_build_object(
    'shift_id', p_shift_id,
    'opening_amount', v_shift.opening_amount,
    'cash_total_sales', v_cash_total,
    'expected_cash', v_expected,
    'counted_cash', p_cash_count,
    'difference', v_diff
  );
END;
$$;

-- 6) pharmacy_register_sale: agregar shift_id y validar turno
CREATE OR REPLACE FUNCTION public.pharmacy_register_sale(p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_clinic uuid;
  v_sale_id uuid;
  v_sale_type text := p_payload->>'sale_type';
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := COALESCE((p_payload->>'discount')::numeric, 0);
  v_total numeric(12,2);
  v_item jsonb;
  v_med record;
  v_lote record;
  v_pick_lote uuid;
  v_oldest_lote uuid;
  v_qty int;
  v_unit numeric(10,2);
  v_idisc numeric(10,2);
  v_isubtotal numeric(12,2);
  v_mov_type public.movimiento_tipo;
  v_override_reason text;
  v_shift_id uuid;
  v_override_no_shift boolean := COALESCE((p_payload->>'override_no_shift')::boolean, false);
  v_override_no_shift_reason text := p_payload->>'override_no_shift_reason';
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'nurse') OR public.has_role(v_user,'receptionist') OR public.has_role(v_user,'manager')) THEN
    RAISE EXCEPTION 'Permisos insuficientes para registrar venta';
  END IF;

  IF v_sale_type NOT IN ('direct_sale','prescription_dispense') THEN
    RAISE EXCEPTION 'sale_type inválido';
  END IF;

  IF jsonb_array_length(COALESCE(p_payload->'items','[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'La venta debe tener al menos un artículo';
  END IF;

  v_clinic := COALESCE(
    (SELECT clinic_id FROM public.patients WHERE id = NULLIF(p_payload->>'patient_id','')::uuid),
    (SELECT clinic_id FROM public.medicamentos WHERE id = (((p_payload->'items')->0)->>'medicamento_id')::uuid),
    '106cc686-a333-4ec1-83ea-84eaafbf2e90'::uuid
  );

  v_mov_type := CASE WHEN v_sale_type = 'direct_sale'
                     THEN 'salida_venta'::public.movimiento_tipo
                     ELSE 'salida_surtido_receta'::public.movimiento_tipo END;

  -- Resolver turno actual del cajero
  SELECT id INTO v_shift_id
    FROM public.pharmacy_cash_shifts
   WHERE cashier_user_id = v_user
     AND clinic_id = v_clinic
     AND status = 'open'
   ORDER BY opened_at DESC LIMIT 1;

  IF v_shift_id IS NULL THEN
    IF v_override_no_shift AND (public.has_role(v_user,'admin') OR public.has_role(v_user,'manager')) THEN
      IF v_override_no_shift_reason IS NULL OR length(trim(v_override_no_shift_reason)) = 0 THEN
        RAISE EXCEPTION 'Venta sin turno requiere motivo de override';
      END IF;
      INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
      VALUES (v_user, 'crear', 'pharmacy_sales', NULL,
              jsonb_build_object('event','venta_sin_turno_override','reason',v_override_no_shift_reason), v_clinic);
    ELSE
      RAISE EXCEPTION 'Debe abrir turno antes de vender.';
    END IF;
  END IF;

  -- Validación de items y stock (igual que antes)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    SELECT * INTO v_med FROM public.medicamentos WHERE id = (v_item->>'medicamento_id')::uuid;
    IF v_med IS NULL THEN RAISE EXCEPTION 'Medicamento no encontrado'; END IF;
    IF v_med.activo = false THEN RAISE EXCEPTION 'Medicamento % está inactivo', v_med.nombre; END IF;

    v_qty := (v_item->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Cantidad inválida para %', v_med.nombre; END IF;

    IF v_sale_type = 'direct_sale' THEN
      IF v_med.is_controlled = true THEN
        INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
        VALUES (v_user, 'crear', 'pharmacy_sales', NULL,
                jsonb_build_object('event','blocked_controlled','medicamento_id',v_med.id), v_clinic);
        RAISE EXCEPTION 'Medicamento sujeto a control sanitario. Requiere validación regulatoria y receta correspondiente.';
      END IF;
      IF v_med.requires_prescription = true OR v_med.allow_direct_sale = false THEN
        INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
        VALUES (v_user, 'crear', 'pharmacy_sales', NULL,
                jsonb_build_object('event','blocked_prescription_required','medicamento_id',v_med.id), v_clinic);
        RAISE EXCEPTION 'Este medicamento requiere receta médica para su venta.';
      END IF;
    END IF;

    v_pick_lote := NULLIF(v_item->>'lote_id','')::uuid;
    SELECT id INTO v_oldest_lote
      FROM public.lotes_medicamento
     WHERE medicamento_id = v_med.id AND existencia >= v_qty AND fecha_caducidad >= CURRENT_DATE
     ORDER BY fecha_entrada ASC, fecha_caducidad ASC LIMIT 1;

    IF v_pick_lote IS NULL THEN
      v_pick_lote := v_oldest_lote;
    ELSE
      IF v_oldest_lote IS NOT NULL AND v_pick_lote <> v_oldest_lote THEN
        v_override_reason := v_item->>'override_reason';
        IF v_override_reason IS NULL OR length(trim(v_override_reason)) = 0 THEN
          RAISE EXCEPTION 'Cambio manual de lote requiere motivo (override_reason)';
        END IF;
        IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'nurse')) THEN
          RAISE EXCEPTION 'Solo admin/enfermería puede saltar lote FIFO';
        END IF;
        INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
        VALUES (v_user, 'actualizar', 'lotes_medicamento', v_pick_lote,
                jsonb_build_object('event','fifo_override','medicamento_id',v_med.id,
                                   'lote_id',v_pick_lote,'oldest_lote_id',v_oldest_lote,
                                   'reason',v_override_reason), v_clinic);
      END IF;
    END IF;

    IF v_pick_lote IS NULL THEN
      RAISE EXCEPTION 'Sin existencia disponible para % (lote no vencido)', v_med.nombre;
    END IF;

    SELECT * INTO v_lote FROM public.lotes_medicamento WHERE id = v_pick_lote FOR UPDATE;
    IF v_lote.fecha_caducidad < CURRENT_DATE THEN
      RAISE EXCEPTION 'No se puede vender lote vencido (% / %)', v_med.nombre, v_lote.numero_lote;
    END IF;
    IF v_lote.existencia < v_qty THEN
      RAISE EXCEPTION 'Existencia insuficiente en lote % de %', v_lote.numero_lote, v_med.nombre;
    END IF;
  END LOOP;

  INSERT INTO public.pharmacy_sales
    (clinic_id, patient_id, customer_name, prescription_id, sale_type,
     status, payment_method, payment_status, requires_invoice, notes, discount, created_by, shift_id)
  VALUES
    (v_clinic,
     NULLIF(p_payload->>'patient_id','')::uuid,
     COALESCE(NULLIF(p_payload->>'customer_name',''), 'Público general'),
     NULLIF(p_payload->>'prescription_id','')::uuid,
     v_sale_type,
     'completed',
     p_payload->>'payment_method',
     COALESCE(p_payload->>'payment_status','paid'),
     COALESCE((p_payload->>'requires_invoice')::boolean, false),
     p_payload->>'notes',
     v_discount,
     v_user,
     v_shift_id)
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    SELECT * INTO v_med FROM public.medicamentos WHERE id = (v_item->>'medicamento_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    v_unit := COALESCE(NULLIF(v_item->>'unit_price','')::numeric, v_med.precio_unitario);
    v_idisc := COALESCE(NULLIF(v_item->>'discount','')::numeric, 0);
    v_isubtotal := (v_qty * v_unit) - v_idisc;

    v_pick_lote := NULLIF(v_item->>'lote_id','')::uuid;
    IF v_pick_lote IS NULL THEN
      SELECT id INTO v_pick_lote
        FROM public.lotes_medicamento
       WHERE medicamento_id = v_med.id AND existencia >= v_qty AND fecha_caducidad >= CURRENT_DATE
       ORDER BY fecha_entrada ASC, fecha_caducidad ASC LIMIT 1;
    END IF;

    UPDATE public.lotes_medicamento SET existencia = existencia - v_qty WHERE id = v_pick_lote;

    INSERT INTO public.pharmacy_sale_items
      (sale_id, clinic_id, medicamento_id, lote_id, prescription_item_id,
       quantity, unit_price, discount, subtotal)
    VALUES
      (v_sale_id, v_clinic, v_med.id, v_pick_lote,
       NULLIF(v_item->>'prescription_item_id','')::uuid,
       v_qty, v_unit, v_idisc, v_isubtotal);

    INSERT INTO public.movimientos_inventario
      (medicamento_id, lote_id, tipo, cantidad, motivo,
       user_id, clinic_id, reference_type, reference_id)
    VALUES
      (v_med.id, v_pick_lote, v_mov_type, v_qty,
       CASE WHEN v_sale_type='direct_sale' THEN 'Venta directa' ELSE 'Surtido de receta' END,
       v_user, v_clinic, 'pharmacy_sale', v_sale_id);

    v_subtotal := v_subtotal + (v_qty * v_unit);
  END LOOP;

  v_total := v_subtotal - v_discount;

  UPDATE public.pharmacy_sales SET subtotal = v_subtotal, total = v_total WHERE id = v_sale_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'crear', 'pharmacy_sales', v_sale_id,
          jsonb_build_object('event','pharmacy_sale_created','sale_type',v_sale_type,
                             'total',v_total,'items',jsonb_array_length(p_payload->'items'),
                             'shift_id', v_shift_id),
          v_clinic);

  RETURN v_sale_id;
END;
$function$;
