-- Fix auth_rls_initplan WARN advisors: wrap auth.uid()/auth.email() in
-- (select ...) so Postgres evaluates once via InitPlan instead of per row.
-- Same policy semantics, no logic change. See CLAUDE.md checklist ref 2026-07-04 audit.

DROP POLICY IF EXISTS "Members read activos_fijos" ON public.activos_fijos;
CREATE POLICY "Members read activos_fijos" ON public.activos_fijos AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM clinic_memberships
  WHERE ((clinic_memberships.user_id = (select auth.uid())) AND (clinic_memberships.clinic_id = activos_fijos.clinic_id)))));

DROP POLICY IF EXISTS "Admins update tasas depreciacion" ON public.activos_fijos_tasas;
CREATE POLICY "Admins update tasas depreciacion" ON public.activos_fijos_tasas AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Members read appointment_insumos" ON public.appointment_insumos;
CREATE POLICY "Members read appointment_insumos" ON public.appointment_insumos AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM clinic_memberships
  WHERE ((clinic_memberships.user_id = (select auth.uid())) AND (clinic_memberships.clinic_id = appointment_insumos.clinic_id)))));

DROP POLICY IF EXISTS "catalogo_modulos_staff_all" ON public.catalogo_modulos;
CREATE POLICY "catalogo_modulos_staff_all" ON public.catalogo_modulos AS PERMISSIVE FOR ALL TO authenticated
  USING (is_global_admin((select auth.uid())))
  WITH CHECK (is_global_admin((select auth.uid())));

DROP POLICY IF EXISTS "cliente_modulos_own_clinic_read" ON public.cliente_modulos;
CREATE POLICY "cliente_modulos_own_clinic_read" ON public.cliente_modulos AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_has_clinic_access((select auth.uid()), clinic_id));

DROP POLICY IF EXISTS "cliente_modulos_staff_all" ON public.cliente_modulos;
CREATE POLICY "cliente_modulos_staff_all" ON public.cliente_modulos AS PERMISSIVE FOR ALL TO authenticated
  USING (is_global_admin((select auth.uid())))
  WITH CHECK (is_global_admin((select auth.uid())));

DROP POLICY IF EXISTS "Members read contab_asientos_pendientes" ON public.contab_asientos_pendientes;
CREATE POLICY "Members read contab_asientos_pendientes" ON public.contab_asientos_pendientes AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM clinic_memberships
  WHERE ((clinic_memberships.user_id = (select auth.uid())) AND (clinic_memberships.clinic_id = contab_asientos_pendientes.clinic_id)))));

DROP POLICY IF EXISTS "Members read contab_cierres" ON public.contab_cierres;
CREATE POLICY "Members read contab_cierres" ON public.contab_cierres AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM clinic_memberships
  WHERE ((clinic_memberships.user_id = (select auth.uid())) AND (clinic_memberships.clinic_id = contab_cierres.clinic_id)))));

DROP POLICY IF EXISTS "Members read contab_estados_cuenta" ON public.contab_estados_cuenta;
CREATE POLICY "Members read contab_estados_cuenta" ON public.contab_estados_cuenta AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM clinic_memberships
  WHERE ((clinic_memberships.user_id = (select auth.uid())) AND (clinic_memberships.clinic_id = contab_estados_cuenta.clinic_id)))));

DROP POLICY IF EXISTS "Admins update contab_reglas_asiento" ON public.contab_reglas_asiento;
CREATE POLICY "Admins update contab_reglas_asiento" ON public.contab_reglas_asiento AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role((select auth.uid()), 'admin'::app_role) AND ((clinic_id IS NULL) OR (EXISTS ( SELECT 1
   FROM clinic_memberships
  WHERE ((clinic_memberships.user_id = (select auth.uid())) AND (clinic_memberships.clinic_id = contab_reglas_asiento.clinic_id)))))))
  WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND ((clinic_id IS NULL) OR (EXISTS ( SELECT 1
   FROM clinic_memberships
  WHERE ((clinic_memberships.user_id = (select auth.uid())) AND (clinic_memberships.clinic_id = contab_reglas_asiento.clinic_id)))))));

DROP POLICY IF EXISTS "Admins write contab_reglas_asiento" ON public.contab_reglas_asiento;
CREATE POLICY "Admins write contab_reglas_asiento" ON public.contab_reglas_asiento AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND ((clinic_id IS NULL) OR (EXISTS ( SELECT 1
   FROM clinic_memberships
  WHERE ((clinic_memberships.user_id = (select auth.uid())) AND (clinic_memberships.clinic_id = contab_reglas_asiento.clinic_id)))))));

DROP POLICY IF EXISTS "Members read contab_reglas_asiento" ON public.contab_reglas_asiento;
CREATE POLICY "Members read contab_reglas_asiento" ON public.contab_reglas_asiento AS PERMISSIVE FOR SELECT TO authenticated
  USING (((clinic_id IS NULL) OR (EXISTS ( SELECT 1
   FROM clinic_memberships
  WHERE ((clinic_memberships.user_id = (select auth.uid())) AND (clinic_memberships.clinic_id = contab_reglas_asiento.clinic_id))))));

DROP POLICY IF EXISTS "staff_read" ON public.conversacion_analisis;
CREATE POLICY "staff_read" ON public.conversacion_analisis AS PERMISSIVE FOR SELECT TO public
  USING (((select auth.uid()) IN ( SELECT clinic_memberships.user_id
   FROM clinic_memberships
  WHERE (clinic_memberships.clinic_id = conversacion_analisis.clinic_id))));

DROP POLICY IF EXISTS "costos_reales_staff_all" ON public.costos_reales_mensuales;
CREATE POLICY "costos_reales_staff_all" ON public.costos_reales_mensuales AS PERMISSIVE FOR ALL TO authenticated
  USING (is_global_admin((select auth.uid())))
  WITH CHECK (is_global_admin((select auth.uid())));

DROP POLICY IF EXISTS "Admins insert cuentas contables" ON public.cuentas_contables;
CREATE POLICY "Admins insert cuentas contables" ON public.cuentas_contables AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update cuentas contables" ON public.cuentas_contables;
CREATE POLICY "Admins update cuentas contables" ON public.cuentas_contables AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins insert honorarios config" ON public.doctor_honorarios_config;
CREATE POLICY "Admins insert honorarios config" ON public.doctor_honorarios_config AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'manager'::app_role)) AND (EXISTS ( SELECT 1
   FROM clinic_memberships
  WHERE ((clinic_memberships.user_id = (select auth.uid())) AND (clinic_memberships.clinic_id = doctor_honorarios_config.clinic_id))))));

DROP POLICY IF EXISTS "Members read honorarios config" ON public.doctor_honorarios_config;
CREATE POLICY "Members read honorarios config" ON public.doctor_honorarios_config AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM clinic_memberships
  WHERE ((clinic_memberships.user_id = (select auth.uid())) AND (clinic_memberships.clinic_id = doctor_honorarios_config.clinic_id)))));

DROP POLICY IF EXISTS "Caja staff registra fondos" ON public.fondos_movimientos;
CREATE POLICY "Caja staff registra fondos" ON public.fondos_movimientos AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_has_clinic_access((select auth.uid()), clinic_id) AND is_caja_staff((select auth.uid())) AND (tipo <> 'cash_drop'::text)));

DROP POLICY IF EXISTS "honorario_pagos_manual_select_member" ON public.honorario_pagos_manual;
CREATE POLICY "honorario_pagos_manual_select_member" ON public.honorario_pagos_manual AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM clinic_memberships
  WHERE ((clinic_memberships.user_id = (select auth.uid())) AND (clinic_memberships.clinic_id = honorario_pagos_manual.clinic_id)))));

DROP POLICY IF EXISTS "loyalty_members_pwa_auth_read" ON public.loyalty_members;
CREATE POLICY "loyalty_members_pwa_auth_read" ON public.loyalty_members AS PERMISSIVE FOR SELECT TO authenticated
  USING (((telefono = (( SELECT auth.jwt() AS jwt) ->> 'phone'::text)) OR (email = (select auth.email()))));

DROP POLICY IF EXISTS "Admins insert egresos manuales" ON public.movimientos_contables;
CREATE POLICY "Admins insert egresos manuales" ON public.movimientos_contables AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((origen = 'manual'::text) AND (created_by = (select auth.uid())) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'manager'::app_role)) AND (EXISTS ( SELECT 1
   FROM clinic_memberships
  WHERE ((clinic_memberships.user_id = (select auth.uid())) AND (clinic_memberships.clinic_id = movimientos_contables.clinic_id))))));

DROP POLICY IF EXISTS "Members read movimientos contables" ON public.movimientos_contables;
CREATE POLICY "Members read movimientos contables" ON public.movimientos_contables AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM clinic_memberships
  WHERE ((clinic_memberships.user_id = (select auth.uid())) AND (clinic_memberships.clinic_id = movimientos_contables.clinic_id)))));

DROP POLICY IF EXISTS "phi_access_log_read_clinic_admin" ON public.phi_access_log;
CREATE POLICY "phi_access_log_read_clinic_admin" ON public.phi_access_log AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_has_clinic_role((select auth.uid()), clinic_id, 'admin'::app_role));

DROP POLICY IF EXISTS "phi_access_log_read_platform_staff" ON public.phi_access_log;
CREATE POLICY "phi_access_log_read_platform_staff" ON public.phi_access_log AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_global_admin((select auth.uid())));

DROP POLICY IF EXISTS "platform_staff_self_read" ON public.platform_staff;
CREATE POLICY "platform_staff_self_read" ON public.platform_staff AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_global_admin((select auth.uid())));

DROP POLICY IF EXISTS "Members read poliza_partidas" ON public.poliza_partidas;
CREATE POLICY "Members read poliza_partidas" ON public.poliza_partidas AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (polizas p
     JOIN clinic_memberships cm ON ((cm.clinic_id = p.clinic_id)))
  WHERE ((p.id = poliza_partidas.poliza_id) AND (cm.user_id = (select auth.uid()))))));

DROP POLICY IF EXISTS "Members read polizas" ON public.polizas;
CREATE POLICY "Members read polizas" ON public.polizas AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM clinic_memberships
  WHERE ((clinic_memberships.user_id = (select auth.uid())) AND (clinic_memberships.clinic_id = polizas.clinic_id)))));

DROP POLICY IF EXISTS "saas_billing_alerts_staff_all" ON public.saas_billing_alerts;
CREATE POLICY "saas_billing_alerts_staff_all" ON public.saas_billing_alerts AS PERMISSIVE FOR ALL TO authenticated
  USING (is_global_admin((select auth.uid())))
  WITH CHECK (is_global_admin((select auth.uid())));

DROP POLICY IF EXISTS "clinic scoped read alertas" ON public.whatsapp_audit_alertas;
CREATE POLICY "clinic scoped read alertas" ON public.whatsapp_audit_alertas AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_has_clinic_access((select auth.uid()), clinic_id));

DROP POLICY IF EXISTS "clinic scoped resolve alertas" ON public.whatsapp_audit_alertas;
CREATE POLICY "clinic scoped resolve alertas" ON public.whatsapp_audit_alertas AS PERMISSIVE FOR UPDATE TO authenticated
  USING (user_has_clinic_access((select auth.uid()), clinic_id))
  WITH CHECK (user_has_clinic_access((select auth.uid()), clinic_id));

DROP POLICY IF EXISTS "platform staff read all alertas" ON public.whatsapp_audit_alertas;
CREATE POLICY "platform staff read all alertas" ON public.whatsapp_audit_alertas AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_global_admin((select auth.uid())));
