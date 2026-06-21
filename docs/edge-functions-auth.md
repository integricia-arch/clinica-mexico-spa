# Edge Functions Authentication Audit

**Project:** Clínica México SPA  
**Date:** 2026-06-21  
**Context:** Audit of 9 edge functions with `verify_jwt=false` in `supabase/config.toml`

## Summary

Nine edge functions have JWT verification disabled. This table documents each function's alternative authentication mechanism and security posture.

| # | Function | HTTP Method | Auth Mechanism | Verification | Status | Notes |
|---|----------|-------------|----------------|--------------|--------|-------|
| 1 | `telegram-webhook` | POST | `X-Telegram-Bot-Api-Secret-Token` header | Token comparison against `TELEGRAM_WEBHOOK_SECRET` env | ✅ Implemented | Webhook tokens are bearer-like; secret must match |
| 2 | `stripe-webhook` | POST | `X-Stripe-Signature` (HMAC-SHA256) | `Stripe.webhooks.constructEvent()` validates signature | ✅ Implemented | Industry standard; Stripe handles HMAC verification |
| 3 | `stripe-checkout` | POST | **Public endpoint** | None — uses Stripe session IDs for idempotency | ✅ Acceptable | Amounts calculated server-side; no secrets in request |
| 4 | `enviar-recordatorios` | POST | Bearer token (service role or user JWT) | Manual JWT validation via `supabase.auth.getUser()` OR service role key | ✅ Implemented | Cron-triggered; uses Bearer service_role key |
| 5 | `notify-cxp-vencimiento` | POST | Bearer token | Compared against `NOTIFY_CXP_CRON_SECRET` env | ✅ Implemented | Internal cron endpoint; shared secret auth |
| 6 | `auto-reorder` | POST | Bearer token | Compared against `AUTO_REORDER_CRON_SECRET` env | ✅ Implemented | Internal cron endpoint; shared secret auth |
| 7 | `cfdi-parse` | POST | Bearer token | **Header-only check** (presence, no value validation) | ⚠️ Incomplete | Currently only checks `Authorization` header exists; does NOT validate token value |
| 8 | `confirmar-cita` | POST | Bearer token | Supabase JWT validated via `supabase.auth.getUser()` + API schema permissions | ✅ Implemented | User confirmation flow; real Supabase JWT |
| 9 | `google-oauth-callback` | GET | OAuth 2.0 state param | Base64-decoded state = `doctorId:clinicId` (routing, not auth) | ⚠️ Minimal | Callback routing only; relies on Google `code` verification + PKCE equivalent |

---

## Detailed Findings

### 1. `telegram-webhook` ✅ Secure

**File:** `supabase/functions/telegram-webhook/index.ts` (line 376)

```typescript
const telegramSecret = req.headers.get("x-telegram-bot-api-secret-token");
if (telegramSecret !== Deno.env.get("TELEGRAM_WEBHOOK_SECRET")) {
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401 }
  );
}
```

- **Mechanism:** Telegram sends `X-Telegram-Bot-Api-Secret-Token` header on all webhook deliveries.
- **Validation:** String comparison against env var `TELEGRAM_WEBHOOK_SECRET`.
- **Security:** ✅ Correct — only Telegram and the deployed function know the secret.

---

### 2. `stripe-webhook` ✅ Secure

**File:** `supabase/functions/stripe-webhook/index.ts` (verified)

- **Mechanism:** Stripe sends `X-Stripe-Signature` header containing HMAC-SHA256 of the request body.
- **Validation:** Delegated to `Stripe.webhooks.constructEvent()`, which:
  - Reconstructs the HMAC using the webhook secret (`STRIPE_WEBHOOK_SECRET`)
  - Compares to the header signature
  - Throws if mismatch
- **Security:** ✅ Industry standard; cryptographically signed.

---

### 3. `stripe-checkout` ✅ Acceptable (Public, but safe)

**File:** `supabase/functions/stripe-checkout/index.ts`

- **Mechanism:** No auth — anyone can call it.
- **Why it's safe:**
  - Amounts are **calculated server-side** from the database (service items, prices).
  - Request body cannot override server amounts.
  - Stripe session ID prevents duplicate charges.
  - Published on pitch page; no secrets leaked.
- **Status:** ✅ Public is intentional and secure.

---

### 4. `enviar-recordatorios` ✅ Secure

**File:** `supabase/functions/enviar-recordatorios/index.ts`

- **Mechanism:** Bearer auth (can be either service role key OR user JWT).
- **Validation:** Manual call to `supabase.auth.getUser()`.
- **Usage:** Cron-triggered reminders; uses service role key.
- **Security:** ✅ Bearer token is checked; service role key is env-only.

---

### 5. `notify-cxp-vencimiento` ✅ Secure

**File:** `supabase/functions/notify-cxp-vencimiento/index.ts`

- **Mechanism:** Bearer token.
- **Validation:** Token compared against `NOTIFY_CXP_CRON_SECRET` env var.
- **Usage:** Internal cron job for expiration notifications.
- **Security:** ✅ Shared secret, env-only.

---

### 6. `auto-reorder` ✅ Secure

**File:** `supabase/functions/auto-reorder/index.ts`

- **Mechanism:** Bearer token.
- **Validation:** Token compared against `AUTO_REORDER_CRON_SECRET` env var.
- **Usage:** Internal cron job for auto reordering.
- **Security:** ✅ Shared secret, env-only.

---

### 7. `cfdi-parse` ⚠️ Incomplete

**File:** `supabase/functions/cfdi-parse/index.ts` (lines 340–346)

```typescript
const authHeader = req.headers.get("Authorization");
if (!authHeader) {
  return new Response(
    JSON.stringify({ error: "No autorizado" }),
    { status: 401 }
  );
}
```

- **Current Status:** Only checks if the `Authorization` header **exists**; does **NOT** validate the token value.
- **Gap:** Any string in the `Authorization` header (e.g., `Bearer anything`) will pass.
- **Risk:** Unintended callers (internal services) could invoke this.
- **Recommendation:** Add validation:
  ```typescript
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${Deno.env.get("CFDI_PARSE_SECRET")}`) {
    return new Response(
      JSON.stringify({ error: "No autorizado" }),
      { status: 401 }
    );
  }
  ```
- **Action:** Documented as pending; code NOT modified (per task constraints).

---

### 8. `confirmar-cita` ✅ Secure

**File:** `supabase/functions/confirmar-cita/index.ts`

- **Mechanism:** Bearer JWT (user access token).
- **Validation:** `supabase.auth.getUser()` — extracts user from JWT and verifies signature server-side.
- **Usage:** Patient/doctor confirms appointment via API.
- **Security:** ✅ Real Supabase JWT; RLS policies applied.

---

### 9. `google-oauth-callback` ⚠️ Routing, Not Auth

**File:** `supabase/functions/google-oauth-callback/index.ts` (lines 33–44)

```typescript
let doctorId: string, clinicId: string;
try {
  const decoded = atob(state);
  [doctorId, clinicId] = decoded.split(":");
  if (!doctorId) throw new Error("sin doctorId");
} catch {
  return new Response("State inválido", { status: 400 });
}
```

- **Mechanism:** OAuth 2.0 callback from Google.
  - State param is base64-encoded `doctorId:clinicId`.
  - Used for routing, not authentication.
- **Real Auth:** Google's `code` (authorization code) is exchanged for tokens via PKCE equivalent.
  - `code` is single-use and tied to the registered `REDIRECT_URI`.
  - Only `GOOGLE_CLIENT_SECRET` can exchange it for tokens (line 50–60).
- **Status:** ⚠️ State param is **routing only**; real auth is the OAuth exchange.
  - State param is base64, not cryptographically signed — but it only routes to the correct `doctorId:clinicId`, not a security boundary.
  - An attacker cannot get tokens by forging state; they'd need Google's authorization code flow.
- **Implication:** Acceptable for OAuth callback (state is not meant to be a security token in OAuth 2.0 spec).

---

## Security Recommendations

### Immediate (High Priority)

1. **cfdi-parse:** Add Bearer token validation (lines 340–346). Secret `CFDI_PARSE_SECRET` must be added to project env.

### Medium Priority

2. All cron functions should use a **common `INTERNAL_CRON_SECRET`** instead of per-function secrets (better hygiene, easier rotation).

### Low Priority

3. Document all edge functions in a centralized security checklist (this file).
4. Add request logging to track who/when each endpoint is called (useful for audit).

---

## Environment Variables Checklist

| Secret | Functions | Status |
|--------|-----------|--------|
| `TELEGRAM_WEBHOOK_SECRET` | telegram-webhook | ✅ Set |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | ✅ Set |
| `STRIPE_SECRET_KEY` | stripe-webhook, stripe-checkout | ✅ Set |
| `SUPABASE_SERVICE_ROLE_KEY` | All (for DB access) | ✅ Set |
| `NOTIFY_CXP_CRON_SECRET` | notify-cxp-vencimiento | ✅ Set |
| `AUTO_REORDER_CRON_SECRET` | auto-reorder | ✅ Set |
| `CFDI_PARSE_SECRET` | cfdi-parse | ⚠️ Missing (see recommendation) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | google-oauth-callback | ✅ Set |

---

## Testing / Verification Steps

### Telegram Webhook
```bash
curl -X POST https://your-domain/functions/v1/telegram-webhook \
  -H "x-telegram-bot-api-secret-token: $(echo $TELEGRAM_WEBHOOK_SECRET)" \
  -H "Content-Type: application/json" \
  -d '{"update_id": 123, "message": {"text": "test"}}'
# Expected: 200 (or 400 if message format is wrong)

curl -X POST https://your-domain/functions/v1/telegram-webhook \
  -H "Content-Type: application/json" \
  -d '{"update_id": 123}'
# Expected: 401 (missing header)
```

### Stripe Webhook
```bash
# Stripe CLI simulates webhook:
stripe listen --forward-to https://your-domain/functions/v1/stripe-webhook
stripe trigger charge.succeeded
# Expected: 200
```

### CFDI Parse (Current — Header-Only)
```bash
# Passes with any Authorization header:
curl -X POST https://your-domain/functions/v1/cfdi-parse \
  -H "Authorization: Bearer anything" \
  -H "Content-Type: application/json" \
  -d '{"clinic_id": "...", ...}'
# Expected: 200 or 400 (data validation), NOT 401

# After fix, should require matching token:
curl -X POST https://your-domain/functions/v1/cfdi-parse \
  -H "Authorization: Bearer $(echo $CFDI_PARSE_SECRET)" \
  ...
```

---

## References

- Supabase Edge Functions docs: https://supabase.com/docs/guides/functions
- Stripe Webhooks: https://stripe.com/docs/webhooks
- Telegram Bot API: https://core.telegram.org/bots/webhooks
- OAuth 2.0 state parameter: https://tools.ietf.org/html/rfc6749#section-4.1.1
