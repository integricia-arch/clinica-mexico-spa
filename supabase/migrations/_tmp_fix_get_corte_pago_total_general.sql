-- Extiende get_corte_pago_total para incluir cobros generales (movimiento_pagos)
-- en cortes vinculados a turno_id (cajeros no-farmacia).
-- Antes solo consultaba pharmacy_cash_shifts → pharmacy_sale_payments.
-- SAT codes: tarjeta = '04','28' | transferencia = '03','02'

CREATE OR REPLACE FUNCTION public.get_corte_pago_total(
  p_corte_id uuid,
  p_metodo   text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_corte    record;
  v_total    numeric := 0;
  v_general  numeric := 0;
  v_sat      text[];
BEGIN
  SELECT * INTO v_corte FROM public.cortes WHERE id = p_corte_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Corte generado desde pharmacy_close_shift (pharmacy_shift_id directo)
  IF v_corte.pharmacy_shift_id IS NOT NULL THEN
    SELECT COALESCE(SUM(pay.amount), 0) INTO v_total
    FROM public.pharmacy_sales ps
    JOIN public.pharmacy_sale_payments pay ON pay.sale_id = ps.id
    WHERE ps.shift_id = v_corte.pharmacy_shift_id
      AND ps.status  <> 'cancelled'
      AND pay.payment_method = p_metodo;
    RETURN v_total;
  END IF;

  -- Corte generado desde turno_close (turno_id)
  IF v_corte.turno_id IS NOT NULL THEN

    -- 1. Ventas farmacia vinculadas al turno vía pharmacy_cash_shifts
    SELECT COALESCE(SUM(pay.amount), 0) INTO v_total
    FROM public.pharmacy_cash_shifts pcs
    JOIN public.pharmacy_sales        ps  ON ps.shift_id  = pcs.id
    JOIN public.pharmacy_sale_payments pay ON pay.sale_id = ps.id
    WHERE pcs.turno_id        = v_corte.turno_id
      AND ps.status          <> 'cancelled'
      AND pay.payment_method  = p_metodo;

    -- 2. Cobros generales (movimiento_pagos) según método SAT
    v_sat := CASE
      WHEN p_metodo = 'tarjeta'       THEN ARRAY['04', '28']
      WHEN p_metodo = 'transferencia' THEN ARRAY['03', '02']
      ELSE ARRAY[]::text[]
    END;

    IF array_length(v_sat, 1) > 0 THEN
      SELECT COALESCE(SUM(mp.monto), 0) INTO v_general
      FROM public.movimiento_pagos mp
      JOIN public.movimientos      m   ON m.id   = mp.movimiento_id
      JOIN public.metodos_pago     met ON met.id = mp.metodo_pago_id
      WHERE m.turno_id     = v_corte.turno_id
        AND m.estado       = 'pagado'
        AND m.tipo         = 'cobro'
        AND met.codigo_sat = ANY(v_sat);
    END IF;

    RETURN v_total + v_general;
  END IF;

  RETURN 0;
END;
$$;
