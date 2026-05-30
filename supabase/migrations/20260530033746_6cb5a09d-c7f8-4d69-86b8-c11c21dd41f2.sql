
ALTER TYPE public.movimiento_tipo ADD VALUE IF NOT EXISTS 'salida_venta';
ALTER TYPE public.movimiento_tipo ADD VALUE IF NOT EXISTS 'salida_surtido_receta';
ALTER TYPE public.movimiento_tipo ADD VALUE IF NOT EXISTS 'cancelacion';

ALTER TABLE public.medicamentos
  ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT 'otc',
  ADD COLUMN IF NOT EXISTS is_controlled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_prescription boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_retained_prescription boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_special_prescription boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_direct_sale boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS regulatory_notes text;

ALTER TABLE public.medicamentos
  DROP CONSTRAINT IF EXISTS medicamentos_sale_type_check;
ALTER TABLE public.medicamentos
  ADD CONSTRAINT medicamentos_sale_type_check
  CHECK (sale_type IN ('otc','receta_requerida','receta_retenida','controlado','no_medicamento'));

ALTER TABLE public.lotes_medicamento
  ADD COLUMN IF NOT EXISTS clinic_id uuid NOT NULL DEFAULT '106cc686-a333-4ec1-83ea-84eaafbf2e90'::uuid,
  ADD COLUMN IF NOT EXISTS fecha_entrada timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS costo_unitario numeric(10,2);

CREATE INDEX IF NOT EXISTS idx_lotes_fifo
  ON public.lotes_medicamento(medicamento_id, fecha_entrada, fecha_caducidad)
  WHERE existencia > 0;

DROP POLICY IF EXISTS multiclinic_access_restrictive ON public.lotes_medicamento;
CREATE POLICY multiclinic_access_restrictive ON public.lotes_medicamento
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id));

ALTER TABLE public.movimientos_inventario
  ADD COLUMN IF NOT EXISTS clinic_id uuid NOT NULL DEFAULT '106cc686-a333-4ec1-83ea-84eaafbf2e90'::uuid,
  ADD COLUMN IF NOT EXISTS reference_type text,
  ADD COLUMN IF NOT EXISTS reference_id uuid;

DROP POLICY IF EXISTS multiclinic_access_restrictive ON public.movimientos_inventario;
CREATE POLICY multiclinic_access_restrictive ON public.movimientos_inventario
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id));

CREATE TABLE IF NOT EXISTS public.pharmacy_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT '106cc686-a333-4ec1-83ea-84eaafbf2e90'::uuid,
  patient_id uuid,
  customer_name text,
  prescription_id uuid,
  sale_type text NOT NULL CHECK (sale_type IN ('direct_sale','prescription_dispense')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('draft','completed','cancelled')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text,
  payment_status text NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('pending','paid','invoiced')),
  requires_invoice boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.pharmacy_sales TO authenticated;
GRANT ALL ON public.pharmacy_sales TO service_role;
ALTER TABLE public.pharmacy_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage pharmacy_sales" ON public.pharmacy_sales
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'nurse') OR public.has_role(auth.uid(),'receptionist'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'nurse') OR public.has_role(auth.uid(),'receptionist'));

CREATE POLICY multiclinic_access_restrictive ON public.pharmacy_sales
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id));

CREATE TRIGGER trg_pharmacy_sales_updated_at
  BEFORE UPDATE ON public.pharmacy_sales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pharmacy_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.pharmacy_sales(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL DEFAULT '106cc686-a333-4ec1-83ea-84eaafbf2e90'::uuid,
  medicamento_id uuid NOT NULL REFERENCES public.medicamentos(id),
  lote_id uuid REFERENCES public.lotes_medicamento(id),
  prescription_item_id uuid,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.pharmacy_sale_items TO authenticated;
GRANT ALL ON public.pharmacy_sale_items TO service_role;
ALTER TABLE public.pharmacy_sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read sale_items" ON public.pharmacy_sale_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'nurse') OR public.has_role(auth.uid(),'receptionist'));

CREATE POLICY "Staff insert sale_items" ON public.pharmacy_sale_items
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'nurse') OR public.has_role(auth.uid(),'receptionist'));

CREATE POLICY multiclinic_access_restrictive ON public.pharmacy_sale_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id));

CREATE INDEX IF NOT EXISTS idx_pharmacy_sale_items_sale ON public.pharmacy_sale_items(sale_id);

CREATE OR REPLACE FUNCTION public.pharmacy_register_sale(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'nurse') OR public.has_role(v_user,'receptionist')) THEN
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    SELECT * INTO v_med FROM public.medicamentos WHERE id = (v_item->>'medicamento_id')::uuid;
    IF v_med IS NULL THEN
      RAISE EXCEPTION 'Medicamento no encontrado';
    END IF;
    IF v_med.activo = false THEN
      RAISE EXCEPTION 'Medicamento % está inactivo', v_med.nombre;
    END IF;

    v_qty := (v_item->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para %', v_med.nombre;
    END IF;

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
     WHERE medicamento_id = v_med.id
       AND existencia >= v_qty
       AND fecha_caducidad >= CURRENT_DATE
     ORDER BY fecha_entrada ASC, fecha_caducidad ASC
     LIMIT 1;

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
     status, payment_method, payment_status, requires_invoice, notes, discount, created_by)
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
     v_user)
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
       WHERE medicamento_id = v_med.id
         AND existencia >= v_qty
         AND fecha_caducidad >= CURRENT_DATE
       ORDER BY fecha_entrada ASC, fecha_caducidad ASC
       LIMIT 1;
    END IF;

    UPDATE public.lotes_medicamento
       SET existencia = existencia - v_qty
     WHERE id = v_pick_lote;

    INSERT INTO public.pharmacy_sale_items
      (sale_id, clinic_id, medicamento_id, lote_id, prescription_item_id,
       quantity, unit_price, discount, subtotal)
    VALUES
      (v_sale_id, v_clinic, v_med.id, v_pick_lote,
       NULLIF(v_item->>'prescription_item_id','')::uuid,
       v_qty, v_unit, v_idisc, v_isubtotal);

    INSERT INTO public.movimientos_inventario
      (medicamento_id, lote_id, tipo, cantidad, motivo,
       created_by, clinic_id, reference_type, reference_id)
    VALUES
      (v_med.id, v_pick_lote, v_mov_type, v_qty,
       CASE WHEN v_sale_type='direct_sale' THEN 'Venta directa' ELSE 'Surtido de receta' END,
       v_user, v_clinic, 'pharmacy_sale', v_sale_id);

    v_subtotal := v_subtotal + (v_qty * v_unit);
  END LOOP;

  v_total := v_subtotal - v_discount;

  UPDATE public.pharmacy_sales
     SET subtotal = v_subtotal,
         total = v_total
   WHERE id = v_sale_id;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'crear', 'pharmacy_sales', v_sale_id,
          jsonb_build_object('event','pharmacy_sale_created','sale_type',v_sale_type,
                             'total',v_total,'items',jsonb_array_length(p_payload->'items')),
          v_clinic);

  RETURN v_sale_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_register_sale(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.pharmacy_register_sale(jsonb) TO authenticated;
