-- Extiende libro_diario con uuid_cfdi/reference_type: RCFF Art. 33 fracc. III exige
-- ligar cada registro contable al folio fiscal (UUID CFDI) que lo respalda. El tipo
-- de póliza (diario/ingreso/egreso) ya viaja en la fila (columna tipo) y ya tiene
-- folio independiente por tipo (poliza_folios), esto solo agrega la trazabilidad
-- fiscal que faltaba en el reporte.

DROP FUNCTION IF EXISTS public.libro_diario(uuid, date, date);

CREATE FUNCTION public.libro_diario(p_clinic_id uuid, p_desde date, p_hasta date)
RETURNS TABLE (
  poliza_id uuid,
  folio integer,
  tipo text,
  fecha date,
  concepto text,
  estado text,
  uuid_cfdi uuid,
  reference_type text,
  orden integer,
  cuenta_codigo text,
  cuenta_nombre text,
  debe_centavos bigint,
  haber_centavos bigint,
  descripcion text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = p_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT p.id, p.folio, p.tipo, p.fecha, p.concepto, p.estado, p.uuid_cfdi, p.reference_type,
         pp.orden, cc.codigo, cc.nombre, pp.debe_centavos, pp.haber_centavos, pp.descripcion
  FROM public.polizas p
  JOIN public.poliza_partidas pp ON pp.poliza_id = p.id
  JOIN public.cuentas_contables cc ON cc.id = pp.cuenta_id
  WHERE p.clinic_id = p_clinic_id AND p.fecha BETWEEN p_desde AND p_hasta
  ORDER BY p.fecha, p.tipo, p.folio, pp.orden;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.libro_diario(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.libro_diario(uuid, date, date) TO authenticated;
