-- GAP-E: fondo siguiente turno + efectivo para depósito
ALTER TABLE public.cortes
  ADD COLUMN IF NOT EXISTS fondo_siguiente_turno numeric(12,2),
  ADD COLUMN IF NOT EXISTS efectivo_deposito     numeric(12,2);

CREATE OR REPLACE FUNCTION public.corte_set_fondo(
  p_corte_id       uuid,
  p_fondo_siguiente numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_conteo numeric;
  v_owner  uuid;
BEGIN
  SELECT conteo_ciego, generado_by INTO v_conteo, v_owner
  FROM public.cortes WHERE id = p_corte_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Corte no encontrado';
  END IF;

  IF auth.uid() IS DISTINCT FROM v_owner
     AND NOT has_role(auth.uid(), 'admin'::app_role)
     AND NOT has_role(auth.uid(), 'manager'::app_role) THEN
    RAISE EXCEPTION 'Sin autorización para actualizar este corte';
  END IF;

  IF p_fondo_siguiente < 0 THEN
    RAISE EXCEPTION 'FONDO_NEGATIVO: el fondo no puede ser negativo';
  END IF;

  UPDATE public.cortes
    SET fondo_siguiente_turno = p_fondo_siguiente,
        efectivo_deposito     = GREATEST(v_conteo - p_fondo_siguiente, 0)
  WHERE id = p_corte_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.corte_set_fondo(uuid, numeric) TO authenticated;
