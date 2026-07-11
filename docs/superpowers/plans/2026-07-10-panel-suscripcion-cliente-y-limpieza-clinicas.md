# Panel de suscripción self-service + archivado de clínicas de prueba + vista de canceladas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cliente ve y controla su suscripción self-service (módulos, facturas, método de pago vía Stripe Customer Portal) en `/configuracion/pagos`; admin archiva (reversible) clínicas de prueba y ve un tab de canceladas/archivadas en `/admin/tenants`.

**Architecture:** Extiende la edge function existente `supabase/functions/manage-subscription/index.ts` (no se crea función nueva) para permitir self-service en `GET` y `update_modules`, y agrega la acción `create_portal_session`. Agrega columna `clinics.archived_at` + RPC `set_clinic_archived`. Frontend: `ConfiguracionPagos.tsx` pasa a consumir el mismo summary que ya usa `AdminTenantDetail.tsx` (componente `InvoicesTable` compartido); `AdminTenants.tsx` agrega tabs con filtro client-side.

**Tech Stack:** React + TypeScript (Vite), Supabase (Postgres + Edge Functions Deno), Stripe REST API vía `fetch` (sin SDK), Vitest + Testing Library (frontend), Deno.test (edge functions).

## Global Constraints

- Stripe se toca primero; la DB solo se actualiza si Stripe confirma (spec, sección "Manejo de errores").
- Toda función `SECURITY DEFINER` nueva: `SET search_path = public`, `REVOKE EXECUTE FROM PUBLIC` + `GRANT` al rol mínimo, check de autorización como primera operación del body, nunca `USING(true)` (CLAUDE.md del proyecto).
- No se construye formulario de tarjeta propio — todo cambio de método de pago va al Customer Portal de Stripe.
- No hay borrado real (`DELETE`) de clínicas — archivado es reversible vía `archived_at`.
- Sin cooldown/review adicional en `update_modules` self-service — solo gate de "no dejar 0 módulos", cambio inmediato con prorrateo.
- Filtro de tabs en `/admin/tenants` es client-side (YAGNI — 4 clínicas hoy, spec lo marca explícito fuera de alcance server-side).
- Edge function changes deployed AND committed (CLAUDE.md) — cada task de backend termina con `supabase functions deploy manage-subscription` antes de dar la task por completa, además del commit.
- Migraciones DDL vía `mcp__supabase__apply_migration` (instrucción MCP del proyecto: "Before making schema changes, use list_tables... Use apply_migration carefully").

---

### Task 1: Migración `clinics.archived_at` + RPC `set_clinic_archived`

**Files:**
- Create: `supabase/migrations/20260710000001_clinics_archived_at.sql`

**Interfaces:**
- Produces: columna `clinics.archived_at timestamptz NULL`; RPC `public.set_clinic_archived(_clinic_id uuid, _archived boolean) RETURNS void`, callable vía `supabase.rpc("set_clinic_archived", { _clinic_id, _archived })` desde el frontend (Task 6 la consume).

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260710000001_clinics_archived_at.sql

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_clinic_archived(_clinic_id uuid, _archived boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_global_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  UPDATE public.clinics
  SET archived_at = CASE WHEN _archived THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = _clinic_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_clinic_archived(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_clinic_archived(uuid, boolean) TO authenticated;
```

- [ ] **Step 2: Aplicar la migración**

Usar `mcp__supabase__apply_migration` con `name: "clinics_archived_at"` y el SQL de arriba (o
`supabase db push --linked --include-all` si se trabaja por CLI local).

- [ ] **Step 3: Verificar columna y RPC**

Correr vía `mcp__supabase__execute_sql`:

```sql
select column_name, data_type from information_schema.columns
where table_name = 'clinics' and column_name = 'archived_at';
```

Expected: 1 fila, `data_type = 'timestamp with time zone'`.

```sql
select proname from pg_proc where proname = 'set_clinic_archived';
```

Expected: 1 fila.

- [ ] **Step 4: Verificar el gate de autorización (RLS negativo)**

Sin sesión de `is_global_admin` real disponible en SQL directo, verificar por lectura de código:
confirmar que el `RAISE EXCEPTION 'No autorizado'` está antes del `UPDATE` (ya lo está en el
Step 1 — no hay branch que lo saltee). Esto se re-verifica de extremo a extremo en el Task 6
(botón Archivar como no-staff no debe existir en la UI, y la ruta ya está gateada por
`isGlobalAdmin` en `AdminTenants.tsx`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260710000001_clinics_archived_at.sql
git commit -m "feat: agrega archived_at + RPC set_clinic_archived para archivado reversible de clinicas"
```

---

### Task 2: Tipos compartidos + componente `InvoicesTable`

**Files:**
- Create: `src/types/subscription.ts`
- Create: `src/components/configuracion/InvoicesTable.tsx`
- Modify: `src/pages/AdminTenantDetail.tsx:1-34` (imports + interfaces), `:213-243` (usar el componente)

**Interfaces:**
- Produces: `SubscriptionSummary`, `SubscriptionInvoice`, `ModuloRow`, `CatalogoModulo` (tipos,
  exportados de `src/types/subscription.ts`); componente `InvoicesTable({ invoices:
  SubscriptionInvoice[] })`.
- Consumes (Task 5): estos mismos tipos y componente, para no duplicar la interfaz `Summary` ni
  el markup de la tabla de facturas entre `AdminTenantDetail.tsx` y `ConfiguracionPagos.tsx`.

- [ ] **Step 1: Crear los tipos compartidos**

```ts
// src/types/subscription.ts
export interface ModuloRow {
  modulo_id: string;
  catalogo_modulos: { id: string; nombre: string; precio_centavos: number; stripe_price_id: string | null } | null;
}

export interface SubscriptionInvoice {
  id: string;
  amount_paid: number;
  status: string;
  created: number;
  hosted_invoice_url: string;
}

export interface SubscriptionSummary {
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
  invoices: SubscriptionInvoice[];
}

export interface CatalogoModulo {
  id: string;
  nombre: string;
  precio_centavos: number;
}
```

- [ ] **Step 2: Crear el componente `InvoicesTable` (extraído 1:1 del markup ya existente en `AdminTenantDetail.tsx:213-243`)**

```tsx
// src/components/configuracion/InvoicesTable.tsx
import type { SubscriptionInvoice } from "@/types/subscription";

export function InvoicesTable({ invoices }: { invoices: SubscriptionInvoice[] }) {
  if (invoices.length === 0) {
    return <p className="text-sm text-gray-500">Sin facturas todavía.</p>;
  }
  return (
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
        {invoices.map((inv) => (
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
  );
}
```

- [ ] **Step 3: Actualizar `AdminTenantDetail.tsx` para usar los tipos y el componente compartidos**

Reemplazar las interfaces locales `ModuloRow`/`Summary`/`CatalogoModulo` (líneas 7-34) por el
import:

```tsx
import type { SubscriptionSummary, CatalogoModulo } from "@/types/subscription";
import { InvoicesTable } from "@/components/configuracion/InvoicesTable";
```

Renombrar todo uso de `Summary` en el archivo a `SubscriptionSummary` (declaración de estado
línea 40: `useState<SubscriptionSummary | null>(null)`, y el cast en `callFn`/`load`).

Reemplazar el bloque de la sección "Historial de facturas" (líneas 213-243) por:

```tsx
          <section className="border rounded p-4">
            <h2 className="font-semibold mb-2">Historial de facturas</h2>
            <InvoicesTable invoices={summary.invoices} />
          </section>
```

- [ ] **Step 4: Verificar en el navegador**

`npm run dev`, entrar como staff a `/admin/tenants/<id de una clínica con facturas>` (ej. Santo
Copo o Clínica Salud Integral MX), confirmar que la tabla de facturas se sigue viendo igual que
antes del cambio.

- [ ] **Step 5: Commit**

```bash
git add src/types/subscription.ts src/components/configuracion/InvoicesTable.tsx src/pages/AdminTenantDetail.tsx
git commit -m "refactor: extrae tipos de suscripcion y componente InvoicesTable compartido"
```

---

### Task 3: Backend — self-service en GET y `update_modules`

**Files:**
- Modify: `supabase/functions/manage-subscription/index.ts:89-110` (gate), `:164-216` (handler
  GET/POST)
- Modify: `supabase/functions/manage-subscription/self-service-gate.test.ts`

**Interfaces:**
- Consumes: `canManageOwnSubscription`, `ActionBody` (ya existentes en el archivo).
- Produces: `isSelfServiceActionForbidden` ahora permite `"cancel" | "update_modules" |
  "create_portal_session"` en vez de solo `"cancel"` (Task 4 agrega `create_portal_session` al
  handler, este task ya lo incluye en el gate). `assertClinicAccess(clinicId, action?)` — helper
  nuevo interno del `Deno.serve`, no exportado (no lo necesita ningún otro módulo).

- [ ] **Step 1: Escribir el test que debe fallar primero (regla de negocio nueva)**

Reemplazar el contenido completo de `self-service-gate.test.ts`:

```ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isSelfServiceActionForbidden } from "./index.ts";

// Regresión que este test protege: un admin de clínica (no-staff) SÍ puede
// gestionar su propia suscripción vía cancel/update_modules/create_portal_session,
// pero NUNCA suspend/reactivate (esas quedan exclusivas de platform_staff) ni
// ninguna acción sobre una clínica que no es la suya.
Deno.test("gate permite cancel de un admin de su propia clinic", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(isSelfServiceActionForbidden("cancel", membership, "clinic-1"), false);
});

Deno.test("gate permite update_modules de un admin de su propia clinic", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(isSelfServiceActionForbidden("update_modules", membership, "clinic-1"), false);
});

Deno.test("gate permite create_portal_session de un admin de su propia clinic", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(isSelfServiceActionForbidden("create_portal_session", membership, "clinic-1"), false);
});

Deno.test("gate rechaza suspend de un admin de su propia clinic", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(isSelfServiceActionForbidden("suspend", membership, "clinic-1"), true);
});

Deno.test("gate rechaza reactivate de un admin de su propia clinic", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(isSelfServiceActionForbidden("reactivate", membership, "clinic-1"), true);
});

Deno.test("gate rechaza update_modules sobre una clinic ajena", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(isSelfServiceActionForbidden("update_modules", membership, "clinic-2"), true);
});

Deno.test("gate rechaza cuando no hay membership", () => {
  assertEquals(isSelfServiceActionForbidden("cancel", null, "clinic-1"), true);
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `deno test supabase/functions/manage-subscription/self-service-gate.test.ts`
Expected: FAIL en los tests de `update_modules`/`create_portal_session` (la implementación
actual solo permite `"cancel"`).

- [ ] **Step 3: Implementar — extender el gate y unificar GET/POST**

En `index.ts`, reemplazar el bloque de comentario + función `isSelfServiceActionForbidden`
(líneas 98-110) por:

```ts
const SELF_SERVICE_ACTIONS = new Set(["cancel", "update_modules", "create_portal_session"]);

// Gate real que corre para requests NO-staff. Deja pasar cancel/update_modules/
// create_portal_session cuando el membership pertenece a la propia clínica —
// suspend/reactivate quedan SIEMPRE exclusivas de platform_staff. Regresión a
// vigilar: agregar "suspend"/"reactivate" a SELF_SERVICE_ACTIONS, o que se
// quite la comparación de `targetClinicId`.
export function isSelfServiceActionForbidden(
  action: ActionBody["action"],
  membership: { role?: string; clinic_id?: string } | null,
  targetClinicId: string,
): boolean {
  return !SELF_SERVICE_ACTIONS.has(action) || !canManageOwnSubscription(membership, targetClinicId);
}
```

Actualizar `ActionBody` (líneas 158-162):

```ts
interface ActionBody {
  action: "update_modules" | "reactivate" | "suspend" | "cancel" | "create_portal_session";
  clinic_id: string;
  modulo_ids?: string[];
}
```

Reemplazar el cuerpo completo de `Deno.serve` (líneas 164-393) por (Task 4 agrega el branch
`create_portal_session` dentro del bloque POST marcado abajo; en este task ese branch aún no
existe, solo el gate ya lo permite):

```ts
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

    const url = new URL(req.url);

    // Devuelve una Response de error si el acceso está prohibido, o null si puede continuar.
    // action=undefined se usa para GET (solo valida que sea la propia clínica, sin gate de acción).
    async function assertClinicAccess(clinicId: string, action?: ActionBody["action"]): Promise<Response | null> {
      if (isStaff) return null;
      const { data: membership } = await admin
        .from("clinic_memberships")
        .select("role, clinic_id")
        .eq("user_id", userData.user.id)
        .eq("clinic_id", clinicId)
        .maybeSingle();
      if (action) {
        if (isSelfServiceActionForbidden(action, membership, clinicId)) return json({ error: "forbidden" }, 403);
        return null;
      }
      if (!canManageOwnSubscription(membership, clinicId)) return json({ error: "forbidden" }, 403);
      return null;
    }

    if (req.method === "GET") {
      const clinicId = url.searchParams.get("clinic_id");
      if (!clinicId) return json({ error: "clinic_id es requerido" }, 400);
      const forbidden = await assertClinicAccess(clinicId);
      if (forbidden) return forbidden;
      const summary = await buildSummary(admin, STRIPE_SAAS_KEY, clinicId);
      return json(summary);
    }

    if (req.method === "POST") {
      const body = (await req.json()) as ActionBody;
      if (!body.clinic_id) return json({ error: "clinic_id es requerido" }, 400);

      const forbidden = await assertClinicAccess(body.clinic_id, body.action);
      if (forbidden) return forbidden;

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

        const subscription = await stripeFetch(`subscriptions/${clinic.stripe_subscription_id_saas}`, "GET");
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
            await stripeFetch(`subscription_items/${item.id}?proration_behavior=create_prorations`, "DELETE");
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
            new URLSearchParams({ cancel_at_period_end: "false", pause_collection: "" }),
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

      if (body.action === "suspend") {
        try {
          await suspendClinic(admin, stripeFetch, body.clinic_id);
        } catch (err) {
          return json({ error: (err as Error).message }, 502);
        }
        const summary = await buildSummary(admin, STRIPE_SAAS_KEY, body.clinic_id);
        return json(summary);
      }

      if (body.action === "cancel") {
        let cancelAt: string;
        try {
          cancelAt = await cancelClinicSubscription(admin, stripeFetch, body.clinic_id);
        } catch (err) {
          return json({ error: (err as Error).message }, 502);
        }
        return json({ subscription_cancel_at: cancelAt });
      }

      return json({ error: "acción no reconocida" }, 400);
    }

    return json({ error: "método no soportado" }, 405);
  } catch (err) {
    console.error("[manage-subscription] unexpected error:", err);
    return json({ error: (err as Error).message ?? "error inesperado" }, 500);
  }
});
```

Nota: este `Deno.serve` reemplaza también el branch viejo `if (!isStaff) { ... action === "cancel"
... }` (líneas 182-209 originales) — ya no existe como bloque separado, `assertClinicAccess`
lo unifica con el flujo staff.

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `deno test supabase/functions/manage-subscription/self-service-gate.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Correr toda la suite de la función (regresión)**

Run: `deno test supabase/functions/manage-subscription/`
Expected: PASS — `cancel.test.ts`, `reactivate.test.ts`, `suspend.test.ts`,
`update-modules.test.ts`, `summary.test.ts` no dependen del `Deno.serve` interno (testean
funciones exportadas puras), deben seguir pasando sin cambios.

- [ ] **Step 6: Deploy + Commit**

```bash
supabase functions deploy manage-subscription
git add supabase/functions/manage-subscription/index.ts supabase/functions/manage-subscription/self-service-gate.test.ts
git commit -m "feat: self-service en GET y update_modules de manage-subscription"
```

---

### Task 4: Backend — acción `create_portal_session`

**Files:**
- Modify: `supabase/functions/manage-subscription/index.ts` (branch dentro del bloque POST del
  Task 3, después del branch `update_modules`)
- Create: `supabase/functions/manage-subscription/portal-session.test.ts`

**Interfaces:**
- Consumes: `stripeFetch` (ya exportado/definido en el archivo), `assertClinicAccess` (Task 3).
- Produces: acción POST `create_portal_session` → `{url: string}` en éxito, `{error: string}` en
  400/502. Consumida por `ConfiguracionPagos.tsx` en Task 5.

- [ ] **Step 1: Escribir el test que debe fallar primero**

```ts
// supabase/functions/manage-subscription/portal-session.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isSelfServiceActionForbidden } from "./index.ts";

// create_portal_session debe ser self-service (el cliente lo dispara desde
// /configuracion/pagos sin ser staff) pero SOLO sobre su propia clínica.
Deno.test("create_portal_session: permitido self-service en la propia clinic", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(isSelfServiceActionForbidden("create_portal_session", membership, "clinic-1"), false);
});

Deno.test("create_portal_session: rechazado sobre clinic ajena", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(isSelfServiceActionForbidden("create_portal_session", membership, "clinic-2"), true);
});
```

- [ ] **Step 2: Correr el test y confirmar que pasa ya (el gate lo agregó el Task 3)**

Run: `deno test supabase/functions/manage-subscription/portal-session.test.ts`
Expected: PASS — el gate ya incluye `create_portal_session` desde el Task 3. Este test documenta
el contrato; lo que falta implementar es el branch del handler (Step 3).

- [ ] **Step 3: Implementar el branch del handler**

En `index.ts`, dentro del bloque `if (req.method === "POST") { ... }` del Task 3, agregar (antes
del branch `if (body.action === "update_modules")`):

```ts
      if (body.action === "create_portal_session") {
        const { data: clinic, error: clinicErr } = await admin
          .from("clinics")
          .select("stripe_customer_id_saas")
          .eq("id", body.clinic_id)
          .single();
        if (clinicErr || !clinic?.stripe_customer_id_saas) {
          return json({ error: "Esta clínica no tiene cliente de Stripe configurado" }, 400);
        }
        try {
          const session = await stripeFetch(
            "billing_portal/sessions",
            "POST",
            new URLSearchParams({
              customer: clinic.stripe_customer_id_saas as string,
              return_url: "https://integrika.mx/configuracion/pagos",
            }),
          );
          return json({ url: session.url });
        } catch (stripeErr) {
          return json({ error: `Stripe: ${(stripeErr as Error).message}` }, 502);
        }
      }

```

- [ ] **Step 4: Prueba manual contra Stripe test-mode**

Con sesión de un admin de clínica de prueba (una de las "p", o crear una temporal con
`stripe_customer_id_saas` de test-mode):

```bash
curl -X POST "$SUPABASE_URL/functions/v1/manage-subscription" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"create_portal_session","clinic_id":"<clinic-id-propia>"}'
```

Expected: `{"url":"https://billing.stripe.com/session/..."}`. Abrir la URL en el navegador,
confirmar que carga el Customer Portal de Stripe con los datos de esa clínica.

- [ ] **Step 5: Deploy + Commit**

```bash
supabase functions deploy manage-subscription
git add supabase/functions/manage-subscription/index.ts supabase/functions/manage-subscription/portal-session.test.ts
git commit -m "feat: accion create_portal_session en manage-subscription"
```

---

### Task 5: Frontend — panel self-service en `ConfiguracionPagos.tsx`

**Files:**
- Modify: `src/pages/configuracion/ConfiguracionPagos.tsx:1-108` (imports + estado + fetch),
  `:219-253` (sección "Tu suscripción")
- Create: `src/pages/configuracion/ConfiguracionPagos.test.tsx`

**Interfaces:**
- Consumes: `SubscriptionSummary`, `CatalogoModulo` (`src/types/subscription.ts`, Task 2),
  `InvoicesTable` (`src/components/configuracion/InvoicesTable.tsx`, Task 2), edge function
  `manage-subscription` (`GET`, `POST action=update_modules|create_portal_session|cancel|
  reactivate`, Tasks 3-4).

- [ ] **Step 1: Escribir el test que debe fallar primero**

```tsx
// src/pages/configuracion/ConfiguracionPagos.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ConfiguracionPagos from "./ConfiguracionPagos";

const mockSummary = {
  clinic: { id: "clinic-1", name: "Clínica Test", status: "active", plan: "estandar", subscription_status: "active", grace_period_ends_at: null },
  modulos: [{ modulo_id: "mod-1", catalogo_modulos: { id: "mod-1", nombre: "Agenda", precio_centavos: 50000, stripe_price_id: "price_1" } }],
  subscription: { status: "active", current_period_end: 1735689600 },
  invoices: [],
};

vi.mock("@/hooks/useActiveClinic", () => ({ useActiveClinic: () => ({ activeClinicId: "clinic-1" }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: "tok" } } })) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
    })),
  },
  supabaseUrl: "https://example.supabase.co",
}));

global.fetch = vi.fn((url: string) => {
  if (url.includes("clinic_id=clinic-1") && !url.includes("action")) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSummary) } as Response);
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSummary) } as Response);
}) as unknown as typeof fetch;

describe("ConfiguracionPagos — panel self-service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra los módulos contratados con precio desde el summary", async () => {
    render(<ConfiguracionPagos />);
    expect(await screen.findByText(/Agenda/)).toBeInTheDocument();
    expect(screen.getByText(/\$500\.00/)).toBeInTheDocument();
  });

  it("deshabilita Guardar cambios si quitar el último módulo dejaría 0", async () => {
    render(<ConfiguracionPagos />);
    const checkbox = await screen.findByLabelText(/Agenda/);
    fireEvent.click(checkbox);
    await waitFor(() => expect(screen.getByText("Guardar cambios")).toBeDisabled());
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run src/pages/configuracion/ConfiguracionPagos.test.tsx`
Expected: FAIL — el componente actual no lee `catalogo_modulos`/módulos del summary, no hay
checkbox con label "Agenda".

- [ ] **Step 3: Implementar — reemplazar estado y fetch de suscripción**

En `ConfiguracionPagos.tsx`, agregar imports (después de la línea 10):

```tsx
import type { SubscriptionSummary, CatalogoModulo } from "@/types/subscription";
import { InvoicesTable } from "@/components/configuracion/InvoicesTable";
```

Reemplazar el bloque de estado de suscripción (líneas 44-58, desde `const [subStatus...` hasta
el cierre de `loadSubscription`) por:

```tsx
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [catalogo, setCatalogo] = useState<CatalogoModulo[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savingModules, setSavingModules] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [subActionLoading, setSubActionLoading] = useState(false);

  const callManageSubscription = async (action: string, extra?: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const res = await fetch(`${supabaseUrl}/functions/v1/manage-subscription`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token}`,
      },
      body: JSON.stringify({ action, clinic_id: activeClinicId, ...extra }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? "No se pudo completar la operación");
    return body;
  };

  const loadSummary = async () => {
    if (!activeClinicId) return;
    setSummaryLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const res = await fetch(`${supabaseUrl}/functions/v1/manage-subscription?clinic_id=${activeClinicId}`, {
      headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data && !data.error) {
      const s = data as SubscriptionSummary;
      setSummary(s);
      setSelectedIds(s.modulos.map((m) => m.modulo_id));
    }
    setSummaryLoading(false);
  };

  useEffect(() => {
    loadSummary();
    if (activeClinicId) {
      supabase.from("catalogo_modulos").select("id, nombre, precio_centavos").eq("activo", true)
        .then((res) => setCatalogo(((res as { data?: CatalogoModulo[] }).data ?? [])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClinicId]);
```

Eliminar la función `loadSubscription` vieja y su `useEffect` asociado (lo que era líneas 60-63),
ya reemplazados arriba.

Reemplazar `handleConfirmCancel`/`handleReactivate` (líneas 80-104) por versiones que usan
`summary` en vez de `subStatus`/`subCancelAt`:

```tsx
  const handleConfirmCancel = async () => {
    setSubActionLoading(true);
    try {
      await callManageSubscription("cancel");
      await loadSummary();
      setCancelModalOpen(false);
      toast.success("Suscripción cancelada — acceso vigente hasta el fin del período pagado");
    } catch (err) {
      toast.error((err as Error).message);
    }
    setSubActionLoading(false);
  };

  const handleReactivate = async () => {
    setSubActionLoading(true);
    try {
      await callManageSubscription("reactivate");
      await loadSummary();
      toast.success("Suscripción reactivada");
    } catch (err) {
      toast.error((err as Error).message);
    }
    setSubActionLoading(false);
  };

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const body = await callManageSubscription("create_portal_session");
      if (body?.url) window.location.href = body.url;
    } catch (err) {
      toast.error((err as Error).message);
    }
    setPortalLoading(false);
  };

  const currentModuleIds = summary?.modulos.map((m) => m.modulo_id) ?? [];
  const hasModuleChanges =
    selectedIds.length !== currentModuleIds.length || selectedIds.some((id) => !currentModuleIds.includes(id));

  const handleSaveModules = async () => {
    setSavingModules(true);
    setModulesError(null);
    try {
      await callManageSubscription("update_modules", { modulo_ids: selectedIds });
      await loadSummary();
      toast.success("Módulos actualizados");
    } catch (err) {
      setModulesError((err as Error).message);
    }
    setSavingModules(false);
  };

  const subStatus = summary?.clinic.subscription_status ?? null;
  const fechaCorte = summary?.subscription?.current_period_end
    ? new Date(summary.subscription.current_period_end * 1000).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "";
```

Eliminar la referencia obsoleta `subCancelAt` en el `<CancelarSuscripcionModal>` al final del
archivo (línea 414): ya no existe esa variable, `fechaCorte` ahora sale de `summary`.

- [ ] **Step 4: Implementar — reemplazar el markup de la sección "Tu suscripción" (líneas 219-253)**

```tsx
      {/* Suscripción */}
      {summary && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
          <h2 className="font-semibold text-card-foreground">Tu suscripción</h2>

          {subStatus === "canceling" ? (
            <div className="rounded-lg bg-warning/10 border border-warning/30 px-4 py-3 text-sm text-warning-foreground space-y-3">
              <p>
                Tu suscripción está programada para cancelarse. Tienes acceso completo a
                todos tus módulos hasta el <strong>{fechaCorte}</strong>.
              </p>
              <Button type="button" size="sm" onClick={handleReactivate} disabled={subActionLoading} className="gap-2">
                {subActionLoading ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
                Reactivar suscripción
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Plan {summary.clinic.plan}. Próximo cobro: {fechaCorte || "sin fecha disponible"}.
            </p>
          )}

          <div>
            <h3 className="text-sm font-semibold text-card-foreground mb-2">Módulos contratados</h3>
            <div className="space-y-2">
              {catalogo.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.id)}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? [...selectedIds, m.id] : selectedIds.filter((id) => id !== m.id))
                    }
                  />
                  {m.nombre} — ${(m.precio_centavos / 100).toFixed(2)}
                </label>
              ))}
            </div>
            {modulesError && <p className="text-sm text-destructive mt-2">{modulesError}</p>}
            <Button
              type="button"
              size="sm"
              className="mt-3"
              onClick={handleSaveModules}
              disabled={savingModules || !hasModuleChanges || selectedIds.length === 0}
            >
              {savingModules ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar cambios
            </Button>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-card-foreground mb-2">Método de pago</h3>
            {summary.subscription?.default_payment_method?.card ? (
              <p className="text-sm text-muted-foreground mb-2">
                {summary.subscription.default_payment_method.card.brand} ···· {summary.subscription.default_payment_method.card.last4}
              </p>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={handleOpenPortal} disabled={portalLoading} className="gap-2">
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Actualizar método de pago
            </Button>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-card-foreground mb-2">Facturas</h3>
            <InvoicesTable invoices={summary.invoices} />
          </div>

          {subStatus !== "canceling" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCancelModalOpen(true)}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <XCircle className="h-4 w-4" />
              Cancelar suscripción
            </Button>
          )}
        </section>
      )}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npx vitest run src/pages/configuracion/ConfiguracionPagos.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Verificar en el navegador (manual)**

`npm run dev`, entrar como admin de "Clínica Salud Integral MX" a `/configuracion/pagos`,
confirmar: se ven los 4 módulos con precio, botón "Actualizar método de pago" redirige a Stripe
test-mode, desmarcar todos los módulos deja "Guardar cambios" deshabilitado.

- [ ] **Step 7: Commit**

```bash
git add src/pages/configuracion/ConfiguracionPagos.tsx src/pages/configuracion/ConfiguracionPagos.test.tsx
git commit -m "feat: panel de suscripcion self-service completo en ConfiguracionPagos"
```

---

### Task 6: Frontend — tabs Activas/Canceladas/Archivadas en `AdminTenants.tsx`

**Files:**
- Modify: `src/pages/AdminTenants.tsx:6-17` (interface), `:79-98` (query + carga), `:222-288`
  (tabla + tabs)

**Interfaces:**
- Consumes: RPC `set_clinic_archived` (Task 1).
- Produces: ninguna consumida por otro task (hoja del árbol de dependencias).

- [ ] **Step 1: Escribir el test que debe fallar primero**

Agregar a `src/pages/AdminTenants.test.tsx` (después del `describe` existente, mismo archivo):

```tsx
describe("AdminTenants — tabs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("por default muestra solo clinicas activas (sin archivar, sin cancelar)", async () => {
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn(() =>
        Promise.resolve({
          data: [
            { id: "1", code: "a", name: "Activa", status: "active", plan: "estandar", created_at: "2026-01-01", whatsapp_status: null, whatsapp_phone_number_id: null, subscription_status: "active", grace_period_ends_at: null, archived_at: null },
            { id: "2", code: "b", name: "Cancelada", status: "active", plan: "estandar", created_at: "2026-01-01", whatsapp_status: null, whatsapp_phone_number_id: null, subscription_status: "canceled", grace_period_ends_at: null, archived_at: null },
            { id: "3", code: "c", name: "Archivada", status: "active", plan: "estandar", created_at: "2026-01-01", whatsapp_status: null, whatsapp_phone_number_id: null, subscription_status: "trialing", grace_period_ends_at: null, archived_at: "2026-07-01" },
          ],
          error: null,
        }),
      ),
      eq: vi.fn().mockReturnThis(),
    });
    render(<AdminTenants />);
    expect(await screen.findByText("Activa")).toBeInTheDocument();
    expect(screen.queryByText("Cancelada")).not.toBeInTheDocument();
    expect(screen.queryByText("Archivada")).not.toBeInTheDocument();
  });

  it("tab Canceladas muestra solo subscription_status canceling/canceled sin archivar", async () => {
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn(() =>
        Promise.resolve({
          data: [
            { id: "1", code: "a", name: "Activa", status: "active", plan: "estandar", created_at: "2026-01-01", whatsapp_status: null, whatsapp_phone_number_id: null, subscription_status: "active", grace_period_ends_at: null, archived_at: null },
            { id: "2", code: "b", name: "Cancelada", status: "active", plan: "estandar", created_at: "2026-01-01", whatsapp_status: null, whatsapp_phone_number_id: null, subscription_status: "canceled", grace_period_ends_at: null, archived_at: null },
          ],
          error: null,
        }),
      ),
      eq: vi.fn().mockReturnThis(),
    });
    render(<AdminTenants />);
    fireEvent.click(await screen.findByText("Canceladas"));
    expect(await screen.findByText("Cancelada")).toBeInTheDocument();
    expect(screen.queryByText("Activa")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run src/pages/AdminTenants.test.tsx`
Expected: FAIL — no existe texto "Canceladas" (sin tabs), y el listado default hoy muestra
todas las filas sin filtrar por `archived_at`/`subscription_status`.

- [ ] **Step 3: Implementar — query, tipo, y estado de tab**

En `AdminTenants.tsx`, agregar `archived_at` a la interface `TenantRow` (línea 6-17):

```tsx
interface TenantRow {
  id: string;
  code: string;
  name: string;
  status: string;
  plan: string;
  created_at: string;
  whatsapp_status: string | null;
  whatsapp_phone_number_id: string | null;
  subscription_status: string;
  grace_period_ends_at: string | null;
  archived_at: string | null;
}
```

Agregar `archived_at` al `select` de `load` (línea 84):

```tsx
      .select(
        "id, code, name, status, plan, created_at, whatsapp_status, whatsapp_phone_number_id, subscription_status, grace_period_ends_at, archived_at"
      )
```

Agregar estado de tab (junto a los demás `useState`, cerca de la línea 32):

```tsx
  const [tab, setTab] = useState<"activas" | "canceladas" | "archivadas">("activas");
```

Agregar la función de filtro y el archivar/desarchivar (junto a `setStatus`, después de la
línea 126):

```tsx
  const setArchived = async (clinicId: string, archived: boolean) => {
    const { error: rpcErr } = await supabase.rpc("set_clinic_archived", {
      _clinic_id: clinicId,
      _archived: archived,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    await load();
  };

  const filteredTenants = tenants.filter((t) => {
    if (tab === "archivadas") return t.archived_at !== null;
    if (t.archived_at !== null) return false;
    const isCanceled = t.subscription_status === "canceling" || t.subscription_status === "canceled";
    return tab === "canceladas" ? isCanceled : !isCanceled;
  });
```

- [ ] **Step 4: Implementar — UI de tabs y acciones por tab**

Reemplazar el `<table>` (líneas 233-287) — envolver con los tabs antes, y usar
`filteredTenants` en vez de `tenants`, agregando columna de Archivar/Desarchivar:

```tsx
      <div className="flex gap-2 mb-4">
        {(["activas", "canceladas", "archivadas"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-sm ${tab === t ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          >
            {t === "activas" ? "Activas" : t === "canceladas" ? "Canceladas" : "Archivadas"}
          </button>
        ))}
      </div>
      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Nombre</th>
              <th>Código</th>
              <th>Estado</th>
              <th>Plan</th>
              <th>Suscripción</th>
              <th>Alta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredTenants.map((t) => (
              <tr
                key={t.id}
                className="border-b cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/admin/tenants/${t.id}`)}
              >
                <td className="py-2">{t.name}</td>
                <td>{t.code}</td>
                <td>{t.status}</td>
                <td>{t.plan}</td>
                <td>
                  {t.subscription_status}
                  {t.subscription_status === "past_due" && t.grace_period_ends_at
                    ? ` (hasta ${new Date(t.grace_period_ends_at).toLocaleDateString("es-MX")})`
                    : ""}
                </td>
                <td>{new Date(t.created_at).toLocaleDateString("es-MX")}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {tab === "archivadas" ? (
                    <button onClick={() => setArchived(t.id, false)} className="text-green-700 underline">
                      Desarchivar
                    </button>
                  ) : (
                    <>
                      {t.status === "suspended" ? (
                        <button onClick={() => setStatus(t.id, "active")} className="text-green-700 underline">
                          Reactivar
                        </button>
                      ) : (
                        <button onClick={() => setStatus(t.id, "suspended")} className="text-red-700 underline">
                          Suspender
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`¿Archivar ${t.name}? Se puede desarchivar después, no se borran datos.`)) {
                            setArchived(t.id, true);
                          }
                        }}
                        className="text-orange-700 underline ml-3"
                      >
                        Archivar
                      </button>
                      <button
                        onClick={() => {
                          setWaTarget(t);
                          setWaForm({ phone_number_id: t.whatsapp_phone_number_id ?? "", waba_id: "", test_to: "" });
                          setWaError(null);
                        }}
                        className="text-blue-700 underline ml-3"
                      >
                        WhatsApp
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npx vitest run src/pages/AdminTenants.test.tsx`
Expected: PASS (todos los tests del archivo — el pre-existente de módulos del wizard y los 2
nuevos de tabs).

- [ ] **Step 6: Verificar en el navegador (manual)**

`npm run dev`, entrar como staff a `/admin/tenants`: tab Activas muestra "Clínica Salud Integral
MX" y las 2 clínicas "p" (aún sin archivar); tab Canceladas muestra "Santo Copo"; click
"Archivar" en una de las "p" → confirma → desaparece de Activas, aparece en tab Archivadas con
botón "Desarchivar" que la regresa.

- [ ] **Step 7: Commit**

```bash
git add src/pages/AdminTenants.tsx src/pages/AdminTenants.test.tsx
git commit -m "feat: tabs Activas/Canceladas/Archivadas y archivado reversible en AdminTenants"
```

---

### Task 7: Smoke test E2E manual (misma sesión, no diferir)

Sin archivos nuevos — checklist de verificación manual en `https://integrika.mx` o local
(`npm run dev`) con Stripe en test-mode, a correr inmediatamente después del Task 6:

- [ ] **Paso 1:** Login como admin de "Clínica Salud Integral MX" → `/configuracion/pagos` →
  confirmar que se ven los 4 módulos con precio y el total, historial de facturas, botón
  "Actualizar método de pago".
- [ ] **Paso 2:** Click "Actualizar método de pago" → confirmar redirect a
  `billing.stripe.com` con los datos correctos de esa clínica (test-mode).
- [ ] **Paso 3:** Volver a `/configuracion/pagos`, desmarcar un módulo, click "Guardar cambios"
  → confirmar toast de éxito y que el total mensual bajó; verificar en Stripe Dashboard
  (test-mode) que el `subscription_item` correspondiente se eliminó con prorrateo.
  Desmarcar TODOS los módulos → confirmar que "Guardar cambios" queda deshabilitado (no se
  puede llegar a 0 módulos).
- [ ] **Paso 4:** Login como staff → `/admin/tenants` → tab Activas → click "Archivar" en una
  de las clínicas "p" → confirmar que desaparece de Activas y aparece en tab Archivadas.
- [ ] **Paso 5:** Tab Archivadas → click "Desarchivar" en esa misma clínica → confirmar que
  regresa a Activas.
- [ ] **Paso 6:** Tab Canceladas → confirmar que se ve "Santo Copo" (no se archivó, sigue como
  cancelación real).
- [ ] **Paso 7:** Actualizar `memoria/STATE.md` marcando las 3 piezas como completadas y crear
  nota en `memoria/diario/2026-07-10.md` con resumen de la sesión (regla obligatoria del
  `CLAUDE.md` del proyecto — no cerrar sin esto).
