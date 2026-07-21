-- Agrega reference_id a libro_diario() para poder armar el link "Ver trámite"
-- (Fase 2 del plan de trazabilidad) sin una consulta extra por póliza.
--
-- Nota: el archivo previo de esta función (20260719140000_fase6c_reportes_partida_doble.sql)
-- ya estaba desactualizado contra prod — uuid_cfdi, reference_type y cuenta_tipo se habían
-- agregado directo en la BD sin migración commiteada (mismo patrón de drift Lovable/CLI ya
-- documentado en STATE.md). Esta migración refleja el estado real de prod + reference_id nuevo.
DROP FUNCTION IF EXISTS public.libro_diario(uuid, date, date);

CREATE FUNCTION public.libro_diario(p_clinic_id uuid, p_desde date, p_hasta date)
RETURNS TABLE(poliza_id uuid, folio integer, tipo text, fecha date, concepto text, estado text,
  uuid_cfdi uuid, reference_type text, reference_id uuid, orden integer, cuenta_codigo text,
  cuenta_nombre text, cuenta_tipo text, debe_centavos bigint, haber_centavos bigint, descripcion text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = p_clinic_id
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
  WHERE p.clinic_id = p_clinic_id AND p.fecha BETWEEN p_desde AND p_hasta
  ORDER BY p.fecha, p.tipo, p.folio, pp.orden;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.libro_diario(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.libro_diario(uuid, date, date) TO authenticated;
