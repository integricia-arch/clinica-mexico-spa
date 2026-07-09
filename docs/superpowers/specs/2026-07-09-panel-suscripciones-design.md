# Panel de control de suscripciones por clínica — diseño

**Fecha**: 2026-07-09 (sesión 29, continuación)
**Estado**: aprobado por el usuario, pendiente de plan de implementación

## Problema

`/admin/tenants` (`src/pages/AdminTenants.tsx`) hoy solo permite:
- Ver una tabla liviana (nombre, código, estado, plan, `subscription_status`, alta).
- Un botón "Suspender"/"Reactivar" que llama a la RPC `set_clinic_status`, la cual
  **solo cambia `clinics.status` en la DB** — no toca nada en Stripe.

Esto generó el síntoma reportado por el usuario: una clínica suspendida cuya
subscription de Stripe ya había expirado/cancelado "ya no hay forma de
reactivarla" — el botón cambia el status local pero no revive ni crea una
subscription real, así que el cliente queda con acceso pero sin cobro
vigente (o sin acceso y sin forma de volver a cobrar).

No existe ninguna forma de:
- Editar los módulos (à la carte) de una clínica ya activa.
- Ver datos reales de la suscripción (próximo cobro, método de pago, historial
  de facturas).
- Reactivar de verdad una suscripción cancelada en Stripe.

## Decisiones (confirmadas con el usuario)

1. **"Reactivar" = acción conjunta Stripe + DB.** Fuente de verdad es Stripe:
   el botón dispara la acción real ahí (reanudar subscription pausada, o
   crear una nueva vía Checkout si ya no existe) y solo tras confirmación se
   actualiza el status local.
2. **Cambios de módulos usan prorrateo automático de Stripe**
   (`proration_behavior: "create_prorations"`) — el cliente ve el cargo/crédito
   proporcional en su próxima factura, sin cálculo manual.
3. **Datos a mostrar**: próxima fecha de cobro + monto, método de pago (marca +
   últimos 4 dígitos), historial de facturas (fecha/monto/estado/link PDF),
   desglose de módulos activos con precio individual.
4. **Arquitectura**: Edge Function nueva `manage-subscription` (staff-only),
   no se extiende `stripe-webhook-saas` (ese es pasivo, reacciona a eventos;
   esta es activa, el staff la dispara a mano) — mismo patrón que
   `create-tenant`/`verify-tenant-code`.
5. **Navegación**: ruta de detalle `/admin/tenants/:id`, no modal. La tabla de
   `/admin/tenants` queda como listado; click en una fila navega al detalle.

## Diseño

### 1. Frontend — `src/pages/AdminTenantDetail.tsx` (nuevo)

Ruta `/admin/tenants/:id`, misma guardia de acceso que `AdminTenants.tsx`
(`is_global_admin` RPC, `Navigate to="/"` si no es staff).

Secciones:
- **Header**: nombre, código, estado, plan, fecha de alta (ya conocidos, sin
  llamada extra — vienen de la misma query que ya usa la tabla, o se repiten
  acá con un `select` por id).
- **Bloque Suscripción**: `subscription_status`, `grace_period_ends_at` si
  aplica, próxima fecha de cobro + monto, método de pago (marca + últimos 4).
  Todo viene del `GET` a `manage-subscription` (ver abajo) — nunca se llama a
  Stripe directo desde el browser.
- **Bloque Módulos**: checkboxes de `catalogo_modulos` (igual patrón que el
  wizard de alta en `AdminTenants.tsx`), preseleccionados según
  `cliente_modulos` actual. Botón "Guardar cambios" solo habilitado si hay
  diff contra el estado actual. Muestra precio individual y total mensual.
- **Bloque Historial**: tabla de últimas facturas (fecha, monto, estado, link
  al PDF de Stripe — `invoice.hosted_invoice_url` o `invoice_pdf`).
- **Acciones**: "Reactivar suscripción" (solo visible si `status='suspended'`
  o `subscription_status` en estado no-activo), "Suspender" (visible si
  activa).

`/admin/tenants` (`AdminTenantsTable.tsx`, ex-`AdminTenants.tsx` recortado a
solo listado + wizard de alta) agrega navegación: click en fila →
`navigate(\`/admin/tenants/${t.id}\`)`. El botón WhatsApp existente se puede
dejar en la tabla o mover al detalle — **decisión de implementación, no
bloqueante para el spec** (recomendado: moverlo al detalle también, por
consistencia, pero no es requisito).

### 2. Backend — Edge Function nueva `supabase/functions/manage-subscription/index.ts`

Staff-only: valida sesión (`supabase.auth.getUser()`) + `is_global_admin` al
inicio de cada rama, igual que el resto de funciones admin. `verify_jwt =
true` en `config.toml` (a diferencia de `telegram-webhook`/`stripe-webhook`,
esta sí la llama un usuario logueado real vía `callFn` del front).

**`GET ?clinic_id=<uuid>`** — resumen de suscripción:
1. Lee `clinics` (status, subscription_status, grace_period_ends_at,
   stripe_customer_id_saas, stripe_subscription_id_saas) y `cliente_modulos`
   join `catalogo_modulos` (módulos activos + precio) de la DB.
2. Si `stripe_subscription_id_saas` existe: `stripe.subscriptions.retrieve`
   con `expand: ["default_payment_method", "latest_invoice"]` para sacar
   próximo cobro/monto y método de pago.
3. `stripe.invoices.list({customer: stripe_customer_id_saas, limit: 12})`
   para el historial.
4. Devuelve todo combinado en un solo JSON — el front no arma nada, solo
   pinta.

**`POST {action: "update_modules", clinic_id, modulo_ids: string[]}`**:
1. Valida que todos los `modulo_ids` existan y estén `activo=true` en
   `catalogo_modulos` (mismo check que ya hace `create-tenant`).
2. Diffea contra `cliente_modulos` actual → módulos a agregar/quitar.
3. Llama Stripe: por cada módulo agregado, `subscriptionItems.create`; por
   cada quitado, `subscriptionItems.del` — todos con
   `proration_behavior: "create_prorations"`.
4. **Solo si Stripe confirma sin error**: `delete`-then-`insert` en
   `cliente_modulos` scopeado por `clinic_id` (mismo patrón idempotente que
   ya usa `stripe-webhook-saas` para esta misma tabla — reutilizar esa
   lógica, no reinventarla).

**`POST {action: "reactivate", clinic_id}`**:
1. Lee `stripe_subscription_id_saas` de `clinics`.
2. Si existe y su status en Stripe es `paused` o tiene
   `cancel_at_period_end=true`: la reanuda
   (`stripe.subscriptions.update({cancel_at_period_end: false})` o
   `resume()` según corresponda al estado real).
3. Si no existe o está `canceled` de forma definitiva: crea una Checkout
   Session nueva reutilizando la función helper que ya usa
   `verify-tenant-code` (misma cuenta Stripe SaaS, mismos módulos que la
   clínica tenía) y devuelve `checkout_url` — el front redirige a pagar,
   igual que el flujo de alta original. El provisioning post-pago ya lo
   maneja `stripe-webhook-saas` sin cambios.
4. Solo tras confirmación de Stripe (paso 2) actualiza `clinics.status` y
   `subscription_status` localmente. El caso 3 no actualiza nada local
   todavía — lo hace el webhook cuando el pago se confirme, igual que hoy.

**`POST {action: "suspend", clinic_id}`**:
1. `stripe.subscriptions.update({pause_collection: {behavior:
   "mark_uncollectible"}})` (o `void`, a definir en el plan según qué
   comportamiento de Stripe se prefiera para no seguir generando invoices
   mientras está suspendida).
2. Solo si Stripe confirma: `clinics.status = 'suspended'` (reemplaza el uso
   actual de `set_clinic_status` para este caso — esa RPC puede seguir
   existiendo para otros usos internos, pero el panel ya no la llama directo
   para suspender/reactivar).

### 3. Manejo de errores

Mismo principio que ya usa `verify-tenant-code`/`stripe-webhook-saas`:
**Stripe se toca primero; la DB solo se actualiza si Stripe confirma.** Si
Stripe falla a mitad de una operación de módulos (ej. agregar 2, falla al
quitar 1), la función devuelve el error real de Stripe sin tocar
`cliente_modulos` — el front muestra el mensaje concreto (reusar el patrón
`callFn`/`data?.error` que ya existe en `AdminTenants.tsx`, no
`supabase.functions.invoke()`).

### 4. Fuera de alcance (deliberado)

- Cambiar tarjeta de pago — se delega al Customer Portal de Stripe (no se
  construye un formulario propio de tarjeta).
- Reembolsos.
- Cambiar el campo `plan` (plan base) — el sistema factura à la carte por
  módulo, no hay lógica de "planes" con distinto precio base todavía.
- Cancelación definitiva (borrar la clínica) — ya existe fuera de este panel
  si hace falta, no se toca acá.

## Testing

- Unit: diff de módulos (agregar/quitar) contra `cliente_modulos` actual.
- Integración: `manage-subscription` contra Stripe test-mode — reactivar una
  subscription pausada, agregar/quitar un módulo con prorrateo, listar
  invoices de un customer de prueba.
- Manual/E2E: smoke test real (como el de sesión 28) — suspender una clínica
  de prueba, confirmar que dejó de facturar en Stripe test-mode, reactivar,
  confirmar que retoma el cobro. Igual que sesiones anteriores, **correr esto
  en la misma sesión de implementación**, no diferirlo (learning ya
  documentado en `STATE.md` tras el costo de sesión 28).
