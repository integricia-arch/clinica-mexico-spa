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
npm run build          # requiere .env con las 3 VITE_* vars
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

Una vez configurados, los deploys automáticos de Lovable funcionarán sin intervención.

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
