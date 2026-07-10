-- Task 5 (plan 2026-07-09-cancelacion-self-service-y-gating-modulos.md):
-- gating real de modulos via RLS RESTRICTIVE, usando clinic_has_modulo_access().
--
-- IMPORTANTE: se usan policies RESTRICTIVE, no PERMISSIVE. Estas tablas ya tienen
-- policies PERMISSIVE (clinic_membership/roles) que Postgres OR-ea entre si -- una
-- policy PERMISSIVE de gating no restringiria nada. RESTRICTIVE se ANDea con las
-- permissivas existentes, mismo patron ya usado en este proyecto para
-- "multiclinic_access_restrictive" (ordenes_compra, facturas_proveedor, etc).
--
-- Alcance: solo compras, almacen, facturacion_cfdi, pos_farmacia. agenda quedo
-- descartada (ver plan, seccion Task 5) -- no tiene dataset exclusivo: appointments/
-- doctors/patients/rooms/servicios son core, usados fuera de los 5 modulos
-- (Recepcion, BI, PanelDoctor, bot Telegram, camino-paciente). Gatearlas rompe
-- funcionalidad que no depende de la suscripcion de "agenda".
--
-- medicamentos/lotes_medicamento se manejan aparte (ver migracion
-- 20260710130000_rls_medicamentos_write_gate.sql): SELECT sin gate, solo
-- escritura gateada por 'almacen' -- decision de arquitectura ya resuelta
-- (sesion 34, 4 agentes) porque Recetas/Enfermeria las leen sin depender de
-- que la clinica tenga 'almacen' contratado.
--
-- Tablas excluidas por ser compartidas con flujos core no gateables (no asumir
-- que faltan por descuido): movimientos_inventario (leido por prescripcionService,
-- dispensa de enfermeria), pharmacy_sales/pharmacy_sale_items (leidos por
-- BI/dashboards/historial paciente), cortes/fondos_movimientos (compartidos con
-- Caja general, no es modulo gateable), pos_error_logs/audit_logs (bitacora, no
-- debe ocultarse por suscripcion).

-- =========================================================================
-- Modulo: compras
-- =========================================================================

DROP POLICY IF EXISTS "cotizaciones_modulo_gate" ON cotizaciones;
CREATE POLICY "cotizaciones_modulo_gate" ON cotizaciones
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'compras'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'compras'));

DROP POLICY IF EXISTS "cotizaciones_items_modulo_gate" ON cotizaciones_items;
CREATE POLICY "cotizaciones_items_modulo_gate" ON cotizaciones_items
  AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM cotizaciones c
    WHERE c.id = cotizaciones_items.cotizacion_id
      AND clinic_has_modulo_access(c.clinic_id, 'compras')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM cotizaciones c
    WHERE c.id = cotizaciones_items.cotizacion_id
      AND clinic_has_modulo_access(c.clinic_id, 'compras')
  ));

DROP POLICY IF EXISTS "ordenes_compra_modulo_gate" ON ordenes_compra;
CREATE POLICY "ordenes_compra_modulo_gate" ON ordenes_compra
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'compras'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'compras'));

DROP POLICY IF EXISTS "ordenes_compra_items_modulo_gate" ON ordenes_compra_items;
CREATE POLICY "ordenes_compra_items_modulo_gate" ON ordenes_compra_items
  AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM ordenes_compra o
    WHERE o.id = ordenes_compra_items.orden_id
      AND clinic_has_modulo_access(o.clinic_id, 'compras')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM ordenes_compra o
    WHERE o.id = ordenes_compra_items.orden_id
      AND clinic_has_modulo_access(o.clinic_id, 'compras')
  ));

DROP POLICY IF EXISTS "fp_cfdi_lineas_modulo_gate" ON fp_cfdi_lineas;
CREATE POLICY "fp_cfdi_lineas_modulo_gate" ON fp_cfdi_lineas
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'compras'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'compras'));

DROP POLICY IF EXISTS "facturas_proveedor_modulo_gate" ON facturas_proveedor;
CREATE POLICY "facturas_proveedor_modulo_gate" ON facturas_proveedor
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'compras'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'compras'));

DROP POLICY IF EXISTS "pagos_proveedor_modulo_gate" ON pagos_proveedor;
CREATE POLICY "pagos_proveedor_modulo_gate" ON pagos_proveedor
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'compras'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'compras'));

DROP POLICY IF EXISTS "recepciones_mercancia_modulo_gate" ON recepciones_mercancia;
CREATE POLICY "recepciones_mercancia_modulo_gate" ON recepciones_mercancia
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'compras'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'compras'));

DROP POLICY IF EXISTS "recepciones_items_modulo_gate" ON recepciones_items;
CREATE POLICY "recepciones_items_modulo_gate" ON recepciones_items
  AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM recepciones_mercancia r
    WHERE r.id = recepciones_items.recepcion_id
      AND clinic_has_modulo_access(r.clinic_id, 'compras')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM recepciones_mercancia r
    WHERE r.id = recepciones_items.recepcion_id
      AND clinic_has_modulo_access(r.clinic_id, 'compras')
  ));

DROP POLICY IF EXISTS "solicitudes_compra_modulo_gate" ON solicitudes_compra;
CREATE POLICY "solicitudes_compra_modulo_gate" ON solicitudes_compra
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'compras'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'compras'));

DROP POLICY IF EXISTS "solicitudes_compra_items_modulo_gate" ON solicitudes_compra_items;
CREATE POLICY "solicitudes_compra_items_modulo_gate" ON solicitudes_compra_items
  AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM solicitudes_compra s
    WHERE s.id = solicitudes_compra_items.solicitud_id
      AND clinic_has_modulo_access(s.clinic_id, 'compras')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM solicitudes_compra s
    WHERE s.id = solicitudes_compra_items.solicitud_id
      AND clinic_has_modulo_access(s.clinic_id, 'compras')
  ));

DROP POLICY IF EXISTS "proveedores_modulo_gate" ON proveedores;
CREATE POLICY "proveedores_modulo_gate" ON proveedores
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'compras'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'compras'));

DROP POLICY IF EXISTS "medicamento_proveedores_modulo_gate" ON medicamento_proveedores;
CREATE POLICY "medicamento_proveedores_modulo_gate" ON medicamento_proveedores
  AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM proveedores p
    WHERE p.id = medicamento_proveedores.proveedor_id
      AND clinic_has_modulo_access(p.clinic_id, 'compras')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM proveedores p
    WHERE p.id = medicamento_proveedores.proveedor_id
      AND clinic_has_modulo_access(p.clinic_id, 'compras')
  ));

-- =========================================================================
-- Modulo: almacen
-- =========================================================================

DROP POLICY IF EXISTS "actas_merma_modulo_gate" ON actas_merma;
CREATE POLICY "actas_merma_modulo_gate" ON actas_merma
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'almacen'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'almacen'));

DROP POLICY IF EXISTS "actas_merma_items_modulo_gate" ON actas_merma_items;
CREATE POLICY "actas_merma_items_modulo_gate" ON actas_merma_items
  AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM actas_merma a
    WHERE a.id = actas_merma_items.acta_id
      AND clinic_has_modulo_access(a.clinic_id, 'almacen')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM actas_merma a
    WHERE a.id = actas_merma_items.acta_id
      AND clinic_has_modulo_access(a.clinic_id, 'almacen')
  ));

DROP POLICY IF EXISTS "conteos_inventario_modulo_gate" ON conteos_inventario;
CREATE POLICY "conteos_inventario_modulo_gate" ON conteos_inventario
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'almacen'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'almacen'));

DROP POLICY IF EXISTS "conteos_items_modulo_gate" ON conteos_items;
CREATE POLICY "conteos_items_modulo_gate" ON conteos_items
  AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM conteos_inventario c
    WHERE c.id = conteos_items.conteo_id
      AND clinic_has_modulo_access(c.clinic_id, 'almacen')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM conteos_inventario c
    WHERE c.id = conteos_items.conteo_id
      AND clinic_has_modulo_access(c.clinic_id, 'almacen')
  ));

-- =========================================================================
-- Modulo: pos_farmacia
-- =========================================================================

DROP POLICY IF EXISTS "pharmacy_sale_payments_modulo_gate" ON pharmacy_sale_payments;
CREATE POLICY "pharmacy_sale_payments_modulo_gate" ON pharmacy_sale_payments
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'pos_farmacia'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'pos_farmacia'));

DROP POLICY IF EXISTS "pharmacy_cash_shifts_modulo_gate" ON pharmacy_cash_shifts;
CREATE POLICY "pharmacy_cash_shifts_modulo_gate" ON pharmacy_cash_shifts
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'pos_farmacia'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'pos_farmacia'));

DROP POLICY IF EXISTS "recetas_capturadas_modulo_gate" ON recetas_capturadas;
CREATE POLICY "recetas_capturadas_modulo_gate" ON recetas_capturadas
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'pos_farmacia'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'pos_farmacia'));

DROP POLICY IF EXISTS "solicitudes_insumos_modulo_gate" ON solicitudes_insumos;
CREATE POLICY "solicitudes_insumos_modulo_gate" ON solicitudes_insumos
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'pos_farmacia'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'pos_farmacia'));

DROP POLICY IF EXISTS "pharmacy_returns_modulo_gate" ON pharmacy_returns;
CREATE POLICY "pharmacy_returns_modulo_gate" ON pharmacy_returns
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'pos_farmacia'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'pos_farmacia'));

DROP POLICY IF EXISTS "pharmacy_return_items_modulo_gate" ON pharmacy_return_items;
CREATE POLICY "pharmacy_return_items_modulo_gate" ON pharmacy_return_items
  AS RESTRICTIVE FOR ALL
  USING (EXISTS (
    SELECT 1 FROM pharmacy_returns r
    WHERE r.id = pharmacy_return_items.return_id
      AND clinic_has_modulo_access(r.clinic_id, 'pos_farmacia')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM pharmacy_returns r
    WHERE r.id = pharmacy_return_items.return_id
      AND clinic_has_modulo_access(r.clinic_id, 'pos_farmacia')
  ));

-- =========================================================================
-- Modulo: facturacion_cfdi
-- =========================================================================

DROP POLICY IF EXISTS "cfdi_config_modulo_gate" ON cfdi_config;
CREATE POLICY "cfdi_config_modulo_gate" ON cfdi_config
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'facturacion_cfdi'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'facturacion_cfdi'));

DROP POLICY IF EXISTS "cfdi_receptores_modulo_gate" ON cfdi_receptores;
CREATE POLICY "cfdi_receptores_modulo_gate" ON cfdi_receptores
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'facturacion_cfdi'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'facturacion_cfdi'));

DROP POLICY IF EXISTS "cfdi_documentos_modulo_gate" ON cfdi_documentos;
CREATE POLICY "cfdi_documentos_modulo_gate" ON cfdi_documentos
  AS RESTRICTIVE FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'facturacion_cfdi'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'facturacion_cfdi'));
