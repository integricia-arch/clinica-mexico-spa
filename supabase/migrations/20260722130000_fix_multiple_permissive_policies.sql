-- Fix multiple_permissive_policies WARN advisors.
-- Rule (Postgres RLS semantics): permissive policies for the same command OR
-- their USING/WITH CHECK together already. Merging N permissive policies for the
-- same cmd into 1 policy with qual = OR(quals) is behavior-identical, not a security
-- change -- just fewer policy evaluations per query. Where one policy was FOR ALL,
-- it is split into INSERT/UPDATE/DELETE (unchanged) + folded into the merged SELECT/
-- UPDATE policy, since Postgres has no 'FOR INSERT,UPDATE,DELETE' combined syntax.


-- === catalogo_modulos ===
DROP POLICY IF EXISTS "catalogo_modulos_authenticated_read" ON public.catalogo_modulos;
DROP POLICY IF EXISTS "catalogo_modulos_staff_all" ON public.catalogo_modulos;
CREATE POLICY "catalogo_modulos_select" ON public.catalogo_modulos AS PERMISSIVE FOR SELECT TO authenticated
  USING (((activo = true)) OR (is_global_admin(( SELECT auth.uid() AS uid))));
CREATE POLICY "catalogo_modulos_insert" ON public.catalogo_modulos AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_global_admin(( SELECT auth.uid() AS uid)));
CREATE POLICY "catalogo_modulos_update" ON public.catalogo_modulos AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_global_admin(( SELECT auth.uid() AS uid)))
  WITH CHECK (is_global_admin(( SELECT auth.uid() AS uid)));
CREATE POLICY "catalogo_modulos_delete" ON public.catalogo_modulos AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_global_admin(( SELECT auth.uid() AS uid)));

-- === cfdi_documentos ===
DROP POLICY IF EXISTS "cfdi_documentos_admin_all" ON public.cfdi_documentos;
DROP POLICY IF EXISTS "cfdi_documentos_receptionist_read" ON public.cfdi_documentos;
CREATE POLICY "cfdi_documentos_select" ON public.cfdi_documentos AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'receptionist'::app_role])))))) OR ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = 'admin'::app_role))))));
CREATE POLICY "cfdi_documentos_insert" ON public.cfdi_documentos AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = 'admin'::app_role)))));
CREATE POLICY "cfdi_documentos_update" ON public.cfdi_documentos AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = 'admin'::app_role)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = 'admin'::app_role)))));
CREATE POLICY "cfdi_documentos_delete" ON public.cfdi_documentos AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = 'admin'::app_role)))));

-- === cfdi_receptores ===
DROP POLICY IF EXISTS "cfdi_receptores_admin_write" ON public.cfdi_receptores;
DROP POLICY IF EXISTS "cfdi_receptores_receptionist_read" ON public.cfdi_receptores;
CREATE POLICY "cfdi_receptores_select" ON public.cfdi_receptores AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'receptionist'::app_role])))))) OR ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = 'admin'::app_role))))));
CREATE POLICY "cfdi_receptores_insert" ON public.cfdi_receptores AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = 'admin'::app_role)))));
CREATE POLICY "cfdi_receptores_update" ON public.cfdi_receptores AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = 'admin'::app_role)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = 'admin'::app_role)))));
CREATE POLICY "cfdi_receptores_delete" ON public.cfdi_receptores AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = 'admin'::app_role)))));

-- === chat_preguntas_pendientes ===
DROP POLICY IF EXISTS "pendientes_read" ON public.chat_preguntas_pendientes;
DROP POLICY IF EXISTS "pendientes_write" ON public.chat_preguntas_pendientes;
CREATE POLICY "chat_pendientes_select" ON public.chat_preguntas_pendientes AS PERMISSIVE FOR SELECT TO public
  USING (is_clinic_staff(( SELECT auth.uid() AS uid)));
CREATE POLICY "chat_pendientes_insert" ON public.chat_preguntas_pendientes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_clinic_staff(( SELECT auth.uid() AS uid)));
CREATE POLICY "chat_pendientes_update" ON public.chat_preguntas_pendientes AS PERMISSIVE FOR UPDATE TO public
  USING (is_clinic_staff(( SELECT auth.uid() AS uid)))
  WITH CHECK (is_clinic_staff(( SELECT auth.uid() AS uid)));
CREATE POLICY "chat_pendientes_delete" ON public.chat_preguntas_pendientes AS PERMISSIVE FOR DELETE TO public
  USING (is_clinic_staff(( SELECT auth.uid() AS uid)));

-- === cliente_modulos ===
DROP POLICY IF EXISTS "cliente_modulos_own_clinic_read" ON public.cliente_modulos;
DROP POLICY IF EXISTS "cliente_modulos_staff_all" ON public.cliente_modulos;
CREATE POLICY "cliente_modulos_select" ON public.cliente_modulos AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id)) OR (is_global_admin(( SELECT auth.uid() AS uid))));
CREATE POLICY "cliente_modulos_insert" ON public.cliente_modulos AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_global_admin(( SELECT auth.uid() AS uid)));
CREATE POLICY "cliente_modulos_update" ON public.cliente_modulos AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_global_admin(( SELECT auth.uid() AS uid)))
  WITH CHECK (is_global_admin(( SELECT auth.uid() AS uid)));
CREATE POLICY "cliente_modulos_delete" ON public.cliente_modulos AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_global_admin(( SELECT auth.uid() AS uid)));

-- === conceptos ===
DROP POLICY IF EXISTS "Admin gestiona conceptos" ON public.conceptos;
DROP POLICY IF EXISTS "Caja staff lee conceptos" ON public.conceptos;
CREATE POLICY "Conceptos select" ON public.conceptos AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND is_caja_staff(( SELECT auth.uid() AS uid)))) OR ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND can_configure_caja(( SELECT auth.uid() AS uid)))));
CREATE POLICY "Conceptos insert" ON public.conceptos AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND can_configure_caja(( SELECT auth.uid() AS uid))));
CREATE POLICY "Conceptos update" ON public.conceptos AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND can_configure_caja(( SELECT auth.uid() AS uid))))
  WITH CHECK ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND can_configure_caja(( SELECT auth.uid() AS uid))));
CREATE POLICY "Conceptos delete" ON public.conceptos AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND can_configure_caja(( SELECT auth.uid() AS uid))));

-- === doctor_bloqueos ===
DROP POLICY IF EXISTS "bloqueos_manage" ON public.doctor_bloqueos;
DROP POLICY IF EXISTS "bloqueos_select" ON public.doctor_bloqueos;
CREATE POLICY "doctor_bloqueos_select" ON public.doctor_bloqueos AS PERMISSIVE FOR SELECT TO public
  USING (((clinic_id IN ( SELECT cm.clinic_id FROM clinic_memberships cm WHERE (cm.user_id = ( SELECT auth.uid() AS uid))))) OR ((clinic_id IN ( SELECT cm.clinic_id FROM clinic_memberships cm WHERE ((cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role, 'receptionist'::app_role])))))));
CREATE POLICY "doctor_bloqueos_insert" ON public.doctor_bloqueos AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((clinic_id IN ( SELECT cm.clinic_id FROM clinic_memberships cm WHERE ((cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role, 'receptionist'::app_role]))))));
CREATE POLICY "doctor_bloqueos_update" ON public.doctor_bloqueos AS PERMISSIVE FOR UPDATE TO public
  USING ((clinic_id IN ( SELECT cm.clinic_id FROM clinic_memberships cm WHERE ((cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role, 'receptionist'::app_role]))))))
  WITH CHECK ((clinic_id IN ( SELECT cm.clinic_id FROM clinic_memberships cm WHERE ((cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role, 'receptionist'::app_role]))))));
CREATE POLICY "doctor_bloqueos_delete" ON public.doctor_bloqueos AS PERMISSIVE FOR DELETE TO public
  USING ((clinic_id IN ( SELECT cm.clinic_id FROM clinic_memberships cm WHERE ((cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role, 'receptionist'::app_role]))))));

-- === doctor_servicios ===
DROP POLICY IF EXISTS "Staff view doctor services" ON public.doctor_servicios;

-- === doctors ===
DROP POLICY IF EXISTS "Staff views doctors" ON public.doctors;

-- === expedientes ===
DROP POLICY IF EXISTS "Shared expediente select" ON public.expedientes;
DROP POLICY IF EXISTS "Staff read expedientes" ON public.expedientes;
CREATE POLICY "expedientes_select_merged" ON public.expedientes AS PERMISSIVE FOR SELECT TO authenticated
  USING (((has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'doctor'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'nurse'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'receptionist'::app_role))) OR ((EXISTS ( SELECT 1 FROM (expediente_permissions ep JOIN doctors d ON ((d.id = ep.doctor_id))) WHERE ((ep.expediente_id = expedientes.id) AND (d.user_id = ( SELECT auth.uid() AS uid)) AND (ep.clinic_id IN ( SELECT clinic_memberships.clinic_id FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.status = 'active'::text)))))))));
DROP POLICY IF EXISTS "Admin/doctor update expedientes" ON public.expedientes;
DROP POLICY IF EXISTS "Shared expediente edit" ON public.expedientes;
CREATE POLICY "expedientes_update_merged" ON public.expedientes AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'doctor'::app_role))) OR ((EXISTS ( SELECT 1 FROM (expediente_permissions ep JOIN doctors d ON ((d.id = ep.doctor_id))) WHERE ((ep.expediente_id = expedientes.id) AND (d.user_id = ( SELECT auth.uid() AS uid)) AND (ep.permission = 'edit'::text) AND (ep.clinic_id IN ( SELECT clinic_memberships.clinic_id FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.status = 'active'::text)))))))))
  WITH CHECK (((has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'doctor'::app_role))) OR ((EXISTS ( SELECT 1 FROM (expediente_permissions ep JOIN doctors d ON ((d.id = ep.doctor_id))) WHERE ((ep.expediente_id = expedientes.id) AND (d.user_id = ( SELECT auth.uid() AS uid)) AND (ep.permission = 'edit'::text) AND (ep.clinic_id IN ( SELECT clinic_memberships.clinic_id FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.status = 'active'::text)))))))));

-- === faq_items ===
DROP POLICY IF EXISTS "faq_admin" ON public.faq_items;
DROP POLICY IF EXISTS "faq_read" ON public.faq_items;
CREATE POLICY "faq_items_select" ON public.faq_items AS PERMISSIVE FOR SELECT TO public
  USING (true);
CREATE POLICY "faq_items_insert" ON public.faq_items AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_clinic_staff(( SELECT auth.uid() AS uid)));
CREATE POLICY "faq_items_update" ON public.faq_items AS PERMISSIVE FOR UPDATE TO public
  USING (is_clinic_staff(( SELECT auth.uid() AS uid)))
  WITH CHECK (is_clinic_staff(( SELECT auth.uid() AS uid)));
CREATE POLICY "faq_items_delete" ON public.faq_items AS PERMISSIVE FOR DELETE TO public
  USING (is_clinic_staff(( SELECT auth.uid() AS uid)));

-- === impresoras ===
DROP POLICY IF EXISTS "Admin gestiona impresoras" ON public.impresoras;
DROP POLICY IF EXISTS "Caja staff lee impresoras" ON public.impresoras;
CREATE POLICY "Impresoras select" ON public.impresoras AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND is_caja_staff(( SELECT auth.uid() AS uid)))) OR ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND can_configure_caja(( SELECT auth.uid() AS uid)))));
CREATE POLICY "Impresoras insert" ON public.impresoras AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND can_configure_caja(( SELECT auth.uid() AS uid))));
CREATE POLICY "Impresoras update" ON public.impresoras AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND can_configure_caja(( SELECT auth.uid() AS uid))))
  WITH CHECK ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND can_configure_caja(( SELECT auth.uid() AS uid))));
CREATE POLICY "Impresoras delete" ON public.impresoras AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND can_configure_caja(( SELECT auth.uid() AS uid))));

-- === loyalty_config ===
DROP POLICY IF EXISTS "loyalty_config_clinic_member" ON public.loyalty_config;
CREATE POLICY "loyalty_config_clinic_member" ON public.loyalty_config AS PERMISSIVE FOR ALL TO authenticated
  USING ((clinic_id IN ( SELECT clinic_memberships.clinic_id FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))))));

-- === loyalty_members ===
DROP POLICY IF EXISTS "loyalty_members_pwa_auth_read" ON public.loyalty_members;
DROP POLICY IF EXISTS "loyalty_members_pwa_update_consent" ON public.loyalty_members;
DROP POLICY IF EXISTS "loyalty_members_staff" ON public.loyalty_members;
CREATE POLICY "loyalty_members_select" ON public.loyalty_members AS PERMISSIVE FOR SELECT TO public
  USING ((((telefono = (( SELECT auth.jwt() AS jwt) ->> 'phone'::text)) OR (email = ( SELECT auth.email() AS email)))) OR ((clinic_id IN ( SELECT clinic_memberships.clinic_id FROM clinic_memberships WHERE (clinic_memberships.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "loyalty_members_update" ON public.loyalty_members AS PERMISSIVE FOR UPDATE TO public
  USING (((telefono = ( SELECT users.phone FROM auth.users WHERE (users.id = ( SELECT auth.uid() AS uid))))) OR ((clinic_id IN ( SELECT clinic_memberships.clinic_id FROM clinic_memberships WHERE (clinic_memberships.user_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK (((telefono = ( SELECT users.phone FROM auth.users WHERE (users.id = ( SELECT auth.uid() AS uid))))) OR ((clinic_id IN ( SELECT clinic_memberships.clinic_id FROM clinic_memberships WHERE (clinic_memberships.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "loyalty_members_insert" ON public.loyalty_members AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((clinic_id IN ( SELECT clinic_memberships.clinic_id FROM clinic_memberships WHERE (clinic_memberships.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "loyalty_members_delete" ON public.loyalty_members AS PERMISSIVE FOR DELETE TO public
  USING ((clinic_id IN ( SELECT clinic_memberships.clinic_id FROM clinic_memberships WHERE (clinic_memberships.user_id = ( SELECT auth.uid() AS uid)))));

-- === loyalty_movimientos ===
DROP POLICY IF EXISTS "loyalty_mov_pwa_auth_read" ON public.loyalty_movimientos;
DROP POLICY IF EXISTS "loyalty_mov_select" ON public.loyalty_movimientos;
CREATE POLICY "loyalty_mov_select_merged" ON public.loyalty_movimientos AS PERMISSIVE FOR SELECT TO public
  USING (((member_id IN ( SELECT lm.id FROM loyalty_members lm WHERE ((lm.telefono = ( SELECT users.phone FROM auth.users WHERE (users.id = ( SELECT auth.uid() AS uid)))) AND (lm.clinic_id = loyalty_movimientos.clinic_id))))) OR ((clinic_id IN ( SELECT clinic_memberships.clinic_id FROM clinic_memberships WHERE (clinic_memberships.user_id = ( SELECT auth.uid() AS uid))))));

-- === manual_paginas ===
DROP POLICY IF EXISTS "manual_paginas_select_authenticated" ON public.manual_paginas;
DROP POLICY IF EXISTS "manual_paginas_write_admin" ON public.manual_paginas;
CREATE POLICY "manual_paginas_select" ON public.manual_paginas AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "manual_paginas_insert" ON public.manual_paginas AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role));
CREATE POLICY "manual_paginas_update" ON public.manual_paginas AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role))
  WITH CHECK (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role));
CREATE POLICY "manual_paginas_delete" ON public.manual_paginas AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role));

-- === medicamento_proveedores ===
DROP POLICY IF EXISTS "med_prov_select_clinic_member" ON public.medicamento_proveedores;
DROP POLICY IF EXISTS "med_prov_write_admin" ON public.medicamento_proveedores;
CREATE POLICY "med_prov_select" ON public.medicamento_proveedores AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1 FROM (medicamentos m JOIN clinic_memberships cm ON ((cm.clinic_id = m.clinic_id))) WHERE ((m.id = medicamento_proveedores.medicamento_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.status = 'active'::text))))) OR ((EXISTS ( SELECT 1 FROM (medicamentos m JOIN clinic_memberships cm ON ((cm.clinic_id = m.clinic_id))) WHERE ((m.id = medicamento_proveedores.medicamento_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.status = 'active'::text) AND (cm.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role])))))));
CREATE POLICY "med_prov_insert" ON public.medicamento_proveedores AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1 FROM (medicamentos m JOIN clinic_memberships cm ON ((cm.clinic_id = m.clinic_id))) WHERE ((m.id = medicamento_proveedores.medicamento_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.status = 'active'::text) AND (cm.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))))));
CREATE POLICY "med_prov_update" ON public.medicamento_proveedores AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1 FROM (medicamentos m JOIN clinic_memberships cm ON ((cm.clinic_id = m.clinic_id))) WHERE ((m.id = medicamento_proveedores.medicamento_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.status = 'active'::text) AND (cm.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM (medicamentos m JOIN clinic_memberships cm ON ((cm.clinic_id = m.clinic_id))) WHERE ((m.id = medicamento_proveedores.medicamento_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.status = 'active'::text) AND (cm.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))))));
CREATE POLICY "med_prov_delete" ON public.medicamento_proveedores AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1 FROM (medicamentos m JOIN clinic_memberships cm ON ((cm.clinic_id = m.clinic_id))) WHERE ((m.id = medicamento_proveedores.medicamento_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.status = 'active'::text) AND (cm.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))))));

-- === metodos_pago ===
DROP POLICY IF EXISTS "Admin gestiona metodos_pago" ON public.metodos_pago;
DROP POLICY IF EXISTS "Caja staff lee metodos_pago" ON public.metodos_pago;
CREATE POLICY "Metodos pago select" ON public.metodos_pago AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND is_caja_staff(( SELECT auth.uid() AS uid)))) OR ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND can_configure_caja(( SELECT auth.uid() AS uid)))));
CREATE POLICY "Metodos pago insert" ON public.metodos_pago AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND can_configure_caja(( SELECT auth.uid() AS uid))));
CREATE POLICY "Metodos pago update" ON public.metodos_pago AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND can_configure_caja(( SELECT auth.uid() AS uid))))
  WITH CHECK ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND can_configure_caja(( SELECT auth.uid() AS uid))));
CREATE POLICY "Metodos pago delete" ON public.metodos_pago AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND can_configure_caja(( SELECT auth.uid() AS uid))));

-- === nurses ===
DROP POLICY IF EXISTS "Staff view nurses" ON public.nurses;
DROP POLICY IF EXISTS "Admins manage nurses" ON public.nurses;
DROP POLICY IF EXISTS "Nurses update own" ON public.nurses;
CREATE POLICY "nurses_select" ON public.nurses AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_staff()) OR (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)));
CREATE POLICY "nurses_update" ON public.nurses AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)))
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)));
CREATE POLICY "nurses_insert" ON public.nurses AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role));
CREATE POLICY "nurses_delete" ON public.nurses AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role));

-- === patient_studies ===
DROP POLICY IF EXISTS "Clinic staff manage patient_studies" ON public.patient_studies;
DROP POLICY IF EXISTS "Patient view own studies" ON public.patient_studies;
CREATE POLICY "patient_studies_select" ON public.patient_studies AS PERMISSIVE FOR SELECT TO authenticated
  USING (((patient_id IN ( SELECT patients.id FROM patients WHERE (patients.user_id = ( SELECT auth.uid() AS uid))))) OR ((clinic_id IN ( SELECT clinic_memberships.clinic_id FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.status = 'active'::text))))));
CREATE POLICY "patient_studies_insert" ON public.patient_studies AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((clinic_id IN ( SELECT clinic_memberships.clinic_id FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.status = 'active'::text)))));
CREATE POLICY "patient_studies_update" ON public.patient_studies AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((clinic_id IN ( SELECT clinic_memberships.clinic_id FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.status = 'active'::text)))))
  WITH CHECK ((clinic_id IN ( SELECT clinic_memberships.clinic_id FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.status = 'active'::text)))));
CREATE POLICY "patient_studies_delete" ON public.patient_studies AS PERMISSIVE FOR DELETE TO authenticated
  USING ((clinic_id IN ( SELECT clinic_memberships.clinic_id FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.status = 'active'::text)))));

-- === payment_transactions ===
DROP POLICY IF EXISTS "payment_transactions_admin_all" ON public.payment_transactions;
DROP POLICY IF EXISTS "payment_transactions_read_staff" ON public.payment_transactions;
CREATE POLICY "payment_transactions_select" ON public.payment_transactions AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'receptionist'::app_role, 'cajero'::app_role])))))) OR ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = 'admin'::app_role))))));
CREATE POLICY "payment_transactions_insert" ON public.payment_transactions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = 'admin'::app_role)))));
CREATE POLICY "payment_transactions_update" ON public.payment_transactions AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = 'admin'::app_role)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = 'admin'::app_role)))));
CREATE POLICY "payment_transactions_delete" ON public.payment_transactions AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND (user_roles.role = 'admin'::app_role)))));

-- === pharmacy_cash_shifts ===
DROP POLICY IF EXISTS "Cashier/manager updates shift" ON public.pharmacy_cash_shifts;
DROP POLICY IF EXISTS "cashier_manager_updates_shift" ON public.pharmacy_cash_shifts;
CREATE POLICY "pharmacy_cash_shifts_update_merged" ON public.pharmacy_cash_shifts AS PERMISSIVE FOR UPDATE TO public
  USING ((((cashier_user_id = ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role))) OR (((cashier_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND ((user_roles.role)::text = ANY (ARRAY['admin'::text, 'manager'::text]))))))))
  WITH CHECK (((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND ((cashier_user_id = ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role)))) OR (user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id)));

-- === phi_access_log ===
DROP POLICY IF EXISTS "phi_access_log_read_clinic_admin" ON public.phi_access_log;
DROP POLICY IF EXISTS "phi_access_log_read_platform_staff" ON public.phi_access_log;
CREATE POLICY "phi_access_log_select_merged" ON public.phi_access_log AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_has_clinic_role(( SELECT auth.uid() AS uid), clinic_id, 'admin'::app_role)) OR (is_global_admin(( SELECT auth.uid() AS uid))));

-- === post_consultation_followups ===
DROP POLICY IF EXISTS "Patient read own followups" ON public.post_consultation_followups;
DROP POLICY IF EXISTS "Staff read followups" ON public.post_consultation_followups;
CREATE POLICY "followups_select_merged" ON public.post_consultation_followups AS PERMISSIVE FOR SELECT TO authenticated
  USING (((patient_id IN ( SELECT patients.id FROM patients WHERE (patients.user_id = ( SELECT auth.uid() AS uid))))) OR (is_clinic_staff(( SELECT auth.uid() AS uid))));

-- === prescription_items ===
DROP POLICY IF EXISTS "prescription_items_patient_read_own" ON public.prescription_items;
DROP POLICY IF EXISTS "prescription_items_staff_clinic_scope" ON public.prescription_items;
CREATE POLICY "prescription_items_select" ON public.prescription_items AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1 FROM (prescriptions p JOIN patients pat ON ((pat.id = p.patient_id))) WHERE ((p.id = prescription_items.prescription_id) AND (pat.user_id = ( SELECT auth.uid() AS uid)))))) OR ((EXISTS ( SELECT 1 FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.clinic_id = prescription_items.clinic_id))))));
CREATE POLICY "prescription_items_insert" ON public.prescription_items AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1 FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.clinic_id = prescription_items.clinic_id)))));
CREATE POLICY "prescription_items_update" ON public.prescription_items AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1 FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.clinic_id = prescription_items.clinic_id)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.clinic_id = prescription_items.clinic_id)))));
CREATE POLICY "prescription_items_delete" ON public.prescription_items AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1 FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.clinic_id = prescription_items.clinic_id)))));

-- === prescriptions ===
DROP POLICY IF EXISTS "prescriptions_patient_read_own" ON public.prescriptions;
DROP POLICY IF EXISTS "prescriptions_staff_clinic_scope" ON public.prescriptions;
CREATE POLICY "prescriptions_select" ON public.prescriptions AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1 FROM patients pat WHERE ((pat.id = prescriptions.patient_id) AND (pat.user_id = ( SELECT auth.uid() AS uid)))))) OR ((EXISTS ( SELECT 1 FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.clinic_id = prescriptions.clinic_id))))));
CREATE POLICY "prescriptions_insert" ON public.prescriptions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1 FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.clinic_id = prescriptions.clinic_id)))));
CREATE POLICY "prescriptions_update" ON public.prescriptions AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1 FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.clinic_id = prescriptions.clinic_id)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.clinic_id = prescriptions.clinic_id)))));
CREATE POLICY "prescriptions_delete" ON public.prescriptions AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1 FROM clinic_memberships WHERE ((clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.clinic_id = prescriptions.clinic_id)))));

-- === profiles ===
DROP POLICY IF EXISTS "profiles_admin_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_write_admin_only" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)) OR ((id = ( SELECT auth.uid() AS uid))));
CREATE POLICY "profiles_update" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((id = ( SELECT auth.uid() AS uid))) OR (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)))
  WITH CHECK (((id = ( SELECT auth.uid() AS uid))) OR (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)));
CREATE POLICY "profiles_insert" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role));
CREATE POLICY "profiles_delete" ON public.profiles AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role));

-- === rooms ===
DROP POLICY IF EXISTS "Staff views rooms" ON public.rooms;

-- === turnos ===
DROP POLICY IF EXISTS "turnos_update" ON public.turnos;
DROP POLICY IF EXISTS "turnos_update_own_or_admin" ON public.turnos;
CREATE POLICY "turnos_update_merged" ON public.turnos AS PERMISSIVE FOR UPDATE TO public
  USING (((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND ((cajero_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = ( SELECT auth.uid() AS uid)) AND ((user_roles.role)::text = ANY (ARRAY['admin'::text, 'manager'::text])))))))) OR ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND ((cajero_user_id = ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role)))))
  WITH CHECK ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id)) OR ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id) AND ((cajero_user_id = ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role)))));

-- === whatsapp_audit_alertas ===
DROP POLICY IF EXISTS "clinic scoped read alertas" ON public.whatsapp_audit_alertas;
DROP POLICY IF EXISTS "platform staff read all alertas" ON public.whatsapp_audit_alertas;
CREATE POLICY "whatsapp_alertas_select_merged" ON public.whatsapp_audit_alertas AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_has_clinic_access(( SELECT auth.uid() AS uid), clinic_id)) OR (is_global_admin(( SELECT auth.uid() AS uid))));