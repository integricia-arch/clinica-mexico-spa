-- Fix hardcoded clinic fallback in pharmacy_register_sale.
-- Problema: COALESCE(..., '106cc686-a333-4ec1-83ea-84eaafbf2e90'::uuid)
-- silenciosamente usa clínica incorrecta si no hay patient_id ni se puede determinar clinic_id.
-- Solución: fallar explícitamente si la clínica no puede determinarse.

BEGIN;

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

  -- Resolver clinic_id: primero desde payload explícito, luego desde paciente, luego desde medicamento.
  -- Si no se puede determinar, fallar explícitamente (SIN fallback hardcodeado).
  v_clinic := NULLIF(p_payload->>'clinic_id', '')::uuid;

  IF v_clinic IS NULL THEN
    SELECT clinic_id INTO v_clinic
      FROM public.patients
     WHERE id = NULLIF(p_payload->>'patient_id','')::uuid;
  END IF;

  IF v_clinic IS NULL THEN
    SELECT clinic_id INTO v_clinic
      FROM public.medicamentos
     WHERE id = (((p_payload->'items')->0)->>'medicamento_id')::uuid;
  END IF;

  IF v_clinic IS NULL THEN
    RAISE EXCEPTION 'clinic_id requerido — no se pudo determinar la clínica para esta venta';
  END IF;

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

  -- Pre-lock todos los lotes en orden determinístico (ORDER BY id) para evitar deadlock.
  -- Se adquieren los locks ANTES de los loops de validación y actualización.
  -- Para lotes especificados explícitamente se usa el lote_id del payload.
  -- Para lotes NULL (FEFO automático) se selecciona el lote FEFO de cada medicamento.
  -- Al ordenar por id (UUID) se garantiza un orden único y consistente entre transacciones
  -- concurrentes, eliminando la posibilidad de deadlock por lock inversion.
  PERFORM id FROM public.lotes_medicamento
    WHERE id IN (
      SELECT COALESCE(
        NULLIF(v_item->>'lote_id', '')::uuid,
        (SELECT id FROM public.lotes_medicamento lm2
         WHERE lm2.medicamento_id = (v_item->>'medicamento_id')::uuid
           AND lm2.existencia >= COALESCE((v_item->>'quantity')::int, 1)
           AND lm2.fecha_caducidad >= CURRENT_DATE
         ORDER BY lm2.fecha_entrada ASC, lm2.fecha_caducidad ASC LIMIT 1)
      )
      FROM jsonb_array_elements(p_payload->'items') v_item
    )
  ORDER BY id
  FOR UPDATE;

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

COMMIT;
