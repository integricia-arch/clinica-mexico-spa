# Corte de caja — gaps reales (sesión 44)

**Fecha:** 2026-07-16
**Contexto:** punto 3 de "los 4 puntos" (STATE.md sesión 43). El plan citado en CLAUDE.md
("Opción B, 6 pasos desde cero") y `memoria/proyectos/project_corte-caja-arquitectura.md`
estaban desactualizados — ese archivo ya no existe y la mayor parte de esos "6 pasos" ya
está implementada en producción (conteo ciego apertura+cierre, denominación, folio Z,
umbral+PIN supervisor, `fondos_movimientos`, corte X). Ver
`memoria/proyectos/investigacion-corte-caja-pos.md` (15-jun) para el detalle original —
su tabla de gaps sigue siendo la referencia correcta. Este spec cubre los gaps
confirmados por inspección de código (no de memoria vieja).

## Componente compartido

**RPC `verify_supervisor_pin(p_clinic_id uuid, p_supervisor_id uuid, p_pin text) RETURNS void`**
(`SECURITY DEFINER`, `SET search_path = public`) — extrae la lógica de validación de PIN
que hoy vive duplicada dentro de `turno_close_with_pin`/`pharmacy_close_shift_with_pin`.
Usa `get_clinic_supervisors` para confirmar que `p_supervisor_id` es supervisor de la
clínica, compara el PIN (hash), y hace `RAISE EXCEPTION 'PIN_INCORRECT'` /
`'PIN_NOT_CONFIGURED'` igual que las RPCs existentes (mismos códigos de error que ya
maneja el cliente). Reusada por los gaps 1 y 2 abajo — nunca duplicar el chequeo de PIN
en una RPC nueva.

**Componente `SupervisorPinDialog`** (`src/components/turno/SupervisorPinDialog.tsx`) —
versión genérica de `SupervisorAuthDialog` sin efecto de cerrar turno: selecciona
supervisor + captura PIN, llama `verify_supervisor_pin`, y en éxito invoca `onAuthorized(supervisorId)`
dejando que el caller decida qué RPC de negocio llamar después. `SupervisorAuthDialog`
(cierre de turno) no se toca — sigue como está, atado a `turno_close`/`pharmacy_close_shift`.

## Gap 1 — Devoluciones sin autorización de supervisor

**Riesgo:** mayor prioridad, vector de fraude por reembolsos. Hoy `ReturnDialog.tsx`
manda `authorized_by: user.id` (el propio cajero) sin ningún control.

- `ReturnDialog.tsx`: antes de `handleSubmit`, abre `SupervisorPinDialog`. Al autorizar,
  guarda `supervisorId` y lo manda como `p_supervisor_id` en el payload de
  `pharmacy_register_return`.
- `pharmacy_register_return` (RPC): agrega parámetro `p_supervisor_id uuid NOT NULL` y
  `p_pin text NOT NULL`. Dentro de la función, primera operación: `PERFORM
  public.verify_supervisor_pin(p_clinic_id, p_supervisor_id, p_pin)` — el PIN se valida
  server-side dentro de la misma transacción, nunca confiar en que el cliente ya lo
  validó (la RPC es invocable directamente vía API, con o sin el diálogo).
  `authorized_by` pasa a ser `p_supervisor_id`, no el cajero.

## Gap 2 — Cash drop sin distinguir de egreso genérico

- `fondos_movimientos.tipo`: CHECK constraint amplía a
  `('egreso','ingreso','cash_drop')`. Columna nueva `destino text` (ej. "caja fuerte",
  "banco", "oficina") — NULL para egreso/ingreso normales, requerida para `cash_drop`.
- `turno_fondo_movimiento` (RPC): cuando `p_tipo = 'cash_drop'`, exige
  `p_supervisor_id` + `p_pin` (doble firma cajero+supervisor) y `p_destino`; llama
  `verify_supervisor_pin` igual que gap 1.
- UI (`FondoMovimientoDialog` en `CajaTurno.tsx`, y su equivalente en `ShiftPanel.tsx`
  farmacia): tercera opción en el Select de tipo ("Cash drop / Retiro a caja fuerte"),
  muestra `SupervisorPinDialog` + campo destino cuando se elige.

## Gap 3 — Sin explicación obligatoria en diferencias

- `turno_close` (RPC): si `v_diff <> 0`, exige `p_notes` no vacío —
  `RAISE EXCEPTION 'NOTES_REQUIRED_ON_DIFF'` si viene NULL/vacío. Mismo patrón que ya usa
  para `DIFF_EXCEEDS_THRESHOLD` (el cliente ya sabe parsear errores con formato
  `CODE|...`).
- `TurnoOpenWizard.tsx`: ya calcula `diferencia` en el paso "diff" contra el Z anterior.
  Agrega campo de notas obligatorio en ese paso cuando `diferencia !== 0 &&
  fondoEsperado !== null`, y lo manda en el insert (`turnos.notas_apertura`).
- Cliente: `CloseTurnoDialog` y `TurnoOpenWizard` bloquean el botón de continuar si hay
  diferencia y el campo de notas está vacío (validación optimista — la RPC es la
  autoridad real).

## Gap 4 — Sin folio correlativo de apertura

- Nueva `SEQUENCE public.turnos_apertura_folio_seq`. Columna
  `turnos.folio_apertura bigint`.
- Hoy la apertura es un INSERT directo del cliente a `turnos` (en `TurnoOpenWizard.tsx` y
  en `CajaTurno.tsx`) — no puede asignar `nextval()` de forma segura desde el cliente sin
  RPC. Nueva RPC `turno_open(p_clinic_id, p_caja_id, p_monto_apertura, p_conteo_apertura,
  p_fondo_esperado, p_denominaciones, p_notas)` (`SECURITY DEFINER`) hace el INSERT +
  `nextval()` + valida diferencia/notas (gap 3) en una sola transacción. Ambos wizards de
  apertura pasan a llamar esta RPC en vez de `supabase.from("turnos").insert(...)`
  directo.

## Gap 5 — Sin límite de efectivo configurable

- Reusa `clinic_settings` (`section='caja'`), nueva key `limite_efectivo` en el mismo
  jsonb donde ya vive `umbral_diferencia`. Sin tabla nueva.
- UI: en `CajaTurno.tsx`/`ShiftPanel.tsx`, cuando `efectivo_esperado` (o el conteo físico
  en corte X) supera `limite_efectivo`, banner de alerta no bloqueante ("Efectivo en caja
  supera el límite configurado — considera un cash drop"). No bloquea ninguna operación,
  solo informa.
- Configuración del límite: nueva fila en la pantalla de ajustes de caja donde ya se
  configura `umbral_diferencia` (mismo formulario, un campo más).

## Gap 6 — Reconciliación de turnos generales (no-farmacia)

`CajaTurno.tsx` (usado para cajas generales) abre turno con un formulario simple que
**muestra** `fondo_default` como valor pre-cargado editable — no es conteo ciego, y no
tiene denominación ni verificación contra el Z anterior. `TurnoOpenWizard.tsx` ya
resuelve todo esto pero hoy solo se monta en el flujo de farmacia.

- Reemplaza la sección "Abrir turno" de `CajaTurno.tsx` (líneas ~896-930) por
  `<TurnoOpenWizard cajaFilter="general" onOpened={...} />`, igual que se usa para
  farmacia. Elimina el estado local `cajaId`/`montoApertura`/`notas` y `abrirTurno()` de
  `CajaTurno.tsx` — ese flujo se mueve dentro del wizard (que ya lo tiene, incluyendo la
  llamada a `turno_open` del gap 4).
- El resto de `CajaTurno.tsx` (cierre, fondos, corte X, historial) no cambia — esas RPCs
  ya son agnósticas de farmacia/general.

## Fuera de alcance (explícito)

- No se toca `pharmacy_close_shift`/`turno_close_with_pin` — siguen como están.
- No se construye UI de reportes agregados de cash drops/límites — solo el registro y la
  alerta puntual.
- No se decide todavía el flujo de aprobación cuando el supervisor no tiene PIN
  configurado (gaps 1 y 2) — reusa el fallback de contraseña que ya existe en
  `SupervisorAuthDialog`, mismo criterio se replica en `SupervisorPinDialog`.

## Testing

- Deno tests para `verify_supervisor_pin`, `pharmacy_register_return` (con y sin PIN
  correcto), `turno_fondo_movimiento` tipo `cash_drop`, `turno_close`/`turno_open` con
  `NOTES_REQUIRED_ON_DIFF`.
- Suite de componentes (`ReturnDialog`, `SupervisorPinDialog`, `TurnoOpenWizard` en modo
  `cajaFilter="general"`) — Vitest + Testing Library, patrón ya usado en el repo.
- `tsc --noEmit` limpio + suite completa verde antes de cerrar cada task del plan.
