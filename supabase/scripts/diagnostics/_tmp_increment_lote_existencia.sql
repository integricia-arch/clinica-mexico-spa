-- RPC para incrementar existencia de lote de forma atómica (evita race condition)
CREATE OR REPLACE FUNCTION increment_lote_existencia(
  p_lote_id uuid,
  p_cantidad integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_nueva_existencia integer;
BEGIN
  UPDATE lotes_medicamento
  SET existencia = existencia + p_cantidad,
      updated_at = now()
  WHERE id = p_lote_id
  RETURNING existencia INTO v_nueva_existencia;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote % no encontrado', p_lote_id;
  END IF;

  RETURN v_nueva_existencia;
END;
$function$;

GRANT EXECUTE ON FUNCTION increment_lote_existencia(uuid, integer) TO authenticated;
