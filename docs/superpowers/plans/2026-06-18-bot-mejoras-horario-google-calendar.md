# Bot Mejoras + Horario Clínica + Google Calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar el bot Telegram con 3-tier FAQ/Haiku/Sonnet, consulta libre de padecimientos, aprendizaje automático, y agregar configuración de horario de clínica desde UI + integración bidireccional con Google Calendar por doctor.

**Architecture:** Proyecto 1 añade capa FAQ (0 tokens) + Haiku triage (micro-costo) antes del agente Sonnet, horario configurable en BD, y mejoras de memoria. Proyecto 2 añade OAuth Google por doctor integrado en el flujo de alta de doctores + sincronización bidireccional de citas.

**Tech Stack:** Deno/TypeScript (edge functions), React/TypeScript (frontend), Supabase (Postgres + RPC), Claude Haiku 4.5 + Sonnet 4.6 (Anthropic), Google Calendar API v3 (OAuth 2.0).

---

## Schema Reference

```
clinic_settings: id, clinic_id, section (text), data (jsonb), updated_at, updated_by
doctors: id, user_id, nombre, apellidos, especialidad, horario_inicio (time), horario_fin (time), activo, clinic_id
faq_buscar(p_pregunta, p_clinic_id?, p_ruta?) → {id, respuesta, uso_count}[]
chat_registrar_pendiente(p_pregunta, p_clinic_id, p_ruta?, p_respuesta?) → void
```

---

## File Map

| File | Action | Responsabilidad |
|------|--------|----------------|
| `supabase/migrations/YYYYMMDD_horario_clinica_seed.sql` | Crear | Seed horario default en clinic_settings |
| `supabase/migrations/YYYYMMDD_doctor_calendars.sql` | Crear | Tabla doctor_calendars + appointments.google_event_id |
| `supabase/functions/telegram-webhook/index.ts` | Modificar | Todos los cambios del bot |
| `supabase/functions/google-oauth-callback/index.ts` | Crear | Maneja redirect OAuth de Google |
| `src/pages/Configuracion.tsx` | Modificar | Añadir sección HorarioClinica |
| `src/pages/AdminUsuarios.tsx` | Modificar | Añadir panel Google Calendar por doctor |

---

## PROYECTO 1 — Bot Mejoras + Horario Clínica

---

### Task 1: Migración — Seed Horario Clínica

**Files:**
- Create: `supabase/migrations/20260626000000_horario_clinica_seed.sql`

- [ ] **Step 1: Crear migration**

```sql
-- Seed horario de atención por clínica en clinic_settings
-- section = 'horario', data = {dias_laborales, hora_apertura, hora_cierre}
-- dias_laborales: 0=domingo, 1=lunes, ..., 6=sábado

INSERT INTO clinic_settings (clinic_id, section, data)
SELECT 
  id,
  'horario',
  '{
    "dias_laborales": [1, 2, 3, 4, 5],
    "hora_apertura": "09:00",
    "hora_cierre": "18:00"
  }'::jsonb
FROM clinics
ON CONFLICT (clinic_id, section) DO NOTHING;
```

- [ ] **Step 2: Aplicar migration**

```powershell
cd C:\Users\pablo\clinica-mexico-spa
supabase db push --linked
```

Verificar: `supabase db query --linked "SELECT clinic_id, data FROM clinic_settings WHERE section = 'horario' LIMIT 3;"`

Esperado: rows con `data = {"dias_laborales":[1,2,3,4,5],"hora_apertura":"09:00","hora_cierre":"18:00"}`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260626000000_horario_clinica_seed.sql
git commit -m "feat: seed horario de atención por clínica en clinic_settings"
```

---

### Task 2: UI — Componente HorarioClinica

**Files:**
- Modify: `src/pages/Configuracion.tsx`

- [ ] **Step 1: Añadir sección HorarioClinica al final de Configuracion.tsx antes del Dialog de rooms**

Localizar en `src/pages/Configuracion.tsx` el bloque `<Dialog open={roomModal}` (cerca de línea 212) e insertar **antes** de él:

```tsx
{/* ── Horario de atención ── */}
{isAdmin && <HorarioClinicaSection />}
```

- [ ] **Step 2: Añadir import y componente HorarioClinicaSection al mismo archivo**

Al inicio del archivo, añadir imports adicionales después de los existentes:

```tsx
import { Clock, CheckSquare, Square } from "lucide-react";
```

Al final del archivo, **antes** del export default o después del último componente, añadir:

```tsx
// ── Horario de atención ───────────────────────────────────────────────────────
const DIAS = [
  { num: 1, label: "L" }, { num: 2, label: "Ma" }, { num: 3, label: "Mi" },
  { num: 4, label: "J" }, { num: 5, label: "V" }, { num: 6, label: "S" },
  { num: 0, label: "D" },
];

function HorarioClinicaSection() {
  const { activeClinicId } = useActiveClinic();
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [apertura, setApertura] = useState("09:00");
  const [cierre, setCierre] = useState("18:00");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeClinicId) return;
    (async () => {
      const { data } = await supabase
        .from("clinic_settings")
        .select("data")
        .eq("clinic_id", activeClinicId)
        .eq("section", "horario")
        .maybeSingle();
      if (data?.data) {
        const d = data.data as { dias_laborales: number[]; hora_apertura: string; hora_cierre: string };
        setDias(d.dias_laborales ?? [1, 2, 3, 4, 5]);
        setApertura(d.hora_apertura ?? "09:00");
        setCierre(d.hora_cierre ?? "18:00");
      }
      setLoading(false);
    })();
  }, [activeClinicId]);

  const toggleDia = (num: number) =>
    setDias((prev) => prev.includes(num) ? prev.filter((d) => d !== num) : [...prev, num].sort());

  const save = async () => {
    if (!activeClinicId) return;
    if (dias.length === 0) { toast.error("Selecciona al menos un día"); return; }
    if (apertura >= cierre) { toast.error("La apertura debe ser antes del cierre"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("clinic_settings")
      .upsert({
        clinic_id: activeClinicId,
        section: "horario",
        data: { dias_laborales: dias, hora_apertura: apertura, hora_cierre: cierre },
        updated_at: new Date().toISOString(),
      }, { onConflict: "clinic_id,section" });
    setSaving(false);
    if (error) toast.error("No se pudo guardar: " + error.message);
    else toast.success("Horario guardado");
  };

  if (loading) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-primary" />
        <h2 className="text-display font-semibold text-card-foreground">Horario de atención</h2>
      </div>
      <div className="space-y-4">
        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">Días laborales</Label>
          <div className="flex gap-2 flex-wrap">
            {DIAS.map(({ num, label }) => {
              const activo = dias.includes(num);
              return (
                <button
                  key={num}
                  onClick={() => toggleDia(num)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    activo
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {activo ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <Label htmlFor="apertura" className="text-sm text-muted-foreground">Apertura</Label>
            <input
              id="apertura"
              type="time"
              value={apertura}
              onChange={(e) => setApertura(e.target.value)}
              className="mt-1 block rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="cierre" className="text-sm text-muted-foreground">Cierre</Label>
            <input
              id="cierre"
              type="time"
              value={cierre}
              onChange={(e) => setCierre(e.target.value)}
              className="mt-1 block rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? "Guardando…" : "Guardar horario"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar build**

```powershell
cd C:\Users\pablo\clinica-mexico-spa
npm run build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 10
```

Esperado: sin errores TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Configuracion.tsx
git commit -m "feat: panel HorarioClinica en Configuración — días laborales y horario de apertura/cierre"
```

---

### Task 3: Bot — leer horario clínica desde BD

**Files:**
- Modify: `supabase/functions/telegram-webhook/index.ts`

- [ ] **Step 1: Añadir variable de entorno CLINIC_ID**

Verificar que `CLINIC_ID` existe como secret en Supabase:

```powershell
supabase secrets list --project-ref kyfkvdyxpvpiacyymldc
```

Si no existe:
```powershell
supabase secrets set CLINIC_ID="<uuid-de-la-clinica>" --project-ref kyfkvdyxpvpiacyymldc
```

Obtener el UUID con: `supabase db query --linked "SELECT id FROM clinics LIMIT 1;"`

- [ ] **Step 2: Añadir constante y función getClinicSchedule**

En `telegram-webhook/index.ts`, después de las constantes de env (cerca de línea 26), añadir:

```typescript
const CLINIC_ID = Deno.env.get("CLINIC_ID") ?? "";

interface ClinicSchedule {
  dias_laborales: number[];
  hora_apertura: string;
  hora_cierre: string;
}

const SCHEDULE_DEFAULT: ClinicSchedule = {
  dias_laborales: [1, 2, 3, 4, 5],
  hora_apertura: "09:00",
  hora_cierre: "18:00",
};

async function getClinicSchedule(): Promise<ClinicSchedule> {
  if (!CLINIC_ID) return SCHEDULE_DEFAULT;
  const { data } = await supabase
    .from("clinic_settings")
    .select("data")
    .eq("clinic_id", CLINIC_ID)
    .eq("section", "horario")
    .maybeSingle();
  if (!data?.data) return SCHEDULE_DEFAULT;
  const d = data.data as Partial<ClinicSchedule>;
  return {
    dias_laborales: d.dias_laborales ?? SCHEDULE_DEFAULT.dias_laborales,
    hora_apertura: d.hora_apertura ?? SCHEDULE_DEFAULT.hora_apertura,
    hora_cierre: d.hora_cierre ?? SCHEDULE_DEFAULT.hora_cierre,
  };
}
```

- [ ] **Step 3: Refactorizar listarHorariosDisponibles para usar getClinicSchedule**

Localizar `listarHorariosDisponibles` (línea ~1364). Reemplazar la línea:
```typescript
const DIAS_LABORALES = [1, 2, 3, 4, 5];
```
(buscar el array hardcodeado dentro de la función) por:

```typescript
const schedule = await getClinicSchedule();
const DIAS_LABORALES = schedule.dias_laborales;
```

Y donde se usa `"08:00"` o los horarios hardcodeados como `horario_inicio`/`horario_fin` del doctor, verificar que ya vienen de la BD (`doctor.horario_inicio`, `doctor.horario_fin`). Si hay algún fallback hardcodeado, reemplazarlo con `schedule.hora_apertura` / `schedule.hora_cierre`.

- [ ] **Step 4: Deploy y verificar**

```powershell
supabase functions deploy telegram-webhook --project-ref kyfkvdyxpvpiacyymldc
```

Probar en Telegram: cambiar horario clínica a Lunes-Sábado en UI → pedir cita para sábado → debe aparecer slot.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/telegram-webhook/index.ts
git commit -m "feat: bot lee horario clínica desde clinic_settings en lugar de DIAS_LABORALES hardcodeado"
```

---

### Task 4: Bot — capa FAQ (Tier 1)

**Files:**
- Modify: `supabase/functions/telegram-webhook/index.ts`

- [ ] **Step 1: Añadir función buscarFaqTelegram**

Después de `getClinicSchedule()` (añadida en Task 3), insertar:

```typescript
async function buscarFaqTelegram(pregunta: string, clinicId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("faq_buscar", {
      p_pregunta: pregunta,
      p_clinic_id: clinicId || null,
      p_ruta: null,  // null = aplica globalmente (no solo a una ruta de app)
    });
    if (error || !data || data.length === 0) return null;
    const match = data[0] as { id: string; respuesta: string; uso_count: number };
    // Incrementar uso en background
    supabase.rpc("faq_incrementar_uso" as never, { p_id: match.id }).catch(() => {});
    return match.respuesta;
  } catch {
    return null;
  }
}
```

> Nota: si no existe `faq_incrementar_uso` RPC, omitir esa línea. El conteo ya lo hace internamente `faq_buscar` en algunas versiones.

- [ ] **Step 2: Insertar llamada FAQ en manejarMensaje**

Localizar en `manejarMensaje()` la línea donde se llama `correrAgente()` (cerca de línea 343). Insertar **antes** de esa llamada:

```typescript
// Capa 1: FAQ lookup (0 tokens Sonnet)
if (text.length >= 5) {
  const faqResp = await buscarFaqTelegram(text, CLINIC_ID);
  if (faqResp) {
    await enviarTelegram(chatId, faqResp);
    await guardarMensajeAsistente(conv.id, faqResp);
    return;
  }
}
```

- [ ] **Step 3: Deploy y verificar**

```powershell
supabase functions deploy telegram-webhook --project-ref kyfkvdyxpvpiacyymldc
```

Probar: si existe un FAQ activo en la BD (tabla `faq_items`), enviar esa pregunta al bot → debe responder sin llamar a Sonnet (verificar en logs que no hay llamada a Anthropic).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/telegram-webhook/index.ts
git commit -m "feat: capa FAQ (tier 1) en bot Telegram — respuestas sin tokens Sonnet para preguntas frecuentes"
```

---

### Task 5: Bot — clasificador de intent con Haiku

**Files:**
- Modify: `supabase/functions/telegram-webhook/index.ts`

- [ ] **Step 1: Añadir función clasificarIntentHaiku**

Después de `buscarFaqTelegram`, insertar:

```typescript
type BotIntent = "booking" | "consulta" | "info" | "gestion" | "humano" | "otro";

async function clasificarIntentHaiku(text: string): Promise<BotIntent> {
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        system: `Clasifica el mensaje de un paciente de clínica médica en UNA palabra:
- booking: quiere agendar cita
- consulta: pregunta sobre síntoma o padecimiento
- info: pregunta de precios, ubicación, horarios, pagos
- gestion: ver, cancelar o reagendar cita existente
- humano: quiere hablar con persona
- otro: no encaja
Responde SOLO la palabra, sin puntuación.`,
        messages: [{ role: "user", content: text }],
      }),
    });
    if (!resp.ok) return "otro";
    const data = await resp.json();
    const raw = (data.content?.[0]?.text ?? "otro").trim().toLowerCase() as BotIntent;
    const validos: BotIntent[] = ["booking", "consulta", "info", "gestion", "humano", "otro"];
    return validos.includes(raw) ? raw : "otro";
  } catch {
    return "otro";
  }
}
```

- [ ] **Step 2: Integrar en manejarMensaje con routing por intent**

Localizar la sección de `manejarMensaje()` donde actualmente cae al agente (después de los regex de saludo/humano/wizard, antes del `correrAgente()` final). Reemplazar el bloque final de fallback al agente con:

```typescript
// Capa 2: Haiku intent triage (solo si no hubo FAQ match ni wizard activo)
const intent = await clasificarIntentHaiku(text);

switch (intent) {
  case "booking":
    await enviarMenuCategorias(chatId);
    break;
  case "consulta":
    await manejarConsultaLibre(chatId, conv, text);
    break;
  case "info":
    await correrAgenteConsulta(chatId, conv, text);
    break;
  case "gestion":
    await verMiCita(chatId, conv);
    break;
  case "humano":
    await escalarConversacion(chatId, conv, "Solicitado por intent Haiku");
    break;
  default:
    await correrAgente(chatId, conv);
}
```

- [ ] **Step 3: Deploy y verificar**

```powershell
supabase functions deploy telegram-webhook --project-ref kyfkvdyxpvpiacyymldc
```

Probar: enviar "me duele la cabeza" → debe ir a `manejarConsultaLibre` (no al menú principal). Enviar "cuánto cuesta" → debe ir a `correrAgenteConsulta`. Enviar "quiero agendar" → debe mostrar categorías directo.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/telegram-webhook/index.ts
git commit -m "feat: Haiku intent classifier como tier 2 en bot — routing inteligente sin Sonnet"
```

---

### Task 6: Bot — consulta libre de padecimientos

**Files:**
- Modify: `supabase/functions/telegram-webhook/index.ts`

- [ ] **Step 1: Añadir función manejarConsultaLibre**

Localizar `iniciarConsultaAbierta` (línea ~543) y añadir **después** de ella la nueva función:

```typescript
const PADECIMIENTO_MAP: { regex: RegExp; especialidades: string[] }[] = [
  { regex: /cabeza|migraña|jaqueca|mareo|vértigo/i, especialidades: ["Medicina general", "Neurología"] },
  { regex: /corazón|pecho|presión|hipertensión|taquicardia|arritmia/i, especialidades: ["Cardiología"] },
  { regex: /piel|acné|mancha|dermatitis|lunar|erupción|urticaria/i, especialidades: ["Dermatología"] },
  { regex: /niño|bebé|pediatr|fiebre.*niño|hijo/i, especialidades: ["Pediatría"] },
  { regex: /diente|muela|encía|caries|dental|boca/i, especialidades: ["Odontología"] },
  { regex: /embaraz|menstrua|ginecolog|ovario|útero|vagina|pap|anticonceptiv/i, especialidades: ["Ginecología"] },
  { regex: /peso|nutrición|dieta|obesidad|colesterol|triglicérid/i, especialidades: ["Nutrición"] },
  { regex: /ansied|depresión|estrés|insomnio|psicolog|ánimo|tristeza|pánico/i, especialidades: ["Psicología"] },
  { regex: /análisis|laboratorio|estudio|sangre.*exam|examen|prueba/i, especialidades: ["Estudios y Laboratorio"] },
  { regex: /espalda|columna|rodilla|hueso|articulación|fractura|ortoped/i, especialidades: ["Medicina general"] },
  { regex: /garganta|tos|gripe|resfriado|fiebre|catarro|moco|nariz/i, especialidades: ["Medicina general"] },
  { regex: /estómago|dolor.*abdomen|gastritis|colitis|diarrea|estreñimiento|digestiv/i, especialidades: ["Medicina general"] },
];

async function manejarConsultaLibre(
  chatId: number,
  conv: Conversacion,
  texto: string,
): Promise<void> {
  // 1. Regex match rápido
  const match = PADECIMIENTO_MAP.find((p) => p.regex.test(texto));

  let especialidades: string[] = [];
  let mensajeBase = "";

  if (match) {
    especialidades = match.especialidades;
    mensajeBase = `Entiendo que tienes molestias. Nuestros especialistas en *${especialidades.join("* o *")}* pueden evaluarte adecuadamente.`;
  } else {
    // 2. Haiku fallback para padecimientos no mapeados
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 60,
          system: `Eres asistente de una clínica médica en México. El paciente describe un padecimiento.
Responde SOLO con el nombre de la especialidad médica más adecuada de esta lista (una o dos):
Medicina general, Cardiología, Dermatología, Ginecología, Neurología, Nutrición, Odontología, Pediatría, Psicología, Estudios y Laboratorio.
No des diagnóstico. Solo la especialidad, separada por coma si son dos.`,
          messages: [{ role: "user", content: texto }],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const esp = (data.content?.[0]?.text ?? "Medicina general").trim();
        especialidades = esp.split(",").map((e: string) => e.trim()).filter(Boolean);
        mensajeBase = `Para lo que describes, nuestros especialistas en *${especialidades.join("* o *")}* pueden ayudarte.`;
      }
    } catch {
      especialidades = ["Medicina general"];
      mensajeBase = "Para tu consulta, te recomendamos Medicina general como punto de partida.";
    }
    if (especialidades.length === 0) {
      especialidades = ["Medicina general"];
      mensajeBase = "Para tu consulta, nuestro equipo de Medicina general puede orientarte.";
    }
  }

  const mensaje = `${mensajeBase}\n\n¿Te gustaría agendar una cita?`;

  // Botones: una especialidad por botón + "Más información"
  const botones = especialidades.map((esp) => [{
    text: `📅 Agendar con ${esp}`,
    callback_data: `cat:${espToKey(esp)}`,
  }]);
  botones.push([{ text: "ℹ️ Quiero más información", callback_data: "consulta" }]);
  botones.push([{ text: "👤 Hablar con alguien", callback_data: "humano" }]);

  await enviarTelegramConBotones(chatId, mensaje, botones);
  await guardarMensajeAsistente(conv.id, mensaje);
}

// Mapea nombre de especialidad al key de CATEGORIAS existente
function espToKey(esp: string): string {
  const MAP: Record<string, string> = {
    "Medicina general": "medgen",
    "Odontología": "odonto",
    "Dermatología": "derma",
    "Pediatría": "pediatria",
    "Ginecología": "gineco",
    "Cardiología": "cardio",
    "Nutrición": "nutricion",
    "Psicología": "psico",
    "Estudios y Laboratorio": "estudios",
    "Neurología": "medgen",
  };
  return MAP[esp] ?? "medgen";
}
```

- [ ] **Step 2: Deploy y probar**

```powershell
supabase functions deploy telegram-webhook --project-ref kyfkvdyxpvpiacyymldc
```

Probar en Telegram: "me duele mucho la cabeza" → debe responder con especialidades y botones de agendar. "tengo acné" → Dermatología. "quiero análisis de sangre" → Estudios y Laboratorio.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/telegram-webhook/index.ts
git commit -m "feat: manejarConsultaLibre — bot guía padecimientos a especialidad con mapa + Haiku fallback"
```

---

### Task 7: Bot — learning pipeline

**Files:**
- Modify: `supabase/functions/telegram-webhook/index.ts`

- [ ] **Step 1: Añadir registro de Q&A tras respuesta Sonnet**

Localizar `ejecutarAgenteLoop()` (línea ~1271). Al final del loop, justo antes del `return responseText`, añadir:

```typescript
// Learning pipeline: registrar Q&A para candidatos FAQ
// Solo si hubo texto de usuario significativo y respuesta del agente
if (userTextForLearning && responseText && userTextForLearning.length >= 10) {
  supabase.rpc("chat_registrar_pendiente", {
    p_pregunta: userTextForLearning,
    p_clinic_id: CLINIC_ID || null,
    p_ruta: null,
    p_respuesta: responseText,
  } as never).catch(() => {}); // fire-and-forget
}
```

Añadir parámetro `userTextForLearning?: string` a la firma de `ejecutarAgenteLoop()` y propagarlo desde `correrAgente()` (pasa el último mensaje del usuario).

- [ ] **Step 2: Deploy y verificar en ayuda-interna**

```powershell
supabase functions deploy telegram-webhook --project-ref kyfkvdyxpvpiacyymldc
```

Enviar una pregunta al bot que llegue al agente Sonnet. Ir a `/ayuda-interna` → "Base de conocimiento" → "Para revisar" → debe aparecer la pregunta como candidato FAQ.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/telegram-webhook/index.ts
git commit -m "feat: learning pipeline en bot — conversaciones Telegram generan candidatos FAQ para revisión"
```

---

### Task 8: Bot — memoria estructurada

**Files:**
- Modify: `supabase/functions/telegram-webhook/index.ts`

- [ ] **Step 1: Añadir interfaz MemoriaPaciente**

Cerca de los tipos existentes (al inicio del archivo), añadir:

```typescript
interface MemoriaPaciente {
  resumen: string;
  preferencias: {
    especialidad_favorita?: string;
    doctor_favorito_nombre?: string;
  };
  datos_clinicos: {
    alergias?: string;
    condiciones_cronicas?: string;
  };
  historial: {
    ultima_cita_servicio?: string;
    veces_agendado: number;
    ultima_interaccion: string;
  };
  meta: {
    interacciones: number;
    updated_at: string;
  };
}

const MEMORIA_DEFAULT: MemoriaPaciente = {
  resumen: "",
  preferencias: {},
  datos_clinicos: {},
  historial: { veces_agendado: 0, ultima_interaccion: new Date().toISOString() },
  meta: { interacciones: 0, updated_at: new Date().toISOString() },
};
```

- [ ] **Step 2: Actualizar buildSystemPrompt**

Reemplazar la función `buildSystemPrompt(memoria)` existente con:

```typescript
function buildSystemPrompt(memoria: MemoriaPaciente | null): string {
  if (!memoria || !memoria.resumen) return SYSTEM_PROMPT_BASE;
  const partes: string[] = [SYSTEM_PROMPT_BASE, "\n── CONTEXTO DEL PACIENTE (no mencionar explícitamente) ──"];
  if (memoria.resumen) partes.push(memoria.resumen);
  if (memoria.datos_clinicos.alergias)
    partes.push(`Alergias conocidas: ${memoria.datos_clinicos.alergias}`);
  if (memoria.datos_clinicos.condiciones_cronicas)
    partes.push(`Condición crónica mencionada por el paciente: ${memoria.datos_clinicos.condiciones_cronicas}`);
  if (memoria.preferencias.doctor_favorito_nombre)
    partes.push(`Ha consultado antes con Dr(a). ${memoria.preferencias.doctor_favorito_nombre}`);
  return partes.join("\n");
}
```

- [ ] **Step 3: Actualizar actualizarMemoria con prompt estructurado**

Localizar `actualizarMemoria()` (línea ~1541) y reemplazar el system prompt del Haiku con:

```typescript
const systemPrompt = `Mantén una nota estructurada sobre este paciente de clínica en JSON.
Extrae del historial de conversación:
- resumen: narrativo breve (máximo 100 palabras) sobre quién es y sus necesidades de salud
- preferencias.especialidad_favorita: si mencionó preferencia de especialidad
- preferencias.doctor_favorito_nombre: si pidió al mismo doctor más de una vez
- datos_clinicos.condiciones_cronicas: solo si el paciente lo mencionó explícitamente (NO diagnostiques)
- historial.ultima_cita_servicio: nombre del último servicio agendado si se agendó en esta sesión
- historial.veces_agendado: sumar 1 si se agendó en esta sesión, mantener si no
NUNCA incluir diagnósticos. Solo lo que el paciente dijo explícitamente.
Responde SOLO con el JSON válido usando exactamente estas claves, sin explicación.`;
```

Y actualizar el tipo de retorno esperado para que haga `JSON.parse()` y lo merge con `MEMORIA_DEFAULT`.

```typescript
// Después del await llamarHaiku(...):
try {
  const parsed = JSON.parse(haiku_response) as Partial<MemoriaPaciente>;
  const nuevaMemoria: MemoriaPaciente = {
    ...MEMORIA_DEFAULT,
    ...parsed,
    preferencias: { ...MEMORIA_DEFAULT.preferencias, ...(parsed.preferencias ?? {}) },
    datos_clinicos: { ...MEMORIA_DEFAULT.datos_clinicos, ...(parsed.datos_clinicos ?? {}) },
    historial: { ...MEMORIA_DEFAULT.historial, ...(parsed.historial ?? {}), ultima_interaccion: new Date().toISOString() },
    meta: { interacciones: (memoriaActual?.meta?.interacciones ?? 0) + 1, updated_at: new Date().toISOString() },
  };
  await guardarMemoria(identidadId, nuevaMemoria);
} catch {
  // JSON parse failed — skip silently
}
```

- [ ] **Step 4: Deploy y verificar**

```powershell
supabase functions deploy telegram-webhook --project-ref kyfkvdyxpvpiacyymldc
```

Verificar: tras conversación, hacer: `supabase db query --linked "SELECT metadata FROM identidades_canal WHERE canal_id='telegram' LIMIT 1;"` → debe tener estructura `{memoria: {resumen, preferencias, datos_clinicos, historial, meta}}`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/telegram-webhook/index.ts
git commit -m "feat: memoria estructurada MemoriaPaciente con preferencias, datos clínicos e historial"
```

---

### Task 9: Bot — perfil doctor en slots + sistema prompt mejorado

**Files:**
- Modify: `supabase/functions/telegram-webhook/index.ts`

- [ ] **Step 1: Añadir especialidad en query de listarHorariosDisponibles**

Localizar el `.select()` en `listarHorariosDisponibles` que tiene `doctors!inner(nombre, apellidos, horario_inicio, horario_fin, activo)` y añadir `especialidad`:

```typescript
.select("doctor_id, doctors!inner(nombre, apellidos, especialidad, horario_inicio, horario_fin, activo)")
```

- [ ] **Step 2: Mostrar especialidad en label del slot**

Localizar donde se construye `fecha_local` en los slots y actualizar:

```typescript
fecha_local: `Dr(a). ${doctor.nombre} ${doctor.apellidos}${doctor.especialidad ? ` · ${doctor.especialidad}` : ""} — ${fechaLocal}`,
```

- [ ] **Step 3: Añadir guía de padecimientos al SYSTEM_PROMPT_BASE**

Localizar `SYSTEM_PROMPT_BASE` (línea ~42) y añadir al final del string:

```typescript
`

GUÍA DE PADECIMIENTOS → ESPECIALIDADES (no das diagnóstico, solo orientas al servicio correcto):
- Dolor de cabeza, migraña, mareos → Medicina General o Neurología
- Problemas cardíacos, presión, taquicardia → Cardiología
- Piel, acné, manchas, erupción → Dermatología
- Niños, pediatría, fiebre infantil → Pediatría
- Dental, muelas, encías → Odontología
- Ginecológico, embarazo, menstruación → Ginecología
- Peso, nutrición, dieta → Nutrición
- Ansiedad, depresión, estrés, insomnio → Psicología
- Análisis, laboratorio, estudios de sangre → Estudios y Laboratorio
- Cualquier otro → Medicina General como punto de partida
Siempre cierra con "¿Agendamos una cita con [especialidad]?"`
```

- [ ] **Step 4: Deploy, verificar y commit**

```powershell
supabase functions deploy telegram-webhook --project-ref kyfkvdyxpvpiacyymldc
```

Verificar: al seleccionar servicio y ver horarios, cada slot muestra `Dr(a). Nombre Apellido · Especialidad — Lunes 30 Jun 10:00`.

```bash
git add supabase/functions/telegram-webhook/index.ts
git commit -m "feat: perfil doctor con especialidad en slots + guía de padecimientos en system prompt"
```

---

### Task 10: Deploy Proyecto 1

- [ ] **Step 1: Build y deploy completo**

```powershell
cd C:\Users\pablo\clinica-mexico-spa
npm run build:all
wrangler deploy
```

- [ ] **Step 2: Verificar en producción**

Checklist:
- [ ] Abre Configuración en `integrika.mx` → sección "Horario de atención" visible → cambiar a incluir sábado → guardar → OK
- [ ] Bot Telegram → preguntar "cuánto cuesta" → si FAQ configurado, responde sin Sonnet
- [ ] Bot → "me duele la cabeza" → responde con especialidades y botones de agendar
- [ ] Bot → "quiero agendar" → va directo a categorías (sin menú principal)
- [ ] Slot de horario muestra especialidad del doctor

- [ ] **Step 3: Commit final P1**

```bash
git add -A
git commit -m "chore: deploy Proyecto 1 — bot 3-tier, horario clínica configurable, consulta libre de padecimientos"
```

---

## PROYECTO 2 — Google Calendar Bidireccional

> **Prerequisito obligatorio antes de Task 11:**
> 1. Ir a https://console.cloud.google.com → nuevo proyecto → habilitar "Google Calendar API"
> 2. Crear credenciales OAuth 2.0 → tipo "Web application"
> 3. Authorized redirect URI: `https://kyfkvdyxpvpiacyymldc.supabase.co/functions/v1/google-oauth-callback`
> 4. Copiar `client_id` y `client_secret`
> 5. Configurar en Supabase:
> ```powershell
> supabase secrets set GOOGLE_CLIENT_ID="<client_id>" GOOGLE_CLIENT_SECRET="<client_secret>" --project-ref kyfkvdyxpvpiacyymldc
> ```

---

### Task 11: Migración — doctor_calendars + appointments.google_event_id

**Files:**
- Create: `supabase/migrations/20260627000000_doctor_calendars.sql`

- [ ] **Step 1: Crear migration**

```sql
-- Tabla para almacenar tokens OAuth de Google Calendar por doctor
CREATE TABLE IF NOT EXISTS doctor_calendars (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id     uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_id     uuid REFERENCES clinics(id) ON DELETE CASCADE,
  google_email  text NOT NULL,
  calendar_id   text NOT NULL DEFAULT 'primary',
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  token_expiry  timestamptz NOT NULL,
  activo        boolean NOT NULL DEFAULT true,
  connected_at  timestamptz DEFAULT now(),
  CONSTRAINT doctor_calendars_doctor_clinic_unique UNIQUE (doctor_id, clinic_id)
);

ALTER TABLE doctor_calendars ENABLE ROW LEVEL SECURITY;

-- Solo service role puede leer/escribir tokens (seguridad)
CREATE POLICY "service_role_only" ON doctor_calendars
  USING (auth.role() = 'service_role');

-- Campo para guardar el ID del evento en Google Calendar
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_event_id text;

-- Index para lookup rápido
CREATE INDEX IF NOT EXISTS idx_doctor_calendars_doctor_id ON doctor_calendars(doctor_id);
```

- [ ] **Step 2: Aplicar migration**

```powershell
supabase db push --linked
```

Verificar: `supabase db query --linked "SELECT table_name FROM information_schema.tables WHERE table_name='doctor_calendars';"`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260627000000_doctor_calendars.sql
git commit -m "feat: tabla doctor_calendars para Google Calendar OAuth + appointments.google_event_id"
```

---

### Task 12: Edge Function — google-oauth-callback

**Files:**
- Create: `supabase/functions/google-oauth-callback/index.ts`

- [ ] **Step 1: Crear función**

```typescript
// supabase/functions/google-oauth-callback/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // "doctorId:clinicId" base64
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(`<html><body><h2>Error al conectar Google Calendar: ${error}</h2><p>Puedes cerrar esta ventana.</p></body></html>`, {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!code || !state) {
    return new Response("Parámetros inválidos", { status: 400 });
  }

  // Decodificar state
  let doctorId: string, clinicId: string;
  try {
    const decoded = atob(state);
    [doctorId, clinicId] = decoded.split(":");
    if (!doctorId) throw new Error("sin doctorId");
  } catch {
    return new Response("State inválido", { status: 400 });
  }

  // Intercambiar code por tokens
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResp.ok) {
    const err = await tokenResp.text();
    console.error("Token exchange failed:", err);
    return new Response(`<html><body><h2>Error al obtener tokens de Google.</h2><p>${err}</p></body></html>`, {
      headers: { "Content-Type": "text/html" },
    });
  }

  const tokens = await tokenResp.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };

  if (!tokens.refresh_token) {
    return new Response(`<html><body><h2>Google no devolvió refresh_token.</h2>
    <p>Revoca el acceso en <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> y vuelve a intentarlo.</p></body></html>`, {
      headers: { "Content-Type": "text/html" },
    });
  }

  // Obtener email del doctor de Google
  const profileResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileResp.json() as { email: string };

  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Guardar tokens
  const { error: dbError } = await supabase.from("doctor_calendars").upsert({
    doctor_id: doctorId,
    clinic_id: clinicId || null,
    google_email: profile.email,
    calendar_id: "primary",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expiry: tokenExpiry,
    activo: true,
    connected_at: new Date().toISOString(),
  }, { onConflict: "doctor_id,clinic_id" });

  if (dbError) {
    console.error("DB error:", dbError);
    return new Response("Error guardando tokens", { status: 500 });
  }

  return new Response(`<html><body>
    <h2>✅ Google Calendar conectado correctamente</h2>
    <p>Cuenta: <strong>${profile.email}</strong></p>
    <p>Ya puedes cerrar esta ventana. Tus citas en esta clínica aparecerán en tu Google Calendar.</p>
  </body></html>`, { headers: { "Content-Type": "text/html" } });
});
```

- [ ] **Step 2: Deploy función**

```powershell
supabase functions deploy google-oauth-callback --project-ref kyfkvdyxpvpiacyymldc
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/google-oauth-callback/
git commit -m "feat: edge function google-oauth-callback — maneja OAuth flow de Google Calendar por doctor"
```

---

### Task 13: Módulo google-calendar-sync en telegram-webhook

**Files:**
- Create: `supabase/functions/telegram-webhook/google-calendar.ts`

- [ ] **Step 1: Crear módulo helper**

```typescript
// supabase/functions/telegram-webhook/google-calendar.ts

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export interface DoctorCalendar {
  id: string;
  doctor_id: string;
  calendar_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
}

export interface BusySlot {
  start: string;
  end: string;
}

// Obtiene tokens del doctor, refrescando si expiran en < 5 min
export async function getDoctorCalendar(doctorId: string): Promise<DoctorCalendar | null> {
  const { data } = await supabase
    .from("doctor_calendars")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("activo", true)
    .maybeSingle();
  if (!data) return null;

  const cal = data as DoctorCalendar;
  const expiry = new Date(cal.token_expiry).getTime();
  const fiveMin = 5 * 60 * 1000;

  if (Date.now() + fiveMin >= expiry) {
    // Refresh token
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: cal.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    if (!resp.ok) return null;
    const tokens = await resp.json() as { access_token: string; expires_in: number };
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await supabase.from("doctor_calendars").update({
      access_token: tokens.access_token,
      token_expiry: newExpiry,
    }).eq("id", cal.id);
    cal.access_token = tokens.access_token;
  }

  return cal;
}

// Obtiene horas ocupadas del doctor en un rango de tiempo
export async function getFreeBusy(
  cal: DoctorCalendar,
  timeMin: string,
  timeMax: string,
): Promise<BusySlot[]> {
  try {
    const resp = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cal.access_token}`,
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        timeZone: "America/Mexico_City",
        items: [{ id: cal.calendar_id }],
      }),
    });
    if (!resp.ok) return [];
    const data = await resp.json() as {
      calendars: Record<string, { busy: BusySlot[] }>;
    };
    return data.calendars?.[cal.calendar_id]?.busy ?? [];
  } catch {
    return [];
  }
}

// Crea evento en Google Calendar del doctor
export async function createCalendarEvent(
  cal: DoctorCalendar,
  event: {
    summary: string;
    description: string;
    startIso: string;
    endIso: string;
  },
): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.calendar_id)}/events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cal.access_token}`,
        },
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          start: { dateTime: event.startIso, timeZone: "America/Mexico_City" },
          end: { dateTime: event.endIso, timeZone: "America/Mexico_City" },
        }),
      },
    );
    if (!resp.ok) return null;
    const data = await resp.json() as { id: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

// Actualiza evento existente (reagendar)
export async function updateCalendarEvent(
  cal: DoctorCalendar,
  eventId: string,
  event: { summary: string; description: string; startIso: string; endIso: string },
): Promise<boolean> {
  try {
    const resp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.calendar_id)}/events/${eventId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cal.access_token}`,
        },
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          start: { dateTime: event.startIso, timeZone: "America/Mexico_City" },
          end: { dateTime: event.endIso, timeZone: "America/Mexico_City" },
        }),
      },
    );
    return resp.ok;
  } catch {
    return false;
  }
}

// Elimina evento (cancelación)
export async function deleteCalendarEvent(
  cal: DoctorCalendar,
  eventId: string,
): Promise<void> {
  try {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.calendar_id)}/events/${eventId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${cal.access_token}` },
      },
    );
  } catch {
    // Fallo silencioso — la cita ya está cancelada en BD
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/telegram-webhook/google-calendar.ts
git commit -m "feat: módulo google-calendar.ts — getDoctorCalendar, getFreeBusy, CRUD eventos"
```

---

### Task 14: Bot — free/busy check en listarHorariosDisponibles

**Files:**
- Modify: `supabase/functions/telegram-webhook/index.ts`

- [ ] **Step 1: Importar módulo google-calendar**

Al inicio de `index.ts`, añadir:

```typescript
import {
  getDoctorCalendar,
  getFreeBusy,
  type BusySlot,
} from "./google-calendar.ts";
```

- [ ] **Step 2: Pre-cargar calendarios de doctores**

En `listarHorariosDisponibles()`, después de obtener la lista de doctores (`doctor_servicios` query), añadir:

```typescript
// Pre-cargar Google Calendars de doctores disponibles
const calendarCache: Record<string, BusySlot[]> = {};
const windowStart = new Date().toISOString();
const windowEnd = new Date(Date.now() + dias_adelante * 86400000).toISOString();

await Promise.all(
  (doctorServiciosData as any[]).map(async (ds: any) => {
    const cal = await getDoctorCalendar(ds.doctor_id);
    if (cal) {
      calendarCache[ds.doctor_id] = await getFreeBusy(cal, windowStart, windowEnd);
    }
  })
);
```

- [ ] **Step 3: Filtrar slots que colisionan con Google Calendar**

En el loop de generación de slots, después del check de conflictos con `appointments`, añadir:

```typescript
// Check colisión con Google Calendar (si el doctor tiene conectado)
const googleBusy = calendarCache[doctorId] ?? [];
const googleConflict = googleBusy.some((busy) => {
  const busyStart = new Date(busy.start).getTime();
  const busyEnd = new Date(busy.end).getTime();
  const slotStart = slotIni.getTime();
  const slotEnd = slotFin.getTime();
  return slotStart < busyEnd && slotEnd > busyStart;
});
if (googleConflict) continue; // slot ocupado en Google Calendar del doctor
```

- [ ] **Step 4: Deploy y verificar**

```powershell
supabase functions deploy telegram-webhook --project-ref kyfkvdyxpvpiacyymldc
```

Verificar: si un doctor tiene Google Calendar conectado con un evento mañana 10-11am, ese slot no debe aparecer en el bot.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/telegram-webhook/index.ts
git commit -m "feat: bot excluye slots ocupados en Google Calendar del doctor al mostrar horarios disponibles"
```

---

### Task 15: Bot — crear/actualizar/eliminar eventos en Google Calendar

**Files:**
- Modify: `supabase/functions/telegram-webhook/index.ts`

- [ ] **Step 1: Importar funciones adicionales**

Ampliar el import de `google-calendar.ts`:

```typescript
import {
  getDoctorCalendar,
  getFreeBusy,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  type BusySlot,
} from "./google-calendar.ts";
```

- [ ] **Step 2: Crear evento al confirmar cita (crearCitaDesdeSesion)**

Localizar `crearCitaDesdeSesion()` (línea ~1193). Después del `supabase.from("appointments").insert(...)` exitoso, añadir:

```typescript
// Crear evento en Google Calendar del doctor (background)
(async () => {
  try {
    const cal = await getDoctorCalendar(doctor_id);
    if (!cal || !apptData?.id) return;
    const eventId = await createCalendarEvent(cal, {
      summary: `Cita: ${servicio.nombre} — ${pacienteNombre}`,
      description: `Paciente: ${pacienteNombre}\nServicio: ${servicio.nombre}\nOrigen: Bot Telegram\nClinica: ${CLINIC_NAME}`,
      startIso: fecha_inicio,
      endIso: fecha_fin,
    });
    if (eventId) {
      await supabase.from("appointments").update({ google_event_id: eventId }).eq("id", apptData.id);
    }
  } catch {
    // No bloquear confirmación si Google falla
  }
})();
```

- [ ] **Step 3: Eliminar evento al cancelar cita (confirmarCancelacionCita)**

Localizar `confirmarCancelacionCita()` (línea ~727). Después del update a "cancelada", añadir:

```typescript
// Eliminar evento de Google Calendar en background
(async () => {
  try {
    const { data: appt } = await supabase
      .from("appointments")
      .select("google_event_id, doctor_id")
      .eq("id", citaId)
      .maybeSingle();
    if (appt?.google_event_id && appt.doctor_id) {
      const cal = await getDoctorCalendar(appt.doctor_id);
      if (cal) await deleteCalendarEvent(cal, appt.google_event_id);
    }
  } catch {}
})();
```

- [ ] **Step 4: Actualizar evento al reagendar (confirmarReagendar)**

Localizar `confirmarReagendar()` (línea ~836). Después del update de fecha, añadir:

```typescript
// Actualizar evento de Google Calendar en background
(async () => {
  try {
    const { data: appt } = await supabase
      .from("appointments")
      .select("google_event_id, doctor_id, servicios(nombre)")
      .eq("id", citaId)
      .maybeSingle();
    if (appt?.google_event_id && appt.doctor_id) {
      const cal = await getDoctorCalendar(appt.doctor_id);
      if (cal) {
        await updateCalendarEvent(cal, appt.google_event_id, {
          summary: `Cita: ${(appt.servicios as any)?.nombre ?? "Consulta"} — ${pacienteNombre}`,
          description: `Cita reagendada\nOrigen: Bot Telegram\nClinica: ${CLINIC_NAME}`,
          startIso: nuevoFechaInicio,
          endIso: nuevoFechaFin,
        });
      }
    }
  } catch {}
})();
```

- [ ] **Step 5: Deploy y verificar end-to-end**

```powershell
supabase functions deploy telegram-webhook --project-ref kyfkvdyxpvpiacyymldc
```

Verificar: agendar cita con doctor que tiene Google Calendar conectado → en < 5 segundos aparece evento en su Google Calendar. Cancelar → evento desaparece. Reagendar → evento se actualiza.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/telegram-webhook/index.ts
git commit -m "feat: sincronización bidireccional Google Calendar — crear/actualizar/eliminar eventos al gestionar citas"
```

---

### Task 16: UI — Panel Google Calendar en alta de doctores

**Files:**
- Modify: `src/pages/AdminUsuarios.tsx`

- [ ] **Step 1: Añadir función generateGoogleOAuthUrl**

Al inicio de `AdminUsuarios.tsx`, añadir helper:

```typescript
const GOOGLE_CLIENT_ID_PUBLIC = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";

function generateGoogleOAuthUrl(doctorId: string, clinicId: string): string {
  const state = btoa(`${doctorId}:${clinicId}`);
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID_PUBLIC,
    redirect_uri: `${SUPABASE_FUNCTIONS_URL}/google-oauth-callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
```

- [ ] **Step 2: Añadir estado de calendarios conectados**

En el componente principal `AdminUsuarios`, añadir:

```typescript
const [doctorCalendars, setDoctorCalendars] = useState<Record<string, string>>({});
// doctorCalendars: { [doctorId]: googleEmail | "" }

const loadCalendars = async () => {
  const { data } = await supabase
    .from("doctor_calendars")
    .select("doctor_id, google_email, activo")
    .eq("activo", true);
  const map: Record<string, string> = {};
  (data ?? []).forEach((c: { doctor_id: string; google_email: string }) => {
    map[c.doctor_id] = c.google_email;
  });
  setDoctorCalendars(map);
};

useEffect(() => { loadCalendars(); }, []);
```

> Nota: `doctor_calendars` tiene RLS solo para service_role. Si el query falla por permisos, usar una edge function que devuelva el listado. Alternativamente, crear una vista o RPC con SECURITY DEFINER que filtre por clinic_id del admin.

- [ ] **Step 3: Añadir columna "Google Calendar" en la tabla de doctores**

En el JSX donde se renderizan las filas de doctores (buscar el `<tr>` con datos del doctor), añadir una celda:

```tsx
<td className="px-4 py-3">
  {doctorCalendars[doctor.id] ? (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-green-500" />
      <span className="text-xs text-muted-foreground truncate max-w-[140px]">
        {doctorCalendars[doctor.id]}
      </span>
    </div>
  ) : (
    <button
      onClick={() => {
        const url = generateGoogleOAuthUrl(doctor.id, activeClinicId ?? "");
        window.open(url, "_blank", "width=600,height=700");
      }}
      className="text-xs text-primary hover:underline flex items-center gap-1"
    >
      <CalendarDays className="h-3 w-3" />
      Conectar Calendar
    </button>
  )}
</td>
```

Añadir `CalendarDays` al import de lucide-react en AdminUsuarios.tsx.

Añadir `<th>` correspondiente en el encabezado de la tabla con texto "Google Calendar".

- [ ] **Step 4: Añadir variable de entorno VITE_GOOGLE_CLIENT_ID**

En `.env` local:
```
VITE_GOOGLE_CLIENT_ID="<tu-google-client-id>"
```

En GitHub Actions secrets (para CI): añadir `VITE_GOOGLE_CLIENT_ID`.

- [ ] **Step 5: Build y verificar**

```powershell
npm run build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 10
```

Verificar: en `/admin/usuarios`, la columna "Google Calendar" aparece. Doctores sin calendar muestran "Conectar Calendar". Hacer clic → abre ventana Google OAuth.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminUsuarios.tsx .env.example
git commit -m "feat: panel Google Calendar en AdminUsuarios — conectar calendar al dar de alta doctor"
```

---

### Task 17: Deploy Proyecto 2

- [ ] **Step 1: Build y deploy completo**

```powershell
cd C:\Users\pablo\clinica-mexico-spa
npm run build:all
wrangler deploy
supabase functions deploy google-oauth-callback telegram-webhook --project-ref kyfkvdyxpvpiacyymldc
```

- [ ] **Step 2: Verificar flujo completo**

Checklist:
- [ ] Admin abre `/admin/usuarios` → ve columna Google Calendar → hace clic "Conectar Calendar" para un doctor
- [ ] Ventana Google OAuth abre → doctor (o admin) autoriza → ventana muestra "✅ Google Calendar conectado"
- [ ] Columna ahora muestra el email del doctor
- [ ] Patient abre bot Telegram → pide cita con ese doctor → slots disponibles excluyen eventos del Google Calendar del doctor
- [ ] Patient confirma cita → en < 5 seg aparece evento en Google Calendar del doctor
- [ ] Admin cancela cita desde app → evento desaparece del Google Calendar del doctor

- [ ] **Step 3: Commit y tag**

```bash
git add -A
git commit -m "feat: Proyecto 2 completo — Google Calendar bidireccional integrado en flujo de doctores"
git tag v2.0-google-calendar
```

---

## Notas Finales

### Backward compatibility
- Doctores sin Google Calendar conectado: bot funciona exactamente igual que antes (fallback graceful)
- Patients existentes: su memoria migra automáticamente al nuevo formato en la primera conversación post-deploy

### Costos estimados post-implementación
| Canal | Antes | Después |
|-------|-------|---------|
| Preguntas comunes (FAQ) | ~$0.003/msg Sonnet | $0 (tier 1) |
| Intent simple (booking/info) | ~$0.003/msg Sonnet | ~$0.000003/msg Haiku |
| Padecimiento → especialidad | ~$0.003/msg Sonnet | ~$0.000003/msg Haiku |
| Booking complejo | ~$0.003/msg Sonnet | ~$0.003/msg Sonnet (igual) |
| **Ahorro estimado** | — | **60-70% reducción tokens** |

### Variables de entorno requeridas para P2
```
CLINIC_ID=<uuid>                    # ya existía o añadir
GOOGLE_CLIENT_ID=<client_id>        # Google Cloud Console
GOOGLE_CLIENT_SECRET=<secret>       # Google Cloud Console
VITE_GOOGLE_CLIENT_ID=<client_id>   # Frontend (build time)
```
