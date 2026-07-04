# Auditoría de seguridad Supabase — 2026-07-04

Origen: revisión diaria reportó `recepcion_revertir()` sin autorización de
llamador. Al corregirlo se decidió correr auditoría completa con
`mcp__supabase__get_advisors(security)` sobre todo el proyecto
(kyfkvdyxpvpiacyymldc) — 449 findings totales.

## Ya cerrado esta sesión (verificado en prod, migraciones commiteadas)

| # | Hallazgo | Severidad real | Fix | Migración |
|---|---|---|---|---|
| 1 | `recepcion_revertir()` sin authz — cualquier usuario borraba recepciones/facturas de otra clínica | HIGH (autenticado) | REVOKE PUBLIC + membership check | `20260704225425`, `20260704225438` |
| 2 | `cfdi_get_secret`/`cfdi_upsert_secret`/`doctor_calendar_get_token`/`doctor_calendar_upsert_token` — CERO check interno, grant directo a `anon` | **CRITICAL (sin login)** | REVOKE de `anon`, solo `service_role` (únicos callers reales son Edge Functions) | `20260704230547` |
| 3 | `prescriptions`/`prescription_items` RLS `USING(true) WITH CHECK(true)` — cualquier autenticado leía/editaba/borraba recetas de cualquier paciente/clínica | **CRITICAL (PHI, cross-tenant)** | Policy scoped a `clinic_memberships` (staff) + SELECT-only propio (paciente) | `20260704230654` |
| 4 | 12 funciones `SECURITY DEFINER` sin `search_path` fijo | MEDIUM (search_path hijack) | `SET search_path = public` en cada una | `20260704230742` |
| 5 | 5 vistas CxP (`v_ciclo_compras`, `kpi_dpo_proveedor`, `concentracion_proveedores`, `kpi_descuento_pronto_pago`, `resumen_alertas_cxp`) corrían como definer + `GRANT ALL` a `anon`/`authenticated` — data financiera de proveedores cruzada entre clínicas | HIGH | `security_invoker=on` + grants mínimos (`SELECT` solo `authenticated`) | `20260704230815` |
| 6 | `recetas_folio_contadores` sin RLS | MEDIUM | `ENABLE ROW LEVEL SECURITY` sin policies (solo se toca vía función definer) | `20260704230834` |

## Backlog priorizado (requiere revisión caso por caso — NO fix ciego)

### P1 — funciones `SECURITY DEFINER` + `anon` + sin ningún check interno (26)

Confirmado por query heurística (busca `auth.uid()`/`has_role`/`is_staff`/`clinic_memberships` en el body — cero matches = sospechosa). Sub-clasificación:

**Fuga de datos de negocio entre clínicas (alto, revisar primero):**
- `get_medicamentos_en_reorden(p_clinic_id)` — lee alertas de reorden de CUALQUIER clínica.
- `get_doctor_calendars(p_clinic_id)` — lista calendarios de doctores de cualquier clínica.
- `get_corte_pago_total(p_corte_id, metodo)` / `get_corte_tarjeta_total(p_corte_id)` — totales de cortes de caja de cualquier clínica por solo el UUID.

**Mutación sin autorización (alto):**
- `increment_lote_existencia(lote_id, cantidad)` — cualquiera infla/desinfla existencia de cualquier lote de medicamento.
- `recepcion_entrada_lote(...)` — inserta entradas de inventario arbitrarias.
- `loyalty_redeem(member_id, clinic_id, puntos)` — redime puntos de lealtad de cualquier member sin dueño verificado.
- `loyalty_register_sale(sale_id, member_id, clinic_id)` — registra venta/otorga puntos sin verificar quién llama.
- `update_journey_progress(_journey_instance_id)` — corrompe el progreso del "journey" clínico de cualquier paciente.

**Integridad/compliance (medio — folios consecutivos tienen implicación legal en México):**
- `next_receta_folio(p_clinic_id)` — llamar directo desagota/desordena la numeración consecutiva de recetas de una clínica.
- `generate_prescription_number_for_doctor(_doctor_id)` — mismo patrón.
- `cancelar_citas_prueba(dias)` — nombre sugiere utilidad de limpieza de datos de prueba; **verificar que no opere sobre citas reales** antes de decidir el fix.

**Triggers sin necesidad de grant directo (bajo riesgo real, pero limpiar higiene):**
`trg_fn_oc_recibida_on_gr`, `trg_fn_pago_actualiza_factura`, `trg_fn_pago_revertir_factura`, `trg_fn_sc_convertida_on_oc`, `fn_check_factura_duplicada`, `fn_check_limite_credito` — nunca deberían tener EXECUTE a ningún rol (Postgres los invoca solo vía trigger). `REVOKE ALL FROM PUBLIC, anon, authenticated` es seguro sin más análisis.

**Probablemente diseño intencional (bajo, confirmar con negocio antes de tocar):**
- `chat_registrar_pendiente`, `faq_buscar` (x2), `faq_incrementar_uso` — bot de FAQ público, sin login, esperado.
- `loyalty_generate_barcode(clinic_id)` — ¿auto-enrolamiento de cliente sin cuenta? confirmar flujo antes de restringir.
- `loyalty_expire_points()`, `notify_new_user_signup()`, `cleanup_abandoned_bot_sesiones()` — jobs sin argumentos, molestia/DoS leve si se spamean, no fuga de datos.

### P2 — 19 políticas RLS "always true" (`rls_policy_always_true`)

Tablas: `arco_requests`, `doctor_prescription_template_versions`, `doctor_prescription_templates`, `journey_instance_audit`, `journey_instance_overrides`, `journey_instance_step_data`, `journey_instance_steps`, `journey_instances`, `journey_option_catalogs`, `journey_option_items`, `journey_step_definitions`, `journey_step_fields`, `journey_template_versions`, `journey_templates`, `journey_validation_rules`, `patient_checkout_events`, `pos_error_logs`, más las ya cerradas `prescriptions`/`prescription_items`.

Necesita entender el modelo de acceso real de cada tabla antes de escribir policy (algunas como `arco_requests`/`patient_checkout_events`/`pos_error_logs` podrían ser INSERT público intencional — solicitudes ARCO o tracking anónimo). Las `journey_*` (11 tablas) son el bloque más grande — probablemente todas comparten el mismo patrón de scoping (por `journey_instance_id` → `patient_id`/`clinic_id`), un solo diseño de policy aplicaría a las 11.

### P3 — infraestructura, bajo riesgo/esfuerzo medio

- 4 extensiones en `public` (`pg_net`, `unaccent`, `pg_trgm`, `btree_gist`) → mover a schema `extensions`. Requiere probar que los índices GiST (`btree_gist`) y búsqueda difusa (`pg_trgm`) sigan resolviendo tras el `ALTER EXTENSION ... SET SCHEMA`.
- Auth → "Leaked password protection" deshabilitado. Toggle en Dashboard de Supabase (Authentication → Settings → Password Security), no scriptable por SQL/MCP.
- ~256 warnings `pg_graphql_*_table_exposed` — en su mayoría ruido esperado (tablas con RLS legítimo que da SELECT a `anon`/`authenticated`). No accionable en bloque; solo revisar si aparece una tabla que NO debería ser visible vía GraphQL en absoluto.

## Plan de prevención

1. **Checklist de migración** (agregar a `CLAUDE.md` del proyecto): toda función nueva con `SECURITY DEFINER` debe, en el mismo archivo de migración:
   - `SET search_path = public` (o el schema que corresponda) en la definición.
   - `REVOKE EXECUTE ... FROM PUBLIC` explícito seguido de `GRANT` solo al rol que realmente la necesita (`authenticated`, o `service_role` si solo la llaman Edge Functions).
   - Si toca datos multi-tenant, un check de `clinic_memberships`/`auth.uid()` en la primera línea del body, antes de cualquier side effect.
2. **Toda policy RLS nueva**: nunca `USING(true)` salvo tabla explícitamente pública (documentar por qué en un comentario SQL arriba de la policy, como ya se hizo aquí).
3. **Correr `get_advisors(security)` antes de cada sesión de trabajo en DB y después de cualquier tanda de migraciones nuevas** — ya está en las guidelines oficiales de Supabase MCP ("run regularly, especially after DDL changes"), formalizarlo como hábito de este proyecto.
4. **Vistas nuevas sobre datos multi-tenant**: `security_invoker = on` por default salvo razón documentada.
5. Revisar este documento en la próxima sesión de seguridad y mover ítems de P1/P2 a "Completado" en `STATE.md` conforme se cierren.

## Nota metodológica

El audit automático (`get_advisors`) da falsos positivos de severidad: marca 65 funciones "definer + anon" como WARN parejo, pero 39 de ellas SÍ validan internamente (`get_prescription_audit`, `set_supervisor_pin`, todo el módulo de caja/turnos, etc.) y no son vulnerables pese al grant. La query heurística de este documento (buscar patrones de auth en el body) filtró esas 39 y dejó 26 realmente sospechosas — evita gastar tiempo revisando funciones que ya están bien.
