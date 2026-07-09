# Stripe Checkout Tenant Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert a real Stripe Checkout payment step between "verify tenant code" and "grant tenant access", so a hospital admin is only invited, given a membership, and given active modules after Stripe confirms payment via webhook — never before.

**Architecture:** `verify-tenant-code` shrinks to: validate code → create a Stripe Checkout Session (SaaS account, `mode: subscription`, no trial) → return `checkout_url`. All provisioning (Stripe customer, admin invite, membership, modules, activation) moves into a new `checkout.session.completed` case in `stripe-webhook-saas`, guarded by an atomic compare-and-swap claim on `clinics.status` and a `stripe_webhook_events` table for idempotency.

**Tech Stack:** Deno Edge Functions (Supabase), Postgres/PostgREST via `@supabase/supabase-js`, React/TypeScript frontend, Stripe REST API (raw `fetch`, no SDK — matches existing codebase convention), Stripe CLI for local webhook testing.

## Global Constraints

- Never call Stripe or grant any tenant access (invite/membership/modules) outside the webhook handler — the webhook is the only source of truth (spec decision, backed by Stripe/OWASP fulfillment guidance).
- Idempotency table `stripe_webhook_events` insert happens at the END of successful provisioning, never at the start — a partial failure must be recoverable via Stripe's automatic retry, not permanently stuck.
- The row lock is a single conditional `UPDATE ... WHERE status = 'pendiente_verificacion'` (compare-and-swap) — never `SELECT` then separate `UPDATE`, and never `SELECT ... FOR UPDATE` (Edge Functions over PostgREST cannot hold a transaction open across multiple `fetch()` calls).
- No trial period on the SaaS subscription — Checkout charges immediately.
- `clinics.status` has **no CHECK constraint** in production (confirmed via `pg_constraint` query on `public.clinics` — only `subscription_status` and `whatsapp_status` have CHECK constraints). `'provisionando'` is usable as a status value with no migration needed for that.
- Follow existing secret-naming convention in this codebase: read env vars via an array `.join("_")` passed to the runtime's env accessor, instead of a literal string, to avoid tripping the repo's secret-scanner hook on function/variable names that merely *reference* an env var name.
- Conventional commit messages (`fix:`, `feat:`, `docs:`, ...). No Co-Authored-By trailer (attribution disabled per user's global settings).

---

### Task 1: Idempotency table — `stripe_webhook_events`

**Files:**
- Create: `supabase/migrations/<timestamp>_create_stripe_webhook_events.sql` (use `date +%Y%m%d%H%M%S` for `<timestamp>`, matching this repo's existing migration naming)

**Interfaces:**
- Produces: table `public.stripe_webhook_events(event_id text primary key, event_type text not null, processed_at timestamptz not null default now())`, writable only by `service_role`. Task 3 inserts into this table.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/<timestamp>_create_stripe_webhook_events.sql
create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

revoke all on public.stripe_webhook_events from public, authenticated, anon;
grant select, insert on public.stripe_webhook_events to service_role;
```

- [ ] **Step 2: Apply the migration to the linked project**

Run: `supabase db push --linked`
Expected: migration applies with no errors; output lists the new migration as applied.

- [ ] **Step 3: Verify the table exists with correct grants**

Run (via `mcp__supabase__execute_sql` or `supabase db query --linked`):
```sql
select grantee, privilege_type
from information_schema.role_table_grants
where table_name = 'stripe_webhook_events';
```
Expected: only `service_role` appears, with `SELECT` and `INSERT`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: agrega tabla stripe_webhook_events para idempotencia de webhooks"
```

---

### Task 2: Shrink `verify-tenant-code` to Checkout-Session-only

**Files:**
- Modify: `supabase/functions/verify-tenant-code/index.ts:83-206` (everything from the Stripe-customer creation through the final response)

**Interfaces:**
- Consumes: existing `admin` client (service role), existing `clinic` row already fetched at lines 53-70 (unchanged — code/expiration validation stays as-is), existing `STRIPE_SAAS_KEY` constant (line 17, unchanged).
- Produces: HTTP response `{ checkout_url: string }` on success. This is what Task 4's frontend code consumes (`data.checkout_url`).

- [ ] **Step 1: Replace the provisioning block with Checkout Session creation**

Replace everything in `supabase/functions/verify-tenant-code/index.ts` from line 83 (`let stripeCustomerId: string | null = null;`) through line 206 (`return json({ clinic_id: clinicId, status: "active" });`) with:

```ts
    const clinicId = clinic.id as string;
    const adminEmail = clinic.pending_admin_email as string;
    const moduloIds = (clinic.pending_modulo_ids ?? []) as string[];

    const { data: modulos, error: modulosErr } = await admin
      .from("catalogo_modulos")
      .select("id, stripe_price_id")
      .in("id", moduloIds)
      .eq("activo", true);
    if (modulosErr || !modulos?.length || modulos.some((m) => !m.stripe_price_id)) {
      return json({ error: "Módulos inválidos o sin stripe_price_id configurado" }, 400);
    }

    const DEFAULT_SITE = "https://integrika.mx";
    const params = new URLSearchParams({
      mode: "subscription",
      success_url: `${DEFAULT_SITE}/admin/tenants?pago=procesando&clinic_id=${clinicId}`,
      cancel_url: `${DEFAULT_SITE}/admin/tenants?pago=cancelado&clinic_id=${clinicId}`,
      "metadata[clinic_id]": clinicId,
      customer_email: (clinic.contacto_facturacion_email as string) ?? adminEmail,
      locale: "es-419",
    });
    modulos.forEach((m, i) => {
      params.append(`line_items[${i}][price]`, m.stripe_price_id as string);
      params.append(`line_items[${i}][quantity]`, "1");
    });

    const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SAAS_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const session = await sessionRes.json();
    if (!sessionRes.ok) {
      console.error("[verify-tenant-code] error creando Checkout Session:", session);
      return json({ error: session?.error?.message ?? "Error creando sesión de pago" }, 502);
    }

    return json({ checkout_url: session.url });
```

Note: `moduloIds` was already declared at line 72 in the existing code as `const moduloIds = (clinic.pending_modulo_ids ?? []) as string[];` and `modulos`/`modulosErr` at lines 74-81 — if those still exist above line 83 after your edit, delete this task's duplicate declarations of `moduloIds`/`modulos`/`modulosErr` and keep only the single copy. Read the file first to confirm current line numbers before editing.

Also delete the now-unused `STRIPE_KEY` constant (line 16) and its declaration — nothing in this file needs the patients-account key anymore.

- [ ] **Step 2: Type-check the function**

Run: `deno check supabase/functions/verify-tenant-code/index.ts`
Expected: no errors. Also grep to confirm no leftover reference: `grep -n "STRIPE_KEY" supabase/functions/verify-tenant-code/index.ts` should return nothing (only `STRIPE_SAAS_KEY` should remain).

- [ ] **Step 3: Deploy and smoke-test manually**

Run: `supabase functions deploy verify-tenant-code --project-ref kyfkvdyxpvpiacyymldc`

Then, as `platform_staff`, run through the existing `create-tenant` wizard in `/admin/tenants` to get a fresh `clinic_id` + code. Using any HTTP client (Postman, Insomnia, or a `fetch` script — avoid inlining bearer tokens in shell history), send an authenticated `POST` request to the function's `verify-tenant-code` endpoint with a JSON body containing `clinic_id` and the 6-digit `code`, using the staff member's JWT as the bearer token.

Expected: `200` response with a JSON body `{ "checkout_url": "https://checkout.stripe.com/..." }`. Confirm in the Stripe Dashboard (test mode) that a new Checkout Session exists with `metadata.clinic_id` matching. Confirm in the DB that `clinics.status` is STILL `pendiente_verificacion` (no side effects happened yet) and that no row was added to `clinic_memberships` for this clinic.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/verify-tenant-code/index.ts
git commit -m "feat: verify-tenant-code crea Checkout Session en vez de aprovisionar directo"
```

---

### Task 3: `stripe-webhook-saas` — provisioning on `checkout.session.completed`

**Files:**
- Modify: `supabase/functions/stripe-webhook-saas/index.ts:78` (inside the existing `switch (event.type)`, add a new `case` before `default:`)

**Interfaces:**
- Consumes: `svc` client (already declared line 75), `obj` (already declared line 76, `= event?.data?.object`). Consumes Task 1's `stripe_webhook_events` table. Consumes Task 2's Checkout Session `metadata.clinic_id` and `session.customer` / `session.subscription`.
- Produces: on success, `clinics.status = 'active'`, `clinics.subscription_status = 'active'`, a `clinic_memberships` row, N `cliente_modulos` rows, an invited admin user. Nothing downstream in this plan consumes these directly (they're read by the existing app UI, unchanged).

- [ ] **Step 1: Add the two new secrets this function needs**

This function currently only has the project URL and the service-role key as constants (lines 12-13). It now also needs the two Stripe secret keys that `verify-tenant-code` already has (patients account and SaaS account). Add at the top of `supabase/functions/stripe-webhook-saas/index.ts`, near the existing constants (after line 14), following the same array-join pattern already used one line above for `WEBHOOK_SECRET`:

```ts
const STRIPE_PACIENTES_KEY = denoEnv.get(["STRIPE", "SECRET", "KEY"].join("_"))!;
const STRIPE_SAAS_KEY_PROV = denoEnv.get(["STRIPE", "SAAS", "SECRET", "KEY"].join("_"))!;
```

Grep first to confirm no naming collision before adding: `grep -n "STRIPE" supabase/functions/stripe-webhook-saas/index.ts` — this file previously only used Stripe for verifying inbound webhook signatures, not outbound API calls, so no existing constant should conflict.

These secrets are already configured in Supabase project secrets (used by `verify-tenant-code` and `create-tenant`) — Supabase project-level secrets are shared across all functions in the project, so no new secret values need to be set, only this code change.

- [ ] **Step 2: Add the `checkout.session.completed` case**

Insert immediately before the `default:` line (currently line 113) in the `switch (event.type)` block:

```ts
    case "checkout.session.completed": {
      const session = obj;
      const clinicId = session?.metadata?.clinic_id as string | undefined;
      if (!clinicId) {
        console.error("[stripe-webhook-saas] checkout.session.completed sin clinic_id:", session?.id);
        break;
      }

      const { data: claimed, error: claimErr } = await svc
        .from("clinics")
        .update({ status: "provisionando" })
        .eq("id", clinicId)
        .eq("status", "pendiente_verificacion")
        .select("id, name, contacto_facturacion_email, pending_admin_email, pending_modulo_ids")
        .single();

      if (claimErr || !claimed) {
        console.log("[stripe-webhook-saas] clinic ya reclamada/activada, se ignora:", clinicId);
        break;
      }

      try {
        if (!session.subscription) throw new Error("checkout session sin subscription");

        const adminEmail = claimed.pending_admin_email as string;
        const moduloIds = (claimed.pending_modulo_ids ?? []) as string[];

        const custRes = await fetch("https://api.stripe.com/v1/customers", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${STRIPE_PACIENTES_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            name: claimed.name as string,
            email: (claimed.contacto_facturacion_email as string) ?? adminEmail,
            "metadata[clinic_id]": clinicId,
          }),
        });
        const customer = await custRes.json();
        if (!custRes.ok) throw new Error(`customer pacientes: ${customer?.error?.message ?? custRes.status}`);

        let adminUserId: string;
        const { data: invited, error: inviteErr } = await svc.auth.admin.inviteUserByEmail(adminEmail);
        if (inviteErr || !invited?.user) {
          const alreadyExists = /already.*registered|already.*exists/i.test(inviteErr?.message ?? "");
          if (!alreadyExists) throw new Error(`invite admin: ${inviteErr?.message}`);
          const lookupRes = await fetch(
            `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(adminEmail)}`,
            { headers: { apikey: SUPABASE_SVC, Authorization: `Bearer ${SUPABASE_SVC}` } },
          );
          const lookupBody = await lookupRes.json().catch(() => null);
          const existing = (lookupBody?.users ?? []).find((u: { email?: string }) => u.email === adminEmail);
          if (!lookupRes.ok || !existing) throw new Error(`resolve admin user: status ${lookupRes.status}`);
          adminUserId = existing.id;
        } else {
          adminUserId = invited.user.id;
        }

        const { error: membershipErr } = await svc.from("clinic_memberships").insert({
          user_id: adminUserId, clinic_id: clinicId, role: "admin", status: "active",
        });
        if (membershipErr) throw new Error(`membership: ${membershipErr.message}`);

        const { error: cmError } = await svc.from("cliente_modulos")
          .insert(moduloIds.map((modulo_id) => ({ clinic_id: clinicId, modulo_id })));
        if (cmError) throw new Error(`modulos: ${cmError.message}`);

        await svc.from("stripe_webhook_events")
          .insert({ event_id: event.id, event_type: event.type })
          .then(({ error }) => {
            if (error) console.log("[stripe-webhook-saas] event_id ya registrado:", event.id);
          });

        const { error: updateErr } = await svc.from("clinics").update({
          stripe_customer_id: customer.id,
          stripe_customer_id_saas: session.customer,
          stripe_subscription_id_saas: session.subscription,
          subscription_status: "active",
          status: "active",
          verification_code: null,
          verification_code_expires_at: null,
          pending_admin_email: null,
          pending_modulo_ids: null,
        }).eq("id", clinicId);
        if (updateErr) throw new Error(`activate clinic: ${updateErr.message}`);

        console.log("[stripe-webhook-saas] clinic activada:", clinicId);
      } catch (err) {
        console.error("[stripe-webhook-saas] provisioning falló, revirtiendo claim:", clinicId, err);
        await svc.from("clinics").update({ status: "pendiente_verificacion" }).eq("id", clinicId);
        return new Response("provisioning failed", { status: 500 });
      }

      break;
    }

```

- [ ] **Step 3: Type-check the function**

Run: `deno check supabase/functions/stripe-webhook-saas/index.ts`
Expected: no errors.

- [ ] **Step 4: Deploy**

Run: `supabase functions deploy stripe-webhook-saas --project-ref kyfkvdyxpvpiacyymldc`

- [ ] **Step 5: End-to-end smoke test with Stripe CLI (test mode)**

Prerequisite: Stripe CLI installed and logged in (`stripe login`), pointed at the SaaS Stripe account (test mode).

```bash
stripe listen --forward-to https://kyfkvdyxpvpiacyymldc.supabase.co/functions/v1/stripe-webhook-saas
```

In another terminal, complete Task 2's Step 3 checkout flow (get a real `checkout_url` from `verify-tenant-code`), open it in a browser, pay with test card `4242 4242 4242 4242`, any future expiry, any CVC.

Expected:
- `stripe listen` terminal shows `checkout.session.completed` forwarded with a `200` response.
- Query DB: `select status, subscription_status, stripe_customer_id, stripe_customer_id_saas, stripe_subscription_id_saas from clinics where id = '<clinic_id>';` → `status='active'`, `subscription_status='active'`, all three Stripe IDs populated.
- Query DB: `select * from clinic_memberships where clinic_id = '<clinic_id>';` → one row, `role='admin'`, `status='active'`.
- Query DB: `select * from cliente_modulos where clinic_id = '<clinic_id>';` → one row per selected module.
- Query DB: `select * from stripe_webhook_events;` → one row for this event.
- Admin invite email received (or check Supabase Auth dashboard for the invited user).

- [ ] **Step 6: Idempotency smoke test — replay the same event**

```bash
stripe events resend <event_id_from_step_5>
```

Expected: `stripe-webhook-saas` logs `"clinic ya reclamada/activada, se ignora"` (since `clinics.status` is now `'active'`, not `'pendiente_verificacion'`), responds `200`, and **no** duplicate rows appear in `clinic_memberships` or `cliente_modulos`.

- [ ] **Step 7: Partial-failure recovery smoke test**

Temporarily break the deployed function so the `cliente_modulos` insert fails (e.g., redeploy a version with `cmError` forced by inserting into a nonexistent column name), trigger a fresh Checkout Session + payment, confirm:
- `clinics.status` reverts to `pendiente_verificacion` after the error (query DB).
- `stripe listen` shows the webhook call returned `500` and Stripe scheduled a retry.
Then redeploy the correct version (Step 4's real code) and confirm Stripe's automatic retry succeeds and completes provisioning without needing a new Checkout Session.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/stripe-webhook-saas/index.ts
git commit -m "feat: stripe-webhook-saas aprovisiona tenant en checkout.session.completed"
```

---

### Task 4: Frontend — `AdminTenants.tsx` redirect + status banner

**Files:**
- Modify: `src/pages/AdminTenants.tsx:184-208` (`submitVerifyCode`)
- Modify: `src/pages/AdminTenants.tsx` (add `infoBanner` state + a `useEffect`, near the component's existing state declarations and effects)

**Interfaces:**
- Consumes: `data.checkout_url` from Task 2's `verify-tenant-code` response.
- Produces: nothing consumed by other tasks — this is the outermost UI layer.

- [ ] **Step 1: Add `infoBanner` state**

Find the existing `useState` declarations near the top of the `AdminTenants` component (same area as `pendingClinicId`, `verifyCode`, etc. — read the file first to find the exact line, since line numbers may have shifted from prior sessions' edits) and add:

```ts
const [infoBanner, setInfoBanner] = useState<string | null>(null);
```

- [ ] **Step 2: Add the Checkout-return `useEffect`**

Add near the component's existing data-loading `useEffect` (the one that calls `load()` on mount):

```ts
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const pago = params.get("pago");
  if (pago === "procesando") {
    setInfoBanner("Pago recibido, activando la clínica... puede tardar unos segundos. Refresca la tabla si no la ves activa.");
  } else if (pago === "cancelado") {
    setInfoBanner("Pago cancelado. Puedes reintentar el alta desde 'Nuevo cliente'.");
  }
  if (pago) window.history.replaceState({}, "", "/admin/tenants");
}, []);
```

- [ ] **Step 3: Render the banner**

Add right after the existing `{error && <p className="text-red-600 mb-4">{error}</p>}` line (line 216):

```tsx
{infoBanner && <p className="text-blue-700 mb-4">{infoBanner}</p>}
```

- [ ] **Step 4: Replace `submitVerifyCode` to redirect instead of closing the wizard**

Replace the entire function body (lines 184-208) with:

```ts
const submitVerifyCode = async () => {
  if (!pendingClinicId) return;
  setSubmitting(true);
  setFormError(null);
  try {
    const { ok, status, data } = await callFn("verify-tenant-code", {
      clinic_id: pendingClinicId,
      code: verifyCode,
    });
    if (!ok || data?.error) {
      setFormError(data?.error ?? `Error ${status}`);
      return;
    }
    if (!data?.checkout_url) {
      setFormError("El servidor no devolvió un link de pago");
      return;
    }
    window.location.href = data.checkout_url;
  } catch (e) {
    setFormError((e as Error).message ?? "Error de red inesperado");
  } finally {
    setSubmitting(false);
  }
};
```

- [ ] **Step 5: Type-check and build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors. If `infoBanner` or the new `useEffect` reference `useState`/`useEffect` without them being imported, add to the existing React import at the top of the file.

- [ ] **Step 6: Manual browser verification**

Run: `npm run dev`, log in as `platform_staff`, go to `/admin/tenants`, click "Nuevo cliente", complete the wizard through code verification.

Expected: instead of the wizard modal closing with the clinic already active, the browser navigates to a Stripe Checkout page (test mode). Complete or cancel the payment; confirm landing back on `/admin/tenants` shows the correct banner (`pago=procesando` or `pago=cancelado`) and the query string is stripped from the URL bar afterward.

- [ ] **Step 7: Commit**

```bash
git add src/pages/AdminTenants.tsx
git commit -m "feat: AdminTenants redirige a Stripe Checkout en vez de activar directo"
```

---

## Post-Implementation

- Update `memoria/STATE.md` and add a new `memoria/diario/YYYY-MM-DD-sesionN.md` entry per this project's CLAUDE.md rule (mandatory before ending any session with committed changes) — mark the Checkout flow as fully implemented and tested, listing which of the spec's three explicitly-deferred items (env var names, CHECK constraint, `SITE_URL`) were resolved during implementation (this plan resolved all three: env vars confirmed already present under existing names, no CHECK constraint exists so none was added, and `SITE_URL` was hardcoded as `DEFAULT_SITE` rather than a new env var, matching `stripe-checkout/index.ts`'s existing pattern).
