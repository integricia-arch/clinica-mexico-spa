-- supabase/migrations/20260723150000_contab_trazar_consecutivo_universal_rango_fechas.sql
-- Reporte real: había 1 sola orden_compra (folio "PRUEBA-OC-20260720010619") y
-- buscar "1" no la encontraba, porque el fallback de número consecutivo solo
-- aplicaba a los tipos SIN folio propio. Ahora el consecutivo (row_number por
-- clínica, orden created_at) es un segundo criterio de búsqueda para TODOS los
-- tipos, folio propio o no — así "1" siempre encuentra el primer trámite de ese
-- tipo en la clínica. También se agrega búsqueda por rango de fechas a
-- contab_trazar_recientes.

CREATE OR REPLACE FUNCTION public.contab_trazar(p_tipo text, p_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_clinic_ids uuid[];
  v_raiz record;
BEGIN
  SELECT array_agg(cm.clinic_id) INTO v_clinic_ids
  FROM public.clinic_memberships cm WHERE cm.user_id = auth.uid();

  -- 1. Input ya es un uuid válido
  BEGIN
    v_id := p_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_id := NULL;
  END;

  -- 2. Folio legible existente por tipo
  IF v_id IS NULL THEN
    CASE p_tipo
      WHEN 'solicitud_compra' THEN
        SELECT id INTO v_id FROM public.solicitudes_compra WHERE folio = p_id AND clinic_id = ANY(v_clinic_ids);
      WHEN 'cotizacion' THEN
        SELECT id INTO v_id FROM public.cotizaciones WHERE folio = p_id AND clinic_id = ANY(v_clinic_ids);
      WHEN 'orden_compra' THEN
        SELECT id INTO v_id FROM public.ordenes_compra WHERE folio = p_id AND clinic_id = ANY(v_clinic_ids);
      WHEN 'recepcion_mercancia' THEN
        SELECT id INTO v_id FROM public.recepciones_mercancia WHERE folio_recepcion = p_id AND clinic_id = ANY(v_clinic_ids);
      WHEN 'factura_proveedor' THEN
        SELECT id INTO v_id FROM public.facturas_proveedor WHERE folio_interno = p_id AND clinic_id = ANY(v_clinic_ids);
      WHEN 'cfdi_documento' THEN
        SELECT id INTO v_id FROM public.cfdi_documentos WHERE folio = p_id AND clinic_id = ANY(v_clinic_ids);
      WHEN 'movimiento_caja' THEN
        SELECT id INTO v_id FROM public.movimientos WHERE folio = p_id AND clinic_id = ANY(v_clinic_ids);
      WHEN 'poliza' THEN
        IF p_id ~ '^[0-9]+$' THEN
          SELECT id INTO v_id FROM public.polizas WHERE folio = p_id::int AND clinic_id = ANY(v_clinic_ids);
        END IF;
      ELSE
        NULL;
    END CASE;
  END IF;

  -- 3. Número consecutivo por clínica (row_number por created_at) — para TODOS los tipos
  IF v_id IS NULL AND p_id ~ '^[0-9]+$' THEN
    CASE p_tipo
      WHEN 'solicitud_compra' THEN
        SELECT x.id INTO v_id FROM (
          SELECT id, clinic_id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
          FROM public.solicitudes_compra WHERE clinic_id = ANY(v_clinic_ids)
        ) x WHERE x.rn = p_id::int;
      WHEN 'cotizacion' THEN
        SELECT x.id INTO v_id FROM (
          SELECT id, clinic_id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
          FROM public.cotizaciones WHERE clinic_id = ANY(v_clinic_ids)
        ) x WHERE x.rn = p_id::int;
      WHEN 'orden_compra' THEN
        SELECT x.id INTO v_id FROM (
          SELECT id, clinic_id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
          FROM public.ordenes_compra WHERE clinic_id = ANY(v_clinic_ids)
        ) x WHERE x.rn = p_id::int;
      WHEN 'recepcion_mercancia' THEN
        SELECT x.id INTO v_id FROM (
          SELECT id, clinic_id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
          FROM public.recepciones_mercancia WHERE clinic_id = ANY(v_clinic_ids)
        ) x WHERE x.rn = p_id::int;
      WHEN 'factura_proveedor' THEN
        SELECT x.id INTO v_id FROM (
          SELECT id, clinic_id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
          FROM public.facturas_proveedor WHERE clinic_id = ANY(v_clinic_ids)
        ) x WHERE x.rn = p_id::int;
      WHEN 'cfdi_documento' THEN
        SELECT x.id INTO v_id FROM (
          SELECT id, clinic_id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
          FROM public.cfdi_documentos WHERE clinic_id = ANY(v_clinic_ids)
        ) x WHERE x.rn = p_id::int;
      WHEN 'movimiento_caja' THEN
        SELECT x.id INTO v_id FROM (
          SELECT id, clinic_id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
          FROM public.movimientos WHERE clinic_id = ANY(v_clinic_ids)
        ) x WHERE x.rn = p_id::int;
      WHEN 'poliza' THEN
        SELECT x.id INTO v_id FROM (
          SELECT id, clinic_id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
          FROM public.polizas WHERE clinic_id = ANY(v_clinic_ids)
        ) x WHERE x.rn = p_id::int;
      WHEN 'appointment' THEN
        SELECT x.id INTO v_id FROM (
          SELECT id, clinic_id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
          FROM public.appointments WHERE clinic_id = ANY(v_clinic_ids)
        ) x WHERE x.rn = p_id::int;
      WHEN 'appointment_insumo' THEN
        SELECT x.id INTO v_id FROM (
          SELECT id, clinic_id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
          FROM public.appointment_insumos WHERE clinic_id = ANY(v_clinic_ids)
        ) x WHERE x.rn = p_id::int;
      WHEN 'pago_proveedor' THEN
        SELECT x.id INTO v_id FROM (
          SELECT id, clinic_id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
          FROM public.pagos_proveedor WHERE clinic_id = ANY(v_clinic_ids)
        ) x WHERE x.rn = p_id::int;
      WHEN 'pharmacy_sale' THEN
        SELECT x.id INTO v_id FROM (
          SELECT id, clinic_id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
          FROM public.pharmacy_sales WHERE clinic_id = ANY(v_clinic_ids)
        ) x WHERE x.rn = p_id::int;
      WHEN 'loyalty_movimiento' THEN
        SELECT x.id INTO v_id FROM (
          SELECT id, clinic_id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
          FROM public.loyalty_movimientos WHERE clinic_id = ANY(v_clinic_ids)
        ) x WHERE x.rn = p_id::int;
      ELSE
        NULL;
    END CASE;
  END IF;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('tipo','HUECO','mensaje','No se encontró el registro solicitado');
  END IF;

  SELECT * INTO v_raiz FROM public._contab_trazar_raiz(p_tipo, v_id);
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

REVOKE EXECUTE ON FUNCTION public.contab_trazar(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.contab_trazar(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.contab_trazar(text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.contab_trazar_recientes(text);

CREATE OR REPLACE FUNCTION public.contab_trazar_recientes(p_tipo text, p_desde date DEFAULT NULL, p_hasta date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_ids uuid[];
  v_result jsonb;
  v_limite int := CASE WHEN p_desde IS NULL AND p_hasta IS NULL THEN 20 ELSE 500 END;
BEGIN
  SELECT array_agg(cm.clinic_id) INTO v_clinic_ids
  FROM public.clinic_memberships cm WHERE cm.user_id = auth.uid();

  CASE p_tipo
    WHEN 'solicitud_compra' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',folio,'consecutivo',rn,'fecha',created_at,'estado',estatus) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, folio, created_at, estatus, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.solicitudes_compra
        WHERE clinic_id = ANY(v_clinic_ids)
          AND (p_desde IS NULL OR created_at::date >= p_desde)
          AND (p_hasta IS NULL OR created_at::date <= p_hasta)
        ORDER BY created_at DESC LIMIT v_limite
      ) t;
    WHEN 'cotizacion' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',folio,'consecutivo',rn,'fecha',created_at,'estado',NULL) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, folio, created_at, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.cotizaciones
        WHERE clinic_id = ANY(v_clinic_ids)
          AND (p_desde IS NULL OR created_at::date >= p_desde)
          AND (p_hasta IS NULL OR created_at::date <= p_hasta)
        ORDER BY created_at DESC LIMIT v_limite
      ) t;
    WHEN 'orden_compra' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',folio,'consecutivo',rn,'fecha',created_at,'estado',estatus) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, folio, created_at, estatus, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.ordenes_compra
        WHERE clinic_id = ANY(v_clinic_ids)
          AND (p_desde IS NULL OR created_at::date >= p_desde)
          AND (p_hasta IS NULL OR created_at::date <= p_hasta)
        ORDER BY created_at DESC LIMIT v_limite
      ) t;
    WHEN 'recepcion_mercancia' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',folio_recepcion,'consecutivo',rn,'fecha',created_at,'estado',estatus) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, folio_recepcion, created_at, estatus, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.recepciones_mercancia
        WHERE clinic_id = ANY(v_clinic_ids)
          AND (p_desde IS NULL OR created_at::date >= p_desde)
          AND (p_hasta IS NULL OR created_at::date <= p_hasta)
        ORDER BY created_at DESC LIMIT v_limite
      ) t;
    WHEN 'factura_proveedor' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',folio_interno,'consecutivo',rn,'fecha',created_at,'estado',estatus) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, folio_interno, created_at, estatus, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.facturas_proveedor
        WHERE clinic_id = ANY(v_clinic_ids)
          AND (p_desde IS NULL OR created_at::date >= p_desde)
          AND (p_hasta IS NULL OR created_at::date <= p_hasta)
        ORDER BY created_at DESC LIMIT v_limite
      ) t;
    WHEN 'pago_proveedor' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',rn::text,'consecutivo',rn,'fecha',created_at,'estado',NULL) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, created_at, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.pagos_proveedor
        WHERE clinic_id = ANY(v_clinic_ids)
          AND (p_desde IS NULL OR created_at::date >= p_desde)
          AND (p_hasta IS NULL OR created_at::date <= p_hasta)
        ORDER BY created_at DESC LIMIT v_limite
      ) t;
    WHEN 'poliza' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',folio::text,'consecutivo',rn,'fecha',created_at,'estado',estado) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, folio, created_at, estado, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.polizas
        WHERE clinic_id = ANY(v_clinic_ids)
          AND (p_desde IS NULL OR created_at::date >= p_desde)
          AND (p_hasta IS NULL OR created_at::date <= p_hasta)
        ORDER BY created_at DESC LIMIT v_limite
      ) t;
    WHEN 'appointment' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',rn::text,'consecutivo',rn,'fecha',created_at,'estado',NULL) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, created_at, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.appointments
        WHERE clinic_id = ANY(v_clinic_ids)
          AND (p_desde IS NULL OR created_at::date >= p_desde)
          AND (p_hasta IS NULL OR created_at::date <= p_hasta)
        ORDER BY created_at DESC LIMIT v_limite
      ) t;
    WHEN 'appointment_insumo' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',rn::text,'consecutivo',rn,'fecha',created_at,'estado',NULL) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, created_at, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.appointment_insumos
        WHERE clinic_id = ANY(v_clinic_ids)
          AND (p_desde IS NULL OR created_at::date >= p_desde)
          AND (p_hasta IS NULL OR created_at::date <= p_hasta)
        ORDER BY created_at DESC LIMIT v_limite
      ) t;
    WHEN 'movimiento_caja' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',folio,'consecutivo',rn,'fecha',created_at,'estado',NULL) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, folio, created_at, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.movimientos
        WHERE clinic_id = ANY(v_clinic_ids)
          AND (p_desde IS NULL OR created_at::date >= p_desde)
          AND (p_hasta IS NULL OR created_at::date <= p_hasta)
        ORDER BY created_at DESC LIMIT v_limite
      ) t;
    WHEN 'pharmacy_sale' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',rn::text,'consecutivo',rn,'fecha',created_at,'estado',NULL) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, created_at, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.pharmacy_sales
        WHERE clinic_id = ANY(v_clinic_ids)
          AND (p_desde IS NULL OR created_at::date >= p_desde)
          AND (p_hasta IS NULL OR created_at::date <= p_hasta)
        ORDER BY created_at DESC LIMIT v_limite
      ) t;
    WHEN 'loyalty_movimiento' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',rn::text,'consecutivo',rn,'fecha',created_at,'estado',NULL) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, created_at, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.loyalty_movimientos
        WHERE clinic_id = ANY(v_clinic_ids)
          AND (p_desde IS NULL OR created_at::date >= p_desde)
          AND (p_hasta IS NULL OR created_at::date <= p_hasta)
        ORDER BY created_at DESC LIMIT v_limite
      ) t;
    WHEN 'cfdi_documento' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',folio,'consecutivo',rn,'fecha',created_at,'estado',status) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, folio, created_at, status, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.cfdi_documentos
        WHERE clinic_id = ANY(v_clinic_ids)
          AND (p_desde IS NULL OR created_at::date >= p_desde)
          AND (p_hasta IS NULL OR created_at::date <= p_hasta)
        ORDER BY created_at DESC LIMIT v_limite
      ) t;
    ELSE
      v_result := '[]'::jsonb;
  END CASE;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.contab_trazar_recientes(text, date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.contab_trazar_recientes(text, date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.contab_trazar_recientes(text, date, date) TO authenticated;
