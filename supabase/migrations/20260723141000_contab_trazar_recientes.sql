-- supabase/migrations/20260723141000_contab_trazar_recientes.sql
-- Lista los últimos 20 trámites del tipo elegido, para no depender de que el
-- usuario ya sepa el folio/consecutivo/uuid antes de buscar. Usa la misma
-- noción de folio/consecutivo que contab_trazar (folio propio si existe, si no
-- row_number por clínica ordenado por created_at) para que el número mostrado
-- aquí sea el mismo que hay que teclear para buscar.

CREATE OR REPLACE FUNCTION public.contab_trazar_recientes(p_tipo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_ids uuid[];
  v_result jsonb;
BEGIN
  SELECT array_agg(cm.clinic_id) INTO v_clinic_ids
  FROM public.clinic_memberships cm WHERE cm.user_id = auth.uid();

  CASE p_tipo
    WHEN 'solicitud_compra' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',folio,'fecha',created_at,'estado',estatus) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, folio, created_at, estatus FROM public.solicitudes_compra
        WHERE clinic_id = ANY(v_clinic_ids) ORDER BY created_at DESC LIMIT 20
      ) t;
    WHEN 'cotizacion' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',folio,'fecha',created_at,'estado',NULL) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, folio, created_at FROM public.cotizaciones
        WHERE clinic_id = ANY(v_clinic_ids) ORDER BY created_at DESC LIMIT 20
      ) t;
    WHEN 'orden_compra' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',folio,'fecha',created_at,'estado',estatus) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, folio, created_at, estatus FROM public.ordenes_compra
        WHERE clinic_id = ANY(v_clinic_ids) ORDER BY created_at DESC LIMIT 20
      ) t;
    WHEN 'recepcion_mercancia' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',folio_recepcion,'fecha',created_at,'estado',estatus) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, folio_recepcion, created_at, estatus FROM public.recepciones_mercancia
        WHERE clinic_id = ANY(v_clinic_ids) ORDER BY created_at DESC LIMIT 20
      ) t;
    WHEN 'factura_proveedor' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',folio_interno,'fecha',created_at,'estado',estatus) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, folio_interno, created_at, estatus FROM public.facturas_proveedor
        WHERE clinic_id = ANY(v_clinic_ids) ORDER BY created_at DESC LIMIT 20
      ) t;
    WHEN 'pago_proveedor' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',rn::text,'fecha',created_at,'estado',NULL) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, created_at, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.pagos_proveedor WHERE clinic_id = ANY(v_clinic_ids)
        ORDER BY created_at DESC LIMIT 20
      ) t;
    WHEN 'poliza' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',folio::text,'fecha',created_at,'estado',estado) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, folio, created_at, estado FROM public.polizas
        WHERE clinic_id = ANY(v_clinic_ids) ORDER BY created_at DESC LIMIT 20
      ) t;
    WHEN 'appointment' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',rn::text,'fecha',created_at,'estado',NULL) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, created_at, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.appointments WHERE clinic_id = ANY(v_clinic_ids)
        ORDER BY created_at DESC LIMIT 20
      ) t;
    WHEN 'appointment_insumo' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',rn::text,'fecha',created_at,'estado',NULL) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, created_at, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.appointment_insumos WHERE clinic_id = ANY(v_clinic_ids)
        ORDER BY created_at DESC LIMIT 20
      ) t;
    WHEN 'movimiento_caja' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',folio,'fecha',created_at,'estado',NULL) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, folio, created_at FROM public.movimientos
        WHERE clinic_id = ANY(v_clinic_ids) ORDER BY created_at DESC LIMIT 20
      ) t;
    WHEN 'pharmacy_sale' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',rn::text,'fecha',created_at,'estado',NULL) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, created_at, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.pharmacy_sales WHERE clinic_id = ANY(v_clinic_ids)
        ORDER BY created_at DESC LIMIT 20
      ) t;
    WHEN 'loyalty_movimiento' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',rn::text,'fecha',created_at,'estado',NULL) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, created_at, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
        FROM public.loyalty_movimientos WHERE clinic_id = ANY(v_clinic_ids)
        ORDER BY created_at DESC LIMIT 20
      ) t;
    WHEN 'cfdi_documento' THEN
      SELECT jsonb_agg(jsonb_build_object('id',id,'folio',folio,'fecha',created_at,'estado',status) ORDER BY created_at DESC)
      INTO v_result FROM (
        SELECT id, folio, created_at, status FROM public.cfdi_documentos
        WHERE clinic_id = ANY(v_clinic_ids) ORDER BY created_at DESC LIMIT 20
      ) t;
    ELSE
      v_result := '[]'::jsonb;
  END CASE;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.contab_trazar_recientes(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.contab_trazar_recientes(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.contab_trazar_recientes(text) TO authenticated;
