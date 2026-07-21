-- Bug preexistente (fase 7): contab_auditoria_huecos comparaba p.evento = mc.evento,
-- pero polizas.evento ∈ {'registro','cancelacion'} y movimientos_contables.evento ∈
-- {'devengo','cancelacion'} — 'registro' nunca es igual a 'devengo', así que CUALQUIER
-- póliza ya generada (por triggers o por el corrector nuevo) seguía reportándose como
-- "sin_poliza" para siempre. Detectado al verificar el corrector de huecos en browser:
-- se generó la póliza folio 3 para un honorario devengado y el check la seguía listando
-- como hueco. Fix: mapear devengo->registro antes de comparar.
CREATE OR REPLACE FUNCTION public.contab_auditoria_huecos(p_clinic_id uuid, p_desde date, p_hasta date)
RETURNS TABLE (
  tipo_hueco text,
  fecha date,
  origen_id uuid,
  descripcion text,
  monto_centavos bigint
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
  SELECT 'sin_referencia'::text, p.fecha, p.id, p.concepto,
         (SELECT COALESCE(SUM(pp.debe_centavos), 0) FROM public.poliza_partidas pp WHERE pp.poliza_id = p.id)::bigint
  FROM public.polizas p
  WHERE p.clinic_id = p_clinic_id AND p.fecha BETWEEN p_desde AND p_hasta AND p.reference_type IS NULL

  UNION ALL

  SELECT 'sin_poliza'::text, mc.fecha_devengo, mc.id, COALESCE(mc.descripcion, mc.origen), mc.monto_centavos
  FROM public.movimientos_contables mc
  WHERE mc.clinic_id = p_clinic_id AND mc.fecha_devengo BETWEEN p_desde AND p_hasta
    AND mc.reference_type IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.polizas p
      WHERE p.reference_type = mc.reference_type AND p.reference_id = mc.reference_id
        AND p.evento = (CASE mc.evento WHEN 'devengo' THEN 'registro' ELSE mc.evento END)
    )
  ORDER BY 2;
END;
$function$;
