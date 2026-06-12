-- Task 4: Flujo completo de devoluciones en farmacia

-- Tabla cabecera de devolución
CREATE TABLE IF NOT EXISTS public.pharmacy_returns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid NOT NULL,
  original_sale_id uuid NOT NULL REFERENCES public.pharmacy_sales(id),
  shift_id        uuid REFERENCES public.pharmacy_cash_shifts(id),
  motivo          text NOT NULL,
  refund_method   text NOT NULL CHECK (refund_method IN ('efectivo','tarjeta','transferencia','sin_reembolso')),
  total_refund    numeric(12,2) NOT NULL DEFAULT 0,
  authorized_by   uuid NOT NULL REFERENCES auth.users(id),
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.pharmacy_returns TO authenticated;
GRANT ALL ON public.pharmacy_returns TO service_role;
ALTER TABLE public.pharmacy_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage pharmacy_returns" ON public.pharmacy_returns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'nurse') OR
         public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'nurse') OR
              public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY multiclinic_returns ON public.pharmacy_returns
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id));

-- Tabla líneas de devolución
CREATE TABLE IF NOT EXISTS public.pharmacy_return_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id       uuid NOT NULL REFERENCES public.pharmacy_returns(id) ON DELETE CASCADE,
  sale_item_id    uuid NOT NULL REFERENCES public.pharmacy_sale_items(id),
  medicamento_id  uuid NOT NULL REFERENCES public.medicamentos(id),
  lote_id         uuid REFERENCES public.lotes_medicamento(id),
  quantity        integer NOT NULL CHECK (quantity > 0),
  unit_price      numeric(10,2) NOT NULL DEFAULT 0,
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.pharmacy_return_items TO authenticated;
GRANT ALL ON public.pharmacy_return_items TO service_role;
ALTER TABLE public.pharmacy_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage pharmacy_return_items" ON public.pharmacy_return_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'nurse') OR
         public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'manager'));

-- RPC: pharmacy_register_return
-- Payload: {clinic_id, sale_id, motivo, refund_method, authorized_by, items:[{sale_item_id, quantity}]}
CREATE OR REPLACE FUNCTION public.pharmacy_register_return(p_payload jsonb)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user         uuid := auth.uid();
  v_clinic       uuid;
  v_sale         record;
  v_return_id    uuid;
  v_shift_id     uuid;
  v_total        numeric(12,2) := 0;
  v_authorized   uuid;
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

  -- Autorización de gerente obligatoria
  v_authorized := NULLIF(p_payload->>'authorized_by','')::uuid;
  IF v_authorized IS NULL THEN
    RAISE EXCEPTION 'Devolución requiere UUID de gerente autorizador (authorized_by)';
  END IF;
  IF NOT (public.has_role(v_authorized,'admin') OR public.has_role(v_authorized,'manager')) THEN
    RAISE EXCEPTION 'Solo admin/gerente puede autorizar devoluciones';
  END IF;

  v_clinic := NULLIF(p_payload->>'clinic_id','')::uuid;
  IF v_clinic IS NULL THEN RAISE EXCEPTION 'clinic_id requerido'; END IF;

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

  -- Validar cada ítem antes de procesar
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

    -- Verificar que no se devuelva más de lo vendido (contando devoluciones previas)
    SELECT COALESCE(SUM(pri.quantity),0) INTO v_already_ret
      FROM public.pharmacy_return_items pri
      JOIN public.pharmacy_returns pr ON pr.id = pri.return_id
     WHERE pri.sale_item_id = v_si.id;

    IF v_already_ret + v_qty > v_si.quantity THEN
      RAISE EXCEPTION 'Devolución excede cantidad vendida para ítem % (vendido: %, ya devuelto: %, solicitado: %)',
        v_si.medicamento_id, v_si.quantity, v_already_ret, v_qty;
    END IF;
  END LOOP;

  -- Turno actual del cajero
  SELECT id INTO v_shift_id
    FROM public.pharmacy_cash_shifts
   WHERE cashier_user_id = v_user AND clinic_id = v_clinic AND status = 'open'
   ORDER BY opened_at DESC LIMIT 1;

  -- Cabecera de devolución
  INSERT INTO public.pharmacy_returns
    (clinic_id, original_sale_id, shift_id, motivo, refund_method, total_refund, authorized_by, created_by)
  VALUES
    (v_clinic, v_sale.id, v_shift_id,
     COALESCE(NULLIF(p_payload->>'motivo',''),'Sin motivo especificado'),
     v_refund_meth, 0, v_authorized, v_user)
  RETURNING id INTO v_return_id;

  -- Procesar ítems
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

    -- Re-acreditar inventario en el lote original
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

  -- Actualizar total en cabecera
  UPDATE public.pharmacy_returns SET total_refund = v_total WHERE id = v_return_id;

  -- Egreso de fondo si el reembolso es en efectivo
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

GRANT EXECUTE ON FUNCTION public.pharmacy_register_return(jsonb) TO authenticated;
