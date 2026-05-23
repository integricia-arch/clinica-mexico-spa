-- Revocar EXECUTE de funciones SECURITY DEFINER que solo deben usarse internamente por triggers
REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_conversacion_last_message() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_audit(public.audit_action, text, uuid, jsonb, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
-- has_role debe seguir siendo ejecutable porque se usa en políticas RLS