-- Auditoría de acceso 2026-07-20: 60 funciones SECURITY DEFINER ejecutables por `anon`
-- (get_advisors security lint "Public Can Execute SECURITY DEFINER Function").
-- Este archivo cierra el grupo de funciones que mueven dinero/inventario/turnos y
-- reportes financieros de negocio: el frontend ya exige login para todas, así que
-- REVOKE FROM PUBLIC + GRANT TO authenticated no cambia comportamiento de usuarios
-- reales, solo cierra la puerta a la anon key pública.
--
-- NO incluidas aquí (requieren análisis de dependencias antes de tocar, próxima
-- migración): funciones trigger-only/cron (notify_new_user_signup,
-- provision_on_auth_user_created, cleanup_abandoned_bot_sesiones, etc.) y
-- funciones predicado usadas dentro de policies RLS (is_staff, is_global_admin,
-- user_has_clinic_access, etc.) — revocarlas sin verificar qué policies las
-- referencian puede romper RLS para usuarios legítimos.

REVOKE EXECUTE ON FUNCTION public.aprobar_diferencia_factura(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aprobar_diferencia_factura(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.aprobar_solicitud_insumo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aprobar_solicitud_insumo(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.rechazar_solicitud_insumo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rechazar_solicitud_insumo(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.confirmar_recepcion_mercancia(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirmar_recepcion_mercancia(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.camino_registrar_cobro(uuid, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.camino_registrar_cobro(uuid, numeric, text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.firmar_acta_merma(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.firmar_acta_merma(uuid, uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_supervisor_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_supervisor_pin(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.verify_supervisor_pin(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_supervisor_pin(uuid, uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_clinic_archived(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_clinic_archived(uuid, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_clinic_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_clinic_status(uuid, text) TO authenticated;

-- pharmacy_*
REVOKE EXECUTE ON FUNCTION public.pharmacy_open_shift(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_open_shift(uuid, numeric, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.pharmacy_close_shift(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_close_shift(uuid, numeric, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.pharmacy_close_shift(uuid, numeric, text, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_close_shift(uuid, numeric, text, boolean, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.pharmacy_close_shift_with_pin(uuid, uuid, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_close_shift_with_pin(uuid, uuid, text, numeric, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.pharmacy_corte_x(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_corte_x(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.pharmacy_fondo_movimiento(uuid, text, numeric, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_fondo_movimiento(uuid, text, numeric, text, text, uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.pharmacy_register_sale(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_register_sale(jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.pharmacy_register_return(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_register_return(jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.pharmacy_recompute_prescription_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_recompute_prescription_status(uuid) TO authenticated;

-- turno_* / corte_*
REVOKE EXECUTE ON FUNCTION public.turno_open(uuid, uuid, numeric, numeric, numeric, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.turno_open(uuid, uuid, numeric, numeric, numeric, jsonb, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.turno_close(uuid, numeric, text, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.turno_close(uuid, numeric, text, boolean, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.turno_close_with_pin(uuid, uuid, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.turno_close_with_pin(uuid, uuid, text, numeric, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.turno_corte_x(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.turno_corte_x(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.turno_fondo_movimiento(uuid, text, numeric, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.turno_fondo_movimiento(uuid, text, numeric, text, text, uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.corte_set_fondo(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.corte_set_fondo(uuid, numeric) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.corte_set_pago_declarado(uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.corte_set_pago_declarado(uuid, text, numeric) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.corte_set_tarjeta_tpv(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.corte_set_tarjeta_tpv(uuid, numeric) TO authenticated;

-- reportes financieros
REVOKE EXECUTE ON FUNCTION public.kpis_dashboard(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kpis_dashboard(uuid, date, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.pnl_mensual(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pnl_mensual(uuid, date, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.flujo_efectivo(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flujo_efectivo(uuid, date, date) TO authenticated;

-- staff / usuarios (info sensible de personal)
REVOKE EXECUTE ON FUNCTION public.get_clinic_supervisors(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_clinic_supervisors(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_nurses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_nurses() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_prescription_audit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_prescription_audit(uuid) TO authenticated;

-- loyalty (mutan puntos/nivel, deben requerir login)
REVOKE EXECUTE ON FUNCTION public.loyalty_generate_barcode(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.loyalty_generate_barcode(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.loyalty_recalculate_level(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.loyalty_recalculate_level(uuid) TO authenticated;

-- diagnóstico admin (mínimo autenticado; el body debe validar is_global_admin)
REVOKE EXECUTE ON FUNCTION public.multiclinic_diagnostics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.multiclinic_diagnostics() TO authenticated;
