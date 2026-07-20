-- Corrección: las 4 migraciones anteriores de esta sesión (120000-120300) hicieron
-- `REVOKE EXECUTE ... FROM PUBLIC` pero Supabase otorga EXECUTE a `anon` de forma
-- EXPLÍCITA (no solo vía el pseudo-rol PUBLIC) al crear la función — mismo patrón ya
-- documentado en CLAUDE.md tras el incidente de `reporte_iva` (fase 9, gate 6B):
-- "REVOKE FROM PUBLIC a secas no revoca el grant default a anon/authenticated".
-- Verificado con aclexplode(proacl): las 58 funciones seguían con EXECUTE directo
-- para anon después de aplicar las migraciones anteriores. Esta migración revoca
-- anon explícitamente en todas. authenticated se deja intacto (ya tenía GRANT
-- explícito correcto desde las migraciones anteriores donde correspondía).

REVOKE EXECUTE ON FUNCTION public.cleanup_abandoned_bot_sesiones() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_has_clinic_access(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pharmacy_open_shift(uuid,numeric,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pharmacy_close_shift(uuid,numeric,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_caja_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_configure_caja(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pharmacy_register_sale(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pharmacy_corte_x(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pharmacy_register_return(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.turno_corte_x(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_supervisor_pin(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_clinic_supervisors(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.corte_set_fondo(uuid,numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.corte_set_tarjeta_tpv(uuid,numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.corte_set_pago_declarado(uuid,text,numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.turno_close(uuid,numeric,text,boolean,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pharmacy_close_shift(uuid,numeric,text,boolean,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.turno_close_with_pin(uuid,uuid,text,numeric,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pharmacy_close_shift_with_pin(uuid,uuid,text,numeric,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_clinic_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_global_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_prescription_audit(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pharmacy_recompute_prescription_status(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.multiclinic_diagnostics() FROM anon;
REVOKE EXECUTE ON FUNCTION public.firmar_acta_merma(uuid,uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_audit_log() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_new_user_signup() FROM anon;
REVOKE EXECUTE ON FUNCTION public.aprobar_solicitud_insumo(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rechazar_solicitud_insumo(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_nurses() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ayuda_chat_resolver_usuarios(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.faq_buscar(text,uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.faq_incrementar_uso(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.chat_registrar_pendiente(text,uuid,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.faq_buscar(text,uuid,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.loyalty_generate_barcode(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.loyalty_recalculate_level(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.loyalty_expire_points() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM anon;
REVOKE EXECUTE ON FUNCTION public.confirmar_recepcion_mercancia(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.aprobar_diferencia_factura(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_has_clinic_role(uuid,uuid,app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_clinic_status(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_clinic_archived(uuid,boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_supervisor_pin(uuid,uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.turno_fondo_movimiento(uuid,text,numeric,text,text,uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pharmacy_fondo_movimiento(uuid,text,numeric,text,text,uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.turno_open(uuid,uuid,numeric,numeric,numeric,jsonb,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_doctor_user_creation() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_nurse_user_creation() FROM anon;
REVOKE EXECUTE ON FUNCTION public.provision_link_user(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.provision_on_auth_user_created() FROM anon;
REVOKE EXECUTE ON FUNCTION public.provision_link_by_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_membership_on_deactivate() FROM anon;
REVOKE EXECUTE ON FUNCTION public.pnl_mensual(uuid,date,date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.flujo_efectivo(uuid,date,date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.kpis_dashboard(uuid,date,date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.contab_valida_periodo_movimiento_manual() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_patient_clinic(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.camino_registrar_cobro(uuid,numeric,text,text,text) FROM anon;
