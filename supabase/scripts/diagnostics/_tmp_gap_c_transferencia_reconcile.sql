-- GAP-C: Reconciliación transferencias/SPEI
-- También agrega RPCs genéricos que reemplazan los específicos de GAP-B.

ALTER TABLE public.cortes
  ADD COLUMN IF NOT EXISTS transferencia_declarado  numeric(12,2),
  ADD COLUMN IF NOT EXISTS transferencia_diferencia numeric(12,2);

-- RPC genérico: total sistema por método de pago para un corte.
-- Reemplaza get_corte_tarjeta_total (se mantiene por compatibilidad).
CREATE OR REPLACE FUNCTION public.get_corte_pago_total(
  p_corte_id uuid,
  p_metodo   text  -- 'tarjeta' | 'transferencia' | cualquier payment_method
) RETURNS numeric
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
      AND pay.payment_method = p_metodo;
    RETURN v_total;
  END IF;

  IF v_corte.turno_id IS NOT NULL THEN
    SELECT COALESCE(SUM(pay.amount), 0) INTO v_total
    FROM public.pharmacy_cash_shifts pcs
    JOIN public.pharmacy_sales ps ON ps.shift_id = pcs.id
    JOIN public.pharmacy_sale_payments pay ON pay.sale_id = ps.id
    WHERE pcs.turno_id = v_corte.turno_id
      AND ps.status <> 'cancelled'
      AND pay.payment_method = p_metodo;
    RETURN v_total;
  END IF;

  RETURN 0;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_corte_pago_total(uuid, text) TO authenticated;

-- RPC genérico: guarda declaración del cajero para cualquier método de pago.
-- Soporta 'tarjeta' y 'transferencia'; otros métodos lanzan excepción.
CREATE OR REPLACE FUNCTION public.corte_set_pago_declarado(
  p_corte_id  uuid,
  p_metodo    text,
  p_declarado numeric
) RETURNS numeric  -- devuelve sistema_total
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_owner         uuid;
  v_sistema_total numeric;
BEGIN
  SELECT generado_by INTO v_owner FROM public.cortes WHERE id = p_corte_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Corte no encontrado'; END IF;

  IF auth.uid() IS DISTINCT FROM v_owner
     AND NOT has_role(auth.uid(), 'admin'::app_role)
     AND NOT has_role(auth.uid(), 'manager'::app_role) THEN
    RAISE EXCEPTION 'Sin autorización';
  END IF;

  IF p_declarado < 0 THEN
    RAISE EXCEPTION 'MONTO_NEGATIVO: el monto declarado no puede ser negativo';
  END IF;

  v_sistema_total := get_corte_pago_total(p_corte_id, p_metodo);

  IF p_metodo = 'tarjeta' THEN
    UPDATE public.cortes
      SET tarjeta_tpv_declarado  = p_declarado,
          tarjeta_tpv_diferencia = p_declarado - v_sistema_total
    WHERE id = p_corte_id;
  ELSIF p_metodo = 'transferencia' THEN
    UPDATE public.cortes
      SET transferencia_declarado  = p_declarado,
          transferencia_diferencia = p_declarado - v_sistema_total
    WHERE id = p_corte_id;
  ELSE
    RAISE EXCEPTION 'Método no soportado: %', p_metodo;
  END IF;

  RETURN v_sistema_total;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.corte_set_pago_declarado(uuid, text, numeric) TO authenticated;
