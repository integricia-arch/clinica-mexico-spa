-- Fase 3 del plan de trazabilidad: dado un poliza_id (resuelto por
-- contab_resolver_asiento), trae sus líneas para alimentar PolizaDetalleDialog
-- desde una pantalla operativa (Citas/Farmacia/Compras), sin tener que cargar
-- todo el libro diario del período.
CREATE OR REPLACE FUNCTION public.poliza_detalle(p_poliza_id uuid)
RETURNS TABLE(poliza_id uuid, folio integer, tipo text, fecha date, concepto text, estado text,
  uuid_cfdi uuid, reference_type text, reference_id uuid, orden integer, cuenta_codigo text,
  cuenta_nombre text, cuenta_tipo text, debe_centavos bigint, haber_centavos bigint, descripcion text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_clinic_id uuid;
BEGIN
  SELECT p.clinic_id INTO v_clinic_id FROM public.polizas p WHERE p.id = p_poliza_id;
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'poliza_no_encontrada';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT p.id, p.folio, p.tipo, p.fecha, p.concepto, p.estado, p.uuid_cfdi, p.reference_type, p.reference_id,
         pp.orden, cc.codigo, cc.nombre, cc.tipo,
         pp.debe_centavos, pp.haber_centavos, pp.descripcion
  FROM public.polizas p
  JOIN public.poliza_partidas pp ON pp.poliza_id = p.id
  JOIN public.cuentas_contables cc ON cc.id = pp.cuenta_id
  WHERE p.id = p_poliza_id
  ORDER BY pp.orden;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.poliza_detalle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.poliza_detalle(uuid) TO authenticated;
