# Harness local del bot de Telegram

Corre conversaciones completas contra el bot SIN Telegram, SIN Anthropic y SIN
Supabase reales. Todo local, cero riesgo a producción, cero costo de tokens.

## Correr

```powershell
cd supabase/functions/telegram-webhook
deno run --allow-net --allow-env --allow-run --allow-read test/run-transcripts.ts
```

Exit code 0 = todos los transcripts en verde.

## Piezas

- `stub-server.ts` (puerto 9999) — emula Telegram Bot API (captura lo enviado),
  Anthropic (respuestas fijas: clasificador dice "booking" si el texto trae
  cita/agendar, triage dice no-urgente, agente responde `[STUB-AGENTE]`) y
  PostgREST con store en memoria sembrado de `fixtures/seed.json`.
- `run-transcripts.ts` — lanza stub + webhook (`index.ts` en puerto 8000, con
  env dummy apuntando al stub) y alimenta los `transcripts/*.json` en orden.
- `transcripts/*.json` — pasos `send` (texto o callback) + `expect`/`notExpect`
  (regex contra los textos que el bot mandó a Telegram en ese paso).
  `expect` acepta `{ "pattern": "...", "max": 1 }` para asertar "máximo N veces"
  (antiloop). `send.update_id` fijo permite probar dedup de updates duplicados.

## Con LLM real (calidad de conversación)

```powershell
$env:RUN_REAL_LLM = "1"
$env:REAL_LLM_KEY = "<tu key>"   # solo en el shell, nunca en archivos
deno run --allow-net --allow-env --allow-run --allow-read test/run-transcripts.ts
```

El stub hace proxy de Anthropic al API real; Telegram y Supabase siguen falsos.

## Límites (a propósito)

- El stub PostgREST NO es Postgres: sin RLS, sin constraints (salvo PK de
  `telegram_updates` para simular el 23505 del dedup), sin RPCs reales
  (devuelven `[]`). Si una task depende de lógica SQL real, se prueba con
  migración + `supabase db query --linked`, no aquí.
- Selects embebidos (`doctor:doctors(...)`) no se resuelven: el seed ya trae
  el objeto embebido en la fila. Si agregas un embed nuevo al código, agrega
  el campo al seed.
