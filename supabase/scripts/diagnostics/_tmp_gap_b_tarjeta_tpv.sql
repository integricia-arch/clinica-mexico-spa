-- GAP-B: Reconciliación tarjeta sistema vs TPV físico
ALTER TABLE public.cortes
  ADD COLUMN IF NOT EXISTS tarjeta_tpv_declarado  numeric(12,2),
  ADD COLUMN IF NOT EXISTS tarjeta_tpv_diferencia numeric(12,2);

-- Devuelve el total de cobros en tarjeta del sistema para un corte dado.
-- Busca primero por pharmacy_shift_id, luego por turno linked shifts.
CREATE OR REPLACE FUNCTION public.get_corte_tarjeta_total(p_corte_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_corte record;
  v_total numeric := 0;
BEGIN
  SELECT * INTO v_corte FROM public.cortes WHERE id = p_corte_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF v_corte.pharmacy_shift_id IS NOT NULL THEN
    SELECT COALESCE(SUM(pay.amount), 0) INTO v_total
    FROM public.pharmacy_sales ps
    JOIN public.pharmacy_sale_payments pay ON pay.sale_id = ps.id
    WHERE ps.shift_id = v_corte.pharmacy_shift_id
      AND ps.status <> 'cancelled'
      AND pay.payment_method = 'tarjeta';
    RETURN v_total;
  END IF;

  IF v_corte.turno_id IS NOT NULL THEN
    SELECT COALESCE(SUM(pay.amount), 0) INTO v_total
    FROM public.pharmacy_cash_shifts pcs
    JOIN public.pharmacy_sales ps ON ps.shift_id = pcs.id
    JOIN public.pharmacy_sale_payments pay ON pay.sale_id = ps.id
    WHERE pcs.turno_id = v_corte.turno_id
      AND ps.status <> 'cancelled'
      AND pay.payment_method = 'tarjeta';
    RETURN v_total;
  END IF;

  RETURN 0;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_corte_tarjeta_total(uuid) TO authenticated;

-- Guarda el total declarado por el cajero desde su TPV físico.
-- Computa la diferencia respecto al total del sistema.
CREATE OR REPLACE FUNCTION public.corte_set_tarjeta_tpv(
  p_corte_id     uuid,
  p_tpv_declarado numeric
) RETURNS numeric  -- devuelve sistema_total para el cliente
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_owner        uuid;
  v_sistema_total numeric;
BEGIN
  SELECT generado_by INTO v_owner FROM public.cortes WHERE id = p_corte_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Corte no encontrado'; END IF;

  IF auth.uid() IS DISTINCT FROM v_owner
     AND NOT has_role(auth.uid(), 'admin'::app_role)
     AND NOT has_role(auth.uid(), 'manager'::app_role) THEN
    RAISE EXCEPTION 'Sin autorización';
  END IF;

  IF p_tpv_declarado < 0 THEN
    RAISE EXCEPTION 'MONTO_NEGATIVO: el total TPV no puede ser negativo';
  END IF;

  v_sistema_total := get_corte_tarjeta_total(p_corte_id);

  UPDATE public.cortes
    SET tarjeta_tpv_declarado  = p_tpv_declarado,
        tarjeta_tpv_diferencia = p_tpv_declarado - v_sistema_total
  WHERE id = p_corte_id;

  RETURN v_sistema_total;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.corte_set_tarjeta_tpv(uuid, numeric) TO authenticated;
