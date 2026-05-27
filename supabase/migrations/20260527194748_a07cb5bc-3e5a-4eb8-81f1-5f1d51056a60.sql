
-- Revoke EXECUTE from anon/public on SECURITY DEFINER functions; keep authenticated where needed
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_clinic_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_audit(audit_action, text, uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_prescription_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_prescription_number_for_doctor(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_prescription_audit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_journey_progress(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_permanent_admins() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_clinic_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit(audit_action, text, uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_prescription_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_prescription_number_for_doctor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_prescription_audit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_journey_progress(uuid) TO authenticated;
