# Diseño — Fase B: Control de pagos SaaS (suscripción recurrente)

**Fecha:** 2026-07-08
**Estado:** Spec detallado, listo para plan de implementación.
**Spec maestro:** `docs/superpowers/specs/2026-07-06-saas-multitenant-whatsapp-design.md`

## Contexto

Fase A (panel `/admin/tenants`) y Fase D (spec+plan WhatsApp, sin ejecutar) ya
existen. Orden acordado del spec maestro: A→D→B→C. Fase D quedó pausada antes
de ejecutar por costo, pero no bloquea Fase B — se retoma el orden en B ahora.

Fase A ya crea `stripe_customer_id` en el wizard "Nuevo cliente", pero ese
customer vive en la cuenta Stripe **actual**, usada para cobros a pacientes.
Fase B usa una **cuenta Stripe separada** para Billing/Subscriptions SaaS —
aislamiento total de dinero paciente vs dinero cliente-SaaS. Esto invalida
reusar ese campo para suscripción; se agregan columnas nuevas dedicadas.

Sesión 20 (`memoria/STATE.md`) investigó 3 estrategias de precio (à la carte,
good-better-best, híbrido base+uso) y diseñó (sin implementar) un esquema
`catalogo_modulos`/`cliente_modulos`/`costos_reales_mensuales`. Fase B
implementa ese esquema como base de un modelo **à la carte**: cada hospital
arma su combo de módulos (Agenda/POS/Almacén/Compras/Facturación/IA), cada
uno con su propio precio y `stripe_price_id`.

## Modelo de datos

### Tablas nuevas

```sql
catalogo_modulos (
  id uuid pk,
  nombre text,               -- 'agenda', 'pos', 'almacen', 'compras', 'facturacion', 'ia'
  descripcion text,
  precio_centavos integer,
  stripe_price_id text,      -- Price id en la cuenta Stripe SaaS
  activo boolean default true
)

cliente_modulos (
  id uuid pk,
  clinic_id uuid fk clinics,
  modulo_id uuid fk catalogo_modulos,
  activo_desde timestamptz,
  activo_hasta timestamptz nullable  -- historial: null = activo hoy
)

costos_reales_mensuales (
  id uuid pk,
  modulo_id uuid fk catalogo_modulos,
  mes date,                  -- primer día del mes
  costo_centavos integer     -- para comparar precio de venta vs costo real (research sesión 20)
)
```

### Columnas nuevas en `clinics`

- `stripe_customer_id_saas` text nullable
- `stripe_subscription_id_saas` text nullable
- `subscription_status` text check in (`trialing`,`active`,`past_due`,`canceled`) default `trialing`
- `grace_period_ends_at` timestamptz nullable — se llena al entrar en `past_due`, se limpia al volver a `active`

Todas las tablas nuevas: RLS scoped a `super_admin` (gestión) y lectura propia
por `clinic_id` para `admin` de cada hospital (ver sus propios módulos/costo).
`costos_reales_mensuales` es solo `super_admin` (dato interno de negocio, no
se expone al cliente).

## Wizard "Nuevo cliente" extendido (toca Fase A)

Flujo actualizado en la edge function `create-tenant`:

1. Crea `clinics` + usuario admin (igual que hoy).
2. Staff selecciona módulos à la carte (checkboxes de `catalogo_modulos` en
   el wizard).
3. Crea customer en la cuenta Stripe SaaS (nueva) + Subscription con 1
   Subscription Item por módulo elegido (cada uno con su `stripe_price_id`).
4. Guarda `stripe_customer_id_saas`/`stripe_subscription_id_saas` en
   `clinics`, inserta filas en `cliente_modulos` (`activo_desde = now()`).
5. Rollback completo si falla un paso intermedio — mismo patrón ya usado en
   `create-tenant` (Fase A).

Requiere env vars nuevas en la cuenta Stripe SaaS: `STRIPE_SAAS_SECRET_KEY`,
`STRIPE_SAAS_WEBHOOK_SECRET`. El usuario las genera en el dashboard Stripe
nuevo y las corre él mismo vía `supabase secrets set` (nunca pegadas en chat).

## Webhook + gate de acceso

- Edge function nueva `stripe-webhook-saas` (mismo patrón que
  `stripe-webhook` existente, cuenta y secret distintos).
- Eventos manejados:
  - `invoice.paid` → `subscription_status='active'`, limpia `grace_period_ends_at`.
  - `invoice.payment_failed` → `subscription_status='past_due'`,
    `grace_period_ends_at = now() + interval '7 days'`.
  - `customer.subscription.deleted` → `subscription_status='canceled'`.
- Gate **mixto por gracia**:
  - `past_due` con `grace_period_ends_at` no vencida → banner de aviso
    (blando), acceso normal a la app.
  - `past_due` con `grace_period_ends_at` vencida, o `canceled` → bloqueo
    duro vía policy `RESTRICTIVE` (mismo patrón ya usado en Fase A para
    clínicas `suspended`, reusa/extiende `user_has_clinic_access`).
- Cron nuevo (mismo patrón que `enviar-recordatorios`), corre diario: revisa
  `clinics` con `subscription_status='past_due'` y `grace_period_ends_at`
  vencida → dispara el bloqueo duro (no depende de un evento Stripe nuevo,
  es paso de tiempo, no de dinero).

## Frontend

- `/admin/tenants`: columna nueva de `subscription_status` + lista de
  módulos activos por cliente. Acción "editar módulos" (agrega/quita
  Subscription Item en Stripe + fila en `cliente_modulos`, cierra
  `activo_hasta` de los removidos en vez de borrar — mantiene historial).
- Banner global (blando): visible a `admin` de la clínica en `past_due` sin
  gracia vencida — "pago pendiente, resuelve antes de [fecha]".
- Pantalla de bloqueo duro (`canceled` o gracia vencida): reemplaza la app
  entera con aviso "contacta a soporte", sin acceso a datos clínicos — mismo
  patrón visual ya usado para clínica `suspended` (Fase A).

## Testing

- RLS: verificar en prod-like que `active`/`trialing` → acceso true,
  `past_due` en gracia → acceso true + banner, `past_due` vencida/`canceled`
  → acceso false en las 16 tablas ya protegidas por Fase A + las nuevas.
- Webhook: simular los 3 eventos Stripe (`invoice.paid`,
  `invoice.payment_failed`, `customer.subscription.deleted`) con firma HMAC
  válida y verificar transición de `subscription_status` correcta.
- Wizard: alta de cliente con 2+ módulos → confirmar Subscription con
  Subscription Items correctos en Stripe, filas correctas en
  `cliente_modulos`, rollback si falla paso intermedio (simular fallo Stripe).
- Cron de gracia: `grace_period_ends_at` vencida → confirma bloqueo duro
  aplicado, no afecta clínicas en gracia vigente.

## Fuera de alcance

- CFDI/impuestos del cobro SaaS (Stripe Tax o facturación manual, a decidir
  aparte — señalado ya en spec maestro).
- Self-service upgrade/downgrade por el cliente mismo — el cambio de módulos
  lo hace staff vía `/admin/tenants`, no el hospital directamente.
- Migrar/tocar `stripe_customer_id` (cuenta pacientes) existente de Fase A —
  queda intacto, sin relación con las columnas `_saas` nuevas.

## Riesgos / dependencias externas

- Confirmar en Stripe si "Subscriptions" (Billing) requiere habilitarse
  explícitamente en la cuenta nueva antes de crear Prices/Subscriptions.
- Usuario debe crear la cuenta Stripe SaaS y generar las API keys/secrets
  antes de implementar (bloqueante externo, no técnico).
