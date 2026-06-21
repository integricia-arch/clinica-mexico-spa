-- GCal error logging: visible field for debugging calendar sync failures.
-- Also adds cleanup RPC for test appointments.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS gcal_last_error TEXT;

-- cancelar_citas_prueba: marks recent bot-originated appointments as 'cancelada'.
-- Useful for cleaning up test bookings without going through the UI.
-- Usage: SELECT cancelar_citas_prueba(1); -- cancel appointments from last N days
CREATE OR REPLACE FUNCTION cancelar_citas_prueba(dias INT DEFAULT 1)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  n INT;
BEGIN
  UPDATE appointments
  SET status = 'cancelada', gcal_last_error = NULL
  WHERE created_at >= now() - (dias || ' days')::interval
    AND status NOT IN ('cancelada', 'liberada')
    AND canal = 'telegram';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
