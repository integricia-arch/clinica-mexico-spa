# Plan: Bot Telegram agente-primero (producción, escalable)

**Fecha:** 2026-07-16
**Branch:** `feat/bot-agente`
**Objetivo:** El bot se cicla y no entiende conversación humana porque el LLM está
estrangulado por 5 capas de routing (regex → wizard → FAQ → clasificador Haiku → agente)
y el agente solo tiene 4 tools que no pueden actuar (solo muestran menús). Invertir la
arquitectura: agente con tools reales primero; regex solo para seguridad (urgencias,
conversación escalada, /comandos).

**Escrito para ejecutarse con modelos baratos (Haiku/Sonnet).** Cada task es chica,
dice qué archivos toca, qué reutiliza, y cómo se verifica. NO improvisar fuera del
alcance de la task. Si algo no cuadra con el código real: parar y reportar, no adivinar.

## Reglas para el ejecutor (leer antes de cada task)

1. Leer `CLAUDE.md` del repo — reglas duras de schema (`patients` sin `domicilio_ciudad`,
   `sexo` CHECK `'M'|'F'|'Otro'`, `verify_jwt=false` para telegram-webhook, Markdown
   con retry plain-text vía `telegramSendMessage()`).
2. Cada task termina con su verificación corrida y en verde. Task sin verificar = no hecha.
3. Commits convencionales (`feat:`, `fix:`, `test:`, `refactor:`), uno por task.
4. Edge function cambiada = desplegada Y commiteada (`supabase functions deploy telegram-webhook`).
5. SQL complejo: escribir a `_tmp_*.sql` y `supabase db query --linked --file archivo.sql`.
   Nunca SQL inline con `$function$`.
6. Toda función `SECURITY DEFINER` nueva: `SET search_path = public` + `REVOKE ... FROM PUBLIC`
   + grant mínimo (checklist completo en CLAUDE.md).
7. No tocar el flujo de consentimiento LFPDPPP ni el triage de urgencias salvo donde
   una task lo diga explícitamente.
8. Secretos reales NUNCA en archivos ni en el chat — el harness usa valores dummy.

## Estado actual (leído del código, no asumir otra cosa)

- `supabase/functions/telegram-webhook/index.ts` — 2,365 líneas, todo el bot.
- `supabase/functions/telegram-webhook/google-calendar.ts` — freebusy/eventos GCal (236 líneas, se queda igual).
- Router actual en `manejarMensaje()` (~línea 450): regex interceptores → gating escalada
  → triage → wizard steps → FAQ (`faq_buscar`) → clasificador Haiku (`clasificarIntentHaiku`)
  → agente (`correrAgente`).
- Agente: `ejecutarAgenteLoop()` (~línea 1863), `MAX_AGENT_ITERATIONS=8`, modelo
  `claude-sonnet-4-6`. Tools actuales: `mostrar_menu_principal`, `mostrar_menu_categorias`,
  `buscar_servicios`, `escalar_a_humano`. Ninguna agenda ni toma datos.
- Historial: `cargarHistorialParaAnthropic()` (~línea 2233) — solo `rol in (user, assistant)`
  de tabla `mensajes`. Tool calls y clicks de botones NO se guardan → el agente no ve sus
  propias acciones previas (causa directa del ciclado).
- Dedup: solo `processedCallbackIds` Set in-process (~línea 40). Telegram reintenta updates
  → duplicados entre isolates en prod.
- Lógica reutilizable que YA existe y funciona (no reescribir):
  `listarHorariosDisponibles()` (~1973), `crearCitaDesdeSesion()` (~1761),
  `normalizeSexo()` (~1753), parser fechas ES (`MESES_ES`/`inferirAño`, ~2279),
  wizard captura (~1474-1751), consentimiento (~1628), triage (`detectarUrgencia`,
  `triageLLM`, ~742), memoria paciente (`cargarMemoria`/`actualizarMemoria`),
  `telegramSendMessage()` con retry plain-text (~2245).
- Tablas usadas por el bot (confirmadas en `types.ts`): `appointments`,
  `identidades_canal`, `conversaciones`, `servicios`, `bot_sesiones`,
  `recordatorios_cita`, `mensajes`, `staff_link_codes`, `patients`,
  `doctor_servicios`, `staff_identidades_canal`, `consentimientos`,
  `clinic_settings`, `audit_logs`. RPCs: `faq_buscar`, `chat_registrar_pendiente`.
  OJO: varias nacieron vía Lovable sin migración local — verificar contra DB viva (Task 0.1).

---

## Fase 0 — Red de seguridad (sin esto, nada se puede cambiar con confianza)

### Task 0.1 — Introspección de schema del bot contra DB viva
- **Qué:** Verificar que TODAS las tablas/columnas que el código usa existen en la DB
  de producción (`kyfkvdyxpvpiacyymldc`), porque parte del schema nació vía Lovable sin
  migración local.
- **Cómo:** Escribir `_tmp_bot_schema_check.sql` que consulte `information_schema.columns`
  para las 14 tablas de arriba + columnas críticas que el código lee/escribe:
  - `conversaciones`: `status`, `prioridad`, `insiste`, `escalated_followup_count`,
    `last_patient_followup_at`, `last_bot_ack_at`, `motivo_resumen`, `dolor_intensidad`,
    `identidad_canal_id`
  - `bot_sesiones`: `flow_step`, `flow_data`, `servicio_id`, `conversacion_id`
  - `identidades_canal`: columna de memoria del paciente (buscar dónde persiste
    `cargarMemoria`/`actualizarMemoria` en el código y confirmar)
  - `mensajes`: `rol`, `contenido`, `conversacion_id`, `created_at`
  - RPCs `faq_buscar` y `chat_registrar_pendiente` en `information_schema.routines`
- Correr con `supabase db query --linked --file _tmp_bot_schema_check.sql`.
- **Output:** anotar faltantes en este doc (sección "Hallazgos 0.1" abajo). Si falta algo
  → migración en Task 0.3. Borrar el `_tmp_*.sql` al final.
- **Verificación:** query corre sin error; lista de faltantes documentada (puede ser vacía).

### Task 0.2 — Harness de simulación de conversaciones (local, sin tocar prod)
- **Qué:** Poder correr una conversación completa contra el bot LOCAL sin Telegram,
  sin Anthropic y sin Supabase reales. Es la única forma de que un modelo barato
  verifique que no rompió el routing.
- **Diseño:**
  1. En `index.ts`, hacer overridables por env las bases URL hardcodeadas
     (cambio mínimo, 2 constantes nuevas):
     ```ts
     const TELEGRAM_API_BASE  = Deno.env.get("TELEGRAM_API_BASE")  ?? "https://api.telegram.org";
     const ANTHROPIC_API_BASE = Deno.env.get("ANTHROPIC_API_BASE") ?? "https://api.anthropic.com";
     // SUPABASE_URL ya viene de env — no requiere cambio.
     ```
     Reemplazar todos los `https://api.telegram.org` y `https://api.anthropic.com`
     literales por estas constantes (grep primero: hay ~6 sitios).
  2. Crear `supabase/functions/telegram-webhook/test/stub-server.ts`: servidor Deno en
     puerto 9999 que atiende:
     - `POST /bot*/sendMessage`, `/bot*/answerCallbackQuery`, `/bot*/editMessageReplyMarkup`
       → captura el body en un array en memoria, responde `{ok:true}`.
     - `GET /captured` → devuelve y limpia los mensajes capturados (lo usa el runner).
     - `POST /v1/messages` (Anthropic stub) → si `body.model` empieza con `claude-haiku`
       responde `{content:[{type:"text",text:"otro"}]}` (clasificador/triage dicen "no");
       si no, responde end_turn con texto fijo `"[STUB-AGENTE]"`. Con env
       `RUN_REAL_LLM=1` el stub hace proxy al API real (usa la key real desde env del
       shell, nunca escrita en archivos).
     - `GET|POST|PATCH /rest/v1/*` y `/rest/v1/rpc/*` (PostgREST stub) → store en memoria
       (Map por tabla) con soporte mínimo: `insert` (devuelve fila con `id` uuid),
       `select` con `eq`/`in`/`order`/`limit`/`maybeSingle`/`single`, `update` con `eq`,
       `delete` con `eq`. RPCs devuelven `[]`. Seed inicial en
       `test/fixtures/seed.json`: 1 clínica settings, 2 servicios, 1 doctor activo con
       `doctor_servicios`. Suficiente para menús y wizard; NO replicar Postgres.
  3. Crear `supabase/functions/telegram-webhook/test/run-transcripts.ts`: lee
     `test/transcripts/*.json`, cada uno:
     ```json
     { "name": "saludo-muestra-menu",
       "steps": [
         { "send": { "text": "hola" },
           "expect": [ "asistente virtual", "men[uú]" ] },
         { "send": { "callback_data": "menu_agendar:" },
           "expect": [ "especialidad" ] } ] }
     ```
     `send.text` → arma update de Telegram (`message`), `send.callback_data` → arma
     `callback_query`. POSTea a `http://localhost:8000` con el header de secret token
     de Telegram con valor dummy `test-secret`. Espera 300ms, lee `/captured`,
     asserta que cada regex de `expect` matchea alguno de los mensajes capturados.
     Exit code ≠ 0 si falla.
  4. El runner lanza stub-server e index.ts como subprocesos con `Deno.Command`,
     inyectándoles env dummy (URLs → localhost:9999, token/keys/secret → valores
     dummy tipo "stub"). Un solo comando corre todo:
     `deno run --allow-net --allow-env --allow-run test/run-transcripts.ts`.
     Documentar en `test/README.md`.
- **Transcripts semilla (5):**
  1. `saludo-menu.json` — "hola" → bienvenida + menú.
  2. `agendar-directo.json` — "quiero una cita con dermatólogo mañana" → HOY: menú
     categorías (comportamiento actual, cambiará en Fase 3 a slots directos).
  3. `wizard-texto-libre.json` — llegar a paso de wizard y mandar texto libre → HOY:
     "Usa los botones" (cambiará en Fase 3).
  4. `despedida.json` — "gracias, es todo" → respuesta breve SIN menú.
  5. `urgencia.json` — "me duele el pecho y no puedo respirar" → mensaje de contención
     con 911 (este comportamiento NUNCA cambia).
- **Verificación:** los 5 transcripts pasan en verde contra el código actual (baseline).
  Los transcripts 2 y 3 documentan el comportamiento viejo y se ACTUALIZAN en Fase 3.

### Task 0.3 — Dedup persistente de updates de Telegram
- **Qué:** Telegram reintenta el webhook si no respondemos rápido; el Set in-process no
  sobrevive entre isolates → mensajes procesados doble en prod (agrava el ciclado).
- **Cómo:**
  1. Migración `supabase/migrations/<ts>_telegram_updates_dedup.sql`:
     ```sql
     CREATE TABLE IF NOT EXISTS telegram_updates (
       update_id bigint PRIMARY KEY,
       created_at timestamptz NOT NULL DEFAULT now()
     );
     ALTER TABLE telegram_updates ENABLE ROW LEVEL SECURITY;
     -- Sin policies: solo service_role escribe (el webhook). Nadie más lee.
     -- Limpieza: pg_cron diario borra > 48h (patrón idempotente: unschedule + schedule,
     -- ver CLAUDE.md sección pg_cron).
     ```
     Incluir aquí lo que haya salido faltante en Task 0.1.
  2. En `procesarUpdate()` (index.ts ~línea 391), como PRIMERA operación:
     `insert({ update_id: update.update_id })` — si el error es conflicto
     de PK (código `23505`), return silencioso (duplicado). Cualquier otro error: log y
     CONTINUAR procesando (dedup nunca tumba el bot).
  3. `supabase db push --linked` + deploy + commit.
- **Verificación:** harness manda el MISMO update (mismo `update_id`) 2 veces → el stub
  PostgREST simula el conflicto de PK → solo 1 respuesta capturada. En prod:
  `supabase db query --linked` confirma tabla existe. `get_advisors` security sin
  hallazgos nuevos (cuando MCP supabase esté conectado; si no, task pendiente anotada).

### Hallazgos 0.1 (corrida 2026-07-16)

- **`conversaciones.last_bot_ack_at` NO existe en prod** — el código la lee y escribe
  (throttle de mensajes durante escalada, index.ts ~517, ~527). El UPDATE falla
  silencioso → `lastAck` siempre 0 → el bot repite el aviso "Recepción ya fue
  notificada" en cada mensaje de insistencia. **Bug de ciclado confirmado en vivo.**
  Fix: agregar columna en la migración de Task 0.3.
- **`telegram_updates` no existe** — esperado, se crea en Task 0.3.
- `staff_link_codes` OK (PK es `code`, no `id` — falso positivo del check).
- RPCs `faq_buscar` y `chat_registrar_pendiente` existen.
- Todas las demás tablas/columnas del bot existen en prod.

### Hallazgo Task 0.2 (harness) — bug #1 del "se cicla" CORREGIDO

`ejecutarAgenteLoop` llamaba `supabase.rpc(...).catch(...)` — PostgrestBuilder NO
implementa `.catch` (solo `.then`) → TypeError síncrono → TODA respuesta del agente
a texto libre ≥10 chars se convertía en "Tuve un problema técnico. ¿Puedes repetirme
tu última frase?". El agente nunca podía contestar nada. Fix: `.then(undefined, ...)`.
Corregido, verificado con transcript `04-despedida`, desplegado a prod 2026-07-16.

### Estado Fase 0: COMPLETADA (2026-07-16)

- Task 0.1 ✓ (hallazgos arriba). Task 0.2 ✓ (harness 6/6 transcripts verdes, incluye
  fix del bug `.catch`). Task 0.3 ✓ (migración `20260716200000` aplicada y verificada
  viva: `telegram_updates` + `last_bot_ack_at` + pg_cron cleanup; dedup en
  `procesarUpdate` desplegado).
- Nota: historial de migraciones reparado (8 versiones marcadas applied; archivo
  duplicado `20260709000001_subscription_cancel_at` renombrado a `20260709000006`).

---

## Fase 1 — Partir el monolito (sin cambiar comportamiento)

### Task 1.1 — Extraer módulos de `index.ts` (2,365 líneas → archivos ≤400 líneas)
- `telegram.ts` — `telegramSendMessage`, `enviarTelegram`, `enviarTelegramConBotones`,
  `answerCallback`, `limpiarTeclado`, bases URL.
- `db.ts` — cliente supabase, `obtenerOCrearIdentidad`, `obtenerOCrearConversacion`,
  `obtenerSesion`/`upsertSesion`/`limpiarSesion`, `guardarMensaje*`, `registrarAudit`,
  `cargarHistorialParaAnthropic`.
- `triage.ts` — `detectarUrgencia`, `triageLLM`, `mensajeContencion`, regex crisis.
- `wizard.ts` — todo el wizard de captura + `crearCitaDesdeSesion` + `normalizeSexo`
  + parser de fechas.
- `horarios.ts` — `listarHorariosDisponibles`, `getServiciosConDoctorActivo`,
  `getCategoriasDisponibles`, slots + GCal.
- `agent.ts` — `SYSTEM_PROMPT_BASE`, `TOOLS`, `ejecutarAgenteLoop`, `ejecutarToolClaude`,
  `llamarClaude`, memoria.
- `router.ts` — `manejarMensaje`, `manejarCallback`, interceptores.
- `index.ts` queda: env, `Deno.serve`, `procesarUpdate`, imports.
- **Regla:** mover código VERBATIM, solo imports/exports nuevos. Cero cambios de lógica.
- **Verificación:** los 5 transcripts baseline pasan idénticos. `deno check index.ts` limpio.
  Deploy + prueba manual de humo en Telegram real (1 "hola").

---

## Fase 2 — Darle manos al agente (tools nuevas envolviendo código existente)

### Task 2.1 — Tool `listar_horarios`
- Envuelve `listarHorariosDisponibles()`. Input: `{ especialidad?, servicio_id?, texto_busqueda?, dias_adelante? }`.
  Si viene especialidad/texto, resolver servicio con la lógica de `buscarServicios` y si
  hay >1 candidato, mandar botones de servicios (flujo actual). Si hay servicio único:
  mandar slots como botones (reusar el formato de `enviarHorariosDeServicio`).
- Devuelve al agente resumen JSON: `{servicio, dias_con_slots: [...]}` para que pueda
  narrar ("tengo espacio mañana a las 10 o el jueves a las 4").
- **Verificación:** transcript nuevo `agente-horarios.json`; con stub, verifica que el
  tool ejecuta y manda botones. Con `RUN_REAL_LLM=1`, revisión humana de la narración.

### Task 2.2 — Tools de datos de paciente y cita (slot-filling conversacional)
- `guardar_datos_paciente` — input: `{ nombre?, apellidos?, fecha_nacimiento?, sexo?, telefono?, email?, alergias? }`.
  Persiste en `bot_sesiones.flow_data` (mismo lugar que el wizard). Valida con
  `normalizeSexo`, parser de fechas existente, y validaciones del wizard. Devuelve
  `{guardado: [...], faltan: [...]}` para que el agente pida SOLO lo que falta.
- `confirmar_cita` — input: `{ slot_key }`. Pre-condición server-side: datos mínimos
  completos + consentimiento. Si falta consentimiento → dispara `preguntarConsentimiento()`
  (botones, NO se salta). Si todo listo → `mostrarConfirmacion()` (botones await_confirm
  existentes). La creación real sigue pasando por `wizardConfirm`/`crearCitaDesdeSesion`
  — el agente NUNCA inserta la cita directo.
- `ver_mis_citas`, `cancelar_cita`, `reagendar_cita` — envuelven `verMiCita`,
  `iniciarCancelacionCita`, `iniciarReagendarCita`.
- `buscar_faq` — envuelve `buscarFaqTelegram` (deja de ser interceptor en Fase 3).
- **Regla dura:** el expediente (`patients` insert) solo se crea en `crearCitaDesdeSesion`
  con consentimiento registrado — igual que hoy.
- **Verificación:** transcript `agente-agenda-completo.json`: conversación libre da
  nombre+fecha+sexo en UNA frase → agente guarda todo, pide solo lo faltante, confirma
  con botones, stub registra insert en `patients` y `appointments`.

### Task 2.3 — System prompt v10
- Reescribir `SYSTEM_PROMPT_BASE`: ahora el agente ES el flujo principal. Documentar
  tools nuevas, cuándo usar botones vs texto, regla de "un dato a la vez si el usuario
  no los da juntos", nunca inventar horarios (solo los que devuelve `listar_horarios`),
  reglas médicas/urgencias intactas.
- **Verificación:** transcripts 1-5 + nuevos pasan; revisión humana de 3 conversaciones
  reales con `RUN_REAL_LLM=1`.

---

## Fase 3 — Invertir el router

### Task 3.1 — Quitar capas
- Borrar `clasificarIntentHaiku` y su llamada (Tier 2). Borrar `manejarConsultaLibre`
  + `PADECIMIENTO_MAP` (el agente orienta con su prompt). Borrar interceptores
  `esSaludo`/`pideHumano`/`pideNuevaConsulta` — el agente maneja saludos, escalada
  (tool existente) y reset.
- Quedan como interceptores SOLO: gating de conversación escalada, triage de urgencias,
  `/comandos` (`/start`, `/nueva`, `/humano`, `/vincular`, `/reagendar`), FAQ deja de
  interceptar (es tool).
- `/start` y `/nueva` conservan su comportamiento actual (reset + menú) — los botones
  siguen funcionando para quien los prefiera.
- **Verificación:** actualizar transcripts 2 y 3 al comportamiento nuevo
  (texto libre → agente agenda). Transcript 5 (urgencia) INTACTO.

### Task 3.2 — Wizard convive con agente
- En el router: si hay `flow_step` activo y llega texto libre que NO valida para ese
  paso, en vez de "Usa los botones": pasar al agente con contexto
  `"[WIZARD ACTIVO paso=X, datos={...}]"` en el system prompt. El agente puede
  (a) responder la duda y re-mostrar el paso, o (b) llenar el campo vía
  `guardar_datos_paciente` y avanzar.
- **Verificación:** transcript `wizard-pregunta-precio.json`: en medio del wizard
  pregunta "¿cuánto cuesta?" → responde precio y retoma el paso.

---

## Fase 4 — Historial fiel + antiloop

### Task 4.1 — Persistir acciones en el historial
- Guardar en `mensajes` (rol `assistant`) un resumen de cada tool ejecutado:
  `"[acción: mostró menú categorías]"`, `"[acción: mostró 6 horarios de Dermatología]"`.
- Guardar clicks de botones como mensaje `user`: `"[eligió: Dermatología]"` en
  `manejarCallback`.
- `cargarHistorialParaAnthropic` los incluye → el agente VE lo que ya pasó.
- **Verificación:** transcript `no-repite-menu.json`: dos mensajes ambiguos seguidos →
  el menú se manda máximo 1 vez.

### Task 4.2 — Guardia antiloop
- En `ejecutarAgenteLoop`: si el agente llama el mismo tool con el mismo input 2 veces
  en la misma corrida → inyectar tool_result de error "ya lo hiciste, responde con texto"
  y en la siguiente iteración forzar respuesta sin tools.
- **Verificación:** unit test del loop con stub Anthropic que intenta repetir tool.

---

## Fase 5 — Producción y escala

### Task 5.1 — Prompt caching
- `cache_control: {type:"ephemeral"}` en system prompt y tools en `llamarClaude`
  (~90% menos costo de input en conversaciones largas). Ver skill `claude-api` para
  sintaxis exacta antes de implementar.
- **Verificación:** log de `usage.cache_read_input_tokens > 0` en segunda llamada.

### Task 5.2 — Métricas mínimas
- Vista SQL `bot_metricas_diarias`: conversaciones, % escaladas, citas creadas con
  `source` telegram, expedientes nuevos vía bot. Consultable desde el panel existente.
- **Verificación:** query devuelve filas coherentes con datos de prueba.

### Task 5.3 — Cierre
- `get_advisors(security)` sin hallazgos nuevos (requiere MCP supabase conectado).
- Actualizar `memoria/STATE.md` + transcript suite completa en verde.
- Prueba manual: 3 conversaciones reales en Telegram (agendar de cero con expediente
  nuevo, reagendar, pregunta de precio en medio del wizard).

---

## Fase 6 — Configuración del bot desde el sistema (pedido de Pablo 2026-07-16)

Regla de identidad del bot (NO negociable, va en system prompt y en toda fase):
**el bot es de AGENDA y ATENCIÓN A CLIENTES — nunca diagnostica, nunca da consejo
médico, nunca pone en riesgo a un humano.** Ayuda a doctores y pacientes a agendar
y da buena atención. Ya está codificado en `SYSTEM_PROMPT_BASE` y triage; cada task
de esta fase lo preserva.

### Task 6.0 — Benchmark de bots exitosos (research, ANTES de diseñar 6.1)
- Investigar con WebSearch/WebFetch soluciones exitosas de bots de agenda y atención
  para salud, cosmetología, spa, salones de belleza: qué configuran (Calendly,
  Fresha, Booksy, Zenoti, SimplyBook, agentes WhatsApp de clínicas), qué campos de
  personalización exponen, cómo manejan recordatorios/no-shows/promociones/opt-in,
  y patrones de agentes LLM para booking (docs de Anthropic tool-use, artículos
  técnicos). Output: `docs/superpowers/specs/<fecha>-bot-config-benchmark.md` con
  tabla comparativa y lista de campos de configuración recomendados.
- **Verificación:** doc existe con ≥5 productos comparados y decisión de campos v1.

### Task 6.1 — Config del bot en `clinic_settings` (section `bot`)
- Nueva sección `bot` en `clinic_settings.data` (misma tabla/patrón que `horario`):
  `nombre_asistente`, `tono` (formal/cálido/casual), `mensaje_bienvenida`,
  `mensaje_despedida`, `instrucciones_extra` (texto libre que se anexa al system
  prompt, con sanitización: nunca puede anular reglas médicas/seguridad),
  `recordatorios` (horas antes de cita, ya hay `enviar-recordatorios`),
  `promociones_habilitadas` + texto de opt-in (LFPDPPP: opt-in activo, nunca
  pre-marcado — ver learnings en CLAUDE.md).
- El bot carga esta config al armar el system prompt (cache por invocación).
  Nombre de clínica, doctores, servicios y horarios YA salen de DB — no duplicar.
- **Verificación:** transcript con config custom en seed → bienvenida usa el nombre
  y tono configurados; instrucciones_extra maliciosas ("diagnostica") NO anulan
  reglas (test explícito).

### Task 6.2 — UI de configuración
- Página en `src/pages/configuracion/` (patrón de `ConfiguracionNotificaciones.tsx`)
  para editar la sección `bot`. Validación con esquema, preview del mensaje.
- **Verificación:** editar y guardar refleja en `clinic_settings`; el bot lo usa.

---

## Fase 7 — Analítica de conversaciones (pedido de Pablo 2026-07-16)

Aprender del uso real: qué quieren los usuarios, dónde se enojan, si están felices,
si aceptan promociones, tiempos de recordatorio efectivos, bugs y tendencias.

### Task 7.0 — Research previo
- Revisar artículos/manuales técnicos (conversation analytics, CSAT en chatbots,
  análisis de sentimiento con LLM batch, métricas de contact-center: containment
  rate, escalation rate, FCR) con WebSearch. Output breve en el mismo doc de 6.0.

### Task 7.1 — Tabla `conversacion_analisis`
- Migración: `conversacion_analisis` (1 fila por conversación cerrada):
  `conversacion_id` FK, `sentimiento` (positivo/neutral/negativo/enojado),
  `intencion_principal`, `intencion_cumplida` bool, `friccion` (texto corto: dónde
  se atoró), `queja` (nullable), `quiere` (qué pedía y no existe — feature requests),
  `posible_bug` (nullable — mensajes de error, loops detectados),
  `acepto_promociones` bool nullable, `duracion_minutos`, `mensajes_count`,
  `escalada` bool, `cita_creada` bool, `modelo` y `analizado_at`.
  RLS: solo staff de la clínica lee (patrón `clinic_memberships` existente).
- **Verificación:** migración aplicada + `get_advisors` limpio.
- ⚠️ Contenido de pacientes = dato sensible (LFPDPPP): el análisis guarda resúmenes
  cortos, NUNCA transcripciones completas duplicadas.

### Task 7.2 — Job de análisis batch (Haiku, barato)
- pg_cron nocturno → Edge Function `analizar-conversaciones`: toma conversaciones
  con `last_message_at` > 12h sin fila en `conversacion_analisis`, manda historial
  a Haiku con prompt de extracción JSON (sentimiento, fricción, queja, etc.),
  inserta. Reusa el patrón de `actualizarMemoria` (ya usa Haiku para resumir).
- **Verificación:** correr manual contra 5 conversaciones reales; filas coherentes.

### Task 7.3 — Panel de tendencias
- Página BI (patrón `useBI.ts`): tendencias semanales de sentimiento, top fricciones,
  top "quiere", % contención (resueltas sin humano), % citas creadas, aceptación de
  promociones, efectividad de recordatorios (recordatorio → cita confirmada vs no-show
  usando `recordatorios_cita` + `appointments.status`).
- **Verificación:** panel carga con datos reales; números cuadran con queries manuales.

---

## Puente WhatsApp + n8n (siguiente proyecto, diseñar PARA ello desde ya)

- Todas las tools nuevas de Fase 2 se escriben transport-agnostic: reciben
  `conv` + callbacks de envío, sin asumir Telegram (los botones inline son la única
  parte Telegram-specific — se aísla en `telegram.ts` en Fase 1).
- `whatsapp-webhook` ya existe como función aparte; portar = reusar `agent.ts` +
  tools con adaptador de WhatsApp (listas/botones de WhatsApp Business API).
- n8n puede orquestar recordatorios/promociones/follow-ups consumiendo las mismas
  tablas (`conversacion_analisis`, `recordatorios_cita`) — no acoplar nada del bot
  a n8n directamente; la frontera es la DB.

---

## Qué NO vamos a hacer (y por qué)

- **WhatsApp**: `whatsapp-webhook` es función aparte; portar el patrón agente-primero
  es proyecto posterior (mismas tools, otro transporte).
- **Multi-clínica en el bot**: `CLINIC_ID` sigue siendo env de la función. SaaS
  multi-tenant del bot = fase futura.
- **Voz/audio**: fuera de alcance.
- **Reescribir wizard de botones**: se queda como camino alterno — usuarios que
  clickean botones no deben perder nada.
- **Cambiar de modelo runtime**: Sonnet (agente) + Haiku (memoria/triage) se quedan;
  caching los abarata. No experimentar con modelos en este plan.

## Decisiones tomadas (no re-litigar)

- El agente NUNCA inserta directo en `patients`/`appointments`; siempre vía
  `crearCitaDesdeSesion` con consentimiento y confirmación por botones.
- Urgencias y conversación escalada SIEMPRE interceptan antes del agente.
- Estado conversacional vive en `bot_sesiones.flow_data` (no en el prompt) — fuente
  de verdad única compartida entre wizard y agente.
