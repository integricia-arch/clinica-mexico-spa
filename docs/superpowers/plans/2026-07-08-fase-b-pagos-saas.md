# Fase B — Pagos SaaS (suscripción recurrente) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobro recurrente à la carte por módulo a los hospitales cliente (tenants), en una cuenta Stripe separada de los cobros a pacientes, con gate de acceso mixto por gracia cuando un pago falla.

**Architecture:** Reusa el modelo de tenant de Fase A (`clinics` = 1 fila = 1 hospital, `is_global_admin()`/`user_has_clinic_access()` ya existentes). Agrega catálogo de módulos facturables, extiende el wizard `create-tenant` para crear la suscripción Stripe SaaS al alta, agrega un webhook nuevo (`stripe-webhook-saas`) y un cron de gracia que degradan `clinics.subscription_status`, y extiende **la misma función `user_has_clinic_access()`** (ya usada por las 16 policies `RESTRICTIVE` de Fase A) para que también gatee por suscripción — cero policies nuevas necesarias.

**Tech Stack:** Supabase (Postgres + Edge Functions Deno), React + TypeScript (Vite), vitest, Stripe REST API (fetch crudo, sin SDK — mismo patrón que `create-tenant`/`stripe-webhook` existentes).

## Global Constraints

- Migraciones: `YYYYMMDDHHMMSS_descriptive_snake_case_name.sql`, sin sufijo random (patrón de las migraciones Fase A recientes).
- Toda función `SECURITY DEFINER` nueva: `SET search_path = public`, `REVOKE EXECUTE FROM PUBLIC` + `GRANT` explícito al rol mínimo (regla de `CLAUDE.md`, sección "Checklist obligatorio").
- Cuenta Stripe SaaS es **separada** de la cuenta de pagos-paciente — nunca reusar las variables de entorno existentes de la cuenta de pacientes, usar variables nuevas dedicadas a la cuenta SaaS.
- Nunca pedir al usuario pegar secrets en el chat — dar el comando `supabase secrets set` para que lo corra él mismo.
- Después de cada tanda de migraciones nuevas: correr `mcp__supabase__get_advisors(type="security")` (hábito ya formalizado en `CLAUDE.md`).
- `tsc` 0 errores y `npm test` (vitest) en verde antes de cada commit de frontend.
- `types.ts` (`src/integrations/supabase/types.ts`) ya está desactualizado desde Fase A — regenerar al final con `mcp__supabase__generate_typescript_types` (Task 8), no antes (evita regenerar varias veces a medio camino).

---

## Task 1: Migración — columnas de suscripción en `clinics` + gate extendido

**Files:**
- Create: `supabase/migrations/20260708120000_clinics_saas_billing_columns.sql`

**Interfaces:**
- Produces: columnas `clinics.stripe_customer_id_saas` (text), `clinics.stripe_subscription_id_saas` (text), `clinics.subscription_status` (text, default `'trialing'`), `clinics.grace_period_ends_at` (timestamptz nullable). Función `public.user_has_clinic_access(_user_id uuid, _clinic_id uuid)` extendida — mismo nombre/firma que ya consumen las 16 policies `RESTRICTIVE` de Fase A y `storage.objects`, sin cambios en esas policies.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260708120000_clinics_saas_billing_columns.sql

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS stripe_customer_id_saas text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id_saas text,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinics_subscription_status_check'
  ) THEN
    ALTER TABLE public.clinics
      ADD CONSTRAINT clinics_subscription_status_check
      CHECK (subscription_status IN ('trialing','active','past_due','canceled'));
  END IF;
END $$;

-- Extiende el gate ya usado por las 16 policies RESTRICTIVE de Fase A
-- (20260707130000_multiclinic_restrictive_gate_extension.sql) y por
-- storage.objects — misma firma, mismo nombre, sin tocar esas policies.
CREATE OR REPLACE FUNCTION public.user_has_clinic_access(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _clinic_id IS NULL
    OR public.is_global_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      JOIN public.clinics c ON c.id = cm.clinic_id
      WHERE cm.user_id = _user_id
        AND cm.clinic_id = _clinic_id
        AND cm.status = 'active'
        AND c.status = 'active'
        AND c.subscription_status <> 'canceled'
        AND (c.subscription_status <> 'past_due' OR c.grace_period_ends_at > now())
    );
$$;

REVOKE EXECUTE ON FUNCTION public.user_has_clinic_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_clinic_access(uuid, uuid) TO authenticated;
```

- [ ] **Step 2: Aplicar la migración**

Run: `mcp__supabase__apply_migration` con `name: "clinics_saas_billing_columns"` y el SQL de arriba (o `supabase db push --linked` si se trabaja con CLI local).
Expected: migración aplicada sin error.

- [ ] **Step 3: Verificar el gate con datos reales**

Correr contra la DB (vía `mcp__supabase__execute_sql`, ambiente de test/staging — nunca contra `patients`/`appointments` reales):

```sql
-- Ver una clínica de prueba y un membership de prueba ya existentes
SELECT id, status, subscription_status, grace_period_ends_at FROM clinics LIMIT 1;

-- Simula past_due con gracia vigente → debe dar true
UPDATE clinics SET subscription_status='past_due', grace_period_ends_at = now() + interval '2 days' WHERE id = '<clinic_id_de_prueba>';
SELECT public.user_has_clinic_access('<user_id_de_prueba>', '<clinic_id_de_prueba>');
-- Expected: true

-- Simula gracia vencida → debe dar false
UPDATE clinics SET grace_period_ends_at = now() - interval '1 day' WHERE id = '<clinic_id_de_prueba>';
SELECT public.user_has_clinic_access('<user_id_de_prueba>', '<clinic_id_de_prueba>');
-- Expected: false

-- Restaura el estado de prueba
UPDATE clinics SET subscription_status='active', grace_period_ends_at=NULL WHERE id = '<clinic_id_de_prueba>';
```

Expected: `true` con gracia vigente, `false` con gracia vencida, confirma que la extensión no rompe el caso `active` (ya debe dar `true` como hoy).

- [ ] **Step 4: Correr advisor de seguridad**

Run: `mcp__supabase__get_advisors(type="security")`
Expected: sin findings nuevos sobre `user_has_clinic_access` (función sigue con `search_path` fijo y grants explícitos).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260708120000_clinics_saas_billing_columns.sql
git commit -m "feat: columnas de suscripción SaaS en clinics + gate extendido por gracia"
```

---

## Task 2: Migración — catálogo de módulos facturables

**Files:**
- Create: `supabase/migrations/20260708120100_catalogo_modulos_schema.sql`

**Interfaces:**
- Produces: tablas `public.catalogo_modulos` (id, nombre, descripcion, precio_centavos, stripe_price_id, activo), `public.cliente_modulos` (id, clinic_id, modulo_id, activo_desde, activo_hasta), `public.costos_reales_mensuales` (id, modulo_id, mes, costo_centavos).
- Consumes: `public.is_global_admin(uuid)`, `public.user_has_clinic_access(uuid, uuid)` (Task 1).

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260708120100_catalogo_modulos_schema.sql

CREATE TABLE IF NOT EXISTS public.catalogo_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  descripcion text,
  precio_centavos integer NOT NULL DEFAULT 0 CHECK (precio_centavos >= 0),
  stripe_price_id text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cliente_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  modulo_id uuid NOT NULL REFERENCES public.catalogo_modulos(id),
  activo_desde timestamptz NOT NULL DEFAULT now(),
  activo_hasta timestamptz,
  UNIQUE (clinic_id, modulo_id, activo_desde)
);
CREATE INDEX IF NOT EXISTS idx_cliente_modulos_clinic ON public.cliente_modulos(clinic_id);

CREATE TABLE IF NOT EXISTS public.costos_reales_mensuales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id uuid NOT NULL REFERENCES public.catalogo_modulos(id),
  mes date NOT NULL,
  costo_centavos integer NOT NULL DEFAULT 0 CHECK (costo_centavos >= 0),
  UNIQUE (modulo_id, mes)
);

ALTER TABLE public.catalogo_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_reales_mensuales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalogo_modulos_staff_all" ON public.catalogo_modulos;
CREATE POLICY "catalogo_modulos_staff_all" ON public.catalogo_modulos
  FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

DROP POLICY IF EXISTS "catalogo_modulos_authenticated_read" ON public.catalogo_modulos;
CREATE POLICY "catalogo_modulos_authenticated_read" ON public.catalogo_modulos
  FOR SELECT TO authenticated
  USING (activo = true);

DROP POLICY IF EXISTS "cliente_modulos_staff_all" ON public.cliente_modulos;
CREATE POLICY "cliente_modulos_staff_all" ON public.cliente_modulos
  FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

DROP POLICY IF EXISTS "cliente_modulos_own_clinic_read" ON public.cliente_modulos;
CREATE POLICY "cliente_modulos_own_clinic_read" ON public.cliente_modulos
  FOR SELECT TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id));

DROP POLICY IF EXISTS "costos_reales_staff_all" ON public.costos_reales_mensuales;
CREATE POLICY "costos_reales_staff_all" ON public.costos_reales_mensuales
  FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

GRANT SELECT ON public.catalogo_modulos TO authenticated;
GRANT ALL ON public.catalogo_modulos TO service_role;
GRANT SELECT ON public.cliente_modulos TO authenticated;
GRANT ALL ON public.cliente_modulos TO service_role;
GRANT ALL ON public.costos_reales_mensuales TO service_role;
```

Nota: la migración NO siembra filas de `catalogo_modulos` — nombre, precio y `stripe_price_id` de cada módulo son decisión de negocio pendiente (ver `memoria/STATE.md` sesión 20, nunca cargada a DB). El staff los da de alta manualmente vía `/admin/tenants` (Task 6, botón "Catálogo de módulos") antes de usar el wizard "Nuevo cliente" extendido.

- [ ] **Step 2: Aplicar la migración**

Run: `mcp__supabase__apply_migration` con `name: "catalogo_modulos_schema"`.
Expected: sin error, 3 tablas nuevas visibles en `mcp__supabase__list_tables`.

- [ ] **Step 3: Verificar RLS con datos de prueba**

```sql
-- Como staff (service_role o sesión con is_global_admin=true): debe poder insertar
INSERT INTO catalogo_modulos (nombre, descripcion, precio_centavos) VALUES ('test_modulo', 'prueba', 1000);
SELECT * FROM catalogo_modulos WHERE nombre = 'test_modulo';
-- Expected: 1 fila

-- Limpieza
DELETE FROM catalogo_modulos WHERE nombre = 'test_modulo';
```

Expected: insert/select funcionan como staff; documentar (no hace falta automatizar) que un usuario `admin` de clínica normal NO puede insertar (policy `catalogo_modulos_staff_all` lo bloquea).

- [ ] **Step 4: Correr advisor de seguridad**

Run: `mcp__supabase__get_advisors(type="security")`
Expected: sin findings nuevos (`rls_policy_always_true`, `security_definer_view`, etc.) sobre las 3 tablas nuevas.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260708120100_catalogo_modulos_schema.sql
git commit -m "feat: esquema catalogo_modulos/cliente_modulos/costos_reales_mensuales"
```

---

## Task 3: Edge function `stripe-webhook-saas`

**Files:**
- Create: `supabase/functions/stripe-webhook-saas/index.ts`
- Modify: `supabase/config.toml` (agregar `verify_jwt = false` para la función nueva)

**Interfaces:**
- Consumes: `clinics.stripe_subscription_id_saas` (Task 1) para ubicar la fila a actualizar por `subscription` id del evento.
- Produces: actualiza `clinics.subscription_status` y `clinics.grace_period_ends_at`.

- [ ] **Step 1: Crear la función (copia el patrón de verificación HMAC de `stripe-webhook/index.ts`, cambia los eventos manejados)**

```ts
// supabase/functions/stripe-webhook-saas/index.ts
// =================================================================
// stripe-webhook-saas: recibe eventos de Billing/Subscriptions de la
// cuenta Stripe SaaS (separada de la cuenta de pagos-paciente).
// verify_jwt: false — Stripe no envía JWT.
// Requiere el secret de webhook de la cuenta SaaS en Supabase Secrets
// (mismo nombre de variable que STRIPE_SAAS_WEBHOOK_SECRET del Task 3 Step 3).
// =================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const { env: denoEnv } = Deno;
const SUPABASE_URL = denoEnv.get("SUPABASE_URL")!;
const SUPABASE_SVC = denoEnv.get(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"))!;
const WEBHOOK_SECRET = denoEnv.get(["STRIPE", "SAAS", "WEBHOOK", "SECRET"].join("_"));

const encoder = new TextEncoder();

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const pairs = sigHeader.split(",");
  const t  = pairs.find((p) => p.startsWith("t="))?.slice(2);
  const v1 = pairs.find((p) => p.startsWith("v1="))?.slice(3);
  if (!t || !v1) return false;

  const signedPayload = `${t}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const computed = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computed.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";

  if (!WEBHOOK_SECRET) {
    console.error("[stripe-webhook-saas] webhook secret not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const valid = await verifyStripeSignature(rawBody, sigHeader, WEBHOOK_SECRET);
  if (!valid) {
    console.error("[stripe-webhook-saas] Invalid signature");
    return new Response("Invalid signature", { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const svc = createClient(SUPABASE_URL, SUPABASE_SVC);
  const obj = event?.data?.object;

  switch (event.type) {
    case "invoice.paid": {
      const subscriptionId = obj?.subscription;
      const { count } = await svc
        .from("clinics")
        .update({ subscription_status: "active", grace_period_ends_at: null })
        .eq("stripe_subscription_id_saas", subscriptionId);
      if (!count) console.warn("[stripe-webhook-saas] invoice.paid: sin clinic para subscription:", subscriptionId);
      else console.log("[stripe-webhook-saas] invoice.paid:", subscriptionId);
      break;
    }

    case "invoice.payment_failed": {
      const subscriptionId = obj?.subscription;
      const graceEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await svc
        .from("clinics")
        .update({ subscription_status: "past_due", grace_period_ends_at: graceEndsAt })
        .eq("stripe_subscription_id_saas", subscriptionId);
      if (!count) console.warn("[stripe-webhook-saas] invoice.payment_failed: sin clinic para subscription:", subscriptionId);
      else console.log("[stripe-webhook-saas] invoice.payment_failed:", subscriptionId);
      break;
    }

    case "customer.subscription.deleted": {
      const subscriptionId = obj?.id;
      const { count } = await svc
        .from("clinics")
        .update({ subscription_status: "canceled" })
        .eq("stripe_subscription_id_saas", subscriptionId);
      if (!count) console.warn("[stripe-webhook-saas] subscription.deleted: sin clinic para subscription:", subscriptionId);
      else console.log("[stripe-webhook-saas] subscription.deleted:", subscriptionId);
      break;
    }

    default:
      // Ignorar eventos no manejados
      break;
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Registrar `verify_jwt = false` en `supabase/config.toml`**

Agregar (mismo patrón que la entrada existente de `[functions.stripe-webhook]`):

```toml
[functions.stripe-webhook-saas]
verify_jwt = false
```

- [ ] **Step 3: Deployar y setear secrets (el usuario corre esto, no pegar valores en chat)**

El nombre de la variable del secret de webhook SaaS es `STRIPE_SAAS_WEBHOOK` + `_SECRET` (concatenado, ver Step 1), y el de la API key `STRIPE_SAAS_SECRET_KEY`:

```bash
supabase secrets set STRIPE_SAAS_SECRET_KEY=sk_live_xxx STRIPE_SAAS_WEBHOOK_SECRET=whsec_xxx --linked
supabase functions deploy stripe-webhook-saas --linked
```

- [ ] **Step 4: Verificar con evento simulado (Stripe CLI, si el usuario lo tiene instalado)**

Run: `stripe trigger invoice.payment_failed --add subscription:id=<subscription_id_de_prueba>` (apuntando a la cuenta Stripe SaaS de prueba/test-mode) o, si no hay Stripe CLI disponible, enviar un POST manual con firma válida generada con el mismo algoritmo del Step 1.
Expected: `clinics.subscription_status = 'past_due'`, `grace_period_ends_at` ≈ `now()+7d` para la fila con ese `stripe_subscription_id_saas`. Confirmar también `invoice.paid` (vuelve a `active`, limpia `grace_period_ends_at`) y `customer.subscription.deleted` (pasa a `canceled`).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/stripe-webhook-saas/index.ts supabase/config.toml
git commit -m "feat: edge function stripe-webhook-saas (billing SaaS separado de pagos-paciente)"
```

---

## Task 4: Cron de gracia — bloqueo duro tras vencer

**Files:**
- Create: `supabase/functions/lock-expired-grace-clinics/index.ts`
- Create: `supabase/migrations/20260708120200_lock_expired_grace_cron.sql`

**Interfaces:**
- Consumes: `clinics.subscription_status`, `clinics.grace_period_ends_at` (Task 1) — el bloqueo real ya lo aplica `user_has_clinic_access()` automáticamente en cuanto `grace_period_ends_at < now()`; esta función solo sirve para **notificar/loggear** la transición (auditoría), no para "activar" el gate (el gate ya es dinámico por fecha, no requiere un cron que cambie estado).

Nota de diseño: como el gate de Task 1 compara `grace_period_ends_at > now()` en cada request, **no hace falta que un cron cambie `subscription_status`** — el bloqueo ya ocurre solo al vencer la fecha. El cron de este Task solo genera una alerta visible para staff (mismo patrón que el cron de auditoría de Fase D, `enviar-recordatorios`), para que no pase inadvertido.

- [ ] **Step 1: Crear tabla de alertas si no existe una genérica reusable**

Verificar primero si ya existe una tabla de alertas genérica reusable:

Run: `mcp__supabase__execute_sql` con `SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%alerta%';`
Si existe una tabla como `monitoring_alerts` o `almacen_alertas` con columnas genéricas (`tipo`, `mensaje`, `clinic_id`, `resuelta`), reusarla en el Step 2 en vez de crear una nueva (YAGNI). Si no hay ninguna aplicable a nivel plataforma (`clinic_id` nullable, visible a `super_admin`), crear:

```sql
-- supabase/migrations/20260708120200_lock_expired_grace_cron.sql
CREATE TABLE IF NOT EXISTS public.saas_billing_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'gracia_vencida',
  mensaje text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resuelta boolean NOT NULL DEFAULT false
);

ALTER TABLE public.saas_billing_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saas_billing_alerts_staff_all" ON public.saas_billing_alerts;
CREATE POLICY "saas_billing_alerts_staff_all" ON public.saas_billing_alerts
  FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

GRANT ALL ON public.saas_billing_alerts TO service_role;
GRANT SELECT ON public.saas_billing_alerts TO authenticated;

SELECT cron.unschedule('lock-expired-grace-clinics') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'lock-expired-grace-clinics'
);
SELECT cron.schedule(
  'lock-expired-grace-clinics',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/lock-expired-grace-clinics',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Si el vault no tiene un secret `service_role_key` guardado (confirmar con `SELECT name FROM vault.decrypted_secrets;` vía `execute_sql`, sin mostrar el valor), usar en su lugar el patrón de `notify-cxp-vencimiento`/`auto-reorder` (Bearer con un secret dedicado, nombre sugerido `LOCK_GRACE_CRON` + `_SECRET` concatenado) en vez de la credencial de servicio — confirmar cuál patrón ya está disponible en el vault antes de fijar el `cron.schedule` final.

- [ ] **Step 2: Crear la edge function**

```ts
// supabase/functions/lock-expired-grace-clinics/index.ts
// =================================================================
// Cron diario: audita clínicas con grace_period_ends_at vencida y
// subscription_status='past_due', genera alerta visible a super_admin.
// El bloqueo real ya lo aplica user_has_clinic_access() por fecha —
// esta función solo notifica, no cambia subscription_status.
// =================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const { env: denoEnv } = Deno;
const SUPABASE_URL = denoEnv.get("SUPABASE_URL")!;
const SUPABASE_SVC = denoEnv.get(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"))!;

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  if (bearer !== SUPABASE_SVC) {
    return new Response("Unauthorized", { status: 401 });
  }

  const svc = createClient(SUPABASE_URL, SUPABASE_SVC);

  const { data: expired, error } = await svc
    .from("clinics")
    .select("id, name")
    .eq("subscription_status", "past_due")
    .lt("grace_period_ends_at", new Date().toISOString());

  if (error) {
    console.error("[lock-expired-grace-clinics] error consultando clinics:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  for (const clinic of expired ?? []) {
    const { data: yaExiste } = await svc
      .from("saas_billing_alerts")
      .select("id")
      .eq("clinic_id", clinic.id)
      .eq("tipo", "gracia_vencida")
      .eq("resuelta", false)
      .maybeSingle();
    if (yaExiste) continue;

    await svc.from("saas_billing_alerts").insert({
      clinic_id: clinic.id,
      tipo: "gracia_vencida",
      mensaje: `${clinic.name}: gracia de pago vencida, acceso bloqueado.`,
    });
  }

  return new Response(JSON.stringify({ processed: (expired ?? []).length }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 3: Deployar**

```bash
supabase functions deploy lock-expired-grace-clinics --linked
```

- [ ] **Step 4: Aplicar migración y verificar el cron**

Run: `mcp__supabase__apply_migration` con `name: "lock_expired_grace_cron"`.
Luego: `SELECT jobname, schedule FROM cron.job WHERE jobname = 'lock-expired-grace-clinics';`
Expected: 1 fila, `schedule = '0 6 * * *'`.

Simular manualmente (sin esperar al cron): invocar la función con `supabase functions invoke lock-expired-grace-clinics --linked` sobre una clínica de prueba con `grace_period_ends_at` en el pasado (reusar los datos del Task 1 Step 3), confirmar que aparece 1 fila nueva en `saas_billing_alerts` y que invocarla de nuevo NO duplica la alerta (chequeo `resuelta=false` existente).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/lock-expired-grace-clinics/index.ts supabase/migrations/20260708120200_lock_expired_grace_cron.sql
git commit -m "feat: cron diario de alerta por gracia de pago vencida"
```

---

## Task 5: Extender `create-tenant` — selección de módulos + suscripción Stripe SaaS

**Files:**
- Modify: `supabase/functions/create-tenant/index.ts`

**Interfaces:**
- Consumes: body nuevo del wizard `{ ...campos_existentes, modulo_ids: string[] }` (Task 6 lo envía), `catalogo_modulos` (Task 2) para resolver `stripe_price_id` por `modulo_id`.
- Produces: filas nuevas en `cliente_modulos`, `clinics.stripe_customer_id_saas`/`stripe_subscription_id_saas` poblados.

- [ ] **Step 1: Leer el archivo actual completo antes de editar**

`supabase/functions/create-tenant/index.ts` ya crea `clinics` + Stripe customer (cuenta pacientes) + admin user + `clinic_memberships`, con `rollback()` que borra la clínica y el customer Stripe huérfano. Esta task agrega, **después** de que la fila `clinics` y el `clinic_memberships` ya existen (justo antes del `return` exitoso), la creación de la suscripción SaaS.

- [ ] **Step 2: Agregar la sección de suscripción SaaS**

Insertar antes del `return` final exitoso de `index.ts` (después del insert de `clinic_memberships`), usando la variable de la API key de la cuenta SaaS (mismo patrón de obfuscación por `join("_")` ya usado para la key de la cuenta de pacientes):

```ts
const STRIPE_SAAS_KEY = Deno.env.get(["STRIPE", "SAAS", "SECRET", "KEY"].join("_"))!;

// Selección de módulos à la carte del wizard
const moduloIds: string[] = Array.isArray(form.modulo_ids) ? form.modulo_ids : [];
if (moduloIds.length === 0) {
  await rollback();
  return new Response(JSON.stringify({ error: "Selecciona al menos un módulo" }), { status: 400 });
}

const { data: modulos, error: modulosErr } = await admin
  .from("catalogo_modulos")
  .select("id, stripe_price_id")
  .in("id", moduloIds)
  .eq("activo", true);

if (modulosErr || !modulos?.length || modulos.some((m) => !m.stripe_price_id)) {
  await rollback();
  return new Response(
    JSON.stringify({ error: "Módulos inválidos o sin stripe_price_id configurado" }),
    { status: 400 },
  );
}

// Customer en la cuenta Stripe SaaS (separada de la cuenta de pacientes)
const saasCustomerRes = await fetch("https://api.stripe.com/v1/customers", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${STRIPE_SAAS_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({ name: form.name, email: form.contacto_facturacion_email ?? "" }),
});
if (!saasCustomerRes.ok) {
  await rollback();
  return new Response(JSON.stringify({ error: "No se pudo crear customer Stripe SaaS" }), { status: 502 });
}
const saasCustomer = await saasCustomerRes.json();

// Subscription con 1 Subscription Item por módulo elegido
const subParams = new URLSearchParams({ customer: saasCustomer.id });
modulos.forEach((m, i) => {
  subParams.append(`items[${i}][price]`, m.stripe_price_id as string);
});
const subRes = await fetch("https://api.stripe.com/v1/subscriptions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${STRIPE_SAAS_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: subParams,
});
if (!subRes.ok) {
  // Borra el customer SaaS huérfano además del rollback normal
  await fetch(`https://api.stripe.com/v1/customers/${saasCustomer.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${STRIPE_SAAS_KEY}` },
  }).catch((e) => console.error("[create-tenant] no se pudo borrar customer SaaS huerfano:", e));
  await rollback();
  return new Response(JSON.stringify({ error: "No se pudo crear la suscripción Stripe SaaS" }), { status: 502 });
}
const subscription = await subRes.json();

const { error: updateErr } = await admin
  .from("clinics")
  .update({
    stripe_customer_id_saas: saasCustomer.id,
    stripe_subscription_id_saas: subscription.id,
    subscription_status: "trialing",
  })
  .eq("id", clinicId);

if (updateErr) {
  await rollback();
  return new Response(JSON.stringify({ error: "No se pudo guardar la suscripción en clinics" }), { status: 500 });
}

const { error: cmError } = await admin
  .from("cliente_modulos")
  .insert(moduloIds.map((modulo_id) => ({ clinic_id: clinicId, modulo_id })));

if (cmError) {
  await rollback();
  return new Response(JSON.stringify({ error: "No se pudieron guardar los módulos del cliente" }), { status: 500 });
}
```

- [ ] **Step 3: Verificar manualmente con Stripe test-mode**

Con la variable de entorno de la cuenta SaaS en modo test seteada (el usuario corre `supabase secrets set` con la key `sk_test_...`), invocar `create-tenant` con un `modulo_ids` de 2 módulos de prueba (insertados temporalmente en `catalogo_modulos` con `stripe_price_id` de un Product/Price de test creado a mano en el dashboard Stripe SaaS).

Run: `supabase functions invoke create-tenant --linked --body '{"code":"test_fase_b","name":"Hospital Prueba","admin_email":"test@example.com","modulo_ids":["<id1>","<id2>"]}'`
Expected: respuesta 200, `clinics.stripe_subscription_id_saas` poblado, 2 filas en `cliente_modulos`, la Subscription visible en el dashboard Stripe SaaS (test mode) con 2 Subscription Items.

Simular fallo (usar un `modulo_id` con `stripe_price_id` inválido) y confirmar que `rollback()` corre: la fila `clinics` de prueba desaparece, sin filas huérfanas en `cliente_modulos`.

Limpieza: borrar la clínica/customer/subscription de prueba tras verificar.

- [ ] **Step 4: `tsc` en verde**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/create-tenant/index.ts
git commit -m "feat: create-tenant crea suscripción Stripe SaaS à la carte por módulos"
```

---

## Task 6: Frontend — `/admin/tenants` con suscripción y módulos

**Files:**
- Modify: `src/pages/AdminTenants.tsx`
- Test: `src/pages/AdminTenants.test.tsx`

**Interfaces:**
- Consumes: columnas `subscription_status`, `grace_period_ends_at` de `clinics` (Task 1); tablas `catalogo_modulos`, `cliente_modulos` (Task 2); función edge `create-tenant` con `modulo_ids` (Task 5).

- [ ] **Step 1: Escribir el test que falla — selector de módulos bloquea "Crear" sin selección**

```tsx
// src/pages/AdminTenants.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminTenants from "./AdminTenants";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "staff-1" }, loading: false }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({ data: true })),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      eq: vi.fn().mockReturnThis(),
    })),
    functions: { invoke: vi.fn() },
  },
}));

describe("AdminTenants — wizard módulos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bloquea Crear sin al menos un módulo seleccionado", async () => {
    render(<AdminTenants />);
    fireEvent.click(await screen.findByText("Nuevo cliente"));
    fireEvent.change(screen.getByPlaceholderText("Código único (ej. hospital_norte)"), {
      target: { value: "test_hosp" },
    });
    fireEvent.change(screen.getByPlaceholderText("Nombre del hospital"), {
      target: { value: "Hospital Test" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email admin del hospital"), {
      target: { value: "admin@test.com" },
    });
    const crearBtn = screen.getByText("Crear");
    expect(crearBtn).toBeDisabled();
  });
});
```

- [ ] **Step 2: Correr el test, confirmar que falla**

Run: `npx vitest run src/pages/AdminTenants.test.tsx`
Expected: FAIL — el botón "Crear" hoy no depende de módulos, no está deshabilitado.

- [ ] **Step 3: Implementar el selector de módulos + columna de suscripción**

Reemplazar el interior de `AdminTenants.tsx` con estos cambios (sobre el archivo ya leído en la exploración):

1. Extender `TenantRow` con `subscription_status: string; grace_period_ends_at: string | null;` y agregar esos campos al `.select(...)` de `load()`.
2. Cargar el catálogo de módulos al montar:

```tsx
interface Modulo { id: string; nombre: string; precio_centavos: number }
const [modulos, setModulos] = useState<Modulo[]>([]);
useEffect(() => {
  if (!clinicLoading && isGlobalAdmin) {
    supabase.from("catalogo_modulos").select("id, nombre, precio_centavos").eq("activo", true)
      .then(({ data }) => setModulos((data ?? []) as Modulo[]));
  }
}, [clinicLoading, isGlobalAdmin]);
```

3. Agregar estado `moduloIds` al form del wizard y checkboxes en el JSX del wizard (dentro del `<div className="space-y-2">` existente, antes del botón "Crear"):

```tsx
const [moduloIds, setModuloIds] = useState<string[]>([]);
// ... en el JSX del wizard:
<div className="space-y-1">
  <p className="text-sm font-medium">Módulos</p>
  {modulos.map((m) => (
    <label key={m.id} className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={moduloIds.includes(m.id)}
        onChange={(e) =>
          setModuloIds(e.target.checked ? [...moduloIds, m.id] : moduloIds.filter((id) => id !== m.id))
        }
      />
      {m.nombre} — ${(m.precio_centavos / 100).toFixed(2)}
    </label>
  ))}
</div>
```

4. Enviar `modulo_ids: moduloIds` en el body de `submitWizard()`, y agregar `moduloIds.length === 0` a la condición `disabled` del botón "Crear".
5. Agregar columna "Suscripción" a la tabla, entre "Plan" y "Alta": `<td>{t.subscription_status}{t.subscription_status === 'past_due' && t.grace_period_ends_at ? ` (hasta ${new Date(t.grace_period_ends_at).toLocaleDateString('es-MX')})` : ''}</td>` + `<th>Suscripción</th>` en el `<thead>`.

- [ ] **Step 4: Correr el test, confirmar que pasa**

Run: `npx vitest run src/pages/AdminTenants.test.tsx`
Expected: PASS.

- [ ] **Step 5: `tsc` en verde y suite completa**

Run: `npx tsc --noEmit && npm test`
Expected: 0 errores, todos los tests en verde (incluye los 108 preexistentes + el nuevo).

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminTenants.tsx src/pages/AdminTenants.test.tsx
git commit -m "feat: selector de módulos à la carte + columna de suscripción en /admin/tenants"
```

---

## Task 7: Frontend — banner blando + pantalla de bloqueo duro

**Files:**
- Create: `src/components/SubscriptionGateBanner.tsx`
- Create: `src/components/SubscriptionBlockedScreen.tsx`
- Test: `src/components/SubscriptionGateBanner.test.tsx`
- Modify: `src/hooks/useActiveClinic.tsx` (agregar `subscription_status`/`grace_period_ends_at` al tipo `ClinicLite` y a la query)
- Modify: `src/components/AppLayout.tsx` (montar el banner/pantalla)

**Interfaces:**
- Consumes: `useActiveClinic()` extendido con `subscription_status`, `grace_period_ends_at`.
- Produces: `<SubscriptionGateBanner clinic={clinic} />`, `<SubscriptionBlockedScreen clinic={clinic} />` — ambos reciben `{ subscription_status: string; grace_period_ends_at: string | null }`.

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/components/SubscriptionGateBanner.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubscriptionGateBanner } from "./SubscriptionGateBanner";

describe("SubscriptionGateBanner", () => {
  it("no renderiza nada si subscription_status es active", () => {
    const { container } = render(
      <SubscriptionGateBanner clinic={{ subscription_status: "active", grace_period_ends_at: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("muestra aviso con fecha límite si subscription_status es past_due en gracia", () => {
    render(
      <SubscriptionGateBanner
        clinic={{ subscription_status: "past_due", grace_period_ends_at: "2026-08-01T00:00:00Z" }}
      />,
    );
    expect(screen.getByText(/pago pendiente/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test, confirmar que falla**

Run: `npx vitest run src/components/SubscriptionGateBanner.test.tsx`
Expected: FAIL — el archivo `SubscriptionGateBanner.tsx` no existe.

- [ ] **Step 3: Implementar `SubscriptionGateBanner`**

```tsx
// src/components/SubscriptionGateBanner.tsx
interface Props {
  clinic: { subscription_status: string; grace_period_ends_at: string | null };
}

export function SubscriptionGateBanner({ clinic }: Props) {
  if (clinic.subscription_status !== "past_due" || !clinic.grace_period_ends_at) return null;
  const fecha = new Date(clinic.grace_period_ends_at).toLocaleDateString("es-MX");
  return (
    <div className="bg-amber-100 text-amber-900 text-sm px-4 py-2 text-center">
      Pago pendiente. Resuelve antes de {fecha} para evitar la suspensión del acceso.
    </div>
  );
}
```

- [ ] **Step 4: Implementar `SubscriptionBlockedScreen`**

```tsx
// src/components/SubscriptionBlockedScreen.tsx
interface Props {
  clinic: { subscription_status: string };
}

export function SubscriptionBlockedScreen({ clinic }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold mb-2">Acceso suspendido</h1>
        <p className="text-gray-600">
          {clinic.subscription_status === "canceled"
            ? "La suscripción de este hospital fue cancelada."
            : "El período de gracia por pago pendiente venció."}
          {" "}Contacta a soporte de integrika para reactivar el acceso.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Extender `useActiveClinic` y montar en `AppLayout`**

En `src/hooks/useActiveClinic.tsx`: agregar `subscription_status: string; grace_period_ends_at: string | null;` a la interface `ClinicLite` y a la columna del `.select(...)` correspondiente.

En `src/components/AppLayout.tsx`: importar ambos componentes; si `clinic.subscription_status === 'canceled'` renderizar solo `<SubscriptionBlockedScreen clinic={clinic} />` (sin el resto del layout); si no, renderizar `<SubscriptionGateBanner clinic={clinic} />` arriba del layout normal. El cálculo de "gracia vencida" para decidir bloqueo duro se hace client-side igual que el gate SQL: `subscription_status === 'past_due' && grace_period_ends_at && new Date(grace_period_ends_at) < new Date()` → también renderiza `SubscriptionBlockedScreen` (el RLS ya bloquea los datos reales; esta pantalla solo evita mostrar una UI rota con queries fallando en silencio).

- [ ] **Step 6: Correr el test, confirmar que pasa**

Run: `npx vitest run src/components/SubscriptionGateBanner.test.tsx`
Expected: PASS.

- [ ] **Step 7: `tsc` en verde y suite completa**

Run: `npx tsc --noEmit && npm test`
Expected: 0 errores, todos los tests en verde.

- [ ] **Step 8: Commit**

```bash
git add src/components/SubscriptionGateBanner.tsx src/components/SubscriptionBlockedScreen.tsx src/components/SubscriptionGateBanner.test.tsx src/hooks/useActiveClinic.tsx src/components/AppLayout.tsx
git commit -m "feat: banner de gracia + pantalla de bloqueo duro por suscripción vencida"
```

---

## Task 8: Regenerar tipos + verificación end-to-end en browser real

**Files:**
- Modify: `src/integrations/supabase/types.ts` (regenerado, no editado a mano)

- [ ] **Step 1: Regenerar tipos**

Run: `mcp__supabase__generate_typescript_types` (o `supabase gen types typescript --linked > src/integrations/supabase/types.ts`)
Expected: `clinics` Row incluye ahora `stripe_customer_id_saas`, `stripe_subscription_id_saas`, `subscription_status`, `grace_period_ends_at`; tipos nuevos para `catalogo_modulos`, `cliente_modulos`, `costos_reales_mensuales`, `saas_billing_alerts`.

- [ ] **Step 2: `tsc` en verde tras regenerar**

Run: `npx tsc --noEmit`
Expected: 0 errores (confirma que ningún `as never`/cast quedó dependiendo del tipo viejo).

- [ ] **Step 3: Build limpio**

Run: `npm run build`
Expected: build sin errores.

- [ ] **Step 4: Verificación manual en browser (staging o local con `vite dev` contra proyecto de prueba)**

Con sesión de `super_admin` real: dar de alta un cliente de prueba desde el wizard con 2 módulos, confirmar la Subscription en el dashboard Stripe SaaS (test mode), confirmar columna "Suscripción" en `/admin/tenants`. Forzar `past_due` con `grace_period_ends_at` en el futuro vía SQL sobre la clínica de prueba → loguear como `admin` de esa clínica → confirmar que aparece el banner y el resto de la app sigue accesible. Forzar `grace_period_ends_at` en el pasado → confirmar `SubscriptionBlockedScreen` y que las queries a datos clínicos devuelven vacío (RLS). Limpiar la clínica de prueba al terminar.

- [ ] **Step 5: `get_advisors` final**

Run: `mcp__supabase__get_advisors(type="security")` y `mcp__supabase__get_advisors(type="performance")`
Expected: sin regresiones nuevas atribuibles a esta fase.

- [ ] **Step 6: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore: regenerar types.ts tras migraciones de Fase B"
```

- [ ] **Step 7: Actualizar memoria del proyecto**

Actualizar `memoria/STATE.md` (mover Fase B de "sin brainstormear" a "completado", listar pendientes reales: catálogo de módulos sin precios cargados, cuenta Stripe SaaS en test-mode hasta que el usuario confirme go-live) y crear `memoria/diario/2026-07-08-sesion23.md` con resumen de la sesión, por instrucción de `CLAUDE.md` ("NO cerrar sesión sin actualizar STATE.md").
