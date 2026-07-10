-- Task 5, parte 2: gating de escritura (INSERT/UPDATE/DELETE) en medicamentos y
-- lotes_medicamento por el modulo 'almacen'. Decision de arquitectura (sesion 34,
-- 4 agentes: A+C): SELECT queda SIN gate -- son catalogo/inventario core que
-- Recetas (prescripcion) y Enfermeria leen sin depender de que la clinica tenga
-- 'almacen' contratado. Solo la escritura (dar de alta/editar/borrar medicamentos
-- o lotes) requiere el modulo.
--
-- IMPORTANTE (bug clasico marcado en el diseno): Postgres NO evalua USING en
-- INSERT -- por eso INSERT usa exclusivamente WITH CHECK. UPDATE lleva ambos.
-- DELETE usa solo USING.
--
-- Auditoria previa (Task 5 residual risk #4): ninguna Edge Function con
-- service_role escribe en lotes_medicamento; cfdi-parse solo hace SELECT sobre
-- medicamentos (match de renglones de factura al catalogo). Sin bypass via
-- service_role para este gate.

DROP POLICY IF EXISTS "medicamentos_insert_modulo_gate" ON medicamentos;
CREATE POLICY "medicamentos_insert_modulo_gate" ON medicamentos
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'almacen'));

DROP POLICY IF EXISTS "medicamentos_update_modulo_gate" ON medicamentos;
CREATE POLICY "medicamentos_update_modulo_gate" ON medicamentos
  AS RESTRICTIVE FOR UPDATE
  USING (clinic_has_modulo_access(clinic_id, 'almacen'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'almacen'));

DROP POLICY IF EXISTS "medicamentos_delete_modulo_gate" ON medicamentos;
CREATE POLICY "medicamentos_delete_modulo_gate" ON medicamentos
  AS RESTRICTIVE FOR DELETE
  USING (clinic_has_modulo_access(clinic_id, 'almacen'));

DROP POLICY IF EXISTS "lotes_medicamento_insert_modulo_gate" ON lotes_medicamento;
CREATE POLICY "lotes_medicamento_insert_modulo_gate" ON lotes_medicamento
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'almacen'));

DROP POLICY IF EXISTS "lotes_medicamento_update_modulo_gate" ON lotes_medicamento;
CREATE POLICY "lotes_medicamento_update_modulo_gate" ON lotes_medicamento
  AS RESTRICTIVE FOR UPDATE
  USING (clinic_has_modulo_access(clinic_id, 'almacen'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'almacen'));

DROP POLICY IF EXISTS "lotes_medicamento_delete_modulo_gate" ON lotes_medicamento;
CREATE POLICY "lotes_medicamento_delete_modulo_gate" ON lotes_medicamento
  AS RESTRICTIVE FOR DELETE
  USING (clinic_has_modulo_access(clinic_id, 'almacen'));
