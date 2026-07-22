-- supabase/scripts/test-trazabilidad-manual.sql
-- Ejecutar con: supabase db query --linked --file supabase/scripts/test-trazabilidad-manual.sql
-- Todo dentro de una transacción con ROLLBACK: no persiste nada.

BEGIN;

DO $$
DECLARE
  v_clinic_id uuid;
  v_user_id uuid;
  v_proveedor_id uuid;
  v_solicitud_id uuid;
  v_cotizacion_id uuid;
  v_orden_id uuid;
  v_recepcion_id uuid;
  v_factura_id uuid;
  v_pago_id uuid;
  v_poliza_id uuid;
  v_arbol jsonb;
  v_niveles int;
BEGIN
  -- Necesitamos una clínica y un usuario con membresía real en ella, para que
  -- auth.uid() (simulado vía request.jwt.claims) pase el check de acceso
  -- dentro de contab_trazar/contab_trazar_proveedor.
  SELECT cm.clinic_id, cm.user_id INTO v_clinic_id, v_user_id
    FROM public.clinic_memberships cm LIMIT 1;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_id, 'role', 'authenticated')::text, true);

  INSERT INTO public.proveedores (clinic_id, nombre) VALUES (v_clinic_id, 'PRUEBA-TRAZA')
    RETURNING id INTO v_proveedor_id;

  INSERT INTO public.solicitudes_compra (clinic_id, folio, solicitante_id, fecha_solicitud, motivo, estatus, aprobador_id, aprobado_at)
    VALUES (v_clinic_id, 'SC-TRAZA-001', auth.uid(), now(), 'prueba trazabilidad', 'aprobada', auth.uid(), now())
    RETURNING id INTO v_solicitud_id;

  INSERT INTO public.cotizaciones (clinic_id, folio, solicitud_compra_id, proveedor_id, fecha_cotizacion, total_centavos, seleccionada, created_by)
    VALUES (v_clinic_id, 'COT-TRAZA-001', v_solicitud_id, v_proveedor_id, now(), 100000, true, auth.uid())
    RETURNING id INTO v_cotizacion_id;

  INSERT INTO public.ordenes_compra (clinic_id, folio, proveedor_id, solicitud_id, cotizacion_id, estatus, fecha_emision, total_centavos, created_by, aprobada_by, aprobada_at)
    VALUES (v_clinic_id, 'OC-TRAZA-001', v_proveedor_id, v_solicitud_id, v_cotizacion_id, 'recibida', now(), 100000, auth.uid(), auth.uid(), now())
    RETURNING id INTO v_orden_id;

  UPDATE public.solicitudes_compra SET orden_compra_id = v_orden_id WHERE id = v_solicitud_id;
  UPDATE public.cotizaciones SET orden_compra_id = v_orden_id WHERE id = v_cotizacion_id;

  INSERT INTO public.recepciones_mercancia (clinic_id, orden_id, proveedor_id, folio_recepcion, fecha_recepcion, estatus, recibido_por)
    VALUES (v_clinic_id, v_orden_id, v_proveedor_id, 'REC-TRAZA-001', now(), 'verificada', auth.uid())
    RETURNING id INTO v_recepcion_id;

  INSERT INTO public.facturas_proveedor (clinic_id, proveedor_id, orden_id, recepcion_id, solicitud_id, folio_interno, fecha_factura, fecha_vencimiento, subtotal_centavos, iva_centavos, total_centavos, saldo_pendiente_centavos, estatus, created_by)
    VALUES (v_clinic_id, v_proveedor_id, v_orden_id, v_recepcion_id, v_solicitud_id, 'FAC-TRAZA-001', now(), now() + interval '30 days', 86207, 13793, 100000, 0, 'pagada', auth.uid())
    RETURNING id INTO v_factura_id;

  INSERT INTO public.pagos_proveedor (clinic_id, factura_id, proveedor_id, fecha_pago, monto_centavos, metodo_pago, registrado_por)
    VALUES (v_clinic_id, v_factura_id, v_proveedor_id, now(), 100000, 'transferencia', auth.uid())
    RETURNING id INTO v_pago_id;

  -- Póliza simulada, ligada al pago (normalmente la generaría el trigger real)
  INSERT INTO public.polizas (clinic_id, folio, tipo, fecha, concepto, reference_type, reference_id, evento, estado, created_by)
    VALUES (v_clinic_id, 99901, 'egreso', now(), 'Pago PRUEBA-TRAZA', 'factura_proveedor_pago', v_pago_id, 'registro', 'contabilizada', auth.uid())
    RETURNING id INTO v_poliza_id;

  -- Verificación 1: trazar desde el pago debe subir hasta la solicitud
  v_arbol := public.contab_trazar('pago_proveedor', v_pago_id);
  IF v_arbol->>'tipo' <> 'solicitud_compra' THEN
    RAISE EXCEPTION 'FALLO: se esperaba raíz solicitud_compra, se obtuvo %', v_arbol->>'tipo';
  END IF;
  IF v_arbol->>'id' <> v_solicitud_id::text THEN
    RAISE EXCEPTION 'FALLO: raíz no es la solicitud creada en la prueba';
  END IF;
  RAISE NOTICE 'OK: contab_trazar desde pago sube correctamente a solicitud_compra';

  -- Verificación 2: trazar desde la solicitud debe bajar hasta la póliza
  v_arbol := public.contab_trazar('solicitud_compra', v_solicitud_id);
  IF v_arbol #>> '{hijos,0,hijos,0,hijos,0,hijos,0,hijos,0,tipo}' <> 'poliza' THEN
    RAISE EXCEPTION 'FALLO: la cadena descendente no llega a poliza. Árbol: %', v_arbol;
  END IF;
  RAISE NOTICE 'OK: contab_trazar desde solicitud baja correctamente hasta poliza';

  -- Verificación 3: contab_trazar_proveedor encuentra la cadena
  v_arbol := public.contab_trazar_proveedor(v_proveedor_id);
  IF jsonb_array_length(v_arbol) <> 1 THEN
    RAISE EXCEPTION 'FALLO: se esperaba 1 árbol para el proveedor de prueba, se obtuvieron %', jsonb_array_length(v_arbol);
  END IF;
  RAISE NOTICE 'OK: contab_trazar_proveedor devuelve la cadena esperada';

  RAISE NOTICE 'TODAS LAS VERIFICACIONES PASARON';
END;
$$;

ROLLBACK;
