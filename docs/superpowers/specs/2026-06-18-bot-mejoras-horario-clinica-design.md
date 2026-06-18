# Bot Telegram — Mejoras Integrales + Configuración Horario Clínica

**Fecha:** 2026-06-18  
**Estado:** Aprobado por usuario  
**Proyecto:** 1 de 2 (Proyecto 2 = integración Google Calendar, alcance futuro)

---

## 1. Contexto y Problema

El bot Telegram de Integriclinica ya tiene booking completo, triage de urgencias, memoria cross-sesión y recordatorios. Sin embargo tiene 8 problemas críticos:

| # | Problema | Consecuencia |
|---|----------|-------------|
| 1 | DIAS_LABORALES hardcodeado `[1,2,3,4,5]` | No respeta el calendario real de la clínica |
| 2 | Horario clínica no configurable desde UI | Admin no puede cambiar horarios sin deploy |
| 3 | Sin capa FAQ en bot Telegram | Cada pregunta común gasta tokens Sonnet (~$0.003) |
| 4 | `iniciarConsultaAbierta` solo ofrece precios/ubicación | Paciente con padecimiento real cae al menú sin guía |
| 5 | Sin aprendizaje desde conversaciones Telegram | FAQs se generan solo desde ayuda-interna, no del bot |
| 6 | Memoria flat de 6 líneas sin estructura | Bot olvida preferencias y datos clínicos relevantes |
| 7 | Todo pasa por Sonnet 4.6 desde el primer mensaje | Costo y latencia innecesarios para consultas simples |
| 8 | Doctores sin descripción en selección de slot | Paciente elige sin saber qué especialidad tiene el doctor |

---

## 2. Alcance

### Incluido (Proyecto 1)
- Configuración de horario clínica: días laborales + hora apertura/cierre
- Bot lee horario desde BD (no hardcodeado)
- 3-tier efficiency layer en el bot Telegram
- Consulta abierta para cualquier padecimiento con routing a especialidad
- Learning pipeline: conversaciones Telegram → candidatos FAQ
- Memoria estructurada por categorías
- Perfil doctor en selección de slot

### Excluido (Proyecto 2 — futuro)
- Integración Google Calendar por doctor
- OAuth por doctor
- Sincronización de disponibilidad en tiempo real

---

## 3. Arquitectura General

```
Paciente Telegram
      │
      ▼
┌─────────────────────────────────────┐
│          CAPA 0: Greeting           │ ← 0 tokens, 0 DB (ya existe)
│    "hola" / "buenas" / "start"      │
└─────────────────────────────────────┘
      │ no match
      ▼
┌─────────────────────────────────────┐
│          CAPA 1: FAQ Lookup         │ ← 0 tokens, 1 DB query (nuevo)
│    faq_buscar(mensaje, ruta=null)   │
└─────────────────────────────────────┘
      │ no match
      ▼
┌─────────────────────────────────────┐
│       CAPA 2: Triage Haiku          │ ← ~$0.00003/msg (nuevo)
│  ¿Es urgencia / booking / consulta  │
│  / pregunta info / otro?            │
└─────────────────────────────────────┘
      │ intent clasificado
      ▼
┌─────────────────────────────────────┐
│      CAPA 3: Sonnet Agent Loop      │ ← ~$0.003/msg (ya existe)
│  Solo si intent = booking/complejo  │
└─────────────────────────────────────┘
      │ respuesta generada
      ▼
┌─────────────────────────────────────┐
│     Learning Pipeline (background)  │ ← async, no bloquea
│  chat_registrar_pendiente(Q, A)     │
└─────────────────────────────────────┘
```

**Ahorro estimado:** 60-70% reducción de llamadas a Sonnet en consultas repetitivas.

---

## 4. Componente A — Configuración Horario Clínica

### 4.1 Base de datos

Usar columna `configuracion` JSONB existente en tabla `clinic_settings`. Añadir campos:

```json
{
  "horario": {
    "dias_laborales": [1, 2, 3, 4, 5],
    "hora_apertura": "09:00",
    "hora_cierre": "18:00"
  }
}
```

Días: 0=domingo, 1=lunes, ..., 6=sábado (estándar JS/PostgreSQL).

**Migración:** seed default `[1,2,3,4,5]`, `"09:00"`, `"18:00"` para clínicas sin configuración.

> No se crea tabla nueva. Se reutiliza `clinic_settings.configuracion JSONB`.

### 4.2 UI — Nuevo componente `HorarioClinicaSection`

Ubicación: `src/pages/configuracion/HorarioClinica.tsx` (componente inline en `Configuracion.tsx` para no crear ruta nueva).

**Wireframe:**
```
┌─ Horario de atención ──────────────────────────────────┐
│                                                         │
│  Días laborales:                                        │
│  [L] [Ma] [Mi] [J] [V] [S] [D]                        │
│   ✓   ✓    ✓   ✓   ✓   □   □                          │
│                                                         │
│  Apertura:  [09:00 ▾]    Cierre:  [18:00 ▾]           │
│                                                         │
│                              [Guardar horario]          │
└─────────────────────────────────────────────────────────┘
```

**Comportamiento:**
- Lee `clinic_settings.configuracion.horario` al montar
- Guardar → `UPDATE clinic_settings SET configuracion = jsonb_set(...)` vía Supabase
- Toast éxito/error
- Solo visible para `admin`

### 4.3 Bot lee horario desde BD

El bot ya tiene `clinicId` disponible desde `identidades_canal` → `patients.clinic_id` o desde la conversación activa. Se pasa como argumento a `listarHorariosDisponibles()`.

En `listarHorariosDisponibles()` (telegram-webhook/index.ts:1364):

```typescript
// ANTES (hardcoded):
const DIAS_LABORALES = [1, 2, 3, 4, 5];

// DESPUÉS (desde BD con defaults como fallback):
const horario = await getClinicSchedule(clinicId);
// getClinicSchedule retorna defaults {dias_laborales:[1,2,3,4,5], hora_apertura:"09:00", hora_cierre:"18:00"}
// si clinic_settings no tiene configuracion.horario configurado
const DIAS_LABORALES = horario.dias_laborales;
const HORA_APERTURA  = horario.hora_apertura;
const HORA_CIERRE    = horario.hora_cierre;
```

Función `getClinicSchedule()`:
- Query única a `clinic_settings` por `clinic_id`
- Extrae `configuracion.horario` con defaults si null
- No cachea entre requests (Deno fresh per invocation), sí cachea dentro del loop de días

---

## 5. Componente B — 3-Tier Efficiency Layer

### 5.1 Capa 1: FAQ en Telegram

Antes de `correrAgente()` en `manejarMensaje()` (línea ~343):

```typescript
// Nuevo: FAQ lookup
const faqMatch = await buscarFaqTelegram(text, activeClinicId);
if (faqMatch) {
  await enviarTelegram(chatId, faqMatch.respuesta);
  await guardarMensajeAsistente(conv.id, faqMatch.respuesta);
  // Background: registrar uso
  supabase.rpc("faq_incrementar_uso", { p_id: faqMatch.id });
  return;
}
```

Usa el mismo RPC `faq_buscar` que usa `help-chat-ai`. FAQs con `ruta_activa = null` aplican globalmente (tanto ayuda-interna como bot Telegram).

### 5.2 Capa 2: Haiku Triage de Intent

**Importante:** Los regex actuales (`esSaludo`, `pideHumano`, `pideNuevaConsulta`) se mantienen y corren PRIMERO — son más rápidos y baratos que Haiku. Haiku solo corre cuando ningún regex hace match Y no hubo FAQ. Si Haiku falla (error de red, timeout), el fallback es `correrAgente()` actual — nunca rompe el bot.

Clasificación Haiku cuando el mensaje no hace match en Capas 0 y 1:

```typescript
type Intent = 
  | "booking"       // quiere agendar cita
  | "consulta"      // pregunta sobre padecimiento/síntoma
  | "info"          // pregunta de precios, ubicación, horarios
  | "gestion"       // ver/cancelar/reagendar cita existente
  | "humano"        // quiere hablar con persona
  | "otro";         // no clasificado

async function clasificarIntentHaiku(text: string): Promise<Intent>
```

**System prompt Haiku:**
```
Clasifica el mensaje de un paciente de clínica médica en UNA de estas categorías:
- booking: quiere agendar cita
- consulta: pregunta sobre síntoma, padecimiento o qué especialidad necesita
- info: pregunta de precios, ubicación, horarios, formas de pago
- gestion: quiere ver, cancelar o reagendar una cita
- humano: quiere hablar con una persona
- otro: no encaja en ninguna

Responde SOLO con la categoría, nada más.
```

**Routing por intent:**
- `booking` → `enviarMenuCategorias()` (directo al booking)
- `consulta` → `manejarConsultaLibre()` (nuevo, ver §6)
- `info` → `correrAgenteConsulta()` (Sonnet con contexto info)
- `gestion` → `verMiCita()` con opciones
- `humano` → `escalarConversacion()`
- `otro` → `correrAgente()` (actual)

**Tokens Haiku:** max 10 tokens de respuesta. Costo: ~$0.000003/msg.

---

## 6. Componente C — Consulta Libre de Padecimientos

### 6.1 Nueva función `manejarConsultaLibre()`

Reemplaza y expande `iniciarConsultaAbierta()`.

**Mapa de padecimientos → especialidades:**
```typescript
const PADECIMIENTO_ESPECIALIDAD: {regex: RegExp, especialidades: string[]}[] = [
  { regex: /cabeza|migraña|dolor.*cabeza|jaqueca/, especialidades: ["Medicina general", "Neurología"] },
  { regex: /corazón|pecho|presión|hipertensión|taquicardia/, especialidades: ["Cardiología", "Medicina general"] },
  { regex: /piel|acné|mancha|dermatitis|lunar/, especialidades: ["Dermatología"] },
  { regex: /niño|bebé|pediatr|fiebre.*niño/, especialidades: ["Pediatría"] },
  { regex: /diente|muela|encía|caries|dental/, especialidades: ["Odontología"] },
  { regex: /embaraz|menstrua|ginecolog|ovario|útero/, especialidades: ["Ginecología"] },
  { regex: /peso|nutrición|dieta|obesidad|colesterol/, especialidades: ["Nutrición"] },
  { regex: /ansied|depresión|estrés|insomnio|psicolog/, especialidades: ["Psicología"] },
  { regex: /análisis|laboratorio|estudio|sangre.*exam/, especialidades: ["Estudios/Laboratorio"] },
];
```

**Flujo:**
1. Recibir texto de padecimiento
2. Regex lookup → si match, sugiere especialidad + botón "Agendar con [especialidad]"
3. Si no match → Haiku con contexto: "¿qué especialidad recomiendas para: [padecimiento]?" → respuesta + botón agendar
4. Mensaje siempre incluye: "Nuestros especialistas en [X] pueden atenderte. ¿Agendamos una cita?"
5. **Nunca:** diagnóstico, medicamentos, "tienes X enfermedad"

**Mensaje de ejemplo:**
```
Entiendo que tienes dolor de cabeza. Nuestros especialistas en 
Medicina General o Neurología pueden evaluarte.

¿Te gustaría agendar una cita?
[Medicina General] [Neurología] [Quiero más información]
```

### 6.2 Modificación al System Prompt

Añadir sección al `SYSTEM_PROMPT_BASE`:

```
GUÍA DE PADECIMIENTOS → ESPECIALIDADES:
Cuando un paciente mencione síntomas, NO des diagnósticos ni medicamentos.
Sí puedes sugerir qué especialidad puede ayudarle y ofrecer agendar.
- Dolor de cabeza/migraña → Medicina General o Neurología
- Problemas cardíacos/presión → Cardiología
- Piel/acné → Dermatología
- Niños → Pediatría
- Dental → Odontología
- Femenino/embarazo → Ginecología
- Peso/nutrición → Nutrición
- Salud mental/estrés → Psicología
- Análisis/estudios → Estudios y Laboratorio

Siempre cierra con: "¿Agendamos una cita con [especialidad]?"
```

---

## 7. Componente D — Learning Pipeline Telegram

### 7.1 Registrar Q&A tras respuesta Sonnet

En `ejecutarAgenteLoop()`, después de obtener respuesta del agente (línea ~1289):

```typescript
// Background: registrar para aprendizaje FAQ
if (responseText && text.length >= 10) {
  supabase.rpc("chat_registrar_pendiente", {
    p_pregunta: userText,
    p_respuesta_ia: responseText,
    p_ruta_activa: null,  // global (no ruta específica)
    p_clinic_id: activeClinicId,
  }).catch(() => {}); // fire-and-forget
}
```

Misma tabla `chat_preguntas_pendientes` que usa `help-chat-ai`. Admin revisa en `/ayuda-interna` → Base de conocimiento → "Para revisar". Al aprobar, se crea `faq_items` con `ruta_activa = null` (aplica a bot + ayuda-interna).

### 7.2 No requiere cambios en UI admin

La UI de `/ayuda-interna` ya tiene la tab "Para revisar" con botones "+ FAQ" e "Ignorar". Funciona para ambos canales.

---

## 8. Componente E — Memoria Estructurada

### 8.1 Nueva estructura

```typescript
interface MemoriaPackiente {
  resumen: string;          // ≤800 chars, narrativo para system prompt
  preferencias: {
    especialidad_favorita?: string;
    doctor_favorito_id?: string;
    doctor_favorito_nombre?: string;
  };
  datos_clinicos: {
    alergias?: string;        // copiado desde patients.alergias
    condiciones_cronicas?: string;  // inferido de conversaciones
  };
  historial: {
    ultima_cita_servicio?: string;
    veces_agendado: number;
    ultima_interaccion: string;   // ISO date
  };
  meta: {
    interacciones: number;
    updated_at: string;
  };
}
```

### 8.2 System prompt injection mejorado

```typescript
function buildSystemPrompt(memoria: MemoriaPackiente | null): string {
  if (!memoria) return SYSTEM_PROMPT_BASE;
  
  const partes = [SYSTEM_PROMPT_BASE];
  
  if (memoria.resumen) {
    partes.push(`\nCONTEXTO DEL PACIENTE (no mencionar explícitamente):\n${memoria.resumen}`);
  }
  if (memoria.datos_clinicos.alergias) {
    partes.push(`Alergias conocidas: ${memoria.datos_clinicos.alergias}`);
  }
  if (memoria.preferencias.doctor_favorito_nombre) {
    partes.push(`Ha consultado antes con Dr(a). ${memoria.preferencias.doctor_favorito_nombre}`);
  }
  
  return partes.join("\n");
}
```

### 8.3 Actualización Haiku mejorada

`actualizarMemoria()` — nuevo system prompt:

```
Mantén una nota estructurada sobre este paciente en JSON. 
Extrae del historial de conversación:
- resumen: narrativo breve de quién es y sus necesidades (≤150 palabras)
- preferencias.especialidad_favorita: si mencionó preferencia
- preferencias.doctor_favorito_nombre: si pidió el mismo doctor antes
- datos_clinicos.alergias: copiar de patients.alergias en BD (no inferir de conversación)
- datos_clinicos.condiciones_cronicas: si el paciente mencionó condición crónica explícitamente (nunca diagnósticos)
- historial.veces_agendado: incrementar si se agendó
NUNCA incluir datos sensibles, solo contexto de servicio.
Responde SOLO con el JSON, sin explicación.
```

---

## 9. Componente F — Perfil Doctor en Slot

### 9.1 Cambio en `listarHorariosDisponibles()`

Añadir `especialidad` al select de doctors:

```typescript
// ANTES:
.select("doctor_id, doctors!inner(nombre, apellidos, horario_inicio, horario_fin, activo)")

// DESPUÉS:
.select("doctor_id, doctors!inner(nombre, apellidos, horario_inicio, horario_fin, activo, especialidad)")
```

### 9.2 Cambio en display de slots

```typescript
// ANTES:
fecha_local: `${doctor.nombre} ${doctor.apellidos} — ${fechaLocal}`

// DESPUÉS:
fecha_local: `Dr(a). ${doctor.nombre} ${doctor.apellidos} · ${doctor.especialidad ?? ""} — ${fechaLocal}`
```

---

## 10. Base de Datos — Cambios Requeridos

| Cambio | Tipo | Descripción |
|--------|------|-------------|
| `clinic_settings.configuracion` seed | Migration | Default `{"horario": {"dias_laborales":[1,2,3,4,5], "hora_apertura":"09:00", "hora_cierre":"18:00"}}` |
| Verificar `doctors.especialidad` existe | Audit | Confirmar columna existe y tiene datos |
| Verificar `faq_buscar` RPC acepta `p_ruta=null` | Audit | Confirmar que null devuelve resultados globales |
| `chat_registrar_pendiente` RPC | Audit | Confirmar firma compatible con llamada desde bot |

---

## 11. Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/YYYYMMDD_clinic_schedule.sql` | Seed horario default en clinic_settings |
| `supabase/functions/telegram-webhook/index.ts` | 5 cambios: getClinicSchedule, FAQ layer, intent triage, manejarConsultaLibre, learning pipeline, memoria estructurada, doctor perfil |
| `src/pages/Configuracion.tsx` | Añadir sección HorarioClinica |
| `src/pages/configuracion/HorarioClinica.tsx` | Nuevo componente (inline si <100 líneas) |

---

## 12. Orden de Implementación — Proyecto 1

1. **DB:** Migration seed horario clínica en `clinic_settings`
2. **UI:** `HorarioClinica` component + integración en `Configuracion.tsx`
3. **Bot — Schedule:** `getClinicSchedule()` + `listarHorariosDisponibles()` refactor
4. **Bot — FAQ layer:** `buscarFaqTelegram()` antes del agente
5. **Bot — Intent Haiku:** `clasificarIntentHaiku()` + routing
6. **Bot — Consulta libre:** `manejarConsultaLibre()` + mapa padecimientos
7. **Bot — Learning:** `chat_registrar_pendiente` tras respuesta Sonnet
8. **Bot — Memoria:** nueva estructura `MemoriaPaciente` + Haiku prompt
9. **Bot — Doctor perfil:** campo especialidad en slots
10. **Deploy P1:** `wrangler deploy` + verificación en producción

---

## 13. Criterios de Éxito — Proyecto 1

- Admin puede cambiar horario clínica desde UI y bot lo refleja sin deploy
- Pregunta repetida (ej. "¿cuánto cuesta la consulta?") responde vía FAQ sin gastar tokens Sonnet
- Mensaje sobre padecimiento (ej. "me duele el estómago") → bot sugiere especialidad y ofrece agendar
- Conversaciones Telegram aparecen en "Para revisar" de ayuda-interna
- Bot recuerda alergias y preferencias del paciente entre sesiones
- Slot de horario muestra nombre y especialidad del doctor

---

## 14. Proyecto 2 — Google Calendar Bidireccional

### Objetivo
Sincronización completa: el bot lee los huecos libres del calendario del doctor y al confirmar una cita la escribe en su Google Calendar. El doctor ve todas sus citas de la clínica en su agenda personal.

### Prerequisito externo (manual, una sola vez)
1. Google Cloud Console → crear proyecto → habilitar **Google Calendar API**
2. Crear credenciales OAuth 2.0 (tipo "Web application")
3. Añadir URI de redirección: `https://kyfkvdyxpvpiacyymldc.supabase.co/functions/v1/google-oauth-callback`
4. Guardar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` como secrets de Supabase Edge Functions

### Componentes técnicos

#### DB — nueva tabla `doctor_calendars`
```sql
CREATE TABLE doctor_calendars (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id     uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_id     uuid NOT NULL REFERENCES clinics(id),
  google_email  text NOT NULL,
  calendar_id   text NOT NULL DEFAULT 'primary',
  access_token  text NOT NULL,       -- cifrado vía pgsodium o secreto en env
  refresh_token text NOT NULL,       -- larga duración, necesario para renovar
  token_expiry  timestamptz NOT NULL,
  activo        boolean NOT NULL DEFAULT true,
  connected_at  timestamptz DEFAULT now(),
  UNIQUE(doctor_id, clinic_id)
);
```

#### Edge Functions nuevas

**`google-oauth-callback`** — Recibe el `code` de Google tras el consentimiento del doctor:
- Intercambia `code` → `access_token` + `refresh_token` vía POST a `https://oauth2.googleapis.com/token`
- Upsert en `doctor_calendars`
- Redirige al doctor a `/configuracion` con mensaje de éxito

**`google-calendar-sync`** (helper compartido, no HTTP endpoint):
- `getAccessToken(doctorId)` — refresca si `token_expiry < now + 5min`
- `getFreeBusy(doctorId, timeMin, timeMax)` — llama `calendar.freeBusy` API
- `createEvent(doctorId, appointment)` — crea evento en calendar del doctor
- `updateEvent(doctorId, googleEventId, appointment)` — actualiza slot tras reagendar
- `deleteEvent(doctorId, googleEventId)` — cancela evento en Google al cancelar cita

#### Modificaciones al bot (`telegram-webhook`)

**`listarHorariosDisponibles()`:**
```typescript
// Para cada doctor conectado a Google Calendar:
const busyTimes = await getFreeBusy(doctor.id, windowStart, windowEnd);
// Filtrar slots que colisionan con busyTimes (además de appointments internos)
```

**`crearCitaDesdeSesion()`** — tras insertar appointment:
```typescript
const cal = await getDoctorCalendar(doctor_id);
if (cal) {
  const eventId = await createEvent(cal, {
    summary: `Cita: ${servicio.nombre} — ${patient.nombre} ${patient.apellidos}`,
    start: fecha_inicio,
    end: fecha_fin,
    description: `Paciente: ${patient.nombre}\nServicio: ${servicio.nombre}\nOrigen: Telegram bot`,
  });
  // Guardar google_event_id en appointment para poder actualizar/cancelar después
  await supabase.from("appointments").update({ google_event_id: eventId }).eq("id", apptId);
}
```

**`confirmarCancelacionCita()`** — si appointment tiene `google_event_id`:
```typescript
await deleteEvent(doctorCalendar, appointment.google_event_id);
```

**`confirmarReagendar()`** — actualiza el evento en Google:
```typescript
await updateEvent(doctorCalendar, appointment.google_event_id, newSlot);
```

#### UI — Panel conexión Google Calendar

En `src/pages/AdminUsuarios.tsx` (perfil doctor) o nueva sección en `Configuracion.tsx`:

```
┌─ Google Calendar — Dr. Martínez ───────────────────────┐
│                                                          │
│  Estado: ● Conectado (dr.martinez@gmail.com)            │
│  Última sincronización: hace 2 min                       │
│                                                          │
│  [Desconectar]                                           │
│                                                          │
│  ── Sin conectar ──                                      │
│  Estado: ○ No conectado                                  │
│  [Conectar Google Calendar]  ← abre OAuth flow          │
└──────────────────────────────────────────────────────────┘
```

El botón "Conectar" genera URL de autorización Google y redirige al doctor. La URL incluye `state=doctorId:clinicId` para identificar al doctor en el callback.

#### Columna adicional en `appointments`
```sql
ALTER TABLE appointments ADD COLUMN google_event_id text;
```

### Orden de implementación — Proyecto 2

1. **Prerequisito:** Admin configura Google Cloud Console (manual externo)
2. **DB:** `doctor_calendars` table + `appointments.google_event_id` column
3. **Edge:** `google-oauth-callback` function
4. **Edge:** módulo `google-calendar-sync.ts` (helper compartido)
5. **Bot:** `listarHorariosDisponibles()` + free/busy check
6. **Bot:** `crearCitaDesdeSesion()` + `createEvent()`
7. **Bot:** `confirmarCancelacionCita()` + `deleteEvent()`
8. **Bot:** `confirmarReagendar()` + `updateEvent()`
9. **UI:** Panel conexión/desconexión por doctor
10. **Deploy P2:** `supabase functions deploy` + `wrangler deploy`

### Criterios de éxito — Proyecto 2
- Doctor conecta su Google Calendar desde la UI sin ayuda técnica
- Bot no ofrece slots donde el doctor tiene evento en Google Calendar
- Al confirmar cita → aparece evento en Google Calendar del doctor en < 5 seg
- Al cancelar/reagendar → evento en Google Calendar se actualiza automáticamente
- Si doctor no tiene Google Calendar conectado → bot funciona igual que antes (backward compatible)
