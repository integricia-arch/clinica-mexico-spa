# Panel principal

> Vista en tiempo real de todo lo que pasa hoy en la clínica: citas, pacientes en proceso, médicos, consultorios y alertas. Solo la ve el **administrador**.

## Operación — cómo se usa

### Cómo revisar el estado general del día

1. Al entrar, ves un grupo de tarjetas con números (citas hoy, en atención, en espera, en consulta, pendientes de análisis, pendientes de receta, pendientes de cobro, altas del día, bloqueados y alertas críticas). Te dan un vistazo rápido de cómo va la operación sin tener que abrir nada.
2. Debajo, si hay un turno de caja abierto, ves una tarjeta verde con el nombre de la caja, cuánto tiempo lleva abierta, el fondo inicial y las ventas del turno. Si nadie ha abierto turno, ves un aviso y un botón para "Abrir turno".
3. Si hay actas de merma sin firmar, órdenes de compra pendientes de aprobar, facturas por pagar vencidas o faltantes en farmacia, aparecen como etiquetas de color debajo — dales clic para ir directo a Farmacia y resolverlas.

### Cómo filtrar lo que ves

1. Usa la barra superior para elegir la fecha, un médico, un consultorio, el estado de la cita, la etapa del camino del paciente, o el nivel de riesgo.
2. Escribe en el buscador para encontrar a un paciente por nombre.
3. Da clic en "Actualizar" para refrescar la información sin recargar la página.

### Cómo seguir el camino de un paciente (tablero)

1. En "Flujo operativo del día" ves columnas: Llegada/Recepción, Identificación/consentimiento, Expediente, Triage, Consulta médica, Análisis, Receta/farmacia, Cobro/facturación, Seguimiento, Alta/cierre y Bloqueados.
2. Cada tarjeta es un paciente con su hora de cita, médico, consultorio, cuánto tiempo lleva en esa etapa, su nivel de riesgo (OK, Medio, Alto) y la siguiente acción que falta.
3. Da clic en "Ver detalle" para abrir el panel completo del paciente: su camino paso a paso, datos básicos, estado actual y accesos directos a su cita, expediente, farmacia, facturación, conversación o auditoría.

### Cómo revisar la agenda y registrar una llegada

1. En "Agenda y citas del día" ves la lista completa de citas con hora, paciente, médico, consultorio, estado y avance del camino.
2. Da clic en "Registrar llegada" para marcar que el paciente ya está en la clínica — se abre una ventana para capturar los datos de su llegada.
3. Si el paciente ya tiene un camino iniciado, puedes usar "Operar" para ir directo a continuar su atención, "Ver" para abrir el detalle, o "Cita" para ver los datos de la cita.

### Cómo ver la carga de médicos y consultorios

1. En "Médicos y carga operativa" ves, por cada médico, cuántas citas tiene hoy, cuántos pacientes en espera, en consulta o en seguimiento, su próximo paciente y un estado (disponible, en consulta, con retraso, sin citas o saturado).
2. En "Consultorios" ves cuáles están ocupados (con el paciente y médico actual) y cuáles están disponibles, junto con la próxima cita programada.

### Cómo atender las alertas

1. En "Alertas y riesgos" ves una lista de situaciones que necesitan atención: citas confirmadas sin camino iniciado, pacientes sin consentimiento registrado, pacientes en consulta sin expediente activo, alergias no confirmadas, caminos bloqueados, overrides autorizados, citas con retraso y médicos saturados.
2. Si la alerta tiene un botón "Abrir", da clic para ir directo a resolverla.
3. Si hay más de 5 alertas, da clic en "Ver más" para desplegar el resto.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** un paciente sin consentimiento registrado siempre aparece con riesgo "Alto".
  **Por qué:** atender a un paciente sin su consentimiento firmado es un riesgo legal y clínico que se debe resolver antes de avanzar.
- **Lo que pasa:** un paciente en consulta sin expediente activo se marca como riesgo "Medio" y genera una alerta crítica.
  **Por qué:** el médico necesita el expediente para registrar lo que hace; si no existe, se puede perder información clínica importante.
- **Lo que pasa:** un médico se marca como "Saturado" cuando tiene más de 8 pacientes el día.
  **Por qué:** ayuda a detectar sobrecarga antes de que afecte la calidad de la atención o genere retrasos.
- **Lo que pasa:** una cita se marca "con retraso" si el paciente no ha llegado 15 minutos después de la hora programada.
  **Por qué:** así el equipo puede reaccionar a tiempo (llamar al paciente, reacomodar la agenda) en vez de notarlo hasta que ya es tarde.
- **Lo que pasa:** las alertas operativas de farmacia/caja (actas de merma, órdenes de compra, facturas vencidas, faltantes) solo aparecen si existen pendientes — si todo está al día, no ves esa sección.
  **Por qué:** evita ruido visual cuando no hay nada que resolver.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No veo la tarjeta de turno de caja | No hay ningún turno abierto en este momento | Da clic en "Abrir turno" o ve a "Caja" |
| Un paciente sale en riesgo "Alto" y no entiendo por qué | Casi siempre es porque falta el consentimiento informado o el camino está bloqueado | Abre el detalle del paciente (botón "Ver detalle") para ver la causa exacta |
| Un médico aparece como "Saturado" | Tiene más de 8 citas asignadas ese día | Considera reasignar algunas citas a otro médico si es posible |
| No veo cambios después de que alguien atendió a un paciente | La información no se actualiza solita | Da clic en "Actualizar" en la barra de filtros |
| Filtré por médico/consultorio y ya no veo a nadie | El filtro está activo y no hay pacientes que cumplan esa combinación | Revisa los filtros activos en la barra superior y quítalos si no los necesitas |
| Le di clic a "Registrar llegada" y no pasa nada visible | Se está creando el camino del paciente en segundo plano | Espera unos segundos a que cargue la ventana de captura de llegada |


## Implementación — para el siguiente dev/agente

- **Archivo(s) principal(es):** `src/pages/AdminDashboard.tsx` (ruta `/`, solo rol `admin` vía `ProtectedRoute allowedRoles={["admin"]}` en `App.tsx`)
- **Componentes de `src/features/centro-control/components/`:** `DashboardFilters`, `OperationalStatCard`, `PatientJourneyKanban` + `PatientJourneyCard`, `TodayAppointmentsTable`, `DoctorLoadCard`, `RoomStatusCard`, `OperationalAlerts`, `FinancialOperationsPanel`, `PatientOperationalDrawer`, `QuickArrivalModal`
- **Hooks de datos:** `useDashboardData` (citas/pacientes/médicos/consultorios/journey instances del día), `useFinancialDashboardData` (turnos de caja, actas de merma, OC, CxP, faltantes farmacia)
- **Helpers de negocio:** `src/features/centro-control/lib/journeyHelpers.ts` — define columnas del kanban (`KANBAN_COLUMNS`), mapeo `step_key → columna`, cálculo de riesgo (`getPatientOperationalRisk`) y siguiente acción (`getPatientNextAction`)
- **Tablas/RPCs Supabase involucradas (indirectas vía hooks):** `appointments`, `patients`, `journey_instances`, `journey_instance_steps`, `journey_instance_step_data`, `expedientes`, `consentimientos`, `cortes`/`turnos`/`pharmacy_cash_shifts` (vía `useFinancialDashboardData`); RPC `createJourneyFromAppointment` / `openJourneyStepByKey` (en `journeyEngine`)
- **Cómo agregar una tarjeta de estadística nueva:** agregar el cálculo en el `useMemo` de `stats` en `AdminDashboard.tsx` y una `OperationalStatCard` más en el grid
- **Cómo agregar una regla de riesgo/alerta nueva:** la lógica de riesgo vive en `getPatientOperationalRisk` (journeyHelpers.ts); las alertas operativas clínicas se generan en el `useMemo` de `alerts` dentro de `AdminDashboard.tsx`; las alertas financieras/farmacia viven en `useFinancialDashboardData` + `FinancialOperationsPanel.tsx`

