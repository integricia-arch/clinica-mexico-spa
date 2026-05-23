# Lovable Prompt — Dashboard ClínicaMX: Citas, Recordatorios, Conversaciones de Telegram

Agrega 3 secciones nuevas al dashboard de ClínicaMX. **No tocar lo existente.** La base de datos en Supabase (`kyfkvdyxpvpiacyymldc`) ya tiene todas las tablas necesarias — solo construye el frontend.

## Contexto del backend

Un bot de Telegram (Edge Function `telegram-webhook`) ya está activo y:
- Crea citas en la tabla `appointments`
- Programa recordatorios T-24h y T-2h en `recordatorios_cita`
- Conversa con los pacientes y guarda todo en `conversaciones` + `mensajes`
- Cuando no puede resolver o el paciente pide hablar con alguien, cambia el `status` de la conversación a `escalada`

El recepcionista necesita ver y responder estas conversaciones escaladas desde el dashboard.

## Tablas existentes (NO crear, solo consumir)

- `appointments(id, patient_id, doctor_id, servicio_id, fecha_inicio, fecha_fin, status, motivo_consulta, origen, creada_por_bot, notas, created_at)`
- `patients(id, nombre, apellidos, fecha_nacimiento, telefono, sexo)`
- `doctors(id, nombre, apellidos, horario_inicio, horario_fin, activo)`
- `servicios(id, nombre, especialidad, duracion_minutos, precio_centavos, activo)`
- `recordatorios_cita(id, appointment_id, identidad_canal_id, programado_para, tipo, status, enviado_at, ultimo_error)`
  - `tipo`: `'T-24h'` o `'T-2h'`
  - `status`: `'pendiente' | 'enviado' | 'fallido' | 'cancelado'`
- `conversaciones(id, identidad_canal_id, status, intencion_actual, last_message_at, created_at)`
  - `status`: `'activa' | 'escalada' | 'cerrada'`
- `mensajes(id, conversacion_id, rol, contenido, raw_payload, created_at)`
  - `rol`: `'user' | 'assistant'`
  - Si `raw_payload->>'sent_by_human' = 'true'` → mensaje enviado por recepción (no por el bot)
- `identidades_canal(id, canal_id, external_id, display_name, patient_id)`

## Edge Functions a llamar (ya existen, no hay que crearlas)

- `enviar-mensaje-humano` — POST `/functions/v1/enviar-mensaje-humano` con body `{ conversacion_id, mensaje }`. Requiere JWT del usuario (lo manda automáticamente el cliente de Supabase).
- `procesar-recordatorios` — POST `/functions/v1/procesar-recordatorios` con body `{ recordatorio_id }` (opcional, para reintento manual de un recordatorio fallido).

---

## Página 1 — `/citas`

**Layout:** tabla principal + filtros arriba.

**Filtros:**
- Rango de fecha (default: hoy hasta +7 días)
- Doctor (dropdown desde `doctors` activos)
- Status (multiselect: solicitada, confirmada, cancelada, completada)

**Columnas:**
- Paciente (`patients.nombre + ' ' + patients.apellidos`)
- Servicio (`servicios.nombre`)
- Doctor (`doctors.nombre + ' ' + doctors.apellidos`)
- Fecha y hora (formato es-MX, zona `America/Mexico_City`)
- Status (badge de color según valor)
- Origen (`telegram`, `web`, etc — con icono)

**Interacciones:**
- Click en fila → modal con detalle completo
- Dentro del modal:
  - Botón "Cambiar status" → dropdown (solicitada → confirmada / cancelada / completada)
  - Botón "Ver conversación" (visible si la cita tiene `identidad_canal` asociada vía `patient_id`) → navega a `/conversaciones?id={conv_id}`

**Si hay un componente de calendario en el stack actual:** agrégalo como pestaña adicional (Tabla / Calendario).

---

## Página 2 — `/recordatorios`

**Tabla con columnas:**
- Paciente
- Cita: `{servicio} — {fecha de la cita formato corto hora México}`
- Tipo: badge `T-24h` o `T-2h`
- Programado para (fecha + hora)
- Status (badge: pendiente=amarillo, enviado=verde, fallido=rojo, cancelado=gris)

**Filtros:** status, tipo.

**Default order:** `programado_para ASC` para los pendientes primero, luego los demás.

**Interacciones:**
- En filas con `status='fallido'`: botón "Reintentar" → llama a `procesar-recordatorios` con `{ recordatorio_id: id }`, refresca la tabla.
- En filas con `status='fallido'`: mostrar `ultimo_error` en tooltip o columna expandible.

---

## Página 3 — `/conversaciones` (la más importante)

**Layout split:** panel izquierdo lista de chats, panel derecho detalle del chat seleccionado. Estilo Intercom / WhatsApp Web.

### Panel izquierdo — Lista

- Conversaciones ordenadas por `last_message_at DESC`.
- Cada item muestra:
  - `display_name` de `identidades_canal`
  - Preview del último mensaje (truncado a 60 chars)
  - Hora del último mensaje (relativa: "hace 5 min", "ayer", etc.)
  - **Badge ROJO PROMINENTE** si `status='escalada'` (esto es lo que más le importa a recepción)
  - Badge gris si `status='cerrada'`
- Filtros arriba: "Todas / Activas / Escaladas / Cerradas" + búsqueda por nombre.
- Default filter: "Escaladas" (porque eso es lo que requiere atención inmediata).

### Panel derecho — Detalle de chat

**Header:**
- Nombre del paciente
- Status (badge)
- Botón "Cerrar conversación" → `UPDATE conversaciones SET status='cerrada' WHERE id=...`
- Si tiene `patient_id` asociado, link al perfil del paciente

**Mensajes (lista scrollable, estilo chat):**
- `rol='user'` → burbuja gris/blanca alineada a la **izquierda** (paciente)
- `rol='assistant'` y `raw_payload->>'sent_by_human' != 'true'` → burbuja azul a la **derecha** (bot)
- `rol='assistant'` y `raw_payload->>'sent_by_human' = 'true'` → burbuja **verde** a la **derecha** con etiqueta "Recepción"
- Cada burbuja muestra hora abajo

**Input al fondo:**
- Textarea + botón Enviar
- **Solo visible cuando `status='escalada'`** (no se permite responder en chats activos donde el bot opera)
- Al enviar: `supabase.functions.invoke('enviar-mensaje-humano', { body: { conversacion_id, mensaje } })`
- Después de enviar, limpiar input + el mensaje aparecerá vía realtime (siguiente sección)

### Realtime

Suscríbete a inserts en `mensajes` filtrado por la conversación seleccionada:

```ts
const channel = supabase
  .channel('mensajes_' + conversacionId)
  .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mensajes',
        filter: 'conversacion_id=eq.' + conversacionId },
      (payload) => agregarMensajeAlChat(payload.new))
  .subscribe();
// limpiar con channel.unsubscribe() al cambiar de chat
```

También suscríbete a updates en `conversaciones` para que el badge "escalada" aparezca/desaparezca en vivo en la lista.

---

## Navegación

Agrega al sidebar principal, debajo de lo que ya exista:
- 📅 Citas → `/citas`
- 🔔 Recordatorios → `/recordatorios`
- 💬 Conversaciones → `/conversaciones`  (con badge numérico de conversaciones escaladas, si es factible con poca complejidad)

## Estilo

- Mantén consistencia con el dashboard actual (mismos colores, tipografía, componentes shadcn/ui si los usa).
- Prioriza claridad operativa: recepción no debe perderse buscando el botón de responder.
- Sin sobreingeniería. Sin nuevas dependencias salvo las estrictamente necesarias.
