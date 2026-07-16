-- supabase/migrations/20260716150100_pharmacy_register_return_pin.sql
CREATE OR REPLACE FUNCTION public.pharmacy_register_return(p_payload jsonb)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_user         uuid := auth.uid();
  v_clinic       uuid;
  v_sale         record;
  v_return_id    uuid;
  v_shift_id     uuid;
  v_total        numeric(12,2) := 0;
  v_authorized   uuid;
  v_pin          text;
  v_item         jsonb;
  v_si           record;
  v_qty          int;
  v_item_sub     numeric(12,2);
  v_already_ret  int;
  v_refund_meth  text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'nurse') OR
          public.has_role(v_user,'receptionist') OR public.has_role(v_user,'manager')) THEN
    RAISE EXCEPTION 'Permisos insuficientes para registrar devolución';
  END IF;

  v_clinic := NULLIF(p_payload->>'clinic_id','')::uuid;
  IF v_clinic IS NULL THEN RAISE EXCEPTION 'clinic_id requerido'; END IF;

  -- Autorización de supervisor por PIN (nunca confiar en que el cliente ya validó)
  v_authorized := NULLIF(p_payload->>'supervisor_id','')::uuid;
  v_pin        := p_payload->>'supervisor_pin';
  IF v_authorized IS NULL OR v_pin IS NULL OR length(trim(v_pin)) = 0 THEN
    RAISE EXCEPTION 'Devolución requiere supervisor_id y supervisor_pin';
  END IF;
  PERFORM public.verify_supervisor_pin(v_clinic, v_authorized, v_pin);

  -- Validar venta original
  SELECT * INTO v_sale FROM public.pharmacy_sales
   WHERE id = NULLIF(p_payload->>'sale_id','')::uuid AND clinic_id = v_clinic;
  IF v_sale IS NULL THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;
  IF v_sale.status <> 'completed' THEN
    RAISE EXCEPTION 'Solo se pueden devolver ventas completadas';
  END IF;

  v_refund_meth := COALESCE(NULLIF(p_payload->>'refund_method',''),'sin_reembolso');

  IF jsonb_array_length(COALESCE(p_payload->'items','[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Debe incluir al menos un artículo a devolver';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    SELECT psi.* INTO v_si
      FROM public.pharmacy_sale_items psi
     WHERE psi.id = (v_item->>'sale_item_id')::uuid
       AND psi.sale_id = v_sale.id;
    IF v_si IS NULL THEN
      RAISE EXCEPTION 'Ítem % no pertenece a la venta', v_item->>'sale_item_id';
    END IF;

    v_qty := (v_item->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida en ítem %', v_si.id;
    END IF;

    SELECT COALESCE(SUM(pri.quantity),0) INTO v_already_ret
      FROM public.pharmacy_return_items pri
      JOIN public.pharmacy_returns pr ON pr.id = pri.return_id
     WHERE pri.sale_item_id = v_si.id;

    IF v_already_ret + v_qty > v_si.quantity THEN
      RAISE EXCEPTION 'Devolución excede cantidad vendida para ítem % (vendido: %, ya devuelto: %, solicitado: %)',
        v_si.medicamento_id, v_si.quantity, v_already_ret, v_qty;
    END IF;
  END LOOP;

  SELECT id INTO v_shift_id
    FROM public.pharmacy_cash_shifts
   WHERE cashier_user_id = v_user AND clinic_id = v_clinic AND status = 'open'
   ORDER BY opened_at DESC LIMIT 1;

  INSERT INTO public.pharmacy_returns
    (clinic_id, original_sale_id, shift_id, motivo, refund_method, total_refund, authorized_by, created_by)
  VALUES
    (v_clinic, v_sale.id, v_shift_id,
     COALESCE(NULLIF(p_payload->>'motivo',''),'Sin motivo especificado'),
     v_refund_meth, 0, v_authorized, v_user)
  RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    SELECT psi.* INTO v_si
      FROM public.pharmacy_sale_items psi
     WHERE psi.id = (v_item->>'sale_item_id')::uuid;

    v_qty := (v_item->>'quantity')::int;
    v_item_sub := ROUND(v_qty * v_si.unit_price, 2);
    v_total    := v_total + v_item_sub;

    INSERT INTO public.pharmacy_return_items
      (return_id, sale_item_id, medicamento_id, lote_id, quantity, unit_price, subtotal)
    VALUES
      (v_return_id, v_si.id, v_si.medicamento_id, v_si.lote_id, v_qty, v_si.unit_price, v_item_sub);

    IF v_si.lote_id IS NOT NULL THEN
      UPDATE public.lotes_medicamento
         SET existencia = existencia + v_qty
       WHERE id = v_si.lote_id;

      INSERT INTO public.movimientos_inventario
        (medicamento_id, lote_id, tipo, cantidad, motivo, created_by)
      VALUES
        (v_si.medicamento_id, v_si.lote_id, 'entrada_devolucion',
         v_qty, 'Devolución ref ' || v_return_id::text, v_user);
    END IF;
  END LOOP;

  UPDATE public.pharmacy_returns SET total_refund = v_total WHERE id = v_return_id;

  IF v_refund_meth = 'efectivo' AND v_shift_id IS NOT NULL AND v_total > 0 THEN
    INSERT INTO public.fondos_movimientos
      (clinic_id, pharmacy_shift_id, tipo, monto, motivo, registrado_by)
    VALUES
      (v_clinic, v_shift_id, 'egreso', v_total,
       'Reembolso devolución ' || v_return_id::text, v_user);
  END IF;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'crear', 'pharmacy_returns', v_return_id,
          jsonb_build_object('event','pharmacy_return_created',
                             'original_sale_id', v_sale.id,
                             'total_refund', v_total,
                             'refund_method', v_refund_meth,
                             'authorized_by', v_authorized),
          v_clinic);

  RETURN v_return_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.pharmacy_register_return(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_register_return(jsonb) TO authenticated;
