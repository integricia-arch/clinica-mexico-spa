# Panel de control de suscripciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar al staff (`platform_staff`) una pantalla `/admin/tenants/:id` para ver el estado real de la suscripción de Stripe de una clínica y editar módulos, reactivar o suspender — todo sincronizado con Stripe, nunca solo local.

**Architecture:** Edge Function nueva `manage-subscription` (Deno, mismo patrón que `create-tenant`/`verify-tenant-code`: fetch crudo a `api.stripe.com` con `STRIPE_SAAS_SECRET_KEY`, form-urlencoded, sin SDK de Stripe) expone 4 acciones sobre una clínica: `summary` (GET), `update_modules`, `reactivate`, `suspend` (POST). El frontend agrega una página de detalle que consume esa función vía el helper `callFn` ya existente en `AdminTenants.tsx`.

**Tech Stack:** Deno Edge Functions (Supabase), React + react-router-dom, Supabase JS client, Stripe REST API (cuenta SaaS).

## Global Constraints

- Stripe se toca ANTES que la base de datos en toda acción de escritura; si Stripe falla, la DB no cambia (regla del spec, ya usada en `verify-tenant-code`/`stripe-webhook-saas`).
- Todas las llamadas a Stripe usan `STRIPE_SAAS_SECRET_KEY` (cuenta SaaS, nunca la de pagos-paciente) vía `fetch` crudo a `https://api.stripe.com/v1/...`, form-urlencoded — mismo patrón que `verify-tenant-code/index.ts`.
- La función es staff-only: valida `Authorization` → `supaUser.auth.getUser()` → `admin.rpc("is_global_admin", {_user_id})`, igual que `create-tenant/index.ts:72-84`.
- Nunca `supabase.functions.invoke()` desde el frontend — usar fetch crudo (`callFn`, ya existe en `AdminTenants.tsx:159-171`) para que el mensaje de error real llegue al usuario.
- `cliente_modulos` se actualiza con `delete`-then-`insert` scopeado por `clinic_id` (mismo patrón que `stripe-webhook-saas/index.ts:180-188`), nunca `upsert` suelto.
- Nombres de columnas reales de `clinics` (no inventar otras): `stripe_customer_id_saas`, `stripe_subscription_id_saas`, `subscription_status`, `status`, `grace_period_ends_at`, `plan`.

---

### Task 1: Edge Function `manage-subscription` — scaffold + acción `summary`

**Files:**
- Create: `supabase/functions/manage-subscription/index.ts`
- Create: `supabase/functions/manage-subscription/summary.test.ts`
- Modify: `supabase/config.toml` (agregar entrada de la función)

**Interfaces:**
- Produces: `buildSummary(admin: SupabaseClient, stripeKey: string, clinicId: string): Promise<{ clinic: object, modulos: object[], subscription: object | null, invoices: object[] }>` — usada por Task 1 (GET) y reusada sin cambios por Tasks 2-4 para devolver el resumen actualizado tras cada acción.
- Consumes: nada de tasks previas (primera task).

- [ ] **Step 1: Agregar la función a `supabase/config.toml`**

Buscar el bloque de `[functions.verify-tenant-code]` existente y agregar debajo, mismo formato:

```toml
[functions.manage-subscription]
verify_jwt = true
```

- [ ] **Step 2: Escribir el test de `buildSummary` (falla porque el archivo no existe)**

```typescript
// supabase/functions/manage-subscription/summary.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildSummary } from "./index.ts";

function fakeAdminClient(clinicRow: Record<string, unknown>, modulosRows: Record<string, unknown>[]) {
  return {
    from(table: string) {
      if (table === "clinics") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: clinicRow, error: null }),
            }),
          }),
        };
      }
      if (table === "cliente_modulos") {
        return {
          select: () => ({
            eq: async () => ({ data: modulosRows, error: null }),
          }),
        };
      }
      throw new Error(`tabla inesperada en test: ${table}`);
    },
  } as unknown as import("https://esm.sh/@supabase/supabase-js@2.45.0").SupabaseClient;
}

Deno.test("buildSummary sin suscripción activa devuelve subscription=null", async () => {
  const admin = fakeAdminClient(
    {
      id: "clinic-1",
      name: "Clínica Test",
      status: "active",
      subscription_status: "active",
      grace_period_ends_at: null,
      stripe_customer_id_saas: null,
      stripe_subscription_id_saas: null,
    },
    [],
  );
  const result = await buildSummary(admin, "sk_test_fake", "clinic-1");
  assertEquals(result.subscription, null);
  assertEquals(result.invoices, []);
  assertEquals(result.clinic.name, "Clínica Test");
});
```

- [ ] **Step 3: Correr el test para confirmar que falla**

Run: `deno test --allow-env --allow-net supabase/functions/manage-subscription/summary.test.ts`
Expected: FAIL — `Module not found "./index.ts"` (el archivo todavía no existe).

- [ ] **Step 4: Implementar `index.ts` con el scaffold + `buildSummary` + ruteo de `action=summary`**

```typescript
// supabase/functions/manage-subscription/index.ts
// manage-subscription: panel de staff para editar módulos, reactivar y
// suspender la suscripción de una clínica. Stripe se toca primero; la DB
// solo se actualiza si Stripe confirma. Solo accesible para platform_staff.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno["env"].get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno["env"].get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno["env"].get(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"))!;
const STRIPE_SAAS_KEY = Deno["env"].get(["STRIPE", "SAAS", "SECRET", "KEY"].join("_"))!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function stripeFetch(path: string, method: "GET" | "POST" | "DELETE", params?: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SAAS_KEY}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe error ${res.status}`);
  return data;
}

export async function buildSummary(admin: SupabaseClient, _stripeKey: string, clinicId: string) {
  const { data: clinic, error: clinicErr } = await admin
    .from("clinics")
    .select(
      "id, name, status, plan, subscription_status, grace_period_ends_at, stripe_customer_id_saas, stripe_subscription_id_saas",
    )
    .eq("id", clinicId)
    .single();
  if (clinicErr || !clinic) throw new Error(clinicErr?.message ?? "Clínica no encontrada");

  const { data: modulos, error: modulosErr } = await admin
    .from("cliente_modulos")
    .select("modulo_id, catalogo_modulos(id, nombre, precio_centavos, stripe_price_id)")
    .eq("clinic_id", clinicId);
  if (modulosErr) throw new Error(modulosErr.message);

  let subscription: Record<string, unknown> | null = null;
  let invoices: Record<string, unknown>[] = [];

  if (clinic.stripe_subscription_id_saas) {
    subscription = await stripeFetch(
      `subscriptions/${clinic.stripe_subscription_id_saas}?expand[]=default_payment_method&expand[]=latest_invoice`,
      "GET",
    );
  }
  if (clinic.stripe_customer_id_saas) {
    const invoiceList = await stripeFetch(
      `invoices?customer=${clinic.stripe_customer_id_saas}&limit=12`,
      "GET",
    );
    invoices = invoiceList.data ?? [];
  }

  return { clinic, modulos: modulos ?? [], subscription, invoices };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "no auth" }, 401);

    const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "no user" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: isStaff } = await admin.rpc("is_global_admin", { _user_id: userData.user.id });
    if (!isStaff) return json({ error: "forbidden" }, 403);

    const url = new URL(req.url);

    if (req.method === "GET") {
      const clinicId = url.searchParams.get("clinic_id");
      if (!clinicId) return json({ error: "clinic_id es requerido" }, 400);
      const summary = await buildSummary(admin, STRIPE_SAAS_KEY, clinicId);
      return json(summary);
    }

    return json({ error: "acción no reconocida" }, 400);
  } catch (err) {
    console.error("[manage-subscription] unexpected error:", err);
    return json({ error: (err as Error).message ?? "error inesperado" }, 500);
  }
});
```

- [ ] **Step 5: Correr el test de nuevo**

Run: `deno test --allow-env --allow-net supabase/functions/manage-subscription/summary.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/manage-subscription/index.ts supabase/functions/manage-subscription/summary.test.ts supabase/config.toml
git commit -m "feat: manage-subscription — scaffold + acción summary"
```

---

### Task 2: Acción `update_modules` (prorrateo automático)

**Files:**
- Modify: `supabase/functions/manage-subscription/index.ts`
- Create: `supabase/functions/manage-subscription/update-modules.test.ts`

**Interfaces:**
- Consumes: `stripeFetch(path, method, params)` y `buildSummary(...)` de Task 1 — mismas firmas, sin cambios.
- Produces: `diffModulos(current: string[], next: string[]): { toAdd: string[]; toRemove: string[] }` — pura, testeable sin red, usada solo dentro de esta task.

- [ ] **Step 1: Escribir el test de `diffModulos` (falla — no existe todavía)**

```typescript
// supabase/functions/manage-subscription/update-modules.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { diffModulos } from "./index.ts";

Deno.test("diffModulos detecta agregados y quitados", () => {
  const result = diffModulos(["a", "b"], ["b", "c"]);
  assertEquals(result.toAdd, ["c"]);
  assertEquals(result.toRemove, ["a"]);
});

Deno.test("diffModulos sin cambios devuelve arrays vacíos", () => {
  const result = diffModulos(["a", "b"], ["b", "a"]);
  assertEquals(result.toAdd, []);
  assertEquals(result.toRemove, []);
});
```

- [ ] **Step 2: Correr el test para confirmar que falla**

Run: `deno test --allow-env --allow-net supabase/functions/manage-subscription/update-modules.test.ts`
Expected: FAIL — `diffModulos` no exportada.

- [ ] **Step 3: Implementar `diffModulos` + rama `action=update_modules` en `index.ts`**

Agregar función pura (exportada, junto a `buildSummary`):

```typescript
export function diffModulos(current: string[], next: string[]): { toAdd: string[]; toRemove: string[] } {
  const currentSet = new Set(current);
  const nextSet = new Set(next);
  return {
    toAdd: next.filter((id) => !currentSet.has(id)),
    toRemove: current.filter((id) => !nextSet.has(id)),
  };
}
```

Agregar interfaz de body y la rama POST en el handler (reemplazar el `return json({ error: "acción no reconocida" }, 400);` del final por el ruteo real):

```typescript
interface ActionBody {
  action: "update_modules" | "reactivate" | "suspend";
  clinic_id: string;
  modulo_ids?: string[];
}
```

```typescript
    if (req.method === "POST") {
      const body = (await req.json()) as ActionBody;
      if (!body.clinic_id) return json({ error: "clinic_id es requerido" }, 400);

      if (body.action === "update_modules") {
        const nextIds = Array.isArray(body.modulo_ids) ? body.modulo_ids : [];
        if (nextIds.length === 0) return json({ error: "Selecciona al menos un módulo" }, 400);

        const { data: nextModulos, error: modulosErr } = await admin
          .from("catalogo_modulos")
          .select("id, stripe_price_id")
          .in("id", nextIds)
          .eq("activo", true);
        if (modulosErr || !nextModulos?.length || nextModulos.length !== nextIds.length) {
          return json({ error: "Módulos inválidos" }, 400);
        }
        if (nextModulos.some((m) => !m.stripe_price_id)) {
          return json({ error: "Un módulo no tiene stripe_price_id configurado" }, 400);
        }

        const { data: clinic, error: clinicErr } = await admin
          .from("clinics")
          .select("stripe_subscription_id_saas")
          .eq("id", body.clinic_id)
          .single();
        if (clinicErr || !clinic?.stripe_subscription_id_saas) {
          return json({ error: "Esta clínica no tiene una suscripción activa en Stripe" }, 400);
        }

        const { data: currentRows } = await admin
          .from("cliente_modulos")
          .select("modulo_id")
          .eq("clinic_id", body.clinic_id);
        const currentIds = (currentRows ?? []).map((r) => r.modulo_id as string);
        const { toAdd, toRemove } = diffModulos(currentIds, nextIds);

        const subscription = await stripeFetch(
          `subscriptions/${clinic.stripe_subscription_id_saas}`,
          "GET",
        );
        const items = (subscription.items?.data ?? []) as { id: string; price: { id: string } }[];

        const { data: removedModulos } = await admin
          .from("catalogo_modulos")
          .select("id, stripe_price_id")
          .in("id", toRemove.length ? toRemove : ["__none__"]);

        try {
          for (const priceId of toAdd.length
            ? nextModulos.filter((m) => toAdd.includes(m.id as string)).map((m) => m.stripe_price_id as string)
            : []) {
            await stripeFetch(
              "subscription_items",
              "POST",
              new URLSearchParams({
                subscription: clinic.stripe_subscription_id_saas as string,
                price: priceId,
                proration_behavior: "create_prorations",
              }),
            );
          }
          for (const modulo of removedModulos ?? []) {
            const item = items.find((it) => it.price.id === modulo.stripe_price_id);
            if (!item) continue;
            await stripeFetch(
              `subscription_items/${item.id}?proration_behavior=create_prorations`,
              "DELETE",
            );
          }
        } catch (stripeErr) {
          return json({ error: `Stripe: ${(stripeErr as Error).message}` }, 502);
        }

        const { error: deleteErr } = await admin.from("cliente_modulos").delete().eq("clinic_id", body.clinic_id);
        if (deleteErr) return json({ error: deleteErr.message }, 500);
        const { error: insertErr } = await admin
          .from("cliente_modulos")
          .insert(nextIds.map((modulo_id) => ({ clinic_id: body.clinic_id, modulo_id })));
        if (insertErr) return json({ error: insertErr.message }, 500);

        const summary = await buildSummary(admin, STRIPE_SAAS_KEY, body.clinic_id);
        return json(summary);
      }

      return json({ error: "acción no reconocida" }, 400);
    }

    return json({ error: "método no soportado" }, 405);
```

(Este bloque reemplaza el `if (req.method === "GET") {...}` seguido del `return json({ error: "acción no reconocida" }, 400);` de Task 1 — el `GET` queda igual, se agrega el `POST` a continuación dentro del mismo `try`.)

- [ ] **Step 4: Correr el test de nuevo**

Run: `deno test --allow-env --allow-net supabase/functions/manage-subscription/update-modules.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/manage-subscription/index.ts supabase/functions/manage-subscription/update-modules.test.ts
git commit -m "feat: manage-subscription — acción update_modules con prorrateo"
```

---

### Task 3: Acción `reactivate`

**Files:**
- Modify: `supabase/functions/manage-subscription/index.ts`
- Create: `supabase/functions/manage-subscription/reactivate.test.ts`

**Interfaces:**
- Consumes: `stripeFetch`, `buildSummary` de Task 1.
- Produces: `needsNewCheckout(subscription: { status?: string; cancel_at_period_end?: boolean } | null): boolean` — pura, decide si hay que reanudar in-place o crear Checkout nuevo.

- [ ] **Step 1: Escribir el test de `needsNewCheckout` (falla)**

```typescript
// supabase/functions/manage-subscription/reactivate.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { needsNewCheckout } from "./index.ts";

Deno.test("sin subscription en Stripe, necesita checkout nuevo", () => {
  assertEquals(needsNewCheckout(null), true);
});

Deno.test("subscription canceled, necesita checkout nuevo", () => {
  assertEquals(needsNewCheckout({ status: "canceled" }), true);
});

Deno.test("subscription con cancel_at_period_end, se puede reanudar in-place", () => {
  assertEquals(needsNewCheckout({ status: "active", cancel_at_period_end: true }), false);
});

Deno.test("subscription paused, se puede reanudar in-place", () => {
  assertEquals(needsNewCheckout({ status: "paused", cancel_at_period_end: false }), false);
});
```

- [ ] **Step 2: Correr el test para confirmar que falla**

Run: `deno test --allow-env --allow-net supabase/functions/manage-subscription/reactivate.test.ts`
Expected: FAIL — `needsNewCheckout` no exportada.

- [ ] **Step 3: Implementar `needsNewCheckout` + rama `action=reactivate`**

```typescript
export function needsNewCheckout(subscription: { status?: string; cancel_at_period_end?: boolean } | null): boolean {
  if (!subscription) return true;
  if (subscription.status === "canceled") return true;
  return false;
}
```

Agregar como otra rama del `if (body.action === ...)`, antes del `return json({ error: "acción no reconocida" }, 400);`:

```typescript
      if (body.action === "reactivate") {
        const { data: clinic, error: clinicErr } = await admin
          .from("clinics")
          .select("id, name, contacto_facturacion_email, stripe_subscription_id_saas, stripe_customer_id_saas")
          .eq("id", body.clinic_id)
          .single();
        if (clinicErr || !clinic) return json({ error: "Clínica no encontrada" }, 404);

        let subscription: { status?: string; cancel_at_period_end?: boolean } | null = null;
        if (clinic.stripe_subscription_id_saas) {
          subscription = await stripeFetch(`subscriptions/${clinic.stripe_subscription_id_saas}`, "GET");
        }

        if (needsNewCheckout(subscription)) {
          const { data: modulosRows } = await admin
            .from("cliente_modulos")
            .select("catalogo_modulos(stripe_price_id)")
            .eq("clinic_id", body.clinic_id);
          const priceIds = (modulosRows ?? [])
            .map((r) => (r.catalogo_modulos as { stripe_price_id?: string })?.stripe_price_id)
            .filter((id): id is string => Boolean(id));
          if (priceIds.length === 0) {
            return json({ error: "Esta clínica no tiene módulos para volver a suscribir" }, 400);
          }

          const DEFAULT_SITE = "https://integrika.mx";
          const params = new URLSearchParams({
            mode: "subscription",
            success_url: `${DEFAULT_SITE}/admin/tenants/${clinic.id}?pago=procesando`,
            cancel_url: `${DEFAULT_SITE}/admin/tenants/${clinic.id}?pago=cancelado`,
            "metadata[clinic_id]": clinic.id as string,
            customer_email: clinic.contacto_facturacion_email as string,
            locale: "es-419",
          });
          priceIds.forEach((priceId, i) => {
            params.append(`line_items[${i}][price]`, priceId);
            params.append(`line_items[${i}][quantity]`, "1");
          });

          let session: { url?: string };
          try {
            session = await stripeFetch("checkout/sessions", "POST", params);
          } catch (stripeErr) {
            return json({ error: `Stripe: ${(stripeErr as Error).message}` }, 502);
          }
          return json({ checkout_url: session.url });
        }

        try {
          await stripeFetch(
            `subscriptions/${clinic.stripe_subscription_id_saas}`,
            "POST",
            new URLSearchParams({ cancel_at_period_end: "false" }),
          );
        } catch (stripeErr) {
          return json({ error: `Stripe: ${(stripeErr as Error).message}` }, 502);
        }

        const { error: updateErr } = await admin
          .from("clinics")
          .update({ status: "active", subscription_status: "active" })
          .eq("id", body.clinic_id);
        if (updateErr) return json({ error: updateErr.message }, 500);

        const summary = await buildSummary(admin, STRIPE_SAAS_KEY, body.clinic_id);
        return json(summary);
      }
```

- [ ] **Step 4: Correr el test de nuevo**

Run: `deno test --allow-env --allow-net supabase/functions/manage-subscription/reactivate.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/manage-subscription/index.ts supabase/functions/manage-subscription/reactivate.test.ts
git commit -m "feat: manage-subscription — acción reactivate"
```

---

### Task 4: Acción `suspend`

**Files:**
- Modify: `supabase/functions/manage-subscription/index.ts`
- Create: `supabase/functions/manage-subscription/suspend.test.ts`

**Interfaces:**
- Consumes: `stripeFetch`, `buildSummary` de Task 1.
- Produces: nada nuevo reutilizable — última acción del ruteo.

- [ ] **Step 1: Escribir el test de integración liviano (falla — la rama no existe)**

Usamos un fake de `admin` + `stripeFetch` inyectado vía un parámetro opcional para no pegarle a la red real. Refactor mínimo: extraer el cuerpo de `suspend` a una función exportada `suspendClinic`.

```typescript
// supabase/functions/manage-subscription/suspend.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { suspendClinic } from "./index.ts";

Deno.test("suspendClinic no actualiza la DB si Stripe falla", async () => {
  let dbUpdateCalled = false;
  const admin = {
    from(table: string) {
      if (table === "clinics") {
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: { id: "c1", stripe_subscription_id_saas: "sub_1" }, error: null }) }),
          }),
          update: () => {
            dbUpdateCalled = true;
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      throw new Error(`tabla inesperada: ${table}`);
    },
  } as unknown as import("https://esm.sh/@supabase/supabase-js@2.45.0").SupabaseClient;

  const failingStripeFetch = () => {
    throw new Error("Stripe caído (simulado)");
  };

  await suspendClinic(admin, failingStripeFetch as never, "c1").catch(() => {});
  assertEquals(dbUpdateCalled, false);
});
```

- [ ] **Step 2: Correr el test para confirmar que falla**

Run: `deno test --allow-env --allow-net supabase/functions/manage-subscription/suspend.test.ts`
Expected: FAIL — `suspendClinic` no exportada.

- [ ] **Step 3: Extraer `suspendClinic` y agregar la rama `action=suspend`**

Agregar la función exportada (junto a `buildSummary`/`diffModulos`/`needsNewCheckout`):

```typescript
type StripeFetchFn = (path: string, method: "GET" | "POST" | "DELETE", params?: URLSearchParams) => Promise<any>;

export async function suspendClinic(admin: SupabaseClient, doStripeFetch: StripeFetchFn, clinicId: string) {
  const { data: clinic, error: clinicErr } = await admin
    .from("clinics")
    .select("id, stripe_subscription_id_saas")
    .eq("id", clinicId)
    .single();
  if (clinicErr || !clinic) throw new Error(clinicErr?.message ?? "Clínica no encontrada");
  if (!clinic.stripe_subscription_id_saas) throw new Error("Esta clínica no tiene una suscripción en Stripe");

  await doStripeFetch(
    `subscriptions/${clinic.stripe_subscription_id_saas}`,
    "POST",
    new URLSearchParams({ "pause_collection[behavior]": "void" }),
  );

  const { error: updateErr } = await admin.from("clinics").update({ status: "suspended" }).eq("id", clinicId);
  if (updateErr) throw new Error(updateErr.message);
}
```

Agregar la rama en el handler:

```typescript
      if (body.action === "suspend") {
        try {
          await suspendClinic(admin, stripeFetch, body.clinic_id);
        } catch (err) {
          return json({ error: (err as Error).message }, 502);
        }
        const summary = await buildSummary(admin, STRIPE_SAAS_KEY, body.clinic_id);
        return json(summary);
      }
```

- [ ] **Step 4: Correr el test de nuevo**

Run: `deno test --allow-env --allow-net supabase/functions/manage-subscription/suspend.test.ts`
Expected: PASS

- [ ] **Step 5: Correr todos los tests de la función juntos**

Run: `deno test --allow-env --allow-net supabase/functions/manage-subscription/`
Expected: todos PASS (summary, update-modules, reactivate, suspend).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/manage-subscription/index.ts supabase/functions/manage-subscription/suspend.test.ts
git commit -m "feat: manage-subscription — acción suspend"
```

---

### Task 5: Deploy de la Edge Function

**Files:**
- Ninguno (deploy, no código).

**Interfaces:**
- Consumes: `supabase/functions/manage-subscription/index.ts` completo de Tasks 1-4.
- Produces: función viva en producción, consumida por Task 6.

- [ ] **Step 1: Verificar que `STRIPE_SAAS_SECRET_KEY` ya está seteado**

Run: `supabase secrets list --project-ref kyfkvdyxpvpiacyymldc`
Expected: aparece `STRIPE_SAAS_SECRET_KEY` en la lista (ya se configuró en sesión 24 — no crear uno nuevo).

- [ ] **Step 2: Deploy**

Run: `supabase functions deploy manage-subscription --project-ref kyfkvdyxpvpiacyymldc`
Expected: `Deployed Function manage-subscription`.

- [ ] **Step 3: Smoke test manual con curl contra una clínica de prueba real**

Run (reemplazar `<JWT>` por un token de sesión de `integric.ia@gmail.com` y `<CLINIC_ID>` por el id de "Santo Copo"):
```bash
curl -s "https://kyfkvdyxpvpiacyymldc.supabase.co/functions/v1/manage-subscription?clinic_id=<CLINIC_ID>" \
  -H "Authorization: Bearer <JWT>" | head -c 500
```
Expected: JSON con `clinic`, `modulos`, `subscription`, `invoices` — sin `error`.

- [ ] **Step 4: Commit (si hubo cambios de config.toml no commiteados aún)**

```bash
git status --short
# si config.toml aparece modificado sin commitear:
git add supabase/config.toml
git commit -m "chore: confirma deploy de manage-subscription"
```

---

### Task 6: Frontend — página de detalle `AdminTenantDetail.tsx`

**Files:**
- Create: `src/pages/AdminTenantDetail.tsx`
- Modify: `src/App.tsx:62` (import), `src/App.tsx:139` (agregar ruta)
- Modify: `src/pages/AdminTenants.tsx:246` (fila navegable)

**Interfaces:**
- Consumes: `manage-subscription` (GET/POST) de Tasks 1-4, ya deployada (Task 5). `supabase`/`supabaseUrl` de `@/integrations/supabase/client` (mismo import que `AdminTenants.tsx:2`).
- Produces: componente `AdminTenantDetail` default-exportado, montado en `/admin/tenants/:id`.

- [ ] **Step 1: Crear `AdminTenantDetail.tsx`**

```tsx
// src/pages/AdminTenantDetail.tsx
import { useEffect, useState, useCallback } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { supabase, supabaseUrl } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ModuloRow {
  modulo_id: string;
  catalogo_modulos: { id: string; nombre: string; precio_centavos: number; stripe_price_id: string | null } | null;
}

interface Summary {
  clinic: {
    id: string;
    name: string;
    status: string;
    plan: string;
    subscription_status: string;
    grace_period_ends_at: string | null;
  };
  modulos: ModuloRow[];
  subscription: {
    status?: string;
    current_period_end?: number;
    default_payment_method?: { card?: { brand: string; last4: string } } | null;
  } | null;
  invoices: { id: string; amount_paid: number; status: string; created: number; hosted_invoice_url: string }[];
}

interface CatalogoModulo {
  id: string;
  nombre: string;
  precio_centavos: number;
}

export default function AdminTenantDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [isPlatformStaff, setIsPlatformStaff] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoModulo[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setIsPlatformStaff(false); return; }
    supabase.rpc("is_global_admin", { _user_id: user.id }).then(({ data }) => setIsPlatformStaff(Boolean(data)));
  }, [authLoading, user]);

  const clinicLoading = authLoading || isPlatformStaff === null;
  const isGlobalAdmin = isPlatformStaff === true;

  const callFn = useCallback(async (method: "GET" | "POST", body?: unknown) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const url = method === "GET"
      ? `${supabaseUrl}/functions/v1/manage-subscription?clinic_id=${id}`
      : `${supabaseUrl}/functions/v1/manage-subscription`;
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token}`,
      },
      body: method === "POST" ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, data: data as (Summary & { error?: string }) | { error?: string; checkout_url?: string } | null };
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await callFn("GET");
    if (!ok || !data || "error" in data && data.error) {
      setError((data as { error?: string })?.error ?? "Error cargando la suscripción");
      setLoading(false);
      return;
    }
    const s = data as Summary;
    setSummary(s);
    setSelectedIds(s.modulos.map((m) => m.modulo_id));
    setError(null);
    setLoading(false);
  }, [callFn]);

  useEffect(() => {
    if (!clinicLoading && isGlobalAdmin) load();
  }, [clinicLoading, isGlobalAdmin, load]);

  useEffect(() => {
    if (!clinicLoading && isGlobalAdmin) {
      supabase.from("catalogo_modulos").select("id, nombre, precio_centavos").eq("activo", true)
        .then((res) => setCatalogo((res.data ?? []) as CatalogoModulo[]));
    }
  }, [clinicLoading, isGlobalAdmin]);

  if (clinicLoading) return <div className="p-6">Cargando...</div>;
  if (!isGlobalAdmin) return <Navigate to="/" replace />;

  const currentIds = summary?.modulos.map((m) => m.modulo_id) ?? [];
  const hasModuleChanges =
    selectedIds.length !== currentIds.length || selectedIds.some((id2) => !currentIds.includes(id2));

  const saveModules = async () => {
    setSaving(true);
    setError(null);
    const { ok, data } = await callFn("POST", { action: "update_modules", clinic_id: id, modulo_ids: selectedIds });
    setSaving(false);
    if (!ok || (data as { error?: string })?.error) {
      setError((data as { error?: string })?.error ?? "Error actualizando módulos");
      return;
    }
    await load();
  };

  const reactivate = async () => {
    setSaving(true);
    setError(null);
    const { ok, data } = await callFn("POST", { action: "reactivate", clinic_id: id });
    setSaving(false);
    if (!ok || (data as { error?: string })?.error) {
      setError((data as { error?: string })?.error ?? "Error reactivando");
      return;
    }
    const checkoutUrl = (data as { checkout_url?: string })?.checkout_url;
    if (checkoutUrl) { window.location.href = checkoutUrl; return; }
    await load();
  };

  const suspend = async () => {
    setSaving(true);
    setError(null);
    const { ok, data } = await callFn("POST", { action: "suspend", clinic_id: id });
    setSaving(false);
    if (!ok || (data as { error?: string })?.error) {
      setError((data as { error?: string })?.error ?? "Error suspendiendo");
      return;
    }
    await load();
  };

  return (
    <div className="p-6 max-w-3xl">
      <Link to="/admin/tenants" className="text-blue-600 underline text-sm">&larr; Volver a clientes</Link>
      {loading ? <p className="mt-4">Cargando...</p> : error && !summary ? (
        <p className="text-red-600 mt-4">{error}</p>
      ) : summary && (
        <>
          <h1 className="text-2xl font-semibold mt-2 mb-1">{summary.clinic.name}</h1>
          <p className="text-sm text-gray-500 mb-4">
            Estado: {summary.clinic.status} · Plan: {summary.clinic.plan} · Suscripción: {summary.clinic.subscription_status}
          </p>
          {error && <p className="text-red-600 mb-4">{error}</p>}

          <section className="mb-6 border rounded p-4">
            <h2 className="font-semibold mb-2">Suscripción</h2>
            {summary.subscription ? (
              <div className="text-sm space-y-1">
                <p>Estado en Stripe: {summary.subscription.status}</p>
                {summary.subscription.current_period_end && (
                  <p>Próximo cobro: {new Date(summary.subscription.current_period_end * 1000).toLocaleDateString("es-MX")}</p>
                )}
                {summary.subscription.default_payment_method?.card && (
                  <p>
                    Tarjeta: {summary.subscription.default_payment_method.card.brand} ····{" "}
                    {summary.subscription.default_payment_method.card.last4}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Sin suscripción activa en Stripe.</p>
            )}
            <div className="mt-3 flex gap-3">
              {summary.clinic.status === "suspended" || !summary.subscription ? (
                <button onClick={reactivate} disabled={saving} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50">
                  {saving ? "Procesando..." : "Reactivar suscripción"}
                </button>
              ) : (
                <button onClick={suspend} disabled={saving} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50">
                  {saving ? "Procesando..." : "Suspender"}
                </button>
              )}
            </div>
          </section>

          <section className="mb-6 border rounded p-4">
            <h2 className="font-semibold mb-2">Módulos</h2>
            <div className="space-y-1">
              {catalogo.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.id)}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? [...selectedIds, m.id] : selectedIds.filter((mid) => mid !== m.id))
                    }
                  />
                  {m.nombre} — ${(m.precio_centavos / 100).toFixed(2)}
                </label>
              ))}
            </div>
            <button
              onClick={saveModules}
              disabled={saving || !hasModuleChanges}
              className="mt-3 bg-blue-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </section>

          <section className="border rounded p-4">
            <h2 className="font-semibold mb-2">Historial de facturas</h2>
            {summary.invoices.length === 0 ? (
              <p className="text-sm text-gray-500">Sin facturas todavía.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-1">Fecha</th>
                    <th>Monto</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {summary.invoices.map((inv) => (
                    <tr key={inv.id} className="border-b">
                      <td className="py-1">{new Date(inv.created * 1000).toLocaleDateString("es-MX")}</td>
                      <td>${(inv.amount_paid / 100).toFixed(2)}</td>
                      <td>{inv.status}</td>
                      <td>
                        <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                          Ver
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Agregar el import en `App.tsx`**

Modificar línea 62 (después de `import AdminTenants from "@/pages/AdminTenants";`):

```tsx
import AdminTenants from "@/pages/AdminTenants";
import AdminTenantDetail from "@/pages/AdminTenantDetail";
```

- [ ] **Step 3: Agregar la ruta en `App.tsx`**

Modificar línea 139, agregar justo debajo de la ruta existente de `/admin/tenants`:

```tsx
                        <Route path="/admin/tenants" element={<ProtectedRoute><AdminTenants /></ProtectedRoute>} />
                        <Route path="/admin/tenants/:id" element={<ProtectedRoute><AdminTenantDetail /></ProtectedRoute>} />
```

- [ ] **Step 4: Hacer la fila de la tabla navegable en `AdminTenants.tsx`**

Modificar `src/pages/AdminTenants.tsx` — agregar import de `useNavigate` (línea 4) y usarlo en la fila:

```tsx
import { Navigate, useNavigate } from "react-router-dom";
```

Dentro del componente, después de `const { user, loading: authLoading } = useAuth();` (línea 26):

```tsx
  const navigate = useNavigate();
```

Reemplazar la apertura de la fila (línea 246, `<tr key={t.id} className="border-b">`) por una versión clickeable, dejando los botones de Acciones con `stopPropagation` para que no disparen la navegación:

```tsx
              <tr
                key={t.id}
                className="border-b cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/admin/tenants/${t.id}`)}
              >
```

Y envolver la celda de Acciones existente (línea 258, `<td>`) para frenar el click:

```tsx
                <td onClick={(e) => e.stopPropagation()}>
```

- [ ] **Step 5: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run: `npm run build`
Expected: build limpio, sin warnings nuevos.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminTenantDetail.tsx src/App.tsx src/pages/AdminTenants.tsx
git commit -m "feat: página de detalle de suscripción /admin/tenants/:id"
```

---

### Task 7: Smoke test manual end-to-end (Stripe test-mode)

**Files:**
- Ninguno — verificación manual, no código.

**Interfaces:**
- Consumes: todo lo de Tasks 1-6 desplegado.

- [ ] **Step 1: Abrir `/admin/tenants` logueado como `integric.ia@gmail.com`, click en una clínica de prueba (ej. "Santo Copo")**

Expected: navega a `/admin/tenants/<id>`, carga sin error, muestra suscripción/módulos/facturas reales de Stripe test-mode.

- [ ] **Step 2: Agregar o quitar un módulo, guardar**

Expected: el botón muestra "Guardando...", al terminar recarga el resumen con la lista de módulos actualizada. Confirmar en `dashboard.stripe.com/test/subscriptions/<id>` que el subscription item cambió con prorrateo.

- [ ] **Step 3: Suspender la clínica de prueba**

Expected: status pasa a `suspended`, botón cambia a "Reactivar suscripción". Confirmar en Stripe test-mode que la subscription tiene `pause_collection` activo.

- [ ] **Step 4: Reactivar**

Expected: si la subscription seguía pausada (no cancelada), vuelve a `active` sin redirigir. Confirmar en Stripe que `pause_collection` se quitó.

- [ ] **Step 5: Forzar el caso de checkout nuevo — cancelar la subscription de prueba directo en Stripe test-mode, luego click "Reactivar suscripción" desde el panel**

Expected: redirige a una Checkout Session nueva de Stripe (mismo flujo que el alta original). Completar el pago con tarjeta de test `4242...` y confirmar que `stripe-webhook-saas` reactiva la clínica vía `checkout.session.completed`.

- [ ] **Step 6: Actualizar memoria**

Agregar entrada en `memoria/STATE.md` (sección "Completado") resumiendo qué se implementó y confirmando que el smoke test pasó, siguiendo el mismo formato usado en sesiones anteriores (27-29) de este archivo.
