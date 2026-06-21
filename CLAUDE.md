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

**Chat de ayuda ("hablar con humano"):** tablas `ayuda_chat_sesiones` / `ayuda_chat_mensajes` ya existen (estado por defecto `escalada`, sin IA conectada). UI pendiente. La columna `rol: asistente_ia` en `ayuda_chat_mensajes` queda lista para cuando se decida hosting de un modelo (Ollama requiere VM/servidor propio — Cloudflare Workers/Supabase Edge Functions no pueden correr un proceso persistente con modelo cargado); decisión pospuesta a propósito.

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

### Al iniciar sesión — SIEMPRE hacer esto primero
1. Leer `memoria/STATE.md` — estado actual, pendientes, archivos clave
2. Leer nota más reciente en `memoria/diario/` — contexto de la última sesión

**PROHIBIDO** usar `mem-search`, `get_observations` u otras herramientas de memoria externa al iniciar. Solo 2 `Read` calls. Toda la verdad del proyecto está en `memoria/`.

### Al terminar sesión — SIEMPRE hacer esto (y también tras CUALQUIER cambio significativo)
1. Actualizar `memoria/STATE.md`: mover completados a "Completado", actualizar "Pendiente"
2. Crear/actualizar nota en `memoria/diario/YYYY-MM-DD.md` con resumen de la sesión

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
