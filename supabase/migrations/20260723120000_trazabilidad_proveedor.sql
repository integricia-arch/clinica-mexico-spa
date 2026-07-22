-- supabase/migrations/20260723120000_trazabilidad_proveedor.sql

CREATE OR REPLACE FUNCTION public.contab_trazar_proveedor(p_proveedor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_arboles jsonb := '[]'::jsonb;
  v_row record;
BEGIN
  SELECT clinic_id INTO v_clinic_id FROM public.proveedores WHERE id = p_proveedor_id;
  IF v_clinic_id IS NULL THEN
    RETURN jsonb_build_object('tipo','HUECO','mensaje','Proveedor no encontrado');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships cm
    WHERE cm.user_id = auth.uid() AND cm.clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'Sin acceso a esta clínica';
  END IF;

  -- raíz: solicitudes con al menos una cotización de este proveedor
  FOR v_row IN
    SELECT DISTINCT sc.id
    FROM public.solicitudes_compra sc
    JOIN public.cotizaciones c ON c.solicitud_compra_id = sc.id
    WHERE c.proveedor_id = p_proveedor_id AND sc.clinic_id = v_clinic_id
  LOOP
    v_arboles := v_arboles || jsonb_build_array(public._contab_trazar_nodo('solicitud_compra', v_row.id, v_clinic_id));
  END LOOP;

  -- órdenes de compra de este proveedor sin solicitud previa (flujo directo)
  FOR v_row IN
    SELECT oc.id
    FROM public.ordenes_compra oc
    WHERE oc.proveedor_id = p_proveedor_id AND oc.solicitud_id IS NULL AND oc.clinic_id = v_clinic_id
  LOOP
    v_arboles := v_arboles || jsonb_build_array(public._contab_trazar_nodo('orden_compra', v_row.id, v_clinic_id));
  END LOOP;

  IF jsonb_array_length(v_arboles) = 0 THEN
    RETURN jsonb_build_object('tipo','HUECO','mensaje','Sin compras registradas para este proveedor');
  END IF;

  RETURN v_arboles;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.contab_trazar_proveedor(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.contab_trazar_proveedor(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.contab_trazar_proveedor(uuid) TO authenticated;
