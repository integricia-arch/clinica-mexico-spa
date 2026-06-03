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
