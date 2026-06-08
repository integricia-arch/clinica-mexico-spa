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

## Contexto de proyecto (credenciales)

Ver `.claude/project-context.md` — IDs de Cloudflare, Supabase URLs, rutas, pendientes de desarrollo.
El archivo está gitignoreado (`.claude/` en `.gitignore`).
