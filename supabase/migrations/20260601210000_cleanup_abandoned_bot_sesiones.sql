-- MEDIUM #12: Delete abandoned bot sessions with PII older than 24h
CREATE OR REPLACE FUNCTION cleanup_abandoned_bot_sesiones()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM bot_sesiones
  WHERE consentimiento_dado = false
    AND updated_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_abandoned_bot_sesiones() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_abandoned_bot_sesiones() TO service_role;
