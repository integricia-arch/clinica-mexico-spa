# Pipeline Videos Marketing IntegriKa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurar ElevenLabs MCP + HeyGen MCP en Claude Code y producir el primer video de marketing de IntegriKa ("El problema") con voz profesional en español MX y avatar HeyGen Avatar IV.

**Architecture:** ElevenLabs MCP (stdio, npx) genera audio .mp3 con voz profesional → HeyGen MCP (HTTP OAuth) recibe script + audio y produce video .mp4 con Avatar IV → video disponible en HeyGen Projects para descarga y publicación.

**Tech Stack:** ElevenLabs MCP `@elevenlabs/elevenlabs-mcp`, HeyGen MCP HTTP `https://mcp.heygen.com/mcp/v1/`, Claude Code CLI

## Global Constraints

- Idioma de todos los scripts: español MX (tono directo, técnico-accesible)
- Marca: IntegriKa, teal `#0891B2` + emerald `#059669`
- Voz: profesional de librería ElevenLabs en español MX (seleccionar en Task 2)
- Audio output: `C:\Users\pablo\Desktop\integrika-videos\` (crear si no existe)
- Videos van a HeyGen Projects (descarga manual)
- No clonar voz propia en v1 — usar librería
- Fuente de datos para scripts: `docs/superpowers/specs/2026-06-22-elevenlabs-heygen-marketing-videos-design.md`

---

## Task 1: Instalar y configurar ElevenLabs MCP

**Por qué este approach:**
ElevenLabs tiene el MCP oficial más maduro para TTS (lanzado con Claude, documentado en elevenlabs.io/docs). Usa stdio transport (npx), igual que Magic MCP ya configurado. Genera archivos .mp3 locales en el directorio configurado — flujo más controlable que streaming.

**Files:**
- Modify: `C:\Users\pablo\.claude.json` (sección `mcpServers`)
- Create: `C:\Users\pablo\Desktop\integrika-videos\` (carpeta output)

**Requires:**
- `ELEVENLABS_API_KEY` de elevenlabs.io/app/settings/api-keys

- [ ] **Step 1: Crear carpeta de output**

```powershell
New-Item -ItemType Directory -Force -Path "C:\Users\pablo\Desktop\integrika-videos"
```

Esperado: carpeta creada sin error.

- [ ] **Step 2: Agregar ElevenLabs MCP a ~/.claude.json**

Editar `C:\Users\pablo\.claude.json`, agregar en `mcpServers`:

```json
"elevenlabs": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@elevenlabs/elevenlabs-mcp@latest"],
  "env": {
    "ELEVENLABS_API_KEY": "<TU_API_KEY_AQUI>",
    "ELEVENLABS_MCP_BASE_PATH": "C:\\Users\\pablo\\Desktop\\integrika-videos",
    "ELEVENLABS_MCP_OUTPUT_MODE": "files"
  }
}
```

**Nota:** `ELEVENLABS_MCP_BASE_PATH` define dónde se guardan los .mp3 generados. `files` mode guarda en disco (vs `resources` que devuelve base64 inline).

- [ ] **Step 3: Verificar MCP en Claude Code**

Reiniciar Claude Code. Verificar que el MCP aparezca disponible listando herramientas. Esperar confirmación de que `elevenlabs` tools están activos.

---

## Task 2: Instalar y configurar HeyGen MCP + autenticación OAuth

**Por qué este approach:**
HeyGen usa HTTP transport con OAuth (no API key en headers) — documentado en developers.heygen.com/mcp/claude-code. Videos se guardan automáticamente en HeyGen Projects. OAuth es one-time: después el connector persiste activo. Ventaja vs API directa: no necesitas gestionar tokens manualmente.

**Files:**
- Modify: `C:\Users\pablo\.claude.json` (via CLI `claude mcp add`)

- [ ] **Step 1: Agregar HeyGen MCP via CLI**

Ejecutar en terminal (fuera de Claude Code, o en ! command):

```bash
claude mcp add --transport http -s user heygen https://mcp.heygen.com/mcp/v1/
```

Esto agrega a `~/.claude.json`:
```json
"heygen": {
  "type": "http",
  "url": "https://mcp.heygen.com/mcp/v1/"
}
```

- [ ] **Step 2: Autenticar HeyGen via OAuth**

Reiniciar Claude Code. En la primera invocación del HeyGen MCP, Claude abrirá URL de autorización. Pasos:
1. Abrir URL en browser
2. Login con cuenta HeyGen existente
3. Aprobar acceso
4. Connector queda activo permanentemente

- [ ] **Step 3: Verificar HeyGen MCP activo**

Pedir a Claude Code que liste los avatares disponibles via HeyGen MCP. Confirmar respuesta con al menos 1 avatar.

---

## Task 3: Seleccionar voz ElevenLabs en español MX

**Por qué este approach:**
ElevenLabs tiene voces nativas en español MX con acento correcto. Grabar audio fuente en inglés y generar español produce acento inglés detectable — documentado en su guía de voice cloning. Usar voz nativa ES-MX = calidad máxima para mercado objetivo (directores de clínica CDMX-GDL-MTY).

**Criterios de selección:**
- Español mexicano (no castellano)
- Tono: profesional, confianza, no robótico
- Género: cualquiera que suene auténtico al mercado médico MX
- Velocidad: natural, no acelerada

- [ ] **Step 1: Listar voces disponibles en ES-MX**

Via ElevenLabs MCP, pedir lista de voces en español. Buscar las con `language: es`, `accent: mexican` o similar.

- [ ] **Step 2: Generar audio de prueba con las top 3 candidatas**

Para cada candidata, generar audio de esta frase de prueba (10 seg):

```
"Las clínicas privadas en México pierden hasta $13,000 pesos al mes 
por no-shows, robo en farmacia y citas que se caen fuera de horario. 
IntegriKa lo resuelve todo desde un solo sistema."
```

Output: `C:\Users\pablo\Desktop\integrika-videos\prueba-voz-1.mp3`, `prueba-voz-2.mp3`, `prueba-voz-3.mp3`

- [ ] **Step 3: Elegir voz definitiva**

Escuchar los 3 audios. Seleccionar la voz que suene más natural y profesional para el mercado médico MX. Documentar el `voice_id` elegido.

---

## Task 4: Escribir y generar audio — Video #1 "El problema"

**Por qué este video primero:**
Es el más corto (90 seg ≈ 225 palabras), cubre el pain point más universal (todo director de clínica lo reconoce), y valida el pipeline completo antes de invertir tiempo en demos más largas. Datos usados vienen de investigación real en Pitch.tsx — no inventados.

**Datos respaldados para el script (fuente: Pitch.tsx líneas 551-567):**
- 310,133 clínicas en MX, 82% sin software real
- No-shows: 22–35% sin recordatorios
- −$3,200/mes robo hormiga farmacia (4% de inventario $80k)
- −$1,800/sem diferencia de caja sin detección
- +$13,601/mes ROI neto calculado

**Files:**
- Create: `C:\Users\pablo\Desktop\integrika-videos\scripts\video-01-el-problema.md`
- Create: `C:\Users\pablo\Desktop\integrika-videos\audio\video-01-el-problema.mp3`

- [ ] **Step 1: Crear carpetas de organización**

```powershell
New-Item -ItemType Directory -Force -Path "C:\Users\pablo\Desktop\integrika-videos\scripts"
New-Item -ItemType Directory -Force -Path "C:\Users\pablo\Desktop\integrika-videos\audio"
New-Item -ItemType Directory -Force -Path "C:\Users\pablo\Desktop\integrika-videos\videos"
```

- [ ] **Step 2: Escribir script Video #1**

Guardar en `C:\Users\pablo\Desktop\integrika-videos\scripts\video-01-el-problema.md`:

```markdown
# Script: "El problema que resuelve IntegriKa"
Duración objetivo: 90 segundos (~225 palabras)
Voz: [voice_id seleccionado en Task 3]

---

[APERTURA — 0-10 seg]
En México hay más de 310,000 clínicas privadas.
Y la mayoría opera hoy con WhatsApp, papel y Excel.

[PROBLEMA 1 — 10-30 seg]
Un paciente llama a las 9 de la noche para agendar cita.
Nadie contesta. La cita se pierde.
Eso pasa entre 20 y 35 por ciento de las veces — 
sin un sistema de recordatorios automático.
Solo en no-shows, una clínica pierde más de $3,000 pesos al mes.

[PROBLEMA 2 — 30-50 seg]
En la farmacia, sin trazabilidad de inventario,
el robo hormiga promedio es del 4 por ciento.
En un inventario de 80,000 pesos, eso son $3,200 pesos que desaparecen cada mes.
Y la diferencia de caja muchas veces no se detecta hasta que ya es demasiado tarde.

[PROBLEMA 3 — 50-65 seg]
Las soluciones que existen hoy —
Huli, Mi-Consultorio, Medesk —
son herramientas parciales.
No entienden el flujo mexicano. No tienen CFDI nativo. 
No integran farmacia, bot de IA y facturación en un solo precio.

[SOLUCIÓN — 65-85 seg]
IntegriKa es el sistema operativo de tu clínica.
Agenda, farmacia, CFDI 4.0, bot de IA 24/7, pagos y Business Intelligence —
todo integrado, sin integraciones, sin add-ons, sin sorpresas en la factura.
Y el plan profesional se paga solo en la primera semana.

[CTA — 85-90 seg]
Conoce IntegriKa en integrika punto mx
```

- [ ] **Step 3: Generar audio del script via ElevenLabs MCP**

Con la voz elegida en Task 3, generar el audio completo. Output: `audio/video-01-el-problema.mp3`

- [ ] **Step 4: Escuchar y verificar el audio**

Abrir `C:\Users\pablo\Desktop\integrika-videos\audio\video-01-el-problema.mp3`. Verificar:
- Pronunciación correcta (especialmente: "IntegriKa", "CFDI", "Huli", "Medesk")
- Duración ~80-95 segundos
- Sin cortes ni artefactos

---

## Task 5: Generar Video #1 via HeyGen MCP

**Por qué HeyGen Avatar IV:**
Lanzado agosto 2025, incluye micro-expresiones, movimiento de cabeza natural y gestos de manos sincronizados con el tono emocional del audio. En pruebas de marketing B2B, avatares realistas aumentan tiempo de visualización vs. solo voz sobre slides (fuente: HeyGen case studies 2025). Para clínicas (mercado conservador), avatar profesional = más credibilidad que animación.

**Files:**
- Output: HeyGen Projects (descarga manual desde app.heygen.com/projects)
- Create: `C:\Users\pablo\Desktop\integrika-videos\videos\video-01-el-problema-LINK.txt`

- [ ] **Step 1: Seleccionar avatar en HeyGen**

Via HeyGen MCP o app.heygen.com/avatars, seleccionar avatar con estas características:
- Avatar IV (no generaciones anteriores)
- Aspecto profesional, neutro, ambiguo — no caricaturesco
- Vestimenta: formal o business casual (consultorio médico / ejecutivo)
- Anotar el `avatar_id`

- [ ] **Step 2: Crear video via HeyGen MCP**

Prompt al HeyGen MCP:
```
Genera un video con Avatar IV usando el avatar [avatar_id].
Script: [texto completo del script de video-01]
Audio: usar el archivo de audio que generé con ElevenLabs para sincronizar labios.
Formato: 16:9 landscape, 1080p.
Background: fondo limpio, profesional, oscuro o neutro (no blanco puro).
```

- [ ] **Step 3: Esperar render y verificar**

HeyGen tarda 2-5 min en renderizar. Verificar en HeyGen Projects:
- Video descargado en `C:\Users\pablo\Desktop\integrika-videos\videos\`
- Duración correcta (~90 seg)
- Sincronización labios-audio correcta
- Avatar visible y profesional

- [ ] **Step 4: Guardar link del proyecto**

Guardar URL del video en HeyGen Projects en `videos/video-01-el-problema-LINK.txt` para referencia futura.

---

## Task 6: Escribir scripts Videos #2–#5

**Por qué escribir scripts ahora:**
Mientras el video #1 se valida, los scripts pueden estar listos. La producción de audio+video tarda ~10 min por video — tener scripts pre-escritos permite batch-production en la siguiente sesión.

**Files:**
- Create: `C:\Users\pablo\Desktop\integrika-videos\scripts\video-02-demo-agenda.md`
- Create: `C:\Users\pablo\Desktop\integrika-videos\scripts\video-03-demo-farmacia.md`
- Create: `C:\Users\pablo\Desktop\integrika-videos\scripts\video-04-roi.md`
- Create: `C:\Users\pablo\Desktop\integrika-videos\scripts\video-05-cfdi.md`

**Datos de referencia para cada script (fuente: Pitch.tsx y spec):**

### Video #2 — "Demo: Agenda + Google Calendar" (3 min)

```markdown
# Script Video #2: Agenda + Google Calendar
Duración: 3 minutos (~450 palabras)

[HOOK — 0-15 seg]
¿Qué pasa cuando un paciente quiere agendar cita a las 11 de la noche?
Con IntegriKa, el bot de IA lo atiende en Telegram — en segundos, sin secretaria.

[DEMO FLUJO — 15-90 seg]
El paciente escribe al bot.
El sistema lo identifica o lo registra como nuevo.
Le muestra los servicios disponibles, los días con horario,
y los slots del médico que eligió — filtrados en tiempo real contra Google Calendar.
No hay doble booking. Nunca.
La cita se confirma, y en ese momento se crean automáticamente
dos recordatorios: uno 24 horas antes, otro 2 horas antes.
Todo por Telegram. Sin una sola llamada.

[VISTA RECEPCIÓN — 90-150 seg]
Desde recepción, la agenda muestra vista semanal y diaria por doctor.
Google Calendar de cada médico sincronizado bidireccionalmente —
si el doctor bloquea un día en su calendar personal, los slots desaparecen del bot.
Citas recurrentes: semanales, quincenales o mensuales, hasta 52 ocurrencias automáticas.

[STATS — 150-170 seg]
70 por ciento menos no-shows con recordatorios automáticos.
310,000 clínicas en México. Solo 18 por ciento tiene software real.
El resto sigue con WhatsApp y Excel.

[CTA — 170-180 seg]
IntegriKa. El sistema operativo de tu clínica.
integrika punto mx
```

### Video #3 — "Demo: Farmacia + Corte de Caja" (3 min)

```markdown
# Script Video #3: Farmacia + Corte de Caja
Duración: 3 minutos (~450 palabras)

[HOOK — 0-15 seg]
¿Sabes exactamente cuánto dinero tienes en tu farmacia en este momento?
¿Y cuánto debería haber?
Con IntegriKa, la diferencia es cero — o la detectas antes de cerrar el turno.

[FARMACIA POS — 15-75 seg]
El punto de venta de farmacia tiene escáner de código de barras,
carrito de compra con existencias en tiempo real,
y desglose de IVA proporcional correcto — cumple con el SAT.
Los medicamentos controlados tienen flujo COFEPRIS:
libro de control, firma de supervisor, trazabilidad completa por lote y caducidad.
El método FEFO garantiza que siempre sale el lote que vence primero.

[CORTE DE CAJA — 75-145 seg]
Al cerrar turno, el cajero hace conteo ciego:
cuenta físicamente el efectivo antes de ver el sistema.
IntegriKa compara contra el corte Z calculado.
Si hay diferencia mayor al umbral configurado, bloquea el cierre hasta que el supervisor autorice con PIN.
No hay manera de que una diferencia "se pierda" en el mes.

[3-WAY MATCH — 145-165 seg]
En almacén, el módulo de compras hace 3-way match:
orden de compra vs recepción vs factura del proveedor.
Si la cantidad facturada es mayor a la recibida, el sistema lanza alerta de posible fraude.

[CTA — 165-180 seg]
Control total de tu farmacia y caja — desde un solo sistema.
IntegriKa. integrika punto mx
```

### Video #4 — "ROI en 30 días" (60 seg)

```markdown
# Script Video #4: ROI en 30 días
Duración: 60 segundos (~150 palabras)

[HOOK — 0-8 seg]
El plan Profesional de IntegriKa cuesta $5,999 pesos al mes.
Y se paga solo antes de que termine la primera semana.

[NÚMEROS — 8-45 seg]
Un no-show evitado a la semana: $3,200 pesos al mes recuperados.
Reducción de robo hormiga en farmacia: otros $3,200.
Ahorro versus contratar una secretaria extra: $5,001 pesos al mes.
Citas recuperadas fuera de horario gracias al bot 24/7: $7,200 pesos más.

Total: $13,601 pesos al mes de retorno neto.
Con un plan de $5,999.

[CONTEXTO — 45-55 seg]
Huli, Mi-Consultorio y Medesk juntos no cubren estos módulos.
Y si los cubren, son add-ons con costo adicional.
IntegriKa los incluye todos. En un precio.

[CTA — 55-60 seg]
Calcula tu ROI en integrika punto mx
```

### Video #5 — "CFDI 4.0 sin dolores de cabeza" (90 seg)

```markdown
# Script Video #5: CFDI 4.0
Duración: 90 segundos (~225 palabras)

[HOOK — 0-10 seg]
Cada vez que un paciente con empresa te pide factura
y no puedes dársela — pierdes ese cliente para siempre.
Y al que sí le das factura manualmente, le cobras $50 o $100 extra de "trámite".

[PROBLEMA — 10-30 seg]
El CFDI 4.0 tiene nuevas reglas del SAT desde 2022:
régimen fiscal del receptor, código postal, uso del CFDI.
Sin sistema, cada factura es un dolor de cabeza.
Huli no tiene CFDI nativo. Mi-Consultorio lo tiene incompleto.
Medesk no cumple con los 4 motivos de cancelación del SAT.

[SOLUCIÓN — 30-70 seg]
IntegriKa tiene CFDI 4.0 nativo desde el primer día.
Timbrado directo con tu PAC — Facturama.
Cancelación con los 4 motivos SAT, acuse al receptor automático.
Complemento de Pagos 2.0 para pagos diferidos.
Factura Global para ventas de mostrador.
Tu certificado digital CSD guardado en Vault cifrado — nunca en texto claro.

Todo desde el mismo sistema donde hiciste la cita,
atendiste al paciente y surtiste el medicamento.
Sin contador intermediario. Sin costo adicional.

[STATS — 70-82 seg]
El plan Esencial de $2,499 ya incluye CFDI.
Vs. contratar un contador solo para facturación: $350 a $600 pesos al mes.

[CTA — 82-90 seg]
Factura en segundos desde IntegriKa.
integrika punto mx
```

- [ ] **Step 1: Guardar los 4 scripts en sus archivos**

Crear `video-02-demo-agenda.md`, `video-03-demo-farmacia.md`, `video-04-roi.md`, `video-05-cfdi.md` en `C:\Users\pablo\Desktop\integrika-videos\scripts\`

- [ ] **Step 2: Commit del plan + scripts**

```bash
cd C:/Users/pablo/clinica-mexico-spa
git add docs/superpowers/plans/2026-06-22-marketing-videos-elevenlabs-heygen.md
git commit -m "docs: plan implementación pipeline videos marketing ElevenLabs + HeyGen"
```

---

## Resumen de instalación

| Componente | Método | Estado |
|-----------|--------|--------|
| ElevenLabs MCP | npx `@elevenlabs/elevenlabs-mcp@latest` → `~/.claude.json` | Task 1 |
| HeyGen MCP | HTTP `https://mcp.heygen.com/mcp/v1/` → `claude mcp add` | Task 2 |
| OAuth HeyGen | Browser one-time login | Task 2 |
| Voz ES-MX | Selección desde librería ElevenLabs | Task 3 |
| Video #1 | Script → Audio → HeyGen render | Tasks 4-5 |
| Scripts #2-#5 | Escritos con datos reales de Pitch.tsx | Task 6 |

## Referencias

- ElevenLabs MCP: github.com/elevenlabs/elevenlabs-mcp
- HeyGen MCP Claude Code: developers.heygen.com/mcp/claude-code
- HeyGen blog: heygen.com/blog/generate-ai-videos-with-claude
- Datos pain points: `src/pages/Pitch.tsx` líneas 551-567
- ROI: `src/pages/Pitch.tsx` líneas 155-160
- Tabla competitiva: `src/pages/Pitch.tsx` líneas 142-153
