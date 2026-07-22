# clinica-mexico-spa — Project Guardrails

Integriclinica appointment system. Supabase backend + Telegram bot (`supabase/functions/telegram-webhook`).
Prod project ref: **kyfkvdyxpvpiacyymldc**.

> Read this before touching the bot or patient/appointment data. These rules encode
> bugs already fixed in production — re-introducing them will silently break booking.

## Database schema invariants (DO NOT regress)

### `patients` table
- **No `domicilio_ciudad` column.** Address is decomposed across:
  `direccion`, `colonia`, `municipio`, `estado`, `codigo_postal`.
  Map any city/locality input to **`municipio`** on insert.
- **`sexo` has a CHECK constraint: only `'M'`, `'F'`, `'Otro'`.**
  Never insert Spanish words (`femenino`/`masculino`). Always pass values
  through `normalizeSexo()` before insert.

### `appointments` table
- Multi-channel booking source (Telegram, web, etc.). Preserve source tracking.

### Identity linking
- Telegram users link to patient records via the `identidad_canal` table.
  A new Telegram user has `patient_id = null` until a patient row is created and linked.

## Telegram webhook rules

- **`verify_jwt = false`** for `telegram-webhook` in `supabase/config.toml`.
  Telegram callbacks carry no Supabase JWT; leaving it on returns 401 and the bot goes dead.
- **Never send Telegram messages with raw Markdown only.** Use `telegramSendMessage()`,
  which retries as plain text on a 400. Malformed entities in dynamic values (names,
  dates, error strings) otherwise silently mute the bot — no error reaches the user.
- Booking flow is a multi-step wizard. State lives in `bot_sesiones.flow_data`;
  steps end at `await_confirm`. Don't drop intermediate state on errors — surface them.

## Workflow

- Edge function changes must be **deployed AND committed**. A live-in-prod but
  uncommitted function is the #1 risk here — git must mirror deployed code.
- Conventional commit messages (`fix:`, `feat:`, ...).
- Validate user input at boundaries (names, surnames, birthdate year inference,
  Spanish characters) before persisting.

## Secrets

- Supabase service role key and Telegram bot token are **env-only**. Never commit.
- If a Supabase access token is exposed during debugging, **revoke and rotate it**.

## Checklist obligatorio — toda función `SECURITY DEFINER` nueva (learned 2026-07-04)

Auditoría de seguridad (`get_advisors`) encontró múltiples funciones `SECURITY DEFINER`
en producción sin ningún control de acceso — la peor (`cfdi_get_secret`,
`doctor_calendar_get_token`, etc.) era llamable con la anon key pública SIN LOGIN
y leía secretos del vault / tokens OAuth por UUID. Ver
`memoria/proyectos/seguridad-auditoria-supabase-2026-07-04.md` para el detalle completo.

Toda migración que cree o reemplace una función `SECURITY DEFINER` DEBE incluir,
en el mismo archivo:

1. `SET search_path = public` (o el schema que corresponda) en la firma de la función.
2. `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC;` explícito, seguido de
   `GRANT EXECUTE ... TO <rol mínimo necesario>` (`authenticated`, o `service_role`
   si solo la llaman Edge Functions — nunca dejar el grant default implícito).
3. Si la función toca datos multi-tenant: check de `clinic_memberships`/`auth.uid()`
   como PRIMERA operación del body, antes de cualquier lectura/escritura.
4. Vistas nuevas sobre datos multi-tenant: `security_invoker = on` por default.
5. Nunca `USING (true)` en una policy RLS salvo tabla explícitamente pública
   (documentar el motivo en comentario SQL arriba de la policy).

Correr `mcp__supabase__get_advisors(type="security")` después de cualquier tanda
de migraciones nuevas — ya es recomendación oficial de Supabase MCP, formalizado
aquí como hábito de este proyecto.

## Vault secrets — regla de seguridad (learned 2026-06-21)

**NUNCA** hacer `SELECT decrypted_secret FROM vault.decrypted_secrets` y mostrar el resultado en output/logs.

Usar el secret **inline** en la query que lo necesita — el valor se usa pero nunca sale del motor:

```sql
-- CORRECTO: secret nunca visible en output
SELECT net.http_post(
  url := 'https://...supabase.co/functions/v1/mi-funcion',
  headers := jsonb_build_object(
    'Authorization', 'Bearer ' || (
      SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'mi_secret'
    )
  ),
  body := '{}'::jsonb
);

-- MAL: expone el secret en plaintext
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'mi_secret';
-- → luego usarlo manualmente en otra query
```

Si un secret ya apareció en output de sesión: evaluar si rotar (depende del blast radius del secret).

---

## Lovable Security Fix Protocol

### El problema

Lovable aplica fixes de seguridad automáticamente (ej. `throw new Error()` en `src/integrations/supabase/client.ts` si `VITE_*` vars son undefined). Si GitHub Actions no tiene esos secrets configurados, el siguiente deploy bake `undefined` en el bundle → React no monta → **site en blanco**.

### Síntoma

- Cambio en Lovable mergeado a `main`
- GitHub Actions deploy completa sin error
- `https://integrika.mx` muestra pantalla en blanco
- DevTools: error tipo `Error: VITE_SUPABASE_URL is not defined` antes de que React monte

### Diagnóstico rápido

```powershell
# Ver el último Worker desplegado
wrangler tail clinica-mexico-spa --format pretty

# O build local para ver si el error es de env vars
cd C:\Users\pablo\clinica-mexico-spa
npm run build 2>&1 | head -20
```

Si el build local pasa pero el site está en blanco → el problema está en CI (secrets faltantes).

### Fix inmediato (deploy manual)

```powershell
cd C:\Users\pablo\clinica-mexico-spa
git pull origin main
npm run build:all      # vite build + manual-site (Docusaurus) + copia a dist/manual; requiere .env con las 3 VITE_* vars
wrangler deploy
```

Requiere `.env` local con:
```
VITE_SUPABASE_URL="https://kyfkvdyxpvpiacyymldc.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOi..."
VITE_SUPABASE_PROJECT_ID="kyfkvdyxpvpiacyymldc"
```

Ver valores completos en `.claude/project-context.md`.

### Fix permanente (GitHub Actions secrets)

Configurar en: **Settings → Secrets → Actions** del repo GitHub.

Secrets requeridos:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_TURNSTILE_SITE_KEY` (opcional — captcha login, ver sección Captcha abajo)

Una vez configurados, los deploys automáticos de Lovable funcionarán sin intervención.

### Captcha en login (Cloudflare Turnstile) <!-- /aprende 2026-06-16 -->

Login por correo/contraseña usa Turnstile (`@marsidev/react-turnstile` en `Login.tsx`). El botón Google **no** lleva captcha — OAuth ya filtra bots.

Setup manual requerido (no automatizable desde el agente, requiere acceso a dashboards externos):
1. Cloudflare dashboard → Turnstile → crear site → copiar **site key** (pública) y **secret key**.
2. `VITE_TURNSTILE_SITE_KEY` en `.env` local y en GitHub Actions secrets (deploy).
3. Supabase dashboard → Authentication → Settings → Bot and Abuse Protection → habilitar, provider Turnstile, pegar **secret key**. Supabase valida el token server-side — nunca se escribe lógica de verificación propia.

Si `VITE_TURNSTILE_SITE_KEY` no está configurada, el login funciona igual sin captcha (graceful degrade) — útil en desarrollo local.

### Manual de usuario + portal público (`/manual`) <!-- /aprende 2026-06-16 -->

Dos capas, una sola fuente de contenido (`docs/manual-usuario/*.md`):

1. **Botón "?" en la app** (`src/components/ManualButton.tsx`): modal ligero, carga el `.md` crudo via `import.meta.glob`, resuelve qué manual mostrar según la ruta activa contra la tabla `manual_paginas`. Registra cada apertura en `manual_consultas` (analítica de fricción).
2. **Portal público** (`manual-site/`, Docusaurus): sitio estático independiente, build propio (`npm run build --prefix manual-site`), output copiado a `dist/manual/` (`scripts/copy-manual-build.cjs`) para que el mismo Worker de Cloudflare lo sirva en `integrika.mx/manual` (Workers Assets resuelve archivos estáticos exactos antes del fallback SPA — sin necesidad de un segundo proyecto/dominio Cloudflare).

**Build de producción siempre usa `npm run build:all`**, no `npm run build` a secas — si solo se corre `vite build`, `/manual` queda con el contenido viejo (`dist/manual` no se regenera).

**Agregar un manual nuevo:**
1. Copiar `docs/manual-usuario/_TEMPLATE.md` → `<slug>.md`.
2. Insertar fila en `manual_paginas` (ruta, slug, titulo, modulo) — esto activa el botón "?" automáticamente.
3. En `manual-site/src/components/HomepageFeatures/index.tsx`, cambiar `ready: false → true` para ese slug (si no, el build de Docusaurus falla por link roto a un doc inexistente).

**Chat de ayuda ("hablar con humano"):** IMPLEMENTADO completo (verificado 2026-07-21). `HelpChatWidget.tsx` (usuario, montado global en `AppLayout.tsx`) + `AyudaInterna.tsx` en `/ayuda-interna` (staff: panel sesiones tomar/cerrar/responder + base de conocimiento FAQ con candidatos aprendidos) + edge function `help-chat-ai` (Claude Haiku vía API, 3 tiers: saludo hardcoded → FAQ DB → Claude, auto-escala a humano por keyword/máx-3-mensajes-IA/error, rate-limited 30/h·user). Tablas `ayuda_chat_sesiones`/`ayuda_chat_mensajes` en uso real, no solo esquema.

### Regla general post-Lovable

Después de cualquier mensaje de seguridad en Lovable (especialmente en `src/integrations/supabase/client.ts`):

1. Verificar `https://integrika.mx` inmediatamente después del merge
2. Si blanco → ejecutar fix inmediato (arriba)
3. Si se repite → configurar GitHub secrets (fix permanente)

---

## Pendientes de desarrollo prioritarios <!-- /aprende 2026-06-08 -->

### Corte de caja (Opción B — aprobada)
Implementar en este orden:
1. **Conteo ciego** — ShiftPanel pide conteo físico ANTES de mostrar el esperado
2. **Folio SEQUENCE + auto-generar corte Z** en tabla `cortes` al cerrar turno farmacia
3. **Umbral de diferencia** configurable por clínica → bloquea si |diff| > umbral hasta firma supervisor
4. **Egresos/Ingresos del fondo** durante turno (nueva tabla + UI)
5. **Corte X** intra-turno sin cerrar
6. Extender `turnos` generales con reconciliación (cajeros no-farmacia)

Ver memoria: `project_corte-caja-arquitectura.md`

### SQL complejo con supabase CLI <!-- /aprende 2026-06-08 -->
- **Nunca** pasar SQL con `$function$` inline: `supabase db query --linked "..."` falla
- **Siempre** escribir a `_tmp_*.sql` y usar: `supabase db query --linked --file archivo.sql`

## Contexto de proyecto (credenciales)

Ver `.claude/project-context.md` — IDs de Cloudflare, Supabase URLs, rutas, pendientes de desarrollo.
El archivo está gitignoreado (`.claude/` en `.gitignore`).

---

## Memoria del proyecto (Obsidian vault)

Esta carpeta ES el vault de Obsidian. Toda la memoria persistente del proyecto vive en `memoria/`.

**Usar la skill `session-sync`** (`.claude/skills/session-sync/SKILL.md`) para el checklist completo de inicio/cierre de sesión — evita que STATE.md, git y graphify-out se desincronicen y evita gastar tokens de más explorando lo que STATE.md ya dice.

**NO cerrar sesión ni hacer commit sin actualizar STATE.md primero.**

### Estructura
```
memoria/
├── STATE.md              # estado vivo del proyecto (actualizar cada sesión)
├── proyectos/            # notas por módulo/proyecto
├── conceptos/            # decisiones técnicas, patrones, reglas de negocio
├── referencias/          # info externa (APIs, docs, etc.)
└── diario/               # notas por sesión (YYYY-MM-DD.md)
```

### Convenciones
- Usar `[[wikilinks]]` para conectar notas
- Una decisión/concepto por nota en `conceptos/`
- `STATE.md` = verdad actual (siempre al día)

## Learnings (added by /aprende 2026-06-09)

### Responsive / Tailwind
- Tailwind breakpoints: sm=640 md=768 **lg=1024** **xl=1280** 2xl=1536. Para "desktop ≥1280px" usar `xl:`, NO `lg:`. <!-- /aprende 2026-06-09 -->
- AppLayout.tsx ya tiene sidebar drawer (`sidebarOpen` state, `lg:hidden`). Para tablet-responsive solo cambiar `lg:` → `xl:` en 4 lugares. NO reconstruir desde cero. <!-- /aprende 2026-06-09 -->
- POS grid en PuntoDeVenta.tsx usa `lg:grid-cols-[220px_1fr_360px]` — INCORRECTO para tablet. Cambiar a `xl:` (Task 4 del plan farmacia-responsive). <!-- /aprende 2026-06-09 -->

### Formularios
- Hook `useFieldErrors` en `src/hooks/useFieldErrors.ts`. Inputs requeridos deben tener `id="field-{nombre}"`. Ver reference_usefielderrors-hook.md. <!-- /aprende 2026-06-09 -->

### Diseño pendiente
- Plan farmacia responsive: `docs/superpowers/plans/2026-06-09-farmacia-responsive.md` — 11 tasks, NO ejecutado. Empezar en Task 1 (useIsTablet). Branch: `feat/pos-criticos-iva-devoluciones`. <!-- /aprende 2026-06-09 -->

## Learnings (added by /aprende 2026-06-21)

### Supabase Edge Functions
- `console.log`/`console.error` internos NO aparecen en ningún log del Dashboard — solo logs de acceso HTTP. Para depurar: `console.error("[Módulo]", id, e)` + persistir error en DB (ej. `gcal_last_error`). Nunca `catch{}` vacío. <!-- /aprende 2026-06-21 -->
- `(async()=>{})()` fire-and-forget es matado por Deno cuando el handler retorna. Solo el trabajo en `EdgeRuntime.waitUntil(promise)` o en `await` directo garantiza completar. Buscar `(async` + `})()` en Edge Functions — cada uno es bug latente. <!-- /aprende 2026-06-21 -->
- `supabase functions logs <nombre>` no existe como subcommand CLI. Debug de lógica interna: `SELECT net.http_post(...)` desde SQL → leer `net._http_response` (columnas: `status_code`, `content` — NO `status`). <!-- /aprende 2026-06-21 -->

### PostgREST
- Filtros embedded de 2 niveles (`tabla.join1.join2.campo`) devuelven `[]` vacío SIN error en producción. Max 1 nivel: desde `doctor_servicios` con `.eq("doctors.activo", true)`, no desde `servicios` con `.eq("doctor_servicios.doctors.activo", true)`. <!-- /aprende 2026-06-21 -->

### Google Calendar (Supabase + GCP)
- OAuth puede conectar y guardar tokens sin error aunque `calendar-json.googleapis.com` esté deshabilitada en GCP. El 403 solo aparece al primer API call real. Al conectar un doctor nuevo, verificar que la API esté habilitada en GCP proyecto 545467181522. <!-- /aprende 2026-06-21 -->

### Bot Telegram
- `esSaludo()` debe llamar `limpiarSesion()` + `enviarMenuPrincipal()` + `return` **siempre**, sin condición `enWizard`. Cualquier condicional permite al agente LLM ser invocado con sesión activa y disparar menús duplicados. <!-- /aprende 2026-06-21 -->

---

## Edge Functions con verify_jwt=false

Nine functions disable JWT verification in `supabase/config.toml` and implement alternative auth.  
**Full audit:** See `docs/edge-functions-auth.md`

| Función | Auth alternativa | Estado |
|---------|-----------------|--------|
| telegram-webhook | X-Telegram-Bot-Api-Secret-Token header | ✅ Implementado |
| stripe-webhook | X-Stripe-Signature (HMAC-SHA256) | ✅ Implementado |
| stripe-checkout | Público — montos server-side, sin secretos | ✅ Aceptable |
| enviar-recordatorios | Bearer (service_role o JWT usuario) | ✅ Implementado |
| notify-cxp-vencimiento | Bearer NOTIFY_CXP_CRON_SECRET | ✅ Implementado |
| auto-reorder | Bearer AUTO_REORDER_CRON_SECRET | ✅ Implementado |
| cfdi-parse | Bearer + supabase.auth.getUser() | ✅ Implementado (Jun 21) |
| confirmar-cita | Bearer + supabase.auth.getUser() | ✅ Implementado |
| google-oauth-callback | OAuth 2.0 state param (base64 doctorId:clinicId) | ⚠️ Enrutamiento, no auth — OAuth exchange valida el `code` |

---

## Supabase CLI + Migrations (learnings Jun 21, 2026) <!-- /aprende 2026-06-21 -->

### Syntax SQL NO soportada en PostgreSQL (causa error en `supabase db push`)

- `CREATE POLICY IF NOT EXISTS "name" ON t` → **NO EXISTE** en ninguna versión PG. Fix: `DROP POLICY IF EXISTS "name" ON t;` + `CREATE POLICY "name" ON t`.
- `ALTER TABLE t ADD CONSTRAINT IF NOT EXISTS name` → **NO EXISTE**. Fix: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='name') THEN ALTER TABLE t ADD CONSTRAINT name ...; END IF; END $$;`
- `CREATE INDEX CONCURRENTLY` vía CLI → falla siempre (CLI usa pipeline/transacción). Fix: quitar CONCURRENTLY, usar `CREATE INDEX IF NOT EXISTS` dentro de `BEGIN/COMMIT`. Para tablas pequeñas el lock es imperceptible.

### Historial de migrations Lovable vs CLI

Lovable aplica migrations directamente a la DB sin pasar por el CLI. Resultado: historial diverge. Pasos para reparar:

1. `supabase migration list --linked` — identificar entradas remotas sin archivo local y locales sin registro remoto
2. `supabase migration repair --status reverted <version>` — eliminar del historial las entradas remotas sin archivo local (Lovable-only)
3. `supabase migration repair --status applied <version>` — marcar como ya aplicadas las migraciones locales que ya están en la DB sin haber pasado por CLI
4. Versiones con formato corto (8 dígitos, ej. `20260602`) → CLI nunca las empareja bien. **Mover a `supabase/scripts/`** y marcar como reverted.

### Comando para push out-of-order

Cuando hay migrations con timestamps anteriores al último registrado en la DB, usar:
```bash
supabase db push --linked --include-all
```
Sin `--include-all` el CLI rechaza migrations "fuera de orden". El trigger específico: timestamps de nuevas migrations intercalados entre timestamps ya registrados en el historial remoto. <!-- /aprende 2026-06-24 -->

### Renombrar una policy requiere DROP de AMBOS nombres <!-- /aprende 2026-06-24 -->

Al renombrar `"policy_old_name"` → `"policy_new_name"` en una migration, incluir DROP IF EXISTS de los dos nombres:

```sql
DROP POLICY IF EXISTS "policy_old_name" ON tabla;
DROP POLICY IF EXISTS "policy_new_name" ON tabla;
CREATE POLICY "policy_new_name" ON tabla ...;
```

Sin DROP del nuevo nombre, una migration re-aplicada falla con "already exists" aunque el nombre viejo ya no exista.

### Migration parcialmente aplicada → repair + re-push <!-- /aprende 2026-06-24 -->

Cuando `supabase db push` falla con `ERROR: policy "X" already exists`:
1. `supabase migration repair --status reverted <version>` — limpia el historial
2. Agregar `DROP POLICY IF EXISTS` al inicio de la migration (hacerla idempotente)
3. `supabase db push --linked` — re-aplica limpio

---

## Schema Drift — Mapeo de columnas reales (learnings Jun 22, 2026) <!-- /aprende 2026-06-22 -->

Columnas frecuentemente asumidas con nombres incorrectos. Siempre verificar contra `types.ts` generado.

### Tabla `patients`
- `apellidos` (no `apellido_paterno` / `apellido_materno`)
- `sexo` CHECK constraint: solo `'M'`, `'F'`, `'Otro'`

### Tabla `appointments`
- `motivo_consulta` (no `motivo`)
- `appointment_status` enum: NO incluye `"no_show"` — comparar con `(status as string) === "no_show"`

### Tabla `prescriptions`
- `prescription_number` (no `numero_receta`)
- `diagnosis` (no `diagnostico`)

### Tabla `recepciones_mercancia`
- `folio_recepcion` (no `folio`)

### Tabla `solicitudes_compra`
- `motivo` (no `descripcion`)

### Interface `ClinicLite` (useActiveClinic.tsx)
- `.name` (no `.nombre`) para nombre de clínica

### Tablas NO en `types.ts` → usar `untypedTable()`
`expediente_permissions`, `ordenes_compra_items`, `recepciones_items`, `recepciones_mercancia`, `facturas_proveedor`, `cfdi_config` (esta SÍ está — acceso directo).

### Cast anti-patrón prohibido
`supabase.from("x" as never) as ReturnType<typeof supabase.from>` — NUNCA usar. Rompe cuando types.ts está correcto.

---

## Módulo Fidelización — Learnings (added by /aprende 2026-06-24)

### Normalizar teléfono a E.164 en registro POS <!-- /aprende 2026-06-24 -->
- loyalty_members.telefono debe almacenar `+52XXXXXXXXXX` (E.164), nunca 10 dígitos raw.
- Supabase Auth almacena `auth.users.phone` siempre en E.164. Sin normalización, `telefono = auth.users.phone` nunca coincide y el wallet PWA devuelve vacío.
- Normalizar en el punto de inserción (registro POS) antes de cualquier `INSERT INTO loyalty_members`.

### LFPDPPP Art. 8 — consentimiento activo (opt-in) <!-- /aprende 2026-06-24 -->
- Checkboxes de consentimiento LFPDPPP deben: iniciar desmarcados, ser interactivos (nunca `disabled`), Submit bloqueado hasta check activo.
- Pre-checked + disabled = consentimiento inválido = violación legal en México.

### RLS PWA: USING(true) es agujero de seguridad en multi-tenant <!-- /aprende 2026-06-24 -->
- `FOR SELECT TO authenticated USING(true)` expone TODAS las filas a cualquier usuario con token.
- Scopear siempre: `USING(telefono = (SELECT phone FROM auth.users WHERE id = auth.uid()))`.
- Auditar todos los DML del cliente PWA al diseñar RLS — SELECT-only no cubre UPDATE (ARCO consent revocation).

### RPCs SECURITY DEFINER <!-- /aprende 2026-06-24 -->
- Todas las RPCs con `SECURITY DEFINER` deben incluir `SET search_path = public` para prevenir schema poisoning.
- RPCs internas (ej. `loyalty_recalculate_level`) que solo se llaman desde otras RPCs: `REVOKE EXECUTE ON FUNCTION nombre FROM PUBLIC` para prevenir llamadas directas del cliente.

### pg_cron: scheduling idempotente <!-- /aprende 2026-06-24 -->
```sql
SELECT cron.unschedule('nombre-job');  -- primero, aunque no exista
SELECT cron.schedule('nombre-job', '0 2 * * *', $$ ... $$);
```
Sin `unschedule` previo, re-aplicar la migration crea jobs duplicados.

---

## Learnings (added by /aprende 2026-06-28)

### BI: tasaRetencion mide frecuencia intra-período, NO retención cross-período <!-- /aprende 2026-06-28 -->
- La métrica `tasaRetencion` en `useBI.ts` cuenta % de pacientes con ≥2 citas **dentro del período seleccionado** (no pacientes que regresan en un período siguiente).
- Label "Retención ≤90d" era semánticamente incorrecto — implica cross-período.
- Fix correcto: renombrar label a "Pac. frecuentes" con suffix "≥2 citas/período". La lógica de cálculo no requiere cambio.
- Si se quiere retención real (cross-período), es una métrica diferente: pacientes con cita en período N que también tuvieron cita en período N-1.

## Learnings (added by /aprende 2026-07-04)

### Una sola librería de animación: `motion`, NUNCA `framer-motion` directo <!-- /aprende 2026-07-04 -->
`https://integrika.mx/pitch` quedó en pantalla en blanco en producción por
`TypeError: e is not a function`. Causa: `Pitch.tsx` importaba `framer-motion`
(dependencia directa v11.18.2) mientras el resto de la app (lealtad, PWA) usa
`motion` (v12.40.0, que trae su propia copia interna de framer-motion). Como
`Pitch.tsx` no está lazy-loaded, ambas versiones terminaban en el mismo chunk
JS de producción y chocaban en runtime (solo se reproduce en build minificado,
`vite dev` no lo muestra). Fix: `import { motion, useInView } from "motion/react"`
(re-exporta la misma API), nunca `from "framer-motion"`. La dependencia
`framer-motion` fue removida de `package.json`.
**Regla:** cualquier componente nuevo con animaciones usa `motion/react`.
Si `npm ls framer-motion` alguna vez muestra más de una copia, es señal de
regresión — investigar antes de mergear.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Módulo Contable (Fases 1-9, CERRADO 2026-07-19)

Ver `memoria/proyectos/modulo-contable-memoria-tecnica.md` para fórmulas exactas y guía de auditoría de números. Dos sistemas coexisten a propósito: devengo simple (fases 1-4, alimenta KPIs/dashboard) y partida doble clásica (fases 6C-8, alimenta reportes formales). No están sincronizados automáticamente — ver sección 9 de la memoria técnica.

**Tablas — devengo simple (fases 1-4):**
- `appointment_insumos` (id, appointment_id, insumo_id, cantidad, costo_unitario_centavos snapshot, tipo: consumo/reversa) — log de movimientos de insumos, descuenta stock vía RPCs.
- `cuentas_contables` (codigo, nombre, tipo: ingreso/egreso, es_fijo, **naturaleza: deudora/acreedora** agregada en fase 6C) — catálogo simple (no SAT implementado aún).
- `movimientos_contables` (clinic_id, cuenta_id, origen: manual/consulta/farmacia/compra/honorario, monto_centavos, fecha_devengo, fecha_pago, reference_type/id, evento: devengo/cancelacion) — append-only devengo.
- `doctor_honorarios_config` (doctor_id, tipo: porcentaje/fijo_por_consulta, valor, vigente_desde) — histórico sin UPDATE destructivo.

**Tablas — partida doble (fases 6C-8):**
- `polizas`/`poliza_partidas`/`poliza_folios` — asientos formales debe=haber, folio autonumérico por clínica+tipo. Escritura SOLO vía `crear_poliza()`/`cancelar_poliza()`.
- `contab_cierres` — marca período cerrado (fase 7); `contab_estados_cuenta` — líneas de banco importadas para conciliación (fase 8).

**RPCs — devengo simple:** `registrar_insumos_cita(appointment_id, items)` — inserta appointment_insumos + descuenta stock (transaccional); `kpis_dashboard(clinic_id, fecha_inicio, fecha_fin)` — retorna P&L y KPIs.

**RPCs — partida doble:** `crear_poliza(payload jsonb)` — valida balance debe=haber, candado de período, idempotencia; `cancelar_poliza(poliza_id)` — reversa, no borra; `cierre_mensual(clinic_id, periodo)` — cierra mes, genera póliza de cierre a cuenta 305; `balanza_comprobacion`/`libro_diario`/`auxiliares_cuenta`/`estado_resultados`/`balance_general(clinic_id, ...)` — reportes en vivo; `contab_importar_estado_cuenta`/`contab_matching_bancario`/`contab_conciliar_linea`/`contab_desconciliar_linea` — conciliación bancaria (fase 8).

**Reglas duras:**
- `appointment_insumos` es el log de insumos, NO `movimientos_inventario` (que es solo medicamentos).
- Escritura de insumos/movimientos/egresos/pólizas: **SOLO vía RPCs SECURITY DEFINER** (policies deniegan DML directo).
- `movimientos_contables` y `polizas`/`poliza_partidas` son append-only; cancelaciones son reversas, no DELETE.
- Idempotencia por `(reference_type, reference_id, evento)` en ambos sistemas.
- Candado de período (fase 7): `crear_poliza()` rechaza fecha en mes ya cerrado en `contab_cierres`.
- Cron contab-devengar-honorarios: 8:30 UTC diario.
- **Limitación conocida:** costo de ventas NO incluye costo de medicamentos (farmacia) — solo insumos clínicos.
- **IVA (fase 9):** `cuentas_contables.iva_tratamiento`/`iva_tasa_pct` configurable por cuenta de ingreso (arranca `sin_configurar` — nunca asumir exento/gravado). `contab_generar_poliza_evento()` genera póliza de 3 líneas (cargo Caja / abono Ingreso subtotal / abono IVA trasladado cuenta `209`) cuando la cuenta destino está gravada. RPC `reporte_iva()` = trasladado (209) − acreditable (118, ya existente desde fase 6B). Exportador Anexo 24 (`exportAnexo24.ts`) genera XML **sin firmar** (nunca tocar e.firma) leyendo RFC/régimen de `cfdi_config` (ya existente en `/configuracion/facturacion`, no duplicar). Régimen fiscal (general/RESICO) es solo metadato — el mecanismo de IVA es idéntico en ambos.
- **Control de activos fijos: investigado, NO implementado.** Ver `memoria/proyectos/modulo-contable-memoria-tecnica.md` §11 — tasas LISR Art. 34, campos sugeridos para `activos_fijos`. Requiere confirmar tasa fiscal de equipo médico con el contador antes de construir.

**Vistas:** `pnl_mensual`, `flujo_efectivo`, `doctor_honorarios_detalle` (grano: cita, agregable por paciente/doctor/día).

## Learnings (added by /aprende 2026-07-18)

- **CSP vive en `public/_headers`.** Todo script/widget de terceros nuevo debe agregarse ahí o queda bloqueado silenciosamente. Turnstile requiere `https://challenges.cloudflare.com` en `script-src` Y `frame-src`. Ojo: /login puede tardar ~1 min en reflejar headers nuevos por cache de edge. <!-- /aprende 2026-07-18 -->
- **`supabase.functions.invoke` NO lanza excepción.** Siempre revisar `{ data, error }` del retorno; un try/catch alrededor nunca detecta el fallo (bug real corregido en AdminUsuarios). <!-- /aprende 2026-07-18 -->
- **Staff de plataforma nuevo = `INSERT INTO platform_staff_pending (email) VALUES ('<email en minúsculas>')`.** Se promueve solo a `platform_staff` en su primer login Google (trigger JIT). Doctores/enfermeras: alta con email en AdminUsuarios y entran con Google, cero pasos manuales. <!-- /aprende 2026-07-18 -->

## Learnings (added by /aprende 2026-07-21)

- **Al dispatchear un subagente que importa un componente creado en la misma sesión, confirmar en el prompt si es named o default export.** `tsc --noEmit` no detecta el mismatch (esModuleInterop lo deja pasar); Vite/ESM sí, y una `SyntaxError` de módulo tumba TODA la app (pantalla en blanco en cualquier ruta), no solo el archivo que importa mal. Ver `lesson_default-export-rompe-runtime-no-tsc.md`. <!-- /aprende 2026-07-21 -->
- **`movimientos_contables.evento` es genérico (`'devengo'`/`'cancelacion'`), NO la clave de negocio de `contab_reglas_asiento`.** Para resolver la regla contable real de un movimiento, derivar la clave (`cobro_caja_consulta`, `venta_farmacia`, `honorario_devengo`, etc.) desde `reference_type`, revisando el trigger fuente real en `supabase/migrations/`. Para `movimiento_caja` específicamente, `reference_id` es el id de la tabla `movimientos` (caja), no el id de la cita — hace falta JOIN por `appointment_id`. Ver `lesson_movimientos-contables-evento-generico-vs-regla.md`. <!-- /aprende 2026-07-21 -->
- **`crear_poliza()`/`cancelar_poliza()`: RESUELTO** (mismo día, migraciones `20260721180000`/`20260721220000`, commit `6a10001`) — bypass `auth.uid() IS NOT NULL AND NOT EXISTS(...)` restaurado, verificado en prod 2026-07-22. `update_journey_progress()` tenía el mismo patrón de bug, también arreglado. <!-- /aprende 2026-07-22 -->

- **Landing `/pitch`: prohibido testimonios ficticios o claims sin sustento** (riesgo publicidad engañosa / PROFECO). Presentar métricas como "escenarios ilustrativos" con su base declarada, nunca como clientes reales con nombre/foto. <!-- /aprende 2026-07-21 -->
