-- supabase/migrations/20260723100000_trazabilidad_raiz.sql

CREATE OR REPLACE FUNCTION public._contab_trazar_usuario(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN p_user_id IS NULL THEN NULL ELSE
    jsonb_build_object('user_id', p_user_id, 'nombre', COALESCE(p.full_name, 'Usuario'))
  END
  FROM (SELECT p_user_id AS uid) u
  LEFT JOIN public.profiles p ON p.id = u.uid;
$$;

REVOKE EXECUTE ON FUNCTION public._contab_trazar_usuario(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._contab_trazar_usuario(uuid) TO authenticated;
-- ALTER DEFAULT PRIVILEGES en este proyecto otorga EXECUTE directo a anon (no via PUBLIC) — revoke explícito requerido.
REVOKE EXECUTE ON FUNCTION public._contab_trazar_usuario(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public._contab_trazar_raiz(p_tipo text, p_id uuid)
RETURNS TABLE(tipo text, id uuid, clinic_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text := p_tipo;
  v_id uuid := p_id;
  v_next_tipo text;
  v_next_id uuid;
BEGIN
  IF p_id IS NULL THEN
    RETURN;
  END IF;

  LOOP
    v_next_tipo := NULL;
    v_next_id := NULL;

    CASE v_tipo
      WHEN 'cotizacion' THEN
        SELECT solicitud_compra_id INTO v_next_id FROM public.cotizaciones c WHERE c.id = v_id;
        IF v_next_id IS NOT NULL THEN v_next_tipo := 'solicitud_compra'; END IF;
      WHEN 'orden_compra' THEN
        SELECT solicitud_id INTO v_next_id FROM public.ordenes_compra oc WHERE oc.id = v_id;
        IF v_next_id IS NOT NULL THEN v_next_tipo := 'solicitud_compra'; END IF;
      WHEN 'recepcion_mercancia' THEN
        SELECT orden_id INTO v_next_id FROM public.recepciones_mercancia rm WHERE rm.id = v_id;
        IF v_next_id IS NOT NULL THEN v_next_tipo := 'orden_compra'; END IF;
      WHEN 'factura_proveedor' THEN
        SELECT solicitud_id INTO v_next_id FROM public.facturas_proveedor fp WHERE fp.id = v_id;
        IF v_next_id IS NOT NULL THEN v_next_tipo := 'solicitud_compra'; END IF;
      WHEN 'pago_proveedor' THEN
        SELECT factura_id INTO v_next_id FROM public.pagos_proveedor pp WHERE pp.id = v_id;
        IF v_next_id IS NOT NULL THEN v_next_tipo := 'factura_proveedor'; END IF;
      WHEN 'appointment_insumo' THEN
        SELECT appointment_id INTO v_next_id FROM public.appointment_insumos ai WHERE ai.id = v_id;
        IF v_next_id IS NOT NULL THEN v_next_tipo := 'appointment'; END IF;
      WHEN 'movimiento_caja' THEN
        SELECT appointment_id INTO v_next_id FROM public.movimientos m WHERE m.id = v_id;
        IF v_next_id IS NOT NULL THEN v_next_tipo := 'appointment'; END IF;
      WHEN 'cfdi_documento' THEN
        -- appointment_id tiene prioridad; si es null se intenta sale_id
        SELECT
          CASE WHEN cd.appointment_id IS NOT NULL THEN cd.appointment_id ELSE cd.sale_id END,
          CASE WHEN cd.appointment_id IS NOT NULL THEN 'appointment' ELSE 'pharmacy_sale' END
        INTO v_next_id, v_next_tipo
        FROM public.cfdi_documentos cd WHERE cd.id = v_id;
      WHEN 'loyalty_movimiento' THEN
        SELECT pharmacy_sale_id INTO v_next_id FROM public.loyalty_movimientos lm WHERE lm.id = v_id;
        IF v_next_id IS NOT NULL THEN v_next_tipo := 'pharmacy_sale'; END IF;
      ELSE
        -- solicitud_compra, appointment, pharmacy_sale, honorario, honorario_pago_manual:
        -- ya son raíz, no tienen ancestro conocido.
        v_next_tipo := NULL;
    END CASE;

    EXIT WHEN v_next_tipo IS NULL OR v_next_id IS NULL;
    v_tipo := v_next_tipo;
    v_id := v_next_id;
  END LOOP;

  RETURN QUERY
  SELECT v_tipo, v_id,
    CASE v_tipo
      WHEN 'solicitud_compra' THEN (SELECT sc.clinic_id FROM public.solicitudes_compra sc WHERE sc.id = v_id)
      WHEN 'orden_compra' THEN (SELECT oc.clinic_id FROM public.ordenes_compra oc WHERE oc.id = v_id)
      WHEN 'recepcion_mercancia' THEN (SELECT rm.clinic_id FROM public.recepciones_mercancia rm WHERE rm.id = v_id)
      WHEN 'factura_proveedor' THEN (SELECT fp.clinic_id FROM public.facturas_proveedor fp WHERE fp.id = v_id)
      WHEN 'pago_proveedor' THEN (SELECT pp.clinic_id FROM public.pagos_proveedor pp WHERE pp.id = v_id)
      WHEN 'appointment' THEN (SELECT a.clinic_id FROM public.appointments a WHERE a.id = v_id)
      WHEN 'pharmacy_sale' THEN (SELECT ps.clinic_id FROM public.pharmacy_sales ps WHERE ps.id = v_id)
      ELSE NULL
    END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._contab_trazar_raiz(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._contab_trazar_raiz(text, uuid) TO authenticated;
-- ALTER DEFAULT PRIVILEGES en este proyecto otorga EXECUTE directo a anon (no via PUBLIC) — revoke explícito requerido.
REVOKE EXECUTE ON FUNCTION public._contab_trazar_raiz(text, uuid) FROM anon;
