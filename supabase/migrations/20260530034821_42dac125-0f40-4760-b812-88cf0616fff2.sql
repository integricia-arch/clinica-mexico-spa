
CREATE OR REPLACE FUNCTION public.pharmacy_recompute_prescription_status(p_prescription_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_total_items int;
  v_fully int;
  v_any int;
  v_new_status text;
  v_clinic uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT clinic_id INTO v_clinic FROM public.prescriptions WHERE id = p_prescription_id;
  IF v_clinic IS NULL THEN
    RAISE EXCEPTION 'Receta no encontrada';
  END IF;
  IF NOT public.user_has_clinic_access(v_user, v_clinic) THEN
    RAISE EXCEPTION 'Sin acceso a la clínica de la receta';
  END IF;

  WITH dispensed AS (
    SELECT pi.id AS item_id,
           COALESCE(pi.quantity, 0)::numeric AS required_qty,
           COALESCE(SUM(psi.quantity), 0)::numeric AS dispensed_qty
      FROM public.prescription_items pi
      LEFT JOIN public.pharmacy_sale_items psi
             ON psi.prescription_item_id = pi.id
     WHERE pi.prescription_id = p_prescription_id
     GROUP BY pi.id, pi.quantity
  )
  SELECT count(*),
         count(*) FILTER (WHERE required_qty > 0 AND dispensed_qty >= required_qty),
         count(*) FILTER (WHERE dispensed_qty > 0)
    INTO v_total_items, v_fully, v_any
    FROM dispensed;

  IF v_total_items = 0 THEN
    RETURN NULL;
  END IF;

  IF v_fully = v_total_items THEN
    v_new_status := 'dispensed';
  ELSIF v_any > 0 THEN
    v_new_status := 'partially_dispensed';
  ELSE
    v_new_status := 'issued';
  END IF;

  UPDATE public.prescriptions
     SET status = v_new_status,
         updated_at = now()
   WHERE id = p_prescription_id
     AND status <> 'cancelled'
     AND status <> v_new_status;

  RETURN v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pharmacy_recompute_prescription_status(uuid) TO authenticated;
