# Centro de Control Clínico — Mejora incremental de AdminDashboard

Mejorar `src/pages/AdminDashboard.tsx` sin romper nada existente. Solo agrega vistas, lecturas y navegación sobre tablas ya creadas.

## Alcance

- Solo se edita `src/pages/AdminDashboard.tsx`.
- Se crean componentes nuevos en `src/features/centro-control/` (carpeta nueva, no toca módulos existentes).
- No se crean tablas, ni edge functions, ni se cambia auth, roles, rutas o RLS.
- No se duplican módulos: las acciones navegan a rutas existentes (`/cita/:id`, `/pacientes`, `/expedientes`, `/farmacia`, `/facturacion`, `/inbox`, `/configuracion/camino-paciente`).

## Estructura de archivos nuevos

```
src/features/centro-control/
  lib/journeyHelpers.ts          # getJourneyStageLabel, getJourneyStageColor, getPatientNextAction, getPatientOperationalRisk
  hooks/useDashboardData.ts      # loadDashboardData con Promise.all defensivo
  components/DashboardFilters.tsx
  components/OperationalStatCard.tsx
  components/PatientJourneyKanban.tsx
  components/PatientJourneyCard.tsx
  components/DoctorLoadCard.tsx
  components/RoomStatusCard.tsx
  components/OperationalAlerts.tsx
  components/TodayAppointmentsTable.tsx
  components/RecentActivityFeed.tsx
  components/SeguimientosPendientes.tsx
  components/PatientOperationalDrawer.tsx
```

`AdminDashboard.tsx` queda como contenedor que orquesta filtros, hook de datos, y secciones.

## Diseño y orden visual

1. Encabezado: "Centro de control clínico" + subtítulo + botones (Nueva cita → `/nueva-cita`, Registrar llegada, Ver bloqueados, Actualizar).
2. `DashboardFilters` (fecha, médico, consultorio, estado cita, etapa camino, riesgo, búsqueda).
3. Grid de 10 `OperationalStatCard` (con fallback "Sin datos registrados todavía" si 0).
4. `PatientJourneyKanban` con 12 columnas, scroll horizontal.
5. `TodayAppointmentsTable` (reemplaza tabla actual).
6. Grid 2 col: `DoctorLoadCard` list + `RoomStatusCard` list.
7. `OperationalAlerts`.
8. `SeguimientosPendientes`.
9. `RecentActivityFeed` (últimos 20 audit_logs, resumen seguro).

Mantiene estilo actual (cards `bg-card`, sidebar oscuro, acentos verde/turquesa primary). Solo tokens semánticos.

## Lógica clave

**Etapas Kanban** mapeadas a `step_key` críticos definidos en `stepKeys.ts`:
- `arrival` → Llegada
- `identification`+`consent` → Identificación
- `record` → Expediente
- `triage` → Triage
- `consultation` → Consulta
- `diagnosis` → Análisis
- `valoration` → Valoración
- `prescription` → Receta
- `billing` → Cobro
- `followup` → Seguimiento
- `discharge` → Alta
- columna virtual `bloqueado` (status === 'bloqueado')

Cuando una `appointment` del día no tiene `journey_instance`, se ubica en columna "Llegada" con badge "Sin camino iniciado" y botón "Iniciar camino" (deshabilitado si no hay plantilla activa, muestra error).

**Iniciar camino**: inserta en `journey_instances` con `appointment_id`, `patient_id`, `template_id` y `template_version_id` de la plantilla activa por defecto, `snapshot_json` desde `journey_template_versions.config_json` + steps. Verifica idempotencia por `appointment_id`.

**Helpers defensivos**: lectura de `snapshot_json.current_step_key` y `status` con guards. Si la propiedad no existe, considerar etapa "Llegada".

**Carga por rol** (lee `user_roles` vía hook `useAuth` existente):
- admin/receptionist/nurse: todo el día
- doctor: filtra `appointments.doctor_id IN (doctors WHERE user_id = auth.uid())`

**Realtime**: suscripciones a `appointments`, `journey_instances`, `recordatorios_cita`, `conversaciones` con `supabase.channel`. Cleanup en unmount. Botón "Actualizar" como fallback.

**Drawer (`PatientOperationalDrawer`)**: usa `Sheet` de shadcn. Lee paciente, cita, doctor, room, último expediente activo, últimas 3 notas (solo si rol lo permite: oculta `subjetivo/objetivo` para receptionist), recordatorios próximos. Botones que navegan, no editan.

## Restricciones implementadas

- No INSERT/UPDATE/DELETE sobre `patients`, `appointments`, `expedientes`, `notas_consulta` desde el dashboard.
- Único INSERT permitido: `journey_instances` al pulsar "Iniciar camino" con validaciones.
- No exponer JSON crudo: todo formateado.
- Notas clínicas resumidas (primeros 80 caracteres del `diagnostico_principal` solo para admin/doctor/nurse).
- Activity feed filtra tablas sensibles a un resumen seguro ("Nota actualizada por Dr. X" sin contenido).
- Cards superiores y secciones muestran skeleton + fallback vacío sin romper.

## Detalles técnicos

- TanStack Query ya está en el proyecto; uso `useQuery` con `queryKey` que incluye fecha y filtros, `refetchInterval` opcional.
- Joins en memoria por id (no nested selects pesadas).
- `Promise.allSettled` para que una tabla opcional fallida no tumbe el dashboard.
- Componentes ≤ 200 líneas, hooks separados.

## Fuera de alcance

- Crear `/camino-paciente/:id` (se enlaza, pero si no existe muestra toast).
- Cambios en sidebar, ProtectedRoute, App.tsx, otros módulos.
- Realtime para audit_logs (solo refetch manual).
- Nuevos campos en BD.