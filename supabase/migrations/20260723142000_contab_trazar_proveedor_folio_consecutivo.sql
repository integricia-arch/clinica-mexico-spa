-- supabase/migrations/20260723142000_contab_trazar_proveedor_folio_consecutivo.sql
-- Mismo problema que contab_trazar: "Id de proveedor" exigía uuid crudo. Con un
-- solo proveedor registrado, el usuario esperaba poder escribir "1". Se agrega
-- resolución por: uuid directo, RFC, o número consecutivo (row_number por
-- clínica ordenado por created_at, igual criterio que contab_trazar).

DROP FUNCTION IF EXISTS public.contab_trazar_proveedor(uuid);

CREATE OR REPLACE FUNCTION public.contab_trazar_proveedor(p_proveedor_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_clinic_ids uuid[];
  v_clinic_id uuid;
  v_arboles jsonb := '[]'::jsonb;
  v_row record;
BEGIN
  SELECT array_agg(cm.clinic_id) INTO v_clinic_ids
  FROM public.clinic_memberships cm WHERE cm.user_id = auth.uid();

  BEGIN
    v_id := p_proveedor_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_id := NULL;
  END;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.proveedores
    WHERE rfc = p_proveedor_id AND clinic_id = ANY(v_clinic_ids);
  END IF;

  IF v_id IS NULL AND p_proveedor_id ~ '^[0-9]+$' THEN
    SELECT x.id INTO v_id FROM (
      SELECT id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
      FROM public.proveedores WHERE clinic_id = ANY(v_clinic_ids)
    ) x WHERE x.rn = p_proveedor_id::int;
  END IF;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('tipo','HUECO','mensaje','Proveedor no encontrado');
  END IF;

  SELECT clinic_id INTO v_clinic_id FROM public.proveedores WHERE id = v_id;
  IF v_clinic_id IS NULL THEN
    RETURN jsonb_build_object('tipo','HUECO','mensaje','Proveedor no encontrado');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships cm
    WHERE cm.user_id = auth.uid() AND cm.clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'Sin acceso a esta clínica';
  END IF;

  FOR v_row IN
    SELECT DISTINCT sc.id
    FROM public.solicitudes_compra sc
    JOIN public.cotizaciones c ON c.solicitud_compra_id = sc.id
    WHERE c.proveedor_id = v_id AND sc.clinic_id = v_clinic_id
  LOOP
    v_arboles := v_arboles || jsonb_build_array(public._contab_trazar_nodo('solicitud_compra', v_row.id, v_clinic_id));
  END LOOP;

  FOR v_row IN
    SELECT oc.id
    FROM public.ordenes_compra oc
    WHERE oc.proveedor_id = v_id AND oc.solicitud_id IS NULL AND oc.clinic_id = v_clinic_id
  LOOP
    v_arboles := v_arboles || jsonb_build_array(public._contab_trazar_nodo('orden_compra', v_row.id, v_clinic_id));
  END LOOP;

  IF jsonb_array_length(v_arboles) = 0 THEN
    RETURN jsonb_build_object('tipo','HUECO','mensaje','Sin compras registradas para este proveedor');
  END IF;

  RETURN v_arboles;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.contab_trazar_proveedor(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.contab_trazar_proveedor(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.contab_trazar_proveedor(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.contab_trazar_proveedores_recientes()
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

  SELECT jsonb_agg(jsonb_build_object('id',id,'folio',rn::text,'fecha',created_at,'estado',nombre) ORDER BY created_at DESC)
  INTO v_result FROM (
    SELECT id, nombre, created_at, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
    FROM public.proveedores WHERE clinic_id = ANY(v_clinic_ids)
    ORDER BY created_at DESC LIMIT 20
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.contab_trazar_proveedores_recientes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.contab_trazar_proveedores_recientes() FROM anon;
GRANT EXECUTE ON FUNCTION public.contab_trazar_proveedores_recientes() TO authenticated;
