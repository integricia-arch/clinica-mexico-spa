# Configuración del Camino del Paciente

Módulo nuevo y aditivo dentro de **Configuración** que permite editar de forma visual y segura el flujo "Camino Médico del Paciente", con plantillas, versionado, simulador, validador y catálogos protegidos. **No reemplaza ni rompe nada existente.**

## Alcance

- Ruta nueva: `/configuracion/camino-paciente` (solo `admin`).
- No se toca el módulo actual "Camino Médico del Paciente" salvo para leer el snapshot de configuración cuando se cree un nuevo camino (integración opcional al final).
- Las tablas existentes (`patients`, `appointments`, `expedientes`, `notas_consulta`, `audit_logs`, etc.) no se modifican.

## Backend (migración Supabase, todo nuevo, RLS estricta)

Tablas nuevas, todas con RLS — lectura para staff clínico, escritura/publicación solo `admin`:

1. `journey_templates` — plantillas (Consulta general, Seguimiento, Urgencia, Procedimiento menor, Laboratorio, Farmacia, Teleconsulta, Alta admin).
2. `journey_template_versions` — `draft | active | archived`, `config_json`, motivo, autor, fechas.
3. `journey_step_definitions` — etapas por versión con `step_key` interno fijo, `step_name` editable, tipo, orden, flags (`is_critical`, `is_required`, `blocks_progress`, `allow_not_applicable`, `requires_responsible`, `requires_document`), roles permitidos.
4. `journey_step_fields` — campos configurables por etapa (tipo, validación, roles visibles/editables, ayuda, default, catálogo).
5. `journey_option_catalogs` + `journey_option_items` — catálogos filtrados por `step_type` / `step_key`. Items usados nunca se borran, solo `is_active=false`.
6. `journey_validation_rules` — reglas condición→acción con severidad.
7. `journey_configuration_audit` — append-only (sin UPDATE/DELETE vía RLS).
8. `journey_instances` — snapshot inmutable de la versión usada por un camino real (referenciable por `appointment_id`/`patient_id`). Garantiza que pacientes en proceso no cambien al republicar.

### Enums y semilla protegida

- Enum `journey_step_type`: `administrativa | clinica | legal | farmacia | facturacion | seguimiento | auditoria`.
- Enum `journey_version_status`: `draft | active | archived`.
- Seed con **plantilla base "Consulta general"** y las **10 etapas críticas** con `step_key` fijos: `identification`, `consent`, `record`, `consultation`, `diagnosis`, `prescription`, `billing`, `followup`, `discharge`, `audit`.
- Trigger `prevent_critical_step_deletion` impide DELETE de filas con `is_critical=true`.
- Trigger `enforce_step_key_immutable` impide cambiar `step_key` en UPDATE.
- Trigger de auditoría en cada tabla → `journey_configuration_audit`.

## Frontend

### Estructura de archivos (todo nuevo)

```text
src/pages/configuracion/CaminoPaciente.tsx        // shell con tabs
src/features/camino-paciente/
  hooks/useJourneyTemplates.ts
  hooks/useJourneyVersion.ts
  lib/stepKeys.ts                    // claves críticas fijas
  lib/getAvailableOptionsForStep.ts  // motor de opciones por etapa
  lib/validateJourneyConfiguration.ts // motor de validación
  lib/simulateJourney.ts             // simulador
  components/TemplateList.tsx
  components/StepList.tsx            // drag-and-drop con candados
  components/StepEditorPanel.tsx     // panel lateral
  components/FieldEditor.tsx
  components/CatalogManager.tsx
  components/RuleEditor.tsx          // editor visual no-JSON
  components/VersionHistory.tsx
  components/SimulatorDialog.tsx
  components/ConfigHealthBadge.tsx   // verde / amarillo / rojo
```

Añadir entrada de menú en `Configuracion.tsx` (sin tocar nada más) → "Configuración del Camino del Paciente". Añadir ruta protegida en `App.tsx` para `admin`.

### Pantallas (tabs)

1. **Plantillas** — lista de `journey_templates`, badge de versión activa, botón "Nueva plantilla" (parte de la base segura).
2. **Etapas** — lista ordenable (dnd-kit) con candados 🔒 en críticas, badge tipo, "No aplica" toggle.
3. **Editor de etapa** (panel lateral) — todos los campos pedidos (nombre visible, descripción, tipo, flags, roles, tiempo máx., bloqueo, documento).
4. **Campos por etapa** — agregar/editar campos con tipos limitados según `step_type` (motor de opciones).
5. **Catálogos** — CRUD seguro: no eliminar items usados, solo desactivar.
6. **Reglas** — editor visual `cuando [X] entonces [bloquear/advertir/requerir override]`, valida contra reglas inválidas/circulares.
7. **Versiones** — historial, borrador/activa/archivada, botones **Probar**, **Publicar**, **Restaurar**.
8. **Simulador** — modal que recorre el flujo según escenario y muestra pasos activos/bloqueados/overrides necesarios.

### Motores

- `getAvailableOptionsForStep(stepKey, stepType, templateId, role)` — devuelve solo opciones permitidas (las listas exactas del brief están codificadas como mapa por `step_key`).
- `validateJourneyConfiguration(configId)` — corre las 11 validaciones del brief y devuelve `{ status: 'green'|'yellow'|'red', issues: [...] }`. **Publicar bloqueado si red.**
- `simulateJourney({templateId, scenario})` — ejecuta el flujo en memoria.

### Reglas de seguridad codificadas (no configurables)

Constantes en `lib/stepKeys.ts` que el editor respeta:
- Etapas críticas no eliminables.
- `consultation` requiere `diagnosis` antes de `discharge`.
- `prescription` requiere médico responsable.
- `pharmacy_dispense` requiere `prescription` activa.
- `discharge` requiere nota final.
- `consent` requerido salvo override con motivo y rol autorizado.
- `audit` no se puede desactivar.

## Integración con el módulo existente

Mínima y opt-in: cuando se cree un nuevo "camino" en el módulo actual, leer la versión activa de la plantilla aplicable y escribir snapshot en `journey_instances`. El módulo actual sigue funcionando idéntico si no se invoca esto.

## Auditoría

Toda mutación en tablas `journey_*` dispara inserción en `journey_configuration_audit` (append-only) además del `audit_logs` global existente vía función `log_audit`.

## Fuera de alcance (para evitar romper)

- No modificar `appointments`, `expedientes`, `notas_consulta`, `audit_logs`.
- No tocar `useAuth`, `ProtectedRoute`, ni rutas existentes salvo agregar la nueva.
- No cambiar el módulo "Camino Médico del Paciente" — solo se le ofrece una API de lectura del snapshot.

## Entregables

1. Migración Supabase con tablas + enums + triggers + seed de plantilla base + RLS.
2. Página `/configuracion/camino-paciente` con los 8 tabs.
3. Motores `getAvailableOptionsForStep`, `validateJourneyConfiguration`, `simulateJourney`.
4. Editor visual de reglas (sin JSON expuesto).
5. Versionado con publicar/restaurar/probar.
6. Badges de salud verde/amarillo/rojo y bloqueo de publicación en rojo.
7. Auditoría dedicada.

Es un módulo grande; lo construiré en este orden: **migración → motores y tipos → shell + tab Plantillas → tab Etapas + Editor → Campos → Catálogos → Reglas → Versiones + Simulador**. ¿Apruebas el plan para comenzar?
