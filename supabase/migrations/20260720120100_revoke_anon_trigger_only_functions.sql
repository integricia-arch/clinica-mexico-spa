-- Auditoría de acceso 2026-07-20, grupo B: funciones SECURITY DEFINER que SOLO se
-- invocan desde triggers/pg_cron, nunca desde el frontend (`.rpc()` no aparece en src/
-- para ninguna de estas — verificado por grep). No necesitan grant a ningún rol de
-- PostgREST: triggers se ejecutan con los privilegios del dueño de la función
-- independientemente de GRANT/REVOKE, y los jobs de pg_cron corren con el rol que
-- programó el job (postgres), no vía la API REST.

REVOKE EXECUTE ON FUNCTION public.notify_new_user_signup() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.provision_on_auth_user_created() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.provision_link_user(uuid, text) FROM PUBLIC;
-- provision_link_by_email SÍ se llama vía RPC directo desde la Edge Function
-- provision-users-from-queue (service_role key) — necesita grant explícito.
REVOKE EXECUTE ON FUNCTION public.provision_link_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_link_by_email(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.cleanup_abandoned_bot_sesiones() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.contab_valida_periodo_movimiento_manual() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_doctor_user_creation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_nurse_user_creation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_membership_on_deactivate() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_audit_log() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.loyalty_expire_points() FROM PUBLIC;
