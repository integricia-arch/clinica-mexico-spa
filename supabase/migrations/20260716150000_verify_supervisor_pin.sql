-- supabase/migrations/20260716150000_verify_supervisor_pin.sql
-- RPC compartida: valida PIN de supervisor sin ejecutar ninguna acción de negocio.
-- Extrae la lógica que hoy vive duplicada dentro de turno_close_with_pin /
-- pharmacy_close_shift_with_pin, para que devoluciones y cash drop la reusen.
CREATE OR REPLACE FUNCTION public.verify_supervisor_pin(
  p_clinic_id     uuid,
  p_supervisor_id uuid,
  p_pin           text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_hash text;
  v_is_supervisor boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  IF NOT public.user_has_clinic_access(auth.uid(), p_clinic_id) THEN
    RAISE EXCEPTION 'Sin acceso a esta clínica';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.clinic_memberships
     WHERE clinic_id = p_clinic_id
       AND user_id = p_supervisor_id
       AND role IN ('admin', 'manager')
  ) INTO v_is_supervisor;

  IF NOT v_is_supervisor THEN
    RAISE EXCEPTION 'Supervisor sin rol admin/manager en esta clínica';
  END IF;

  SELECT supervisor_pin_hash INTO v_hash
    FROM public.profiles WHERE id = p_supervisor_id;

  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'PIN_NOT_CONFIGURED';
  END IF;

  IF crypt(p_pin, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'PIN_INCORRECT';
  END IF;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.verify_supervisor_pin(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_supervisor_pin(uuid, uuid, text) TO authenticated;
