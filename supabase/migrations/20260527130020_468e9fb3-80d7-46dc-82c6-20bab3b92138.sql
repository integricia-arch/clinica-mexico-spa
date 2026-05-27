
REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.journey_audit_trigger() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.journey_step_audit_trigger() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_conversacion_last_message() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_step_key_immutable() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prevent_critical_step_deletion() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prevent_option_item_deletion() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_audit(public.audit_action, text, uuid, jsonb, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_clinic_staff(uuid) FROM authenticated;
