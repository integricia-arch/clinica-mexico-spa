# Motor operativo del Camino del Paciente

Convertir el camino del paciente de una representación visual a un motor operativo real, con apertura/cierre formal de cada hito, evidencia, responsables, validaciones y auditoría. Estrictamente aditivo: no se reemplazan tablas, módulos ni componentes existentes.

## Alcance

Cubre los 13 hitos del flujo (llegada → recepción → identificación/consentimiento → expediente → triage → consulta → receta → farmacia → cobro/facturación → alta → post-consulta), respetando RLS y roles actuales (`admin`, `doctor`, `receptionist`, `nurse`, `patient`). El rol `pharmacy` no existe todavía: se prepara la estructura pero se permite que `admin`/`receptionist` cubran temporalmente.

No se tocan: `patients`, `appointments`, `doctors`, `rooms`, `expedientes`, `notas_consulta`, `medicamentos`, `lotes_medicamento`, `recordatorios_cita`, `journey_templates*`, ni el `AdminDashboard` ni `PatientJourneyLine` existentes (solo se enriquecen con datos nuevos vía hook).

## Cambios de base de datos (migración aditiva)

Nuevas tablas en `public`, todas con RLS habilitada y políticas por rol:

1. `journey_instance_steps` — un registro por hito por instancia (status, opened_at/by, assigned_to, closed_at/by, blocked_reason, next_action, notes).
2. `journey_instance_step_data` — `data_json` por hito con `created_by`/`updated_by`.
3. `journey_instance_audit` — append-only (RLS: INSERT permitido a staff, UPDATE/DELETE denegados). Trigger `journey_step_audit_trigger` registra automáticamente cambios en `journey_instance_steps`.
4. `journey_instance_documents` — referencias a documentos por hito (file_url/file_name/document_type).
5. `journey_instance_overrides` — solicitud y autorización de overrides (estados: requested, authorized, rejected).
6. `prescriptions` — receta electrónica con `prescription_number` único, estados (draft/issued/cancelled/dispensed/partially_dispensed), QR interno, PDF URL.
7. `prescription_items` — partidas de receta con denominación genérica/distintiva, forma, concentración, dosis, vía, frecuencia, duración, cantidad, indicaciones, flag controlado.
8. `patient_checkout_events` — alta del paciente (tipo, estatus, resumen, followup_required).
9. `post_consultation_followups` — seguimiento post-consulta (canal, estado, adherencia, síntomas, efectos adversos).

Funciones SQL `SECURITY DEFINER`:
- `generate_prescription_number()` — folio único por día.
- `journey_step_audit_trigger()` — append a `journey_instance_audit`.
- `update_journey_progress(journey_instance_id)` — recalcula `current_step_key`/`status`/`progress_percent` dentro del `snapshot_json`.

Políticas RLS (resumen):
- Staff lee/escribe steps y data según rol del paso (recepción no edita diagnóstico; doctor no borra pagos; etc.) — se aplica a nivel de aplicación + RLS general por rol de staff.
- `journey_instance_audit`: INSERT por cualquier staff autenticado; UPDATE/DELETE denegados a todos.
- `prescriptions`: INSERT/UPDATE solo doctor dueño o admin; SELECT staff clínico y paciente dueño.
- `patient_checkout_events`: INSERT/UPDATE admin/receptionist/doctor; SELECT staff + paciente dueño.

## Capa de servicios (frontend)

Nuevo paquete `src/features/camino-paciente/services/` con módulos puros que encapsulan toda la lógica de negocio y llaman a Supabase:

- `journeyEngine.ts`: `createJourneyFromAppointment`, `openJourneyStep`, `saveJourneyStepData`, `closeJourneyStep`, `blockJourneyStep`, `requestStepOverride`, `authorizeStepOverride`, `updateJourneyProgress`.
- `prescriptionService.ts`: `createPrescriptionFromConsultation`, `addPrescriptionItem`, `issuePrescription` (con validaciones de cédula, alergias, campos obligatorios), `cancelPrescription`, `dispensePrescription` (descuenta `lotes_medicamento` vía `movimientos_inventario`).
- `checkoutService.ts`: `checkoutPatient` con validaciones de consulta cerrada, receta emitida/justificada y pago/justificación.
- `followupService.ts`: `createFollowup`, `completeFollowup`, integración con `recordatorios_cita`.
- `journeyValidations.ts`: reglas declarativas por hito (campos requeridos mínimos, predecesores, roles que pueden cerrar).

Cada operación de cierre llama a `updateJourneyProgress` y deja registro en `journey_instance_audit`.

## Componentes y pantallas

Nuevos archivos en `src/features/camino-paciente/operativo/`:

- `RegistrarLlegadaDrawer.tsx` — Drawer accesible desde `AdminDashboard`/`TodayAppointmentsTable`. Precarga doctor/consultorio de la cita, permite reasignar (solo admin/receptionist), llama `createJourneyFromAppointment` + abre hito `arrival`.
- `JourneyOperationalDrawer.tsx` — Drawer principal del hito actual con tabs: Datos, Acciones, Documentos, Auditoría. Botones contextuales: Abrir, Guardar, Cerrar, Bloquear, Solicitar override. Muestra `PatientJourneyLine` arriba (reutilizada).
- `StepForms/` — formularios por hito: `ArrivalForm`, `IdentificationConsentForm`, `RecordReviewForm`, `TriageVitalsForm`, `ConsultationOpenForm`, `ConsultationCloseForm`, `PrescriptionForm`, `PharmacyDispenseForm`, `BillingForm`, `CheckoutForm`, `FollowupForm`. Cada uno valida con `zod` y delega al servicio.
- `OverrideRequestDialog.tsx` y `OverrideAuthorizeDialog.tsx`.
- `StepAuditList.tsx` — historial filtrado del hito.
- `PrescriptionPreview.tsx` — vista imprimible con QR (lib `qrcode.react`), folio y todos los datos exigidos.
- `pages/CaminoPaciente.tsx` — ruta nueva `/camino-paciente/:journeyInstanceId` para abrir el detalle completo.

Hooks:
- `useJourneyInstance(id)` — carga instance + steps + step_data + override pendiente, con suscripción realtime a los tres canales.
- `useJourneyStepActions()` — wrappers de servicios con toasts.

## Integraciones con módulos existentes (no destructivas)

- `AdminDashboard.tsx` / `TodayAppointmentsTable.tsx`: añadir botón "Registrar llegada" cuando no hay `journey_instance` y "Abrir camino" cuando ya existe. Doble clic en línea gráfica → navega a `/camino-paciente/:id`.
- `PatientJourneyLine.tsx`: extender `buildJourneyLineSteps` para consumir `journey_instance_steps` cuando existan (fallback al snapshot actual). Sin cambios visuales fuera de mostrar bloqueos y overrides ya soportados.
- `PatientOperationalDrawer.tsx`: agregar botón "Abrir camino operativo" que enruta al drawer nuevo.
- `Farmacia.tsx`: añadir tab "Surtir receta" que lista `prescriptions` con `status='issued'`.
- `Facturacion.tsx`: añadir tab "Pendientes del camino" que lista `journey_instances` con hito `billing` abierto.
- `Auditoria.tsx`: añadir filtro por `journey_instance_audit`.
- `AppLayout`/router: registrar ruta `/camino-paciente/:id` protegida para staff.

## Roles y seguridad

- Validación dual: en la capa de servicio (early return + toast con motivo) y en RLS.
- Documentos clínicos sensibles (notas de consulta, diagnóstico) no se muestran en formularios visibles para `receptionist`.
- Receta solo editable por doctor dueño o admin; recepción/farmacia ven solo lectura.
- Override requiere `admin` para autorizar; cualquier staff puede solicitarlo.
- `journey_instance_audit` nunca se expone para edición/borrado en la UI.

## Diseño

Se respeta el sistema actual: tokens semánticos (`bg-card`, `text-foreground`, `border-border`), drawer lateral `Sheet`, tipografía Plus Jakarta Sans / DM Sans, acentos teal/blue, estados con colores semánticos ya definidos (`success`, `info`, `warning`, `destructive`, `purple-500` para override). Sin nuevas dependencias visuales pesadas (solo `qrcode.react` para el QR de receta).

## Out of scope

- Firma criptográfica real / cumplimiento NOM-024 o COFEPRIS (se documenta como advertencia en la UI, no se simula cumplimiento).
- Generación de PDF en backend (se ofrece print-to-PDF del navegador como v1).
- Validación de interacciones medicamentosas (se deja la estructura preparada).
- Nuevo rol `pharmacy` en `app_role` (se prepara la lógica de servicio pero la autorización efectiva cae en `admin`/`receptionist` hasta que se cree el rol).
- Tocar `src/integrations/supabase/client.ts` o `types.ts` (se regeneran tras la migración).

## Entregables

1. Una migración SQL con 9 tablas + RLS + 3 funciones + 1 trigger.
2. Capa de servicios (~5 archivos) en `src/features/camino-paciente/services/`.
3. Drawers, formularios por hito y página `/camino-paciente/:id` (~15 archivos en `src/features/camino-paciente/operativo/`).
4. Ediciones puntuales en `AdminDashboard`, `TodayAppointmentsTable`, `Farmacia`, `Facturacion`, `Auditoria`, `App.tsx` (router).
5. Hooks `useJourneyInstance`, `useJourneyStepActions`.
6. Nueva dependencia: `qrcode.react`.
