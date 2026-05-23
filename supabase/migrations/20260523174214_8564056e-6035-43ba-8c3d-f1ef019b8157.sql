-- Asegura que cualquier cambio en user_roles quede registrado en audit_logs.
DROP TRIGGER IF EXISTS user_roles_audit ON public.user_roles;

CREATE TRIGGER user_roles_audit
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger();