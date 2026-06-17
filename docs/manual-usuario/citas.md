# Citas

> Aquí ves todas las citas programadas, agendas una nueva y entras al detalle de cualquier cita para confirmarla, cancelarla, cobrarla o dar seguimiento. La usan recepción, administración, doctores y enfermería.

## Operación — cómo se usa

### Cómo ver las citas de un rango de fechas

1. Al entrar, la pantalla ya te muestra las citas de los próximos 7 días (desde hoy).
2. Si quieres otro rango, cambia las fechas en "Desde" y "Hasta".
3. Si quieres ver solo las citas de un médico, elígelo en el filtro "Médico" (por default muestra "Todos").
4. Usa las etiquetas de color (Solicitada, Confirmada, Recordada, Cancelada) para mostrar u ocultar citas por status — da clic sobre la etiqueta para activarla o desactivarla.
5. La tabla se actualiza sola con tus filtros, no hace falta dar clic en "Buscar".

### Cómo agendar una cita nueva

1. Da clic en "Nueva cita" (arriba a la derecha).
2. Llena los datos que te pide la ventana (paciente, médico, servicio, fecha y hora).
3. Confirma — la cita aparece en la lista si cae dentro del rango de fechas que tienes filtrado.

### Cómo ver el detalle rápido de una cita

1. Da clic sobre cualquier renglón de la tabla.
2. Se abre una ventana con los datos principales: servicio, médico, teléfono del paciente, origen (web, WhatsApp, Telegram), motivo y notas si las hay.
3. Desde ahí puedes:
   - **Cambiar el status** directamente con el selector "Cambiar status".
   - Dar clic en **"Ver detalle"** para abrir la pantalla completa de la cita.
   - Dar clic en **"Ver conversación"** para ir al chat que tuvo el paciente con el bot (si no tiene canal o conversación asociada, te avisa y no te lleva a ningún lado).

### Cómo identificar el origen de una cita

- El icono junto al nombre del canal te dice de dónde vino la cita: globo (web), avión de papel (Telegram), teléfono (WhatsApp).
- Si dice "(bot)" junto al origen, fue agendada automáticamente por el asistente, sin que nadie de recepción interviniera.

### Cómo confirmar o cancelar una cita (pantalla de detalle completo)

1. Entra al detalle completo de la cita (botón "Ver detalle" desde la ventana rápida, o navegando directo a `/cita/:id`).
2. Si la cita está en status "Solicitada" o "Tentativa", verás dos botones grandes: **"Confirmar cita"** y **"Cancelar cita"**.
3. Si cancelas, el sistema te pide confirmar de nuevo — la cancelación es permanente y el paciente tendrá que reagendar.
4. Si necesitas otro status (por ejemplo "Liberada" o "Confirmada por médico"), usa el selector de status arriba a la derecha de la pantalla de detalle.

### Cómo cobrar una cita con tarjeta

1. En el detalle completo de la cita, busca el bloque "Cobro con tarjeta" (no aparece si la cita está cancelada o liberada).
2. Si no escribes un monto, el sistema usa el precio del servicio agendado como sugerencia.
3. Da clic en "Cobrar con tarjeta" — se abre la ventana de pago.
4. Al completarse el pago, verás una confirmación con los últimos dígitos del cobro.

### Cómo dar seguimiento al "camino del paciente"

1. En el detalle completo, busca el bloque "Camino del paciente".
2. Si el paciente aún no ha llegado a la clínica, da clic en "Iniciar camino" para registrar su llegada.
3. Si ya inició su camino, el botón cambia a "Registrar llegada" y verás el avance (en qué etapa va) debajo.

### Cómo asignar o cambiar la enfermera responsable

1. En el detalle completo, busca "Enfermera responsable".
2. Si tienes permiso (admin o doctor), verás un selector — elige la enfermera o "Sin asignar".
3. El cambio se guarda solo. Si asignas una enfermera, ella recibe una notificación automática.
4. Si no tienes permiso para reasignar, solo ves el nombre de la enfermera asignada (o "Sin asignar"), sin poder cambiarlo.

### Cómo programar un recordatorio manual

1. En el detalle completo, ve a la sección "Recordatorios".
2. Da clic en "Nuevo recordatorio". Si el botón está desactivado, es porque el paciente no tiene ningún canal de comunicación registrado (no se le puede enviar nada).
3. Elige el canal (WhatsApp, SMS, correo, Telegram), la fecha y hora, y revisa o ajusta el mensaje sugerido.
4. Guarda — el recordatorio queda en estado "Pendiente" hasta que se envíe.
5. Para mandarlo de inmediato en vez de esperar la fecha programada, da clic en "Enviar ahora" junto al recordatorio.
6. Para cambiar la fecha de un recordatorio ya creado, da clic en "Reprogramar".

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** no puedes cancelar o confirmar una cita que ya está confirmada, cancelada o liberada — los botones grandes solo aparecen si está en "Solicitada" o "Tentativa".
  **Por qué:** evitar que se reconfirme o cancele dos veces una cita que ya tiene una decisión tomada; para otros cambios de status usa el selector de arriba.
- **Lo que pasa:** el botón "Nuevo recordatorio" aparece bloqueado para algunos pacientes.
  **Por qué:** el paciente no tiene ningún canal de comunicación (WhatsApp, Telegram, etc.) registrado en el sistema, así que no hay a dónde enviarle el mensaje.
- **Lo que pasa:** el bloque de "Cobro con tarjeta" no aparece en algunas citas.
  **Por qué:** la cita está cancelada o liberada, o no hay una clínica activa seleccionada en el sistema.
- **Lo que pasa:** "Ver conversación" a veces no te lleva a ningún lado y solo te avisa.
  **Por qué:** el paciente no tiene un canal de comunicación vinculado, o nunca tuvo una conversación previa con el bot.
- **Lo que pasa:** solo algunos roles pueden reasignar la enfermera responsable.
  **Por qué:** esa decisión la toman admin o doctor; recepción y enfermería solo pueden consultar quién está asignada.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No veo una cita que sé que existe | Está fuera del rango de fechas filtrado, o su status está desactivado en el filtro de etiquetas | Amplía el rango "Desde/Hasta" y revisa que la etiqueta de su status esté activada |
| No puedo confirmar ni cancelar una cita desde el detalle | La cita ya no está en "Solicitada" ni "Tentativa" | Usa el selector de status en la parte de arriba para cambiarla a lo que necesites |
| El botón "Nuevo recordatorio" está apagado | El paciente no tiene canal de comunicación registrado | Pide que se registre su WhatsApp, Telegram o correo antes de programar el recordatorio |
| "Ver conversación" me dice que no hay nada | El paciente no tiene canal vinculado o nunca chateó con el bot | Es normal si la cita se agendó por otro medio (web o en persona) |
| No veo el selector para cambiar la enfermera | Tu rol no tiene permiso para reasignar | Pide a un admin o doctor que haga el cambio |
| No aparece el bloque para cobrar con tarjeta | La cita está cancelada/liberada, o no hay clínica activa | Verifica el status de la cita y que tengas una clínica seleccionada en el sistema |


## Implementación — para el siguiente dev/agente

- **Archivo(s) principal(es):** `src/pages/Citas.tsx` (lista + modal rápido), `src/pages/DetalleCita.tsx` (detalle completo en `/cita/:id`), `src/components/agenda/NuevaCitaDialog.tsx` (alta de cita)
- **Tablas Supabase involucradas:** `appointments`, `patients`, `doctors`, `servicios`, `rooms`, `appointment_resources`, `identidades_canal`, `conversaciones`, `recordatorios_cita`, `journey_instances`, `nurses`
- **RPCs/edge functions:** `log_audit` (RPC, audita cambios de status), `enviar-recordatorios` (edge function, envío manual de recordatorio), `notify-nurse-assignment` (edge function, notifica a la enfermera reasignada)
- **Cómo agregar un campo nuevo:** migración en la tabla correspondiente (normalmente `appointments`) + agregarlo al `select()` en `Citas.tsx`/`DetalleCita.tsx` + actualizar formulario en `NuevaCitaDialog.tsx` si aplica + regenerar `types.ts`
- **Cómo agregar una regla de negocio nueva:** los cambios de status y reasignación de enfermera se validan en el frontend (`updateStatus`, `handleReasignarEnfermera` en `DetalleCita.tsx`) — si la regla debe ser infranqueable (no solo UI), muévela a un trigger o RPC en Postgres
- **Camino del paciente:** integrado vía `src/features/camino-paciente/` (`PatientJourneyLine`, `journeyEngine.audit`) y `src/features/centro-control/components/QuickArrivalModal.tsx`
- **Cobro con tarjeta:** `src/features/pagos/StripePaymentModal.tsx`, requiere `activeClinicId` de `useActiveClinic()`

