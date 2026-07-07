# Diseño — Etapa SaaS multi-tenant: panel de clientes, pagos, docs y WhatsApp multi-número

**Fecha:** 2026-07-06
**Estado:** Spec maestro (overview) — cada fase (A/B/C/D) tendrá su propio spec detallado antes de implementarse.

## Contexto

`clinica-mexico-spa` (integrika.mx) opera hoy como app de una sola clínica en producción (React + Supabase + Cloudflare Workers). Ya existen piezas reutilizables clave:

- Tabla `clinics` + columna `clinic_id` con scoping RLS en la mayoría de tablas (multi-clínica ya parcialmente resuelto, pensado para sucursales).
- Roles vía `has_role()` / enum de roles (admin, doctor, nurse, etc.).
- Stripe ya integrado (`stripe-checkout`, `stripe-payment-intent`, `stripe-webhook`) para cobros a **pacientes**.
- Bot conversacional vía Telegram (`telegram-webhook`, `enviar-mensaje-humano`, `enviar-recordatorios`, `help-chat-ai`) — **no existe integración WhatsApp todavía**.
- Patrón de notificaciones (`notification_rules`, `notify-*` edge functions).

**Objetivo de esta etapa:** convertir integrika.mx en plataforma SaaS que vende el sistema a múltiples hospitales/clínicas (2-10 en los primeros 6-12 meses), cada uno con: panel de gestión propio, cobro recurrente de suscripción, documentación de cliente, y un número de WhatsApp Business dedicado con bot conversacional + agentes supervisores de flujo de mensajes.

## Decisión de escala y modelo de tenant

Con 2-10 clientes esperados, **no se crea una tabla `tenants` nueva**. Se reutiliza `clinics` como unidad de tenant (1 hospital = 1 fila `clinics` = 1 cliente pagante). Se agregan columnas SaaS a `clinics`:

- `subscription_status` (`trialing` | `active` | `past_due` | `canceled`)
- `stripe_customer_id`, `stripe_subscription_id`
- `plan` (texto/enum simple)
- `whatsapp_phone_number_id`, `whatsapp_business_account_id` (nulos hasta Fase D)

Se agrega rol `super_admin` (staff de integrika, ve/administra todos los tenants) al enum de roles existente. Los roles actuales (`admin`, `doctor`, etc.) siguen scoped a su propio `clinic_id` vía RLS ya existente — sin cambios ahí.

Justificación: a esta escala, una tabla `tenants` separada de `clinics` sería una capa de indirección sin beneficio real (YAGNI); si se llega a 50+ clientes se puede migrar sin romper lo demás porque `clinic_id` ya es la FK universal.

## Fase A — Panel de clientes (onboarding + gestión SaaS)

Ruta nueva `/admin/tenants`, visible solo a `super_admin`. Funciones:

- Listar hospitales/clientes con estado de suscripción.
- Wizard "Nuevo cliente": captura datos del hospital → crea fila `clinics`, crea usuario admin inicial (`auth.users` + profile + rol `admin` scoped a ese `clinic_id`), crea customer en Stripe. (Alta de número WhatsApp se conecta en Fase D, cuando esa infra exista — el wizard deja el campo pendiente si Fase D no está lista aún.)
- Acciones: suspender / reactivar cliente (cambia `subscription_status` manualmente o vía webhook Stripe).

Fuera de alcance de Fase A: self-service signup público (a esta escala, alta la hace el equipo de integrika manualmente vía el wizard, no el cliente).

## Fase B — Control de pagos (suscripción recurrente)

Se reusa el patrón ya probado de `stripe-checkout` / `stripe-webhook`, pero como **producto Stripe distinto** (Billing/Subscriptions) — separado por completo de los cobros a pacientes que ya existen, para no mezclar dinero de paciente con dinero de cliente-SaaS.

- Edge function `stripe-webhook-saas` (nueva, o mismo webhook con `event.data.object` discriminado por metadata) actualiza `clinics.subscription_status` según eventos `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`.
- Gate de acceso: si `subscription_status IN ('past_due','canceled')`, el frontend muestra banner de bloqueo/aviso; decisión de bloqueo duro (RLS) vs blando (banner) se define en el spec detallado de Fase B.

Fuera de alcance: manejo de impuestos/CFDI para el cobro SaaS (se resuelve con Stripe Tax o facturación manual — a decidir en spec de Fase B).

## Fase C — Documentación de cliente

La más ligera de las 4. Sin infraestructura nueva compleja:

- Carpeta `docs/clientes/<hospital-slug>/` con: contrato/addendum B2B, aviso de privacidad específico si aplica, manual de onboarding.
- Si se requiere que el cliente descargue PDFs desde el panel, usar un bucket privado de Supabase Storage con RLS por `clinic_id` (patrón ya usado en el proyecto para otros documentos).

## Fase D — WhatsApp multi-número + agentes

**Proveedor:** Meta Cloud API directo (no Twilio). Se usa **una sola WhatsApp Business Account (WABA)** propiedad de integrika, con **un `phone_number_id` por hospital** — evita el trámite de verificación de Business Manager por cada cliente.

- Edge function nueva `whatsapp-webhook` (mismo patrón que `telegram-webhook` existente): recibe TODOS los mensajes de TODOS los números, y enruta por el `phone_number_id` recibido en el payload → `clinic_id` (vía la columna agregada en Fase A/modelo de tenant).
- **Bot conversacional:** reusa la lógica ya existente de `help-chat-ai`, adaptado a formato de mensajes de WhatsApp Cloud API, scoped siempre por el `clinic_id` resuelto en el paso de ruteo. Mismo rol que hoy cumple Telegram, pero por hospital.
- **Agentes supervisores (QA de flujo):** función programada (cron, como `enviar-recordatorios`) que audita que los eventos que debían generar un mensaje saliente (recordatorio de cita, resultado de laboratorio, cobro pendiente) efectivamente tengan un registro correspondiente en el log de mensajes enviados. Si falta, genera una alerta visible en el panel (`admin`/`super_admin`). No conversan con el paciente — solo vigilan.

Fuera de alcance de Fase D: migrar el bot de Telegram existente a WhatsApp (quedan ambos canales activos en paralelo, decisión de deprecar Telegram no es parte de esta etapa).

## Orden de implementación

1. **Fase A** (panel de clientes + modelo de tenant) — todo lo demás depende de esto.
2. **Fase D** (WhatsApp + agentes) — mayor valor diferenciador para vender a nuevos hospitales.
3. **Fase B** (pagos SaaS) — automatiza lo que en A empieza manual.
4. **Fase C** (documentación) — la más ligera, se acomoda al final o en paralelo sin bloquear nada.

Cada fase se brainstorm-ea y se planea por separado (su propio spec en `docs/superpowers/specs/`) antes de escribir código.

## Riesgos / dependencias externas

- Meta requiere verificación de Business Manager de integrika (proceso externo, no técnico) antes de poder agregar números — bloqueante para Fase D, fuera del control del código.
- Stripe Billing en México: confirmar que el modo "Subscriptions" está habilitado en la cuenta ya usada para pagos de paciente, o si requiere cuenta/producto separado.
- Aviso de privacidad / contrato B2B (Fase C) requiere abogado — ya señalado como pendiente externo en `memoria/STATE.md`.
