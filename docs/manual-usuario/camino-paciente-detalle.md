# Camino del paciente (detalle)

> Es la línea de tiempo completa de la atención de un paciente en la clínica, dividida en hitos (llegada, triage, consulta, receta, pago, alta, etc.). Aquí se abren, completan o bloquean esos hitos y se solicitan excepciones cuando algo no puede seguir el orden normal. La usan recepción, enfermería, doctores y administración, según el hito y su rol.

## Operación — cómo se usa

### Cómo ver el estado general del camino

1. Arriba de todo ves el nombre del paciente, su edad, sexo, el estado general del camino (En proceso, Completado, Bloqueado), la fecha de la cita, el motivo, el doctor asignado, el consultorio y cuánto tiempo lleva el paciente en la clínica.
2. Debajo, una barra de progreso te dice cuántos hitos van completados de cuántos en total.
3. La línea de hitos (los mismos círculos que ves en el detalle de la cita) te permite dar clic en cualquier paso para saltar directo a él.

### Cómo trabajar un hito específico

1. En la columna izquierda ves la lista de todos los hitos del camino. Los que están activos (en proceso, abiertos, bloqueados o que requieren revisión) se resaltan en azul.
2. Da clic sobre el hito que te interesa — se abre a la derecha con tres pestañas: **Datos**, **Acciones** y **Auditoría**.
3. En **Datos**, revisa lo que ya se capturó (si hay) y llena el formulario específico de ese paso (cada hito tiene su propio formulario: llegada, triage, consulta, etc.).
4. En **Acciones**, da clic en **"Abrir hito"** para marcar que empezaste a trabajarlo, o en **"Completar hito"** cuando termines. Si no tienes el rol requerido para ese hito, verás un aviso indicando qué roles sí pueden actuar ahí.
5. En **Auditoría**, revisa el historial de cambios de ese hito específico (o de todo el camino, si no hay uno seleccionado).

### Cómo bloquear un hito

1. Dentro de la pestaña **Acciones** del hito, escribe el motivo del bloqueo (es obligatorio).
2. Da clic en **"Bloquear"** — el hito queda marcado como bloqueado hasta que se resuelva.

### Cómo pedir o autorizar una excepción (override)

1. Si necesitas saltarte un hito por una razón justificada, escribe la justificación clínica en **"Solicitar override"** y confirma.
2. Un administrador ve la solicitud pendiente en un recuadro amarillo y puede darle clic a **"Autorizar (admin)"** para aprobarla.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** cada hito solo lo pueden abrir, completar o bloquear ciertos roles (por ejemplo, "Consulta médica" solo admin, gerente o doctor).
  **Por qué:** cada paso de la atención corresponde a una responsabilidad clínica o administrativa específica — no cualquiera debe poder marcar que una consulta ya se hizo.
- **Lo que pasa:** si intentas actuar sobre un hito sin el rol adecuado, el sistema te lo dice explícitamente (qué roles sí pueden).
  **Por qué:** para que sepas a quién pedirle que lo haga, en vez de solo bloquearte sin explicación.
- **Lo que pasa:** un override necesita que alguien más (un administrador) lo autorice después de solicitarlo.
  **Por qué:** saltarse el orden normal del camino es una excepción — se registra quién la pidió, por qué, y quién la aprobó, para mantener trazabilidad clínica.
- **Lo que pasa:** todos los cambios (abrir, cerrar, bloquear, override) quedan en una bitácora que no se puede modificar.
  **Por qué:** es el registro legal de cómo se atendió al paciente paso a paso.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No puedo completar un hito | Tu rol no está en la lista de roles permitidos para ese hito | Revisa el aviso "Sin permiso para este hito" — ahí dice quién sí puede hacerlo |
| El botón "Completar hito" está apagado | El hito ya está completado, o no tienes permiso | Verifica el estado del hito en la lista de la izquierda |
| No me deja bloquear un hito | No escribiste el motivo del bloqueo | El motivo es obligatorio — escríbelo antes de dar clic en "Bloquear" |
| Solicité un override y no pasa nada | Un override necesita que un administrador lo autorice después | Pide a un administrador que revise el recuadro amarillo de "Override pendiente" y lo autorice |
| No veo "Autorizar (admin)" en un override que pedí | Esa acción solo la puede hacer un administrador, no quien lo solicitó | Pide a un administrador que entre y lo autorice |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/CaminoPaciente.tsx` (ruta `/camino-paciente/:id`)
- **Hook de datos:** `src/features/camino-paciente/hooks/useJourneyInstance.ts` (carga `instance`, `patient`, `appointment`, `steps`, `stepData`, `pendingOverrides`, `audit`, expone `reload()`)
- **Servicios:** `src/features/camino-paciente/services/journeyEngine.ts` — `openJourneyStep`, `closeJourneyStep`, `saveJourneyStepData`, `blockJourneyStep`, `requestStepOverride`, `authorizeStepOverride`
- **Formularios por hito:** `src/features/camino-paciente/operativo/StepForms/registry.ts` (`getStepForm(stepKey)`) — cada `step_key` (arrival, triage, consultation_open, prescription, billing, discharge, etc.) tiene su propio componente de formulario; si un `step_key` no tiene formulario registrado, se muestra "Sin formulario configurado para este hito."
- **Permisos por hito:** constante `STEP_ROLES` en `CaminoPaciente.tsx` — mapea cada `step_key` a los roles permitidos (`admin`, `manager`, `receptionist`, `nurse`, `doctor`, `cajero` según el paso). Un `step_key` no mapeado permite a cualquier rol actuar (`return true` en `canActOnStep`).
- **Componente compartido:** `PatientJourneyLine` (`src/features/camino-paciente/components/`) — la misma línea de hitos que aparece en `DetalleCita.tsx`, aquí con `showLabels` y `onStepClick`.
- **Roles con acceso a la ruta:** `admin`, `doctor`, `receptionist`, `nurse` (ver `App.tsx`, ruta `/camino-paciente/:id`).
- **Cómo agregar un hito nuevo:** definir el nuevo `step_key` en la plantilla del journey (`journey_templates`/`journey_instance_steps`), crear su formulario en `StepForms/` y registrarlo en `registry.ts`, y agregar su entrada a `STEP_ROLES` si requiere restricción de rol.
- **Cómo agregar una regla de negocio nueva:** las reglas de qué hito bloquea a cuál (dependencias entre pasos) viven en `journeyEngine.ts`/el motor de journey, no en este componente — el componente solo dispara acciones y refresca (`reload()`).

_/aprende 2026-07-06_
