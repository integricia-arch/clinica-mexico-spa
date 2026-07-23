# Unificar módulo Recepción + Conversaciones — Design Spec

**Fecha:** 2026-07-23
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

Hoy existen dos módulos de nav separados que hacen trabajo relacionado:

- **`/recepcion`** (`RecepcionDashboard.tsx`) — dashboard operativo: stats del día,
  citas del día, pendientes/rechazadas por doctor, y un resumen embebido de
  conversaciones escaladas con botón "Abrir" que navega a `/inbox?id=`.
  Roles: `admin`, `receptionist`.
- **`/inbox`** (también accesible en `/conversaciones`, mismo componente `Inbox.tsx`) —
  vista completa de chat: lista de conversaciones, hilo de mensajes, responder,
  tomar control, cerrar. Roles de ruta: `admin`, `receptionist`, `doctor`, `nurse`.

No son 100% duplicados (uno es dashboard, otro es la vista de chat completa),
pero comparten dominio (conversaciones escaladas) y el usuario los percibe como
una sola función que debería vivir en un solo lugar.

**Decisión del usuario:** un solo módulo "Recepción". Doctor y nurse tienen
**acceso completo**, igual que receptionist (no una vista recortada).

## Hueco encontrado — RLS no cubre doctor/nurse

Auditoría de `pg_policies` mostró que aunque `/inbox` ya permitía la ruta a
doctor/nurse, las políticas RLS reales bloqueaban casi todo:

| Tabla | Policy | Roles actuales | Falta |
|---|---|---|---|
| `conversaciones` | Staff read conversaciones (SELECT) | admin, receptionist, (o `asignada_humano_id = uid`) | doctor, nurse |
| `conversaciones` | Staff update conversaciones (UPDATE) | admin, receptionist | doctor, nurse |
| `mensajes` | Staff read mensajes (SELECT) | admin, receptionist | doctor, nurse |
| `doctor_contact_attempts` | Staff read doctor_contact_attempts (SELECT) | admin, receptionist | doctor, nurse |

Sin corregir esto, doctor/nurse verían el módulo unificado vacío pese a tener
acceso de ruta — el bug ya existía antes de esta fusión, esta migración lo
resuelve como parte del ajuste de acceso "completo".

`appointments` (View appointments) ya incluye `nurse` explícito, y doctor ve
sus propias citas vía `is_appointment_participant(id)` — **no se toca**, es
una policy usada en toda la app (Agenda, Citas, Panel del doctor) y ampliarla
a "doctor ve TODAS las citas de la clínica" es un cambio de alcance distinto,
fuera de esta fusión.

`enviar-mensaje-humano` (edge function) ya acepta doctor/nurse — usa
service-role internamente, no está bloqueada por RLS. No requiere cambio.

## Hueco de trazabilidad — tomar control sin auditoría

`cerrarConversacion()` en `Inbox.tsx` inserta en `audit_logs`
(`accion: "conv_cerrada"`). `tomarControl()` no inserta nada — no hay registro
de quién tomó una conversación escalada. Se agrega el mismo patrón de insert
(`accion: "conv_tomada"`) para consistencia de auditoría, ya que al ampliar
acceso a doctor/nurse la trazabilidad de "quién tomó control" importa más.

## Diseño

### 1. Rutas y navegación

- `/recepcion` pasa a ser el único módulo real, con tabs internos:
  `Resumen` (contenido actual de `RecepcionDashboard`) y `Conversaciones`
  (contenido actual de `Inbox`). Tab controlado por query param `?tab=`
  (`resumen` por default; `conversaciones` si viene `?id=` en la URL).
- `/inbox` y `/conversaciones` se convierten en redirects (`<Navigate>`) a
  `/recepcion?tab=conversaciones` preservando `?id=` si existe — ningún link
  existente (Citas.tsx, PatientOperationalDrawer, buildJourneyLineSteps
  followup) se rompe; se actualizan de todos modos para apuntar directo a la
  ruta canónica y evitar el salto doble.
- `AppLayout.tsx`: un solo `NAV_ITEMS` entry "Recepción" con
  `roles: ["admin","receptionist","doctor","nurse"]`. Se elimina el entry
  "Conversaciones". El badge de escaladas (`escaladasCount`) se asocia al
  item `/recepcion`.

### 2. Componentes

- Se crea `src/features/recepcion/ConversacionesTab.tsx` con el contenido
  íntegro de `Inbox.tsx` (lista + hilo + responder + tomar control + cerrar +
  `ConversationActionPanel`), sin reescritura de lógica.
- `src/pages/RecepcionDashboard.tsx` pasa a ser el shell: header + tabs +
  renderiza `ResumenTab` (contenido actual del dashboard, extraído a
  `src/features/recepcion/ResumenTab.tsx`) o `ConversacionesTab`.
- El botón "Abrir" de "Casos por atender" en Resumen cambia de
  `navigate('/inbox?id=')` a cambiar el tab activo + `?id=` en la misma ruta.
- `src/pages/Inbox.tsx` se elimina tras la migración de su contenido.

### 3. Migración SQL

Nueva migración `supabase/migrations/<timestamp>_recepcion_conversaciones_rls_doctor_nurse.sql`:
- `DROP POLICY IF EXISTS` + `CREATE POLICY` en las 4 policies de la tabla
  anterior, agregando `has_role(..., 'doctor')` / `has_role(..., 'nurse')` al
  OR existente.
- Correr `get_advisors(type="security")` después de aplicar.

### 4. Docs / manual de usuario

- Contenido de `docs/manual-usuario/conversaciones.md` se funde como sección
  dentro de `docs/manual-usuario/recepcion.md`; se borra `conversaciones.md`.
- `DELETE FROM manual_paginas WHERE ruta = '/inbox'` (la fila de `/recepcion`
  ya existe y se mantiene).
- `manual-site/src/components/HomepageFeatures/index.tsx`: se quita la
  entrada `{ slug: 'conversaciones', ... }` (evita link roto en build
  Docusaurus, aprendido 2026-06-16).
- `HelpChatWidget.tsx` → `RUTA_MANUAL`: se quitan las claves `/inbox` y
  `/conversaciones` (dead routes tras el redirect).

### 5. Puntos de integración a revisar sin romper

- `App.tsx`: quitar rutas `/inbox` e `/conversaciones` → Inbox, agregar
  redirects; ampliar roles de `/recepcion` a incluir doctor/nurse; quitar
  import de `Inbox`.
- `PatientOperationalDrawer.tsx` (`onNavigate("/inbox")`) → actualizar a
  `/recepcion?tab=conversaciones`.
- `buildJourneyLineSteps.ts` (`followup: "/inbox"`) → actualizar a
  `/recepcion?tab=conversaciones`.
- `Citas.tsx` (`navigate('/conversaciones?id=...')`) → actualizar a
  `/recepcion?tab=conversaciones&id=...`.

## Fuera de alcance

- No se construye un sistema genérico de permisos por rol configurable —
  se reutiliza el patrón existente de arrays `roles` (igual que el resto de
  la app). El usuario aceptó "doctor/nurse = acceso completo igual que
  receptionist" como la regla fija, no una matriz configurable.
- No se toca la policy de `appointments` ni el alcance de qué citas ve un
  doctor fuera de este módulo.
- No se implementa scoping multi-tenant por `clinic_id` en las policies de
  `conversaciones`/`mensajes` — la policy actual tampoco lo tenía para
  admin/receptionist; ese es un problema preexistente separado, no
  introducido ni agravado por este cambio.

## Testing

- Manual: login como doctor y como nurse, confirmar que ven conversaciones
  escaladas, historial de mensajes, pueden tomar control/responder/cerrar,
  y que `audit_logs` registra `conv_tomada` y `conv_cerrada` con su `user.id`.
- Confirmar que `/inbox`, `/conversaciones` y links con `?id=` viejos
  redirigen correctamente.
- `supabase db push --linked` limpio + `get_advisors(type="security")` sin
  hallazgos nuevos.
- Build de `manual-site` (`npm run build:all`) sin link roto.
