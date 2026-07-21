# S1 — Rate limiting Edge Functions · DISEÑO (Opus, 2026-07-21)

Tarea #3 del [[plan-avance-ejecucion]]. Fase de diseño (Opus). Implementación → Sonnet.

## Inventario: 39 functions activas, clasificadas por superficie de abuso

Criterio: ¿es llamable por anónimo (sin auth) y hace trabajo costoso (DB write, email,
$ PAC, $ Stripe, LLM)? `verify_jwt=false` sin gate interno = anon-abusable.

### PRIORIDAD 1 — anon, sin auth, trabajo costoso (rate limit YA)

| Function | verify_jwt | Gate interno | Costo por request | Riesgo |
|----------|-----------|--------------|-------------------|--------|
| **arco-request** | false | **NINGUNO** (público a propósito) | INSERT `arco_requests` + Telegram a TODOS los admins | Spam masivo de folios ARCO + flood Telegram. **El peor.** |
| **stripe-checkout** | false | ninguno (montos server-side) | crea Checkout Session en Stripe | Spam de sesiones Stripe, ruido en dashboard, posible rate limit de Stripe |

### PRIORIDAD 2 — autenticado pero costoso por identidad (rate limit por user)

| Function | verify_jwt | Costo | Riesgo |
|----------|-----------|-------|--------|
| **help-chat-ai** | true | llamada LLM ($ por token) | user autenticado quema presupuesto LLM en burst |
| **cfdi-timbrar** | true (getUser) | **timbre PAC = $ real** | user quema timbres en loop (bug o malicia) |
| **stripe-payment-intent** | true | PaymentIntent Stripe | menor, auth-gated |
| **verify-tenant-code** | true + is_global_admin | brute-force código 6 díg (H3) | LOW, solo platform staff. Si se abre self-service → sube |

### PRIORIDAD 3 — webhooks con firma/secreto (validan rápido, NO rate limit propio)

telegram-webhook (X-Telegram secret), stripe-webhook / stripe-webhook-saas (HMAC),
whatsapp-webhook (verify token), google-oauth-callback (OAuth state). Validan antes de
trabajo pesado. Endurecer solo si se ve abuso. **No tocar en v1.**

### NO requieren (auth por secreto/service_role o cron dedicado)

create-tenant (is_global_admin), cfdi-email (getUser), notify-new-user (Bearer svc),
notify-cxp-vencimiento / auto-reorder / lock-expired-grace-clinics / whatsapp-audit-mensajes
(CRON_SECRET dedicado), provision-users-from-queue (v4, admin+scope), cfdi-* restantes (getUser).

## Mecanismo propuesto: tabla `rate_limits` en Postgres (NO KV Cloudflare)

Razón: las functions ya tienen service_role client; una tabla Postgres es transaccional,
consultable, sin infra nueva. KV de Cloudflare añade dependencia y las functions corren en
Supabase Edge (Deno), no en el Worker — no comparten runtime con el KV del Worker.

```sql
CREATE TABLE public.rate_limits (
  bucket      text        NOT NULL,   -- "arco:<ip>" | "help-chat:<user_id>" | ...
  window_start timestamptz NOT NULL,
  count       integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
-- RLS: sin policies de cliente, solo service_role (las functions). REVOKE ALL FROM anon,authenticated.
-- Limpieza: pg_cron borra window_start < now() - interval '1 day' (diario).
```

RPC atómica `check_rate_limit(_bucket text, _limit int, _window_seconds int) returns boolean`
(SECURITY DEFINER, search_path=public, REVOKE FROM public + GRANT service_role):
- calcula `window_start = date_trunc` por ventana fija (o sliding con bucket = floor(epoch/window))
- `INSERT ... ON CONFLICT (bucket, window_start) DO UPDATE SET count = rate_limits.count + 1 RETURNING count`
- retorna `count <= _limit`. Fija = simple; suficiente v1 (ventana fija, no sliding).

Helper Deno compartido `_shared/rateLimit.ts`:
```ts
export async function enforceRateLimit(admin, bucket, limit, windowSec) {
  const { data: ok } = await admin.rpc("check_rate_limit",
    { _bucket: bucket, _limit: limit, _window_seconds: windowSec });
  return ok === true; // false → responder 429
}
```

Identidad del bucket:
- anon (arco, stripe-checkout): IP de `req.headers.get("x-forwarded-for")?.split(",")[0]`. IP spoofable pero eleva el costo del abuso; combinar con email cuando exista.
- autenticado: `user.id`.

## Límites sugeridos (ajustables)

| Function | bucket | límite | ventana |
|----------|--------|--------|---------|
| arco-request | `arco:<ip>` | 3 | 1 h |
| stripe-checkout | `checkout:<ip>` | 10 | 1 h |
| help-chat-ai | `help:<user_id>` | 30 | 1 h |
| cfdi-timbrar | `timbrar:<user_id>` | 60 | 1 h |
| stripe-payment-intent | `pi:<user_id>` | 20 | 1 h |

## Respuesta al exceder
`429` + `{ error: "Demasiadas solicitudes, intenta más tarde" }` + header `Retry-After`.
Fail-open: si la RPC falla (BD caída), permitir la request (no romper el negocio por el limitador) y `console.error`. Excepción: arco-request y stripe-checkout → fail-open igual (v1); si se vuelve problema, fail-closed.

## Implementación (Sonnet — orden)
1. Migración: tabla `rate_limits` + RPC `check_rate_limit` + REVOKE/GRANT + pg_cron cleanup. `get_advisors(security)`.
2. `_shared/rateLimit.ts`.
3. Cablear P1 (arco-request, stripe-checkout) → deploy → test burst (>límite → 429).
4. Cablear P2 (help-chat-ai, cfdi-timbrar, stripe-payment-intent).
5. Columna "rate limit" en `docs/edge-functions-auth.md`.

## Cierre
docs actualizado, advisors limpio, test negativo (burst 20 → 429) pasa en arco-request.
```
```
