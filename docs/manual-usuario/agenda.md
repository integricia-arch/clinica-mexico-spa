# Agenda médica

> Aquí ves todas las citas de la semana en una sola pantalla, organizadas por día y hora. La usan recepción, doctores, enfermería y administración para saber qué citas hay y entrar al detalle de cualquiera de ellas.

## Operación — cómo se usa

### Cómo ver las citas de la semana

1. Al entrar a "Agenda médica" ves automáticamente la semana actual (lunes a sábado), con las horas de 8:00 a 18:00 en la columna izquierda.
2. Cada cita aparece como una tarjeta de color en el día y la hora en que está agendada, con el nombre del paciente, el horario y su estado (por ejemplo "Confirmada" o "Solicitada").
3. El color de la tarjeta te dice el estado de un vistazo: verde es confirmada, amarillo es solicitada/pendiente, gris es tentativa, y rojo es cancelada (las canceladas y liberadas no se muestran en esta vista).

### Cómo moverte entre semanas

1. Usa las flechas de la parte superior derecha para ir a la semana anterior o a la siguiente.
2. El rango de fechas que estás viendo aparece en el centro, entre las dos flechas.

### Cómo filtrar por médico

1. Si eres administrador o trabajas en recepción, verás un selector "Todos los médicos" arriba a la derecha.
2. Elige un médico específico para ver solo sus citas, o deja "Todos los médicos" para ver la agenda completa.
3. Si eres doctor, el sistema ya filtra automáticamente para mostrarte solo tus propias citas.

### Cómo ver el detalle de una cita

1. Da clic sobre la tarjeta de la cita que te interesa.
2. Se abre la pantalla de detalle de esa cita, donde puedes ver toda la información, cambiar su estado (confirmar o cancelar), reasignar la enfermera, programar recordatorios o cobrar con tarjeta, según tu rol.

### Cómo agendar una cita nueva

La pantalla de Agenda médica es solo para consultar — no tiene un botón para crear citas aquí. Para agendar, ve a la pantalla "Citas" (menú lateral), donde sí encontrarás el botón "Nueva cita".

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** las citas canceladas o liberadas no aparecen en el calendario. **Por qué:** así el calendario solo muestra lo que realmente vas a atender esa semana, sin que se llene de citas que ya no van a pasar.
- **Lo que pasa:** si eres doctor, solo ves tus propias citas y no puedes cambiar el filtro de médico. **Por qué:** un doctor solo necesita ver su propia agenda; el filtro por médico es una herramienta de recepción y administración para coordinar a todo el equipo.
- **Lo que pasa:** la agenda se actualiza sola cuando alguien crea o modifica una cita, sin que tengas que recargar la página. **Por qué:** varias personas (recepción, el bot de Telegram, los doctores) pueden agendar al mismo tiempo, y necesitas ver los cambios de inmediato para no encimar citas.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No encuentro el botón para crear una cita nueva | Esta pantalla es solo de consulta | Ve a "Citas" en el menú lateral — ahí está el botón "Nueva cita" |
| No veo las citas de otro médico | Tu filtro está puesto en un médico específico, o eres doctor y solo ves las tuyas | Si eres recepción o admin, cambia el selector a "Todos los médicos" |
| Una cita cancelada desapareció del calendario | Es el comportamiento normal — las citas canceladas no se muestran aquí | Si necesitas verla, búscala desde la pantalla "Citas" o entra directo a su detalle |
| Hice un cambio en otra pantalla y no se refleja aquí | Tu conexión puede haberse cortado momentáneamente | Recarga la página (F5) |
| Di clic en una cita y no pasa nada o da error | La cita pudo haber sido eliminada o ya no existe | Recarga la página; si el problema sigue, avisa a soporte |


## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/AgendaMedico.tsx` (ruta `/agenda`, registrada en `App.tsx`). Es de **solo lectura**: no tiene creación de citas, reprogramación ni cancelación — solo navega a `/cita/:id` al hacer clic en una tarjeta.
- **Nota importante:** existe también `src/pages/Agenda.tsx` (con vista día/semana, "Nueva cita", bloqueos de horario, confirmar/cancelar) pero **no está enrutado en `App.tsx`** — es código huérfano, no es la pantalla que ve el usuario en `/agenda`. No confundir al documentar o modificar.
- **Crear cita nueva:** se hace desde `src/pages/Citas.tsx` (ruta `/citas`), que usa `src/components/agenda/NuevaCitaDialog.tsx` (selección de paciente, doctor, enfermera opcional, fecha/hora, duración, servicio, motivo, y soporte de citas recurrentes).
- **Detalle/acciones de una cita:** `src/pages/DetalleCita.tsx` (ruta `/cita/:id`) — cambia `status` directo en `appointments`, reasigna `assigned_nurse_id`, gestiona `recordatorios_cita`, y cobro con Stripe (`StripePaymentModal`). No hay edición de fecha/hora ahí tampoco.
- **Tablas Supabase:** `appointments` (con joins a `patients`, `doctors`), `doctors`.
- **Realtime:** suscripción a `postgres_changes` (INSERT/UPDATE) sobre `appointments` en el canal `agenda-realtime` — por eso la vista se refresca sola.
- **Cómo agregar un campo nuevo a la tarjeta de cita:** ampliar el `select` en `loadAppointments()` (línea ~65) y agregar el campo al JSX dentro del `.map` de `slots` (~línea 162).
- **Cómo agregar una regla de negocio nueva:** si es de visibilidad/filtrado, va en `loadAppointments()` o en `getAppointmentsForSlot()`; si es de transición de estado (confirmar/cancelar), esa lógica vive en `DetalleCita.tsx`, no aquí.

