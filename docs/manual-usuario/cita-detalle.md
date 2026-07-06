# Detalle de cita

> Aquí ves toda la información de una cita específica y actúas sobre ella: confirmarla o cancelarla, cambiar su estado, cobrar con tarjeta, dar seguimiento al camino del paciente, reasignar la enfermera y gestionar sus recordatorios. La usan recepción, administración, doctores y enfermería (cada quien ve solo lo que le corresponde).

## Operación — cómo se usa

### Cómo confirmar o cancelar la cita

1. Si la cita está en "Solicitada" o "Tentativa" y tienes rol de admin o recepción, verás dos botones grandes: **"Confirmar cita"** y **"Cancelar cita"**.
2. Si cancelas, el sistema te pide confirmar de nuevo — la cancelación es permanente y el paciente tendrá que reagendar.
3. Para cualquier otro estado (por ejemplo "Liberada" o "Confirmada por médico"), usa el selector de estado en la esquina superior derecha de la pantalla.

### Cómo cobrar la cita con tarjeta

1. Busca el bloque **"Cobro con tarjeta"** — solo aparece si tu rol es admin o recepción, la cita no está cancelada ni liberada, y hay una clínica activa seleccionada.
2. Si no escribes un monto, el sistema usa el precio del servicio agendado como sugerencia.
3. Da clic en **"Cobrar con tarjeta"** — se abre la ventana de pago.
4. Al completarse el pago, verás una confirmación con los últimos dígitos del cobro.

### Cómo dar seguimiento al camino del paciente

1. Busca el bloque **"Camino del paciente"**.
2. Si el paciente aún no ha llegado, da clic en **"Iniciar camino"** (solo admin/recepción) para registrar su llegada.
3. Si ya inició, el botón cambia a **"Registrar llegada"** y ves el avance debajo, en qué etapa va.

### Cómo asignar o cambiar la enfermera responsable

1. Busca **"Enfermera responsable"**.
2. Si eres admin o doctor, verás un selector — elige la enfermera o "Sin asignar". El cambio se guarda solo y, si asignas a alguien, ella recibe una notificación automática.
3. Si no tienes ese permiso, solo ves el nombre de la enfermera asignada (o "Sin asignar"), sin poder cambiarlo.

### Cómo programar un recordatorio manual

1. En la sección **"Recordatorios"**, da clic en **"Nuevo recordatorio"**. Si el botón está desactivado, el paciente no tiene ningún canal de comunicación registrado.
2. Elige el canal, la fecha y hora, y ajusta el mensaje sugerido si hace falta.
3. Guarda — queda en estado "Pendiente" hasta que se envíe.
4. Para mandarlo de inmediato, da clic en **"Enviar ahora"** junto al recordatorio.
5. Para cambiar la fecha de uno ya creado, da clic en **"Reprogramar"**.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** los botones grandes de confirmar/cancelar solo aparecen si la cita está en "Solicitada" o "Tentativa".
  **Por qué:** evita reconfirmar o cancelar dos veces una cita que ya tiene una decisión tomada; para otros cambios usa el selector de estado.
- **Lo que pasa:** el bloque de cobro con tarjeta no aparece en todas las citas.
  **Por qué:** la cita está cancelada o liberada, o no hay una clínica activa seleccionada en el sistema.
- **Lo que pasa:** el botón "Nuevo recordatorio" aparece bloqueado para algunos pacientes.
  **Por qué:** el paciente no tiene ningún canal de comunicación (WhatsApp, Telegram, etc.) registrado, así que no hay a dónde enviarle el mensaje.
- **Lo que pasa:** solo admin o doctor pueden reasignar la enfermera responsable.
  **Por qué:** esa decisión la toman ellos; recepción y enfermería solo consultan quién está asignada.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No puedo confirmar ni cancelar la cita | Ya no está en "Solicitada" ni "Tentativa" | Usa el selector de estado en la parte de arriba |
| No aparece el bloque para cobrar con tarjeta | La cita está cancelada/liberada, o no hay clínica activa | Verifica el estado de la cita y que haya una clínica seleccionada |
| El botón "Nuevo recordatorio" está apagado | El paciente no tiene canal de comunicación registrado | Pide que se registre su WhatsApp, Telegram o correo antes de programar el recordatorio |
| No veo el selector para cambiar la enfermera | Tu rol no tiene permiso para reasignar | Pide a un admin o doctor que haga el cambio |
| No veo un aviso de "Cita agendada vía Telegram" | La cita no fue creada por el bot | Es normal; ese aviso solo aparece si `creada_por_bot` está activo |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/DetalleCita.tsx` (ruta `/cita/:id`)
- **Tablas Supabase involucradas:** `appointments` (incluye `assigned_nurse_id`, `status`), `patients`, `doctors`, `rooms`, `servicios`, `nurses`, `identidades_canal`, `recordatorios_cita`, `journey_instances`, `appointment_resources`
- **RPCs/edge functions:** `log_audit` (RPC, audita cambios de status), `enviar-recordatorios` (edge function, envío manual/reintento), `notify-nurse-assignment` (edge function, notifica a la enfermera reasignada)
- **Componentes reusados:** `PatientJourneyLine` y `journeyEngine.audit` (`src/features/camino-paciente/`), `QuickArrivalModal` (`src/features/centro-control/components/`), `StripePaymentModal` (`src/features/pagos/`, requiere `activeClinicId` de `useActiveClinic()`)
- **Permisos por bloque:** `hasRole("admin") || hasRole("receptionist")` controla el selector de estado, confirmar/cancelar, cobro con tarjeta e iniciar camino; `hasRole("admin") || hasRole("doctor")` controla reasignación de enfermera (`puedeReasignarEnfermera`); `hasRole("admin") || hasRole("receptionist")` controla gestión de recordatorios (`puedeGestionarRecordatorios`); el bloque de camino del paciente es visible (solo lectura) también para `doctor` y `nurse`.
- **Cómo agregar un campo nuevo:** ampliar el `select()` del `useEffect` inicial + agregar el bloque JSX correspondiente + regenerar `types.ts` si el campo está en una tabla tipada.
- **Cómo agregar una regla de negocio nueva:** los cambios de status y reasignación de enfermera se validan en el frontend (`updateStatus`, `handleReasignarEnfermera`) — si debe ser infranqueable, moverla a un trigger o RPC en Postgres.

_/aprende 2026-07-06_
