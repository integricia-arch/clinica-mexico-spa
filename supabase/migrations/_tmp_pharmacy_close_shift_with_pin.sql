-- pharmacy_close_shift_with_pin: verifies supervisor PIN then delegates to pharmacy_close_shift
-- Mirrors turno_close_with_pin but for pharmacy_cash_shifts.

CREATE OR REPLACE FUNCTION public.pharmacy_close_shift_with_pin(
  p_shift_id      uuid,
  p_supervisor_id uuid,
  p_pin           text,
  p_cash_count    numeric,
  p_notes         text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_hash text;
BEGIN
  SELECT supervisor_pin_hash INTO v_hash
    FROM public.profiles WHERE id = p_supervisor_id;

  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'PIN_NOT_CONFIGURED';
  END IF;

  IF crypt(p_pin, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'PIN_INCORRECT';
  END IF;

  IF NOT (has_role(p_supervisor_id, 'admin'::app_role)
          OR has_role(p_supervisor_id, 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Supervisor sin rol admin/manager';
  END IF;

  RETURN public.pharmacy_close_shift(p_shift_id, p_cash_count, p_notes, true, p_supervisor_id);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.pharmacy_close_shift_with_pin(uuid, uuid, text, numeric, text) TO authenticated;
