# Stripe Checkout antes de aprovisionar tenant — Diseño

Fecha: 2026-07-08
Contexto: sesión 25 (Jul 9) fixeó 3 bugs reales del alta de tenant (500 genérico,
import.meta.env roto en build prod, listUsers() fallando en silencio), pero dejó
expuesto un hueco de diseño: `verify-tenant-code` da acceso completo (invite +
membership + módulos + subscription vía API directa) sin cobrar nada — nunca se
pide tarjeta. Este spec cierra ese hueco insertando Stripe Checkout entre
"verificar código" y "dar acceso", con webhook como única fuente de verdad para
el provisioning.

## Decisiones de diseño (con justificación)

- **Provisioning vive en el webhook, no en un endpoint post-redirect.** Stripe
  garantiza entrega server-to-server con reintentos (hasta 72h); el browser del
  usuario no garantiza nada (puede cerrar la pestaña tras pagar, perder
  conexión en el redirect). Nunca fulfillment desde `success_url`. Ver fuentes:
  [Stripe: Fulfill orders](https://docs.stripe.com/checkout/fulfillment),
  [OWASP Third Party Payment Gateway Integration](https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Payment_Gateway_Integration_Cheat_Sheet.html).
- **Idempotencia con tabla `stripe_webhook_events`** (`event_id` UNIQUE),
  insertada **al final** del provisioning exitoso — no al inicio. Si insertara
  al inicio, un fallo a mitad de camino dejaría la clinic huérfana para
  siempre (el reintento de Stripe caería en el guard de "ya procesado" sin
  reintentar el trabajo real). Insertar al final recupera de fallos parciales
  vía el reintento natural de Stripe.
- **Row lock vía UPDATE condicional (CAS), no `SELECT FOR UPDATE`.** Edge
  Functions vía PostgREST no mantienen una transacción abierta entre múltiples
  `fetch()`, así que el lock es un único
  `UPDATE clinics SET status='provisionando' WHERE status='pendiente_verificacion'`.
  Postgres serializa UPDATEs concurrentes a nivel de fila — dos entregas
  simultáneas del mismo evento nunca ganan ambas la condición.
- **Sin trial period** — Checkout cobra de inmediato (`mode: subscription`,
  sin `trial_period_days`). Resuelve el problema raíz: nunca se pedía tarjeta.
- **Cancelación/expiración**: sin cron de limpieza (fuera de alcance). Clinics
  huérfanas en `pendiente_verificacion` con código expirado quedan como fila
  sin uso — no rompen nada, `verify-tenant-code` ya rechaza códigos expirados.
  Reintento = repetir el alta desde cero vía `create-tenant` (código nuevo,
  fila nueva).
- **Customer Stripe cuenta-pacientes también se mueve al webhook.** Cero
  side-effects (ni Stripe ni DB) hasta que el pago esté confirmado.
- **Módulos**: el webhook lee `clinics.pending_modulo_ids`, no metadata de
  Stripe — evita datos duplicados/desincronizados. Metadata de la Checkout
  Session solo lleva `clinic_id`.

## Arquitectura

```
create-tenant (sin cambios)
  → clinic status=pendiente_verificacion, código por email

verify-tenant-code (reescrito, queda minimal)
  → valida código + expiración
  → crea Checkout Session (cuenta SaaS, mode=subscription, sin trial,
    line_items = pending_modulo_ids resueltos a stripe_price_id)
  → metadata: { clinic_id }
  → devuelve { checkout_url } — cero side-effects más allá de esto

stripe-webhook-saas (nuevo case: checkout.session.completed)
  → claim atómico: UPDATE clinics SET status='provisionando'
    WHERE status='pendiente_verificacion' — 0 filas afectadas = ya reclamada, sale
  → crea customer Stripe cuenta-pacientes
  → invita admin (o resuelve user_id existente, patrón fixeado sesión 25)
  → crea clinic_membership
  → inserta cliente_modulos desde pending_modulo_ids
  → insert stripe_webhook_events(event_id) — idempotencia del evento
  → UPDATE clinics: status=active, subscription_status=active, ids de Stripe,
    limpia campos pending_*
  → catch: revierte status a pendiente_verificacion, responde 500 (Stripe reintenta)
```

## Migración DB

```sql
create table stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

revoke all on stripe_webhook_events from public, authenticated;
grant select, insert on stripe_webhook_events to service_role;
```

Confirmar si `clinics.status` tiene CHECK constraint — de ser así, agregar
`'provisionando'` como valor válido en la misma migración.

## `verify-tenant-code` — cambios

Reemplaza desde "crea customer Stripe pacientes" (línea 83 actual) hasta el
final. Ya no toca `auth.admin.inviteUserByEmail`, `clinic_memberships`,
`cliente_modulos`, ni `clinics.update` — todo migra al webhook. Deja de usar
la clave de la cuenta pacientes; usa la constante `STRIPE_SAAS_KEY` (ya
presente en el archivo, misma que usa hoy para crear la subscription SaaS)
para crear la Checkout Session:

```ts
const clinicId = clinic.id as string;
const moduloIds = (clinic.pending_modulo_ids ?? []) as string[];

const { data: modulos, error: modulosErr } = await admin
  .from("catalogo_modulos")
  .select("id, stripe_price_id")
  .in("id", moduloIds)
  .eq("activo", true);
if (modulosErr || !modulos?.length || modulos.some((m) => !m.stripe_price_id)) {
  return json({ error: "Módulos inválidos o sin stripe_price_id configurado" }, 400);
}

const params = new URLSearchParams({
  mode: "subscription",
  success_url: `${SITE_URL}/admin/tenants?pago=procesando&clinic_id=${clinicId}`,
  cancel_url: `${SITE_URL}/admin/tenants?pago=cancelado&clinic_id=${clinicId}`,
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
  return json({ error: session?.error?.message ?? "Error creando sesión de pago" }, 502);
}

return json({ checkout_url: session.url });
```

## `stripe-webhook-saas` — nuevo case

Agregar al `switch (event.type)` existente (línea 78), reusando la misma
verificación de firma y el mismo cliente `svc`. La función necesita acceso a
las dos claves secretas de Stripe (cuenta pacientes y cuenta SaaS) que hoy
solo tiene `verify-tenant-code` — agregarlas a los secrets del proyecto para
esta función, siguiendo el mismo patrón de `.join("_")` que ya usa el resto
del archivo para nombrar variables de entorno sensibles.

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
      headers: { Authorization: `Bearer ${STRIPE_PACIENTES_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
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
      .then(({ error }) => { if (error) console.log("[stripe-webhook-saas] event_id ya registrado:", event.id); });

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

## Frontend — `AdminTenants.tsx`

`submitVerifyCode` (líneas 184-208) deja de cerrar el wizard directo; redirige
a `data.checkout_url`:

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

Nuevo `useEffect` para el retorno de Checkout (banner informativo, sin
polling ni confirmación contra Stripe — el webhook es la única fuente de
verdad):

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

`infoBanner`: `useState<string | null>(null)` nuevo, renderizado como banner
simple arriba de la tabla.

## Edge cases cubiertos

1. Staff no tiene forma de suspender una clinic aún no `active` — el claim
   solo dispara sobre `pendiente_verificacion`, sin riesgo real hoy.
2. Módulo desactivado (`catalogo_modulos.activo=false`) entre alta y pago: el
   webhook igual lo entrega — ya fue cobrado en Stripe. El filtro `activo` en
   `verify-tenant-code` es para no vender algo dado de baja, no para negar
   algo ya pagado.
3. `session.subscription` null: guard explícito, revierte claim, 500.
4. Email de invitación (código de verificación) se manda antes de pagar — sin
   cambio, es solo el código, no acceso a la app.
5. `stripe_webhook_events` cerrada a `service_role` únicamente.
6. Doble-clic en "Verificar y activar": ya cubierto por `disabled={submitting}`.

## Testing

**Automatizable:** casos ya cubiertos de `verify-tenant-code` (código
incorrecto/expirado, módulo sin `stripe_price_id`) extendidos con el nuevo
flujo; webhook con evento sin `metadata.clinic_id` no debe reventar.

**Manual, obligatorio antes de prod** (no hay forma confiable de mockear
Checkout + reintentos de Stripe sin perder cobertura real):
1. Alta feliz completa: create-tenant → código → verify-tenant-code → redirect
   Checkout test (`4242...`) → Stripe CLI `stripe listen --forward-to` recibe
   `checkout.session.completed` → verificar `clinics.status=active`,
   membership, `cliente_modulos`, admin invitado.
2. Reintento de webhook (`stripe events resend`) tras provisioning exitoso →
   no debe duplicar nada (guard de `status` ya no es `pendiente_verificacion`).
3. Fallo simulado a mitad de camino → confirmar revert de `status` y que un
   reintento posterior de Stripe completa el provisioning.
4. Cancelar Checkout → `cancel_url` carga, banner correcto, clinic sigue
   `pendiente_verificacion`.
5. Código expira antes de pagar (30 min) → reintento con código viejo → 400.

## Pendiente de implementación (no cubierto en este spec)

- Confirmar nombre exacto de las env vars de las claves secretas de Stripe
  (cuenta pacientes y cuenta SaaS) ya configuradas en Supabase Secrets del
  proyecto, y agregarlas a `stripe-webhook-saas`.
- Confirmar si `clinics.status` tiene CHECK constraint (agregar
  `'provisionando'` si aplica).
- `SITE_URL` como env var en `verify-tenant-code` (hoy no existe — usar mismo
  patrón de `DEFAULT_SITE` de `stripe-checkout/index.ts` si aplica, o env var
  nueva).
