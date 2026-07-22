-- supabase/migrations/20260723110000_trazabilidad_nodo.sql

CREATE OR REPLACE FUNCTION public._contab_trazar_nodo(p_tipo text, p_id uuid, p_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_node jsonb;
  v_hijos jsonb := '[]'::jsonb;
  v_poliza_id uuid;
  v_poliza record;
  v_row record;
BEGIN
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('tipo','HUECO','mensaje','id nulo para tipo '||p_tipo);
  END IF;

  CASE p_tipo

    WHEN 'solicitud_compra' THEN
      SELECT sc.folio, sc.fecha_solicitud, sc.estatus,
             sc.solicitante_id, sc.aprobador_id, sc.orden_compra_id
      INTO v_row FROM public.solicitudes_compra sc
      WHERE sc.id = p_id AND sc.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Solicitud no encontrada'); END IF;

      -- una solicitud puede tener varias cotizaciones; solo la seleccionada avanza
      FOR v_row IN
        SELECT id FROM public.cotizaciones
        WHERE solicitud_compra_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('cotizacion', v_row.id, p_clinic_id));
      END LOOP;

      IF jsonb_array_length(v_hijos) = 0 THEN
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Sin cotizaciones registradas aún'));
      END IF;

      SELECT sc.folio, sc.fecha_solicitud AS fecha, sc.estatus AS estado,
             sc.solicitante_id, sc.aprobador_id
      INTO v_row FROM public.solicitudes_compra sc WHERE sc.id = p_id;

      v_node := jsonb_build_object(
        'tipo','solicitud_compra','id',p_id,'folio',v_row.folio,'fecha',v_row.fecha,
        'monto_centavos', NULL, 'estado', v_row.estado,
        'creado_por', public._contab_trazar_usuario(v_row.solicitante_id),
        'autorizado_por', public._contab_trazar_usuario(v_row.aprobador_id),
        'hijos', v_hijos
      );
      RETURN v_node;

    WHEN 'cotizacion' THEN
      SELECT c.folio, c.fecha_cotizacion AS fecha, c.total_centavos, c.created_by, c.orden_compra_id
      INTO v_row FROM public.cotizaciones c
      WHERE c.id = p_id AND c.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Cotización no encontrada'); END IF;

      IF v_row.orden_compra_id IS NOT NULL THEN
        v_hijos := jsonb_build_array(public._contab_trazar_nodo('orden_compra', v_row.orden_compra_id, p_clinic_id));
      ELSE
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Cotización aún no genera orden de compra'));
      END IF;

      RETURN jsonb_build_object(
        'tipo','cotizacion','id',p_id,'folio',v_row.folio,'fecha',v_row.fecha,
        'monto_centavos', v_row.total_centavos, 'estado', NULL,
        'creado_por', public._contab_trazar_usuario(v_row.created_by),
        'autorizado_por', NULL,
        'hijos', v_hijos
      );

    WHEN 'orden_compra' THEN
      SELECT oc.folio, oc.fecha_emision AS fecha, oc.total_centavos, oc.estatus,
             oc.created_by, oc.aprobada_by
      INTO v_row FROM public.ordenes_compra oc
      WHERE oc.id = p_id AND oc.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Orden de compra no encontrada'); END IF;

      v_hijos := '[]'::jsonb;
      FOR v_row IN
        SELECT id FROM public.recepciones_mercancia
        WHERE orden_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('recepcion_mercancia', v_row.id, p_clinic_id));
      END LOOP;
      IF jsonb_array_length(v_hijos) = 0 THEN
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Sin recepción de mercancía aún'));
      END IF;

      SELECT oc.folio, oc.fecha_emision AS fecha, oc.total_centavos, oc.estatus,
             oc.created_by, oc.aprobada_by
      INTO v_row FROM public.ordenes_compra oc WHERE oc.id = p_id;

      RETURN jsonb_build_object(
        'tipo','orden_compra','id',p_id,'folio',v_row.folio,'fecha',v_row.fecha,
        'monto_centavos', v_row.total_centavos, 'estado', v_row.estatus,
        'creado_por', public._contab_trazar_usuario(v_row.created_by),
        'autorizado_por', public._contab_trazar_usuario(v_row.aprobada_by),
        'hijos', v_hijos
      );

    WHEN 'recepcion_mercancia' THEN
      SELECT rm.folio_recepcion, rm.fecha_recepcion AS fecha, rm.estatus, rm.recibido_por
      INTO v_row FROM public.recepciones_mercancia rm
      WHERE rm.id = p_id AND rm.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Recepción no encontrada'); END IF;

      v_hijos := '[]'::jsonb;
      FOR v_row IN
        SELECT id FROM public.facturas_proveedor
        WHERE recepcion_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('factura_proveedor', v_row.id, p_clinic_id));
      END LOOP;
      IF jsonb_array_length(v_hijos) = 0 THEN
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Sin factura de proveedor registrada aún'));
      END IF;

      SELECT rm.folio_recepcion, rm.fecha_recepcion AS fecha, rm.estatus, rm.recibido_por
      INTO v_row FROM public.recepciones_mercancia rm WHERE rm.id = p_id;

      RETURN jsonb_build_object(
        'tipo','recepcion_mercancia','id',p_id,'folio',v_row.folio_recepcion,'fecha',v_row.fecha,
        'monto_centavos', NULL, 'estado', v_row.estatus,
        'creado_por', public._contab_trazar_usuario(v_row.recibido_por),
        'autorizado_por', NULL,
        'hijos', v_hijos
      );

    WHEN 'factura_proveedor' THEN
      SELECT fp.folio_interno, fp.fecha_factura AS fecha, fp.total_centavos, fp.estatus, fp.created_by
      INTO v_row FROM public.facturas_proveedor fp
      WHERE fp.id = p_id AND fp.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Factura no encontrada'); END IF;

      v_hijos := '[]'::jsonb;
      -- póliza de devengo (reference_type='factura_proveedor')
      SELECT id INTO v_poliza_id FROM public.polizas
      WHERE reference_type='factura_proveedor' AND reference_id = p_id AND clinic_id = p_clinic_id
      LIMIT 1;
      IF v_poliza_id IS NOT NULL THEN
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('poliza', v_poliza_id, p_clinic_id));
      ELSE
        v_hijos := v_hijos || jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Factura sin póliza de devengo generada'));
      END IF;

      FOR v_row IN
        SELECT id FROM public.pagos_proveedor
        WHERE factura_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('pago_proveedor', v_row.id, p_clinic_id));
      END LOOP;

      SELECT fp.folio_interno, fp.fecha_factura AS fecha, fp.total_centavos, fp.estatus, fp.created_by
      INTO v_row FROM public.facturas_proveedor fp WHERE fp.id = p_id;

      RETURN jsonb_build_object(
        'tipo','factura_proveedor','id',p_id,'folio',v_row.folio_interno,'fecha',v_row.fecha,
        'monto_centavos', v_row.total_centavos, 'estado', v_row.estatus,
        'creado_por', public._contab_trazar_usuario(v_row.created_by),
        'autorizado_por', NULL,
        'hijos', v_hijos
      );

    WHEN 'pago_proveedor' THEN
      SELECT pp.monto_centavos, pp.fecha_pago AS fecha, pp.registrado_por
      INTO v_row FROM public.pagos_proveedor pp
      WHERE pp.id = p_id AND pp.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Pago no encontrado'); END IF;

      SELECT id INTO v_poliza_id FROM public.polizas
      WHERE reference_type='factura_proveedor_pago' AND reference_id = p_id AND clinic_id = p_clinic_id
      LIMIT 1;
      IF v_poliza_id IS NOT NULL THEN
        v_hijos := jsonb_build_array(public._contab_trazar_nodo('poliza', v_poliza_id, p_clinic_id));
      ELSE
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Pago sin póliza generada'));
      END IF;

      RETURN jsonb_build_object(
        'tipo','pago_proveedor','id',p_id,'folio',NULL,'fecha',v_row.fecha,
        'monto_centavos', v_row.monto_centavos, 'estado', NULL,
        'creado_por', public._contab_trazar_usuario(v_row.registrado_por),
        'autorizado_por', NULL,
        'hijos', v_hijos
      );

    WHEN 'poliza' THEN
      SELECT pz.folio, pz.fecha, pz.estado, pz.created_by,
             (SELECT COALESCE(sum(debe_centavos),0) FROM public.poliza_partidas WHERE poliza_id = pz.id) AS monto
      INTO v_row FROM public.polizas pz
      WHERE pz.id = p_id AND pz.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Póliza no encontrada'); END IF;

      v_hijos := '[]'::jsonb;
      FOR v_row IN
        SELECT ec.id FROM public.contab_estados_cuenta ec
        JOIN public.poliza_partidas ppd ON ppd.id = ec.poliza_partida_id
        WHERE ppd.poliza_id = p_id AND ec.clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(jsonb_build_object(
          'tipo','conciliacion_bancaria','id',v_row.id,'folio',NULL,'fecha',NULL,
          'monto_centavos', NULL, 'estado','conciliado','creado_por',NULL,'autorizado_por',NULL,'hijos','[]'::jsonb
        ));
      END LOOP;
      IF jsonb_array_length(v_hijos) = 0 THEN
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Aún no conciliado con banco'));
      END IF;

      SELECT pz.folio, pz.fecha, pz.estado, pz.created_by
      INTO v_row FROM public.polizas pz WHERE pz.id = p_id;

      RETURN jsonb_build_object(
        'tipo','poliza','id',p_id,'folio',v_row.folio,'fecha',v_row.fecha,
        'monto_centavos', NULL, 'estado', v_row.estado,
        'creado_por', public._contab_trazar_usuario(v_row.created_by),
        'autorizado_por', NULL,
        'hijos', v_hijos
      );

    WHEN 'appointment' THEN
      SELECT a.created_at::date AS fecha
      INTO v_row FROM public.appointments a
      WHERE a.id = p_id AND a.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Cita no encontrada'); END IF;

      v_hijos := '[]'::jsonb;
      FOR v_row IN
        SELECT id FROM public.appointment_insumos WHERE appointment_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('appointment_insumo', v_row.id, p_clinic_id));
      END LOOP;
      FOR v_row IN
        SELECT id FROM public.movimientos WHERE appointment_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('movimiento_caja', v_row.id, p_clinic_id));
      END LOOP;
      FOR v_row IN
        SELECT id FROM public.cfdi_documentos WHERE appointment_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('cfdi_documento', v_row.id, p_clinic_id));
      END LOOP;
      -- honorario: doctor_honorarios_detalle es VISTA agregada por cita, sin id propio
      IF EXISTS (SELECT 1 FROM public.doctor_honorarios_detalle WHERE appointment_id = p_id) THEN
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('honorario', p_id, p_clinic_id));
      END IF;

      RETURN jsonb_build_object(
        'tipo','appointment','id',p_id,'folio',NULL,'fecha',v_row.fecha,
        'monto_centavos', NULL, 'estado', NULL,
        'creado_por', NULL, 'autorizado_por', NULL,
        'hijos', v_hijos
      );

    WHEN 'appointment_insumo' THEN
      SELECT ai.cantidad, ai.costo_unitario_centavos, ai.user_id, ai.created_at::date AS fecha
      INTO v_row FROM public.appointment_insumos ai
      WHERE ai.id = p_id AND ai.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Insumo no encontrado'); END IF;

      SELECT id INTO v_poliza_id FROM public.polizas
      WHERE reference_type='appointment_insumo' AND reference_id = p_id AND clinic_id = p_clinic_id LIMIT 1;
      IF v_poliza_id IS NOT NULL THEN
        v_hijos := jsonb_build_array(public._contab_trazar_nodo('poliza', v_poliza_id, p_clinic_id));
      ELSE
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Insumo sin póliza generada'));
      END IF;

      RETURN jsonb_build_object(
        'tipo','appointment_insumo','id',p_id,'folio',NULL,'fecha',v_row.fecha,
        'monto_centavos', v_row.cantidad * v_row.costo_unitario_centavos, 'estado', NULL,
        'creado_por', public._contab_trazar_usuario(v_row.user_id),
        'autorizado_por', NULL, 'hijos', v_hijos
      );

    WHEN 'honorario' THEN
      -- p_id aquí es el appointment_id (ver nota en _contab_trazar_raiz)
      SELECT id INTO v_poliza_id FROM public.polizas
      WHERE reference_type='honorario_appointment' AND reference_id = p_id AND clinic_id = p_clinic_id LIMIT 1;
      IF v_poliza_id IS NOT NULL THEN
        v_hijos := jsonb_build_array(public._contab_trazar_nodo('poliza', v_poliza_id, p_clinic_id));
      ELSE
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Honorario sin póliza generada'));
      END IF;

      RETURN jsonb_build_object(
        'tipo','honorario','id',p_id,'folio',NULL,'fecha',NULL,
        'monto_centavos', NULL, 'estado', NULL,
        'creado_por', NULL, 'autorizado_por', NULL, 'hijos', v_hijos
      );

    WHEN 'movimiento_caja' THEN
      SELECT m.total, m.cajero_user_id, m.created_at::date AS fecha, m.folio
      INTO v_row FROM public.movimientos m
      WHERE m.id = p_id AND m.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Movimiento de caja no encontrado'); END IF;

      SELECT id INTO v_poliza_id FROM public.polizas
      WHERE reference_type='movimiento_caja' AND reference_id = p_id AND clinic_id = p_clinic_id LIMIT 1;
      IF v_poliza_id IS NOT NULL THEN
        v_hijos := jsonb_build_array(public._contab_trazar_nodo('poliza', v_poliza_id, p_clinic_id));
      ELSE
        v_hijos := jsonb_build_array(jsonb_build_object('tipo','HUECO','mensaje','Movimiento sin póliza generada'));
      END IF;

      RETURN jsonb_build_object(
        'tipo','movimiento_caja','id',p_id,'folio',v_row.folio,'fecha',v_row.fecha,
        'monto_centavos', round(v_row.total*100), 'estado', NULL,
        'creado_por', public._contab_trazar_usuario(v_row.cajero_user_id),
        'autorizado_por', NULL, 'hijos', v_hijos
      );

    WHEN 'pharmacy_sale' THEN
      SELECT ps.total, ps.created_by, ps.created_at::date AS fecha
      INTO v_row FROM public.pharmacy_sales ps
      WHERE ps.id = p_id AND ps.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Venta no encontrada'); END IF;

      v_hijos := '[]'::jsonb;
      FOR v_row IN
        SELECT id FROM public.loyalty_movimientos WHERE pharmacy_sale_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('loyalty_movimiento', v_row.id, p_clinic_id));
      END LOOP;
      FOR v_row IN
        SELECT id FROM public.cfdi_documentos WHERE sale_id = p_id AND clinic_id = p_clinic_id
      LOOP
        v_hijos := v_hijos || jsonb_build_array(public._contab_trazar_nodo('cfdi_documento', v_row.id, p_clinic_id));
      END LOOP;
      -- Limitación conocida: sin FK de movimientos(caja) hacia pharmacy_sales,
      -- no se puede ligar la venta POS a su póliza automáticamente.
      v_hijos := v_hijos || jsonb_build_array(jsonb_build_object(
        'tipo','HUECO',
        'mensaje','Venta POS no se puede ligar a su póliza (sin FK movimientos→pharmacy_sales) — ver limitación conocida en memoria del módulo contable'
      ));

      SELECT ps.total, ps.created_by, ps.created_at::date AS fecha
      INTO v_row FROM public.pharmacy_sales ps WHERE ps.id = p_id;

      RETURN jsonb_build_object(
        'tipo','pharmacy_sale','id',p_id,'folio',NULL,'fecha',v_row.fecha,
        'monto_centavos', round(v_row.total*100), 'estado', NULL,
        'creado_por', public._contab_trazar_usuario(v_row.created_by),
        'autorizado_por', NULL, 'hijos', v_hijos
      );

    WHEN 'loyalty_movimiento' THEN
      SELECT lm.tipo, lm.puntos, lm.created_by, lm.created_at::date AS fecha
      INTO v_row FROM public.loyalty_movimientos lm
      WHERE lm.id = p_id AND lm.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','Movimiento de lealtad no encontrado'); END IF;

      RETURN jsonb_build_object(
        'tipo','loyalty_movimiento','id',p_id,'folio',NULL,'fecha',v_row.fecha,
        'monto_centavos', NULL, 'estado', v_row.tipo,
        'creado_por', public._contab_trazar_usuario(v_row.created_by),
        'autorizado_por', NULL, 'hijos', '[]'::jsonb
      );

    WHEN 'cfdi_documento' THEN
      SELECT cd.folio, cd.fecha_emision::date AS fecha, cd.total, cd.status
      INTO v_row FROM public.cfdi_documentos cd
      WHERE cd.id = p_id AND cd.clinic_id = p_clinic_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('tipo','HUECO','mensaje','CFDI no encontrado'); END IF;

      RETURN jsonb_build_object(
        'tipo','cfdi_documento','id',p_id,'folio',v_row.folio,'fecha',v_row.fecha,
        'monto_centavos', round(v_row.total*100), 'estado', v_row.status,
        'creado_por', NULL, 'autorizado_por', NULL, 'hijos', '[]'::jsonb
      );

    ELSE
      RETURN jsonb_build_object('tipo','HUECO','mensaje','Tipo de nodo desconocido: '||p_tipo);
  END CASE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._contab_trazar_nodo(text, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._contab_trazar_nodo(text, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._contab_trazar_nodo(text, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.contab_trazar(p_tipo text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raiz record;
BEGIN
  SELECT * INTO v_raiz FROM public._contab_trazar_raiz(p_tipo, p_id);
  IF NOT FOUND OR v_raiz.clinic_id IS NULL THEN
    RETURN jsonb_build_object('tipo','HUECO','mensaje','No se encontró el registro solicitado');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships cm
    WHERE cm.user_id = auth.uid() AND cm.clinic_id = v_raiz.clinic_id
  ) THEN
    RAISE EXCEPTION 'Sin acceso a esta clínica';
  END IF;

  RETURN public._contab_trazar_nodo(v_raiz.tipo, v_raiz.id, v_raiz.clinic_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.contab_trazar(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.contab_trazar(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.contab_trazar(text, uuid) TO authenticated;
