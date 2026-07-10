# Cancelación Self-Service + Gating Real de Módulos — Plan de Implementación

> **Para workers agénticos:** SUB-SKILL REQUERIDO: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`) para tracking.

**Goal:** Permitir que el admin de una clínica cliente cancele su propia suscripción (sin depender de `platform_staff`) y que el acceso a cada módulo pagado se valide de verdad — hoy NO existe ningún control por módulo, ni cosmético ni de backend (confirmado por auditoría de código, sesión 33).

**Architecture:** Dos subsistemas independientes que comparten una sola fuente de verdad (`clinics.subscription_status` + `cliente_modulos.activo_hasta`, Stripe como origen):
1. **Cancelación self-service**: nueva acción `cancel` en `manage-subscription`, habilitada para el rol `admin` de `clinic_memberships` (hoy solo `is_global_admin`). Cancela en Stripe con `cancel_at_period_end=true` (nunca corte inmediato) — mismo patrón que Amazon/Spotify/Claude.
2. **Gating real de módulos**: función Postgres `clinic_has_modulo_access()` SECURITY DEFINER, usada en RLS de las tablas de cada módulo + como capa cosmética en frontend (defensa en profundidad, nunca frontend-only).

**Tech Stack:** Supabase (Postgres RLS + Edge Functions Deno), React/TypeScript, Stripe API (cuenta SaaS, `STRIPE_SAAS_SECRET_KEY`).

## Investigación previa (sesión 33 — no repetir)

**Cómo manejan esto Amazon, Spotify y Anthropic (research vía WebSearch):**
- **Amazon Prime**: cancelar en cualquier momento desde "Your Memberships". Acceso sigue hasta fin del período ya pagado. Reembolso completo solo si canceló ≤3 días hábiles de la compra Y no usó beneficios; si no, sin reembolso parcial.
- **Spotify**: cancelar cuando quieras. Premium sigue activo hasta la fecha de renovación, luego pasa a free automático. Sin reembolso parcial por cancelar a mitad de ciclo. Excepción: cancelar durante trial gratis corta el acceso de inmediato (no aplica a nuestro caso, no tenemos trial real).
- **Anthropic (Claude)**: cancelar en Settings → Billing en cualquier momento. Acceso al plan pago sigue hasta el fin del período de facturación actual. Reembolso solo en ventana corta (14 días, UE/UK) — fuera de esa ventana, prorrateo según uso, no reembolso completo.

**Patrón único, sin excepciones entre las 3**: cancelar es self-service e inmediato en la UI, pero el EFECTO (pérdida de acceso) nunca es inmediato — siempre corre hasta el fin del período ya pagado. Nunca reembolso parcial por el tiempo restante ya pagado. Esto es lo que implementamos: `cancel_at_period_end=true`, nunca cancelación dura desde el self-service.

**Estado actual del código (auditoría, sesión 33):**
- `cliente_modulos` existe con `activo_hasta`, pero **ninguna parte del código la lee** para gating — ni frontend (`AppLayout.tsx`, `ProtectedRoute` en `App.tsx:100-117`) ni RLS de tablas funcionales. Solo se usa para trazabilidad/facturación.
- El único gate real hoy es a nivel de CLÍNICA COMPLETA: `AppLayout.tsx:151-156` bloquea toda la app si `subscription_status === "canceled"` o venció `grace_period_ends_at`. Calculado en cliente (JS `Date` compare), no en RLS.
- `manage-subscription` (`supabase/functions/manage-subscription/index.ts:130-131`) exige `is_global_admin` — 403 para cualquier otro rol. Solo lo consume `AdminTenantDetail.tsx` (panel staff). Acciones existentes: `update_modules`, `reactivate`, `suspend` (pausa cobro, no cancela). **No existe acción `cancel` real.**
- Ya existe un plan previo (`docs/superpowers/plans/2026-07-09-panel-suscripciones.md`) — es 100% panel-admin-staff, no toca self-service ni gating por módulo. Sin solapamiento.

## Global Constraints

- Cancelar nunca corta acceso al instante — siempre `cancel_at_period_end=true`, acceso corre hasta `current_period_end` de Stripe.
- Toda función `SECURITY DEFINER` nueva DEBE cumplir el checklist de `CLAUDE.md` del proyecto: `SET search_path = public`, `REVOKE EXECUTE FROM PUBLIC` + `GRANT` al rol mínimo, check de `clinic_memberships`/`auth.uid()` como primera operación.
- `cliente_modulos.activo_hasta` se valida por FECHA (`is null or > now()`), nunca solo por existencia de la fila.
- Ningún gating puede ser frontend-only — toda restricción de acceso a datos de un módulo debe reforzarse en RLS o Edge Function, el frontend es solo cosmético (ocultar nav) además del enforcement real.
- Nomenclatura: nuevo estado `clinics.subscription_status = 'canceling'` para "cancelación programada, acceso vigente hasta X" — distinto de `'canceled'` (ya terminó).

---

### Task 1: Migración — estado `canceling` + columna `subscription_cancel_at`

**Files:**
- Create: `supabase/migrations/<timestamp>_subscription_cancel_at.sql`

**Interfaces:**
- Produces: columna `clinics.subscription_cancel_at timestamptz null` (fecha en que Stripe cortará el acceso realmente) y valor `'canceling'` válido en el CHECK constraint de `subscription_status` (si existe uno — confirmar con `\d clinics` antes de escribir el ALTER).

- [ ] **Step 1: Confirmar constraint actual**

Correr contra el proyecto (`kyfkvdyxpvpiacyymldc`):
```sql
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'clinics'::regclass AND contype = 'c';
```
Anotar el nombre exacto del CHECK sobre `subscription_status` para el DROP/CREATE del siguiente paso.

- [ ] **Step 2: Escribir la migración**

```sql
-- supabase/migrations/<timestamp>_subscription_cancel_at.sql
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS subscription_cancel_at timestamptz;

-- Reemplazar <nombre_constraint_real> por el confirmado en Step 1
ALTER TABLE clinics DROP CONSTRAINT IF EXISTS <nombre_constraint_real>;
ALTER TABLE clinics ADD CONSTRAINT <nombre_constraint_real>
  CHECK (subscription_status IN ('active', 'past_due', 'canceling', 'canceled', 'trialing'));

COMMENT ON COLUMN clinics.subscription_cancel_at IS
  'Fecha en que Stripe cortará el acceso real tras cancelación self-service (cancel_at_period_end). NULL si no hay cancelación programada.';
```

- [ ] **Step 3: Aplicar y verificar**

`mcp__supabase__apply_migration` con el contenido de arriba. Verificar con:
```sql
SELECT subscription_status, subscription_cancel_at FROM clinics LIMIT 1;
```
Expected: query corre sin error, columna existe.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/<timestamp>_subscription_cancel_at.sql
git commit -m "feat: agregar subscription_cancel_at y estado canceling a clinics"
```

**Agente sugerido**: `ecc:database-reviewer` revisa la migración antes de aplicar (reversibilidad, lock level — tabla `clinics` es chica, sin riesgo real, pero sigue el hábito del proyecto).

---

### Task 2: Función `clinic_has_modulo_access` (gating real, SECURITY DEFINER)

**Files:**
- Create: `supabase/migrations/<timestamp>_clinic_has_modulo_access.sql`

**Interfaces:**
- Produces: `clinic_has_modulo_access(p_clinic_id uuid, p_modulo_slug text) RETURNS boolean` — usable directo en cualquier RLS policy vía `USING (clinic_has_modulo_access(clinic_id, 'farmacia'))`.
- Consumes: tablas `clinics` (subscription_status, grace_period_ends_at), `cliente_modulos` (activo_hasta), `catalogo_modulos` (slug↔id).

- [ ] **Step 1: Confirmar si `catalogo_modulos` tiene columna `slug`**

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'catalogo_modulos';
```
Si no existe `slug` (solo `id`/`nombre`), la función recibe `p_modulo_id uuid` en vez de slug — ajustar firma antes de seguir. Confirmar esto ANTES de escribir el Step 2 (bloqueante).

- [ ] **Step 2: Escribir la función**

```sql
-- supabase/migrations/<timestamp>_clinic_has_modulo_access.sql
CREATE OR REPLACE FUNCTION clinic_has_modulo_access(p_clinic_id uuid, p_modulo_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM cliente_modulos cm
    JOIN catalogo_modulos m ON m.id = cm.modulo_id
    JOIN clinics c ON c.id = cm.clinic_id
    WHERE cm.clinic_id = p_clinic_id
      AND m.slug = p_modulo_slug
      AND (cm.activo_hasta IS NULL OR cm.activo_hasta > now())
      AND c.subscription_status IN ('active', 'past_due', 'canceling')
      AND (c.subscription_status != 'past_due' OR c.grace_period_ends_at > now())
  );
$$;

REVOKE EXECUTE ON FUNCTION clinic_has_modulo_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clinic_has_modulo_access(uuid, text) TO authenticated;
```

- [ ] **Step 3: Test manual directo**

```sql
-- Con una clinic_id real de prueba y un slug que SÍ tiene contratado:
SELECT clinic_has_modulo_access('<clinic_id_real>', 'agenda');
-- Expected: true

-- Con un slug que NO tiene contratado:
SELECT clinic_has_modulo_access('<clinic_id_real>', 'pos_farmacia');
-- Expected: false (a menos que sí lo tenga — verificar contra cliente_modulos real)
```

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/<timestamp>_clinic_has_modulo_access.sql
git commit -m "feat: función clinic_has_modulo_access para gating real por módulo"
```

**Agente obligatorio**: `ecc:security-reviewer` — esta función es exactamente el tipo de `SECURITY DEFINER` que el CLAUDE.md del proyecto marca como checklist obligatorio (precedente: `cfdi_get_secret` fue el hallazgo crítico de la auditoría 2026-07-04). No mergear sin ese review.

---

### Task 3: Acción `cancel` en `manage-subscription` (self-service, no solo staff)

**Files:**
- Modify: `supabase/functions/manage-subscription/index.ts:130-131` (el 403 actual)
- Test: `supabase/functions/manage-subscription/index.test.ts` (crear si no existe, seguir el patrón de tests Deno ya usado en `docs/superpowers/plans/2026-07-09-panel-suscripciones.md:398-420` para `needsNewCheckout`)

**Interfaces:**
- Consumes: `clinic_memberships` (role, user_id, clinic_id) para el check de autorización nuevo.
- Produces: `body.action === "cancel"` → Stripe `subscriptions.update(subscriptionId, { cancel_at_period_end: true })`, luego `UPDATE clinics SET subscription_status = 'canceling', subscription_cancel_at = <current_period_end de la respuesta de Stripe> WHERE id = clinic_id`.

- [ ] **Step 1: Escribir función pura de autorización (testeable sin red)**

```typescript
// Agregar cerca de otras funciones puras del archivo
export function canManageOwnSubscription(
  membership: { role?: string; clinic_id?: string } | null,
  targetClinicId: string,
): boolean {
  return membership?.role === "admin" && membership?.clinic_id === targetClinicId;
}
```

- [ ] **Step 2: Test de la función pura**

```typescript
Deno.test("admin de la propia clinic puede cancelar", () => {
  assertEquals(
    canManageOwnSubscription({ role: "admin", clinic_id: "abc" }, "abc"),
    true,
  );
});

Deno.test("admin de OTRA clinic no puede cancelar", () => {
  assertEquals(
    canManageOwnSubscription({ role: "admin", clinic_id: "xyz" }, "abc"),
    false,
  );
});

Deno.test("rol no-admin no puede cancelar", () => {
  assertEquals(
    canManageOwnSubscription({ role: "viewer", clinic_id: "abc" }, "abc"),
    false,
  );
});
```

Run: `deno test supabase/functions/manage-subscription/index.test.ts`
Expected: FAIL (función no existe todavía en el punto de import — correr ANTES del Step 1 real para confirmar que falla).

- [ ] **Step 3: Modificar el gate de autorización existente**

En `index.ts:130-131`, reemplazar el 403 ciego por: si `is_global_admin` → permitir cualquier acción (como hoy); si no, buscar membership del usuario para `body.clinic_id` y solo permitir si `body.action === "cancel"` y `canManageOwnSubscription(membership, body.clinic_id)` es true. Cualquier otra acción (`update_modules`, `suspend`, `reactivate`) sigue exigiendo `is_global_admin` — self-service SOLO habilita `cancel`.

- [ ] **Step 4: Implementar el case `cancel`**

```typescript
case "cancel": {
  const sub = await stripeSaasFetch(`subscriptions/${clinic.stripe_subscription_id_saas}`, {
    method: "POST",
    body: new URLSearchParams({ cancel_at_period_end: "true" }),
  });
  const cancelAt = new Date(sub.current_period_end * 1000).toISOString();
  await svc.from("clinics").update({
    subscription_status: "canceling",
    subscription_cancel_at: cancelAt,
  }).eq("id", clinic.id);
  return new Response(JSON.stringify({ subscription_cancel_at: cancelAt }), {
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 5: Test de integración manual contra Stripe test-mode**

Con una clinic de prueba con subscripción activa real: llamar el endpoint con `action: "cancel"` autenticado como el admin de esa clínica (no platform_staff). Confirmar en `dashboard.stripe.com/test` que la subscription queda `cancel_at_period_end: true` y en la DB que `subscription_status = 'canceling'`.

- [ ] **Step 6: Commit**
```bash
git add supabase/functions/manage-subscription/index.ts supabase/functions/manage-subscription/index.test.ts
git commit -m "feat: acción cancel self-service en manage-subscription"
```

**Agente sugerido**: `superpowers:tdd-guide` para Steps 1-2 (red-green), `ecc:security-reviewer` para el Step 3 (es el punto exacto donde se relaja una autorización — el tipo de cambio que más fácil abre un agujero).

---

### Task 4: Webhook — reflejar `cancel_at_period_end` y limpiar módulos al cancelar de verdad

**Files:**
- Modify: `supabase/functions/stripe-webhook-saas/index.ts` (agregar case `customer.subscription.updated`; revisar case `customer.subscription.deleted` existente)

**Interfaces:**
- Consumes: evento Stripe `customer.subscription.updated` (trae `cancel_at_period_end`, `current_period_end`, `id`).
- Produces: side-effect en `clinics.subscription_status`/`subscription_cancel_at`; en `customer.subscription.deleted`, además setea `cliente_modulos.activo_hasta = now()` para TODAS las filas de esa clínica (confirmar primero si el case existente ya lo hace).

- [ ] **Step 1: Leer el case `customer.subscription.deleted` actual completo**

Archivo `stripe-webhook-saas/index.ts`, buscar `case "customer.subscription.deleted"`. Confirmar si ya toca `cliente_modulos`. Si NO lo toca, es un gap que hay que cerrar aquí (si no, `clinic_has_modulo_access` de Task 2 seguiría dando `true` porque `activo_hasta` nunca se puso).

- [ ] **Step 2: Agregar case `customer.subscription.updated`**

```typescript
case "customer.subscription.updated": {
  const sub = obj;
  const subscriptionId = sub?.id;
  const status = sub?.cancel_at_period_end
    ? "canceling"
    : (sub?.status === "active" ? "active" : sub?.status);
  const cancelAt = sub?.cancel_at_period_end && sub?.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;
  const { count } = await svc.from("clinics")
    .update({ subscription_status: status, subscription_cancel_at: cancelAt })
    .eq("stripe_subscription_id_saas", subscriptionId);
  if (!count) console.warn("[stripe-webhook-saas] subscription.updated: sin clinic para subscription:", subscriptionId);
  break;
}
```

- [ ] **Step 3: Asegurar limpieza de módulos en `customer.subscription.deleted`**

Si el Step 1 confirmó que falta, agregar antes/junto al update existente de ese case:
```typescript
await svc.from("cliente_modulos")
  .update({ activo_hasta: new Date().toISOString() })
  .eq("clinic_id", clinicId)
  .is("activo_hasta", null);
```

- [ ] **Step 4: Deploy y smoke test**

`mcp__supabase__deploy_edge_function` para `stripe-webhook-saas`. En Stripe test-mode: sobre una subscription de prueba, togglear `cancel_at_period_end` desde el dashboard y confirmar que el evento llega (usar `dashboard.stripe.com/test/workbench/webhooks` → pestaña Entregas del endpoint correcto, mismo lugar auditado sesión 33) y que `clinics.subscription_cancel_at` se pobló.

- [ ] **Step 5: Commit**
```bash
git add supabase/functions/stripe-webhook-saas/index.ts
git commit -m "feat: webhook refleja cancel_at_period_end y limpia modulos al cancelar"
```

**Agente sugerido**: `ecc:code-reviewer` (lógica de webhook, no toca autorización) + smoke test manual (patrón ya establecido en sesiones 28/31/32 — barato vía `get_logs`+SQL antes de recurrir a browser automation completo).

---

### Task 5: RLS — aplicar `clinic_has_modulo_access` a las tablas gateadas por módulo

**Files:**
- Create: `supabase/migrations/<timestamp>_rls_modulo_gating.sql`

**Interfaces:**
- Consumes: `clinic_has_modulo_access(clinic_id, slug)` de Task 2.

- [ ] **Step 1: Inventariar qué tablas pertenecen a qué módulo**

Grep en el repo por dónde cada módulo (agenda, pos_farmacia, almacen, compras, facturacion_cfdi) lee/escribe — ya existe este mapeo implícito en las rutas de `App.tsx` y en los nombres de tabla (`recepciones_mercancia`, `solicitudes_compra`, `cfdi_config`, etc.). Producir una tabla módulo→tablas antes de escribir RLS (evita adivinar).

- [ ] **Step 2: Migración por módulo, patrón DROP+CREATE idempotente**

Para cada tabla del módulo (ejemplo con `recepciones_mercancia`, módulo `compras`):
```sql
DROP POLICY IF EXISTS "recepciones_mercancia_modulo_gate" ON recepciones_mercancia;
CREATE POLICY "recepciones_mercancia_modulo_gate" ON recepciones_mercancia
  FOR ALL
  USING (clinic_has_modulo_access(clinic_id, 'compras'))
  WITH CHECK (clinic_has_modulo_access(clinic_id, 'compras'));
```
Repetir por cada tabla del inventario del Step 1. **No tocar** tablas de módulos que no se están gateando en esta ronda (agenda/citas quedan siempre disponibles salvo decisión explícita — confirmar con el usuario cuáles módulos son realmente opcionales vs core antes de aplicar en masa).

- [ ] **Step 3: Test negativo real**

Con una clínica de prueba SIN el módulo `compras` contratado (`cliente_modulos` sin esa fila, o `activo_hasta` en el pasado), loguearse como su admin y confirmar que un `SELECT * FROM recepciones_mercancia` devuelve vacío (no error, RLS filtra silencioso — comportamiento esperado de Postgres RLS).

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/<timestamp>_rls_modulo_gating.sql
git commit -m "feat: RLS gatea tablas de módulos por clinic_has_modulo_access"
```

**Agente obligatorio**: `ecc:security-reviewer` + `ecc:database-reviewer` — esta es la tarea de mayor riesgo del plan completo (romper esto deja datos de un módulo visibles sin pagar, o peor, bloquea datos que sí debían verse). No mergear sin ambos reviews y el Step 3 verificado a mano.

---

### Task 6: Frontend — ocultar nav/rutas por módulo real (cosmético, capa 2)

**Files:**
- Create: `src/hooks/useModulosActivos.ts`
- Modify: `src/components/AppLayout.tsx:216` (nav)
- Modify: `src/App.tsx:100-117` (`ProtectedRoute`)

**Interfaces:**
- Produces: `useModulosActivos(clinicId: string): { slugs: string[], loading: boolean }` — lee `cliente_modulos` join `catalogo_modulos`, filtra `activo_hasta is null or > now()` en el cliente (mismo criterio que la función SQL, duplicado a propósito porque esta capa es solo cosmética).

- [ ] **Step 1: Escribir el hook**

```typescript
// src/hooks/useModulosActivos.ts
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useModulosActivos(clinicId: string | undefined) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) { setLoading(false); return; }
    let cancelled = false;
    supabase
      .from("cliente_modulos")
      .select("activo_hasta, catalogo_modulos(slug)")
      .eq("clinic_id", clinicId)
      .then(({ data }) => {
        if (cancelled) return;
        const now = Date.now();
        const active = (data ?? [])
          .filter((r) => !r.activo_hasta || new Date(r.activo_hasta).getTime() > now)
          .map((r) => (r.catalogo_modulos as { slug: string } | null)?.slug)
          .filter((s): s is string => Boolean(s));
        setSlugs(active);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [clinicId]);

  return { slugs, loading };
}
```

**Nota**: requiere que `catalogo_modulos` tenga columna `slug` (mismo prerequisito que Task 2 Step 1 — si no existe, ajustar el `.select` a `catalogo_modulos(id)` y comparar por id en vez de slug en todo este Task).

- [ ] **Step 2: Filtrar nav en `AppLayout.tsx`**

En la lista de items de nav (línea ~216), agregar `moduloSlug?: string` a cada item que corresponda a un módulo opcional, y filtrar: `items.filter(item => !item.moduloSlug || slugs.includes(item.moduloSlug))`.

- [ ] **Step 3: Filtrar rutas en `ProtectedRoute`**

En `App.tsx:100-117`, extender `ProtectedRoute` para aceptar `requiredModulo?: string` y redirigir a una pantalla "módulo no contratado" (reusar patrón de `SubscriptionBlockedScreen` ya existente) si `requiredModulo` no está en `slugs`.

- [ ] **Step 4: Verificación manual en browser**

Con una clínica de prueba sin módulo `compras`: confirmar que el link de Compras no aparece en sidebar Y que navegar directo a la URL de Compras redirige a la pantalla de bloqueo (no un error crudo de RLS).

- [ ] **Step 5: Commit**
```bash
git add src/hooks/useModulosActivos.ts src/components/AppLayout.tsx src/App.tsx
git commit -m "feat: frontend oculta nav/rutas de módulos no contratados"
```

**Agente sugerido**: `ecc:code-reviewer`, opcional `frontend-design` skill si la pantalla de bloqueo necesita pulirse.

---

### Task 7: UI de cancelación self-service (`/configuracion`)

**Files:**
- Modify: `src/pages/configuracion/ConfiguracionPagos.tsx`
- Create: `src/components/configuracion/CancelarSuscripcionModal.tsx`

**Interfaces:**
- Consumes: acción `cancel` de Task 3 (fetch crudo, NO `supabase.functions.invoke()` — regla ya aprendida en este proyecto sesión 25: `invoke()` esconde el body de error real).
- Produces: modal con términos + confirmación, botón visible solo si `subscription_status` no es ya `canceling`/`canceled`.

- [ ] **Step 1: Copy de términos (texto exacto, basado en el research de las 3 empresas)**

```typescript
export const TERMINOS_CANCELACION = {
  titulo: "Cancelar suscripción",
  cuerpo: (fechaCorte: string) =>
    `Tu suscripción se cancelará, pero seguirás teniendo acceso completo a todos tus módulos hasta el ${fechaCorte}. No se hace ningún reembolso por el tiempo ya pagado. Puedes reactivar tu suscripción en cualquier momento antes de esa fecha desde esta misma pantalla.`,
  confirmar: "Sí, cancelar suscripción",
  cancelar: "No, mantener mi suscripción",
};
```

- [ ] **Step 2: Componente del modal**

```typescript
// src/components/configuracion/CancelarSuscripcionModal.tsx
import { TERMINOS_CANCELACION } from "./terminos-cancelacion";

export function CancelarSuscripcionModal({
  open, onClose, onConfirm, fechaCorte, loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fechaCorte: string;
  loading: boolean;
}) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true">
      <h2>{TERMINOS_CANCELACION.titulo}</h2>
      <p>{TERMINOS_CANCELACION.cuerpo(fechaCorte)}</p>
      <button onClick={onClose} disabled={loading}>{TERMINOS_CANCELACION.cancelar}</button>
      <button onClick={onConfirm} disabled={loading}>{TERMINOS_CANCELACION.confirmar}</button>
    </div>
  );
}
```

- [ ] **Step 3: Integrar en `ConfiguracionPagos.tsx`**

Agregar estado `subscription_cancel_at`/`subscription_status` (leer de `clinics` vía el hook que ya usa la página), botón "Cancelar suscripción" que abre el modal, `onConfirm` hace:
```typescript
const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-subscription`, {
  method: "POST",
  headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ action: "cancel", clinic_id: clinicId }),
});
const body = await res.json();
if (!res.ok) throw new Error(body?.error ?? "No se pudo cancelar la suscripción");
```
Si `subscription_status === "canceling"`, mostrar banner con la fecha (`subscription_cancel_at`) y botón "Reactivar" que llama `action: "reactivate"` (ya existe, Task 3 no lo toca).

- [ ] **Step 4: Verificación manual en browser**

Login como admin de clínica de prueba (no platform_staff) → `/configuracion` → cancelar → confirmar banner con fecha correcta → click Reactivar → confirmar que vuelve a estado normal.

- [ ] **Step 5: Commit**
```bash
git add src/pages/configuracion/ConfiguracionPagos.tsx src/components/configuracion/CancelarSuscripcionModal.tsx
git commit -m "feat: UI self-service para cancelar/reactivar suscripción"
```

**Agente sugerido**: `ecc:code-reviewer`. La copy de términos (Step 1) es cuasi-legal — recomendar al usuario una revisión humana final del texto antes de prod (mismo criterio que LFPDPPP en este proyecto, `CLAUDE.md` ya trata consentimiento/legal con cuidado).

---

### Task 8: Smoke test end-to-end real (Stripe test-mode)

**Files:** ninguno — solo verificación manual.

- [ ] **Step 1**: Clínica de prueba con subscripción activa real (tarjeta test `4242...`) y al menos 2 módulos contratados.
- [ ] **Step 2**: Login como su admin (no staff) → `/configuracion` → cancelar → confirmar Stripe test-mode muestra `cancel_at_period_end: true` y la DB `subscription_status = 'canceling'`.
- [ ] **Step 3**: Confirmar que TODOS los módulos siguen accesibles (gating no debe cortar nada todavía — sigue dentro del período pagado).
- [ ] **Step 4**: Forzar el fin del período: en Stripe test-mode, cancelar la subscription de verdad (dashboard) para disparar `customer.subscription.deleted` de inmediato en vez de esperar el ciclo real.
- [ ] **Step 5**: Confirmar `clinics.subscription_status = 'canceled'`, `cliente_modulos.activo_hasta` poblado para todas las filas, y que el frontend ahora SÍ bloquea (nav sin módulos, rutas redirigen).
- [ ] **Step 6**: Reactivar una clínica ANTES del corte (repetir Steps 1-3, luego click "Reactivar" en vez de Step 4) — confirmar que vuelve a `active` sin pasar por checkout nuevo (ya cubierto por la acción `reactivate` existente).

**Agente sugerido**: manual, mismo patrón costo-consciente de sesiones previas (preferir `get_logs`+SQL antes que browser automation completo cuando alcance).

---

## Mapeo de agentes por fase (según reglas globales del usuario)

| Fase | Tasks | Agente/skill |
|------|-------|---------------|
| Migraciones DB | 1, 2 | `ecc:database-reviewer` (review antes de aplicar) |
| Autorización/Edge Functions | 3 | `superpowers:tdd-guide` (red-green) + `ecc:security-reviewer` (el gate de autorización) |
| Webhook | 4 | `ecc:code-reviewer` |
| RLS gating | 5 | `ecc:security-reviewer` + `ecc:database-reviewer` — **obligatorio ambos, mayor riesgo del plan** |
| Frontend cosmético | 6, 7 | `ecc:code-reviewer`, opcional `frontend-design` |
| QA end-to-end | 8 | manual, browser real contra Stripe test-mode |
| Ejecución completa | Todas | `superpowers:subagent-driven-development` (patrón ya usado con éxito en sesiones 30-32 de este mismo proyecto) |

## Self-Review

**Cobertura del pedido del usuario:**
- "Opción de cancelar suscripción por el cliente" → Tasks 3, 4, 7.
- "Validar que solo pueda ver los módulos que tiene pagados" → Tasks 2, 5, 6.
- "Validando la fecha del pago que esté activo" → `activo_hasta` en Task 2 (función SQL) y Task 6 (hook), no solo existencia de fila.
- "El plan de suscripción, las especificaciones, los términos" → Task 7 Step 1 (copy) + investigación Amazon/Spotify/Anthropic documentada arriba.
- "Revisa las grandes empresas... analízalas... plan de trabajo con skills y agentes" → sección de investigación + tabla de mapeo de agentes.

**Riesgo mayor no cubierto por este plan (fuera de alcance, marcarlo así):** decidir cuáles módulos son "core" (siempre visibles, ej. Agenda) vs verdaderamente opcionales/gateables — Task 5 Step 1 lo deja como decisión a tomar con el usuario antes de aplicar RLS en masa, no asumir.
