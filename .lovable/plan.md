# Plan: Flujo Telegram/Inbox/Recepción operativo

## Diagnóstico del bug actual

En `supabase/functions/telegram-webhook/index.ts`, cuando una conversación está `escalada`, el bot responde con un mensaje genérico ("Recepción ya está al tanto…") en cada nuevo mensaje del paciente. Resultado:
- El paciente recibe ruido repetido.
- Algunos mensajes parecen "perderse" porque el handler corta el flujo antes de garantizar el INSERT en `mensajes` con `direction` correcto.

## Cambios

### 1. `supabase/functions/telegram-webhook/index.ts`
- **Siempre** guardar el mensaje entrante en `mensajes` (direction `inbound`, raw_payload completo, idempotente por `update_id`).
- Si `conversacion.status = 'escalada'`:
  - NO generar respuesta del bot por defecto.
  - Si `flow_data.greeted_during_escalation !== true`, mandar UNA vez el aviso "Recepción ya está atendiendo tu caso…" y marcar `flow_data.greeted_during_escalation = true` en `bot_sesiones`.
  - Ejecutar triage de palabras clave; si hay señales rojas → marcar conversación `prioridad='urgente'`, mandar mensaje seguro (911) una sola vez (`flow_data.urgent_notice_sent`), insertar audit `prioridad_urgente_asignada`.
- Audit `mensaje_recibido_durante_escalamiento`.

### 2. Migración DB
- `conversaciones`: agregar columna `prioridad text default 'normal'` (`normal|alta|urgente`), `motivo_resumen text`, `dolor_intensidad int`.
- `appointments`: agregar columna `conversacion_id uuid` (nullable, FK lógica).
- `audit_logs` enum (`accion`): agregar valores nuevos si no existen — usar `text` ya, o ampliar enum con `ALTER TYPE ... ADD VALUE`.
- Función `pharmacy_*` no se toca. Sólo agregar índice `appointments_conversacion_id_idx`.
- RPC `inbox_create_appointment(p_conversacion_id, p_patient_id, p_doctor_id, p_room_id, p_servicio_id, p_fecha_inicio, p_duracion_min, p_notas)`:
  - Valida misma `clinic_id` entre doctor/room/servicio/patient.
  - Valida `doctor_servicios` activo.
  - Valida sin choque (overlap por doctor y por room).
  - Inserta appointment, set `conversacion_id`, set conversation `status='cerrada'` opcional? → No: queda escalada hasta que recepción cierre. Solo marca `flow_data.appointment_id`.
  - Inserta audit `cita_creada_desde_inbox`, `doctor_asignado`, `consultorio_asignado`.
  - Devuelve `appointment_id`.
- RPC `inbox_send_patient_message(p_conversacion_id, p_text)`: helper que recepción ya usa vía edge function existente — no duplicar.

### 3. Nueva edge function `notify-appointment-assigned`
- Recibe `appointment_id`.
- Carga doctor (email), paciente (telegram chat via identidades_canal), room, servicio.
- Manda Telegram al paciente: confirmación de cita + disclaimer 911. Inserta `mensajes` outbound.
- Manda email al doctor si tiene `email` (usa Resend si está configurado; si no, deja `doctor_notification_failed` + audit).
- Audit: `doctor_notification_sent|failed`, `confirmacion_paciente_enviada`.
- `verify_jwt = true` (llamada desde frontend autenticado).

### 4. Frontend `src/pages/Inbox.tsx`
- En panel derecho de conversación `escalada` agregar `<ConversationActionPanel/>`:
  - Datos: paciente, teléfono/telegram, motivo_resumen, dolor_intensidad, prioridad, badge "Urgente" rojo.
  - Botones: "Asignar cita", "Cerrar conversación", "Enviar mensaje" (ya existe).
- "Asignar cita" abre `<AssignAppointmentDialog/>` (nuevo componente):
  - Select servicio (filtrado por clinic).
  - Select doctor (filtrado por servicio via `doctor_servicios` + clinic + activo).
  - Select consultorio (clinic + activo).
  - Date/time picker + duración default 30min.
  - Muestra slots sugeridos: query `appointments` del día para doctor y room, calcula libres considerando horario doctor.
  - Submit → llama RPC `inbox_create_appointment` → en success llama edge `notify-appointment-assigned` → toast.
- Badge urgente en lista de conversaciones (orden: urgente > alta > normal > fecha).

### 5. Componentes nuevos
- `src/features/inbox/ConversationActionPanel.tsx`
- `src/features/inbox/AssignAppointmentDialog.tsx`
- `src/features/inbox/availability.ts` (cálculo de slots client-side, validación adicional).

## Archivos modificados/creados

```
M supabase/functions/telegram-webhook/index.ts
+ supabase/functions/notify-appointment-assigned/index.ts
+ supabase/migrations/<ts>_inbox_appointment_flow.sql
M src/pages/Inbox.tsx
+ src/features/inbox/ConversationActionPanel.tsx
+ src/features/inbox/AssignAppointmentDialog.tsx
+ src/features/inbox/availability.ts
```

## Criterio de éxito

- Paciente manda "10" tras escalamiento → mensaje aparece en /inbox, bot NO responde de nuevo (solo el primer aviso).
- Triage detecta keywords → conversación marca urgente + paciente recibe mensaje seguro 1 sola vez.
- Recepción asigna cita → appointment creado, conversacion_id ligado, telegram al paciente, email al doctor (o audit failed), todo auditado.
- `tsc --noEmit` y `npm run build` pasan.

## Riesgos pendientes

- Sin canal directo al doctor más allá de email; confirmación del doctor queda manual.
- Recordatorios automáticos no implementados aquí.
- No se valida traslape entre clínicas para doctor multiclinic.
