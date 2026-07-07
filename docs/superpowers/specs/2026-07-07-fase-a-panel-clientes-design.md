# Diseño — Fase A: Panel de clientes SaaS (onboarding + gestión de tenants)

**Fecha:** 2026-07-07
**Depende de:** `2026-07-06-saas-multitenant-whatsapp-design.md` (spec maestro)
**Estado:** Listo para plan de implementación.

## Contexto

Fase A es la base de la que dependen las fases B (pagos), C (docs) y D (WhatsApp+agentes) del spec maestro. Convierte `clinics` en la unidad de tenant SaaS, agrega un rol `super_admin` operado por el staff de integrika, y da un panel para dar de alta/gestionar hospitales clientes sin tocar SQL a mano.

Roles existentes (`admin`, `doctor`, `nurse`, `receptionist`, `patient` — enum `app_role`) siguen scoped a su propio `clinic_id` vía RLS ya existente (comparación directa de columna, sin cambios). `has_role()` verifica el rol de forma global por `user_id`; el scope por clínica lo hace cada policy por separado comparando `clinic_id`.

## Cambios de datos

**Columnas nuevas en `clinics`:**
- `subscription_status` (`trialing` | `active` | `past_due` | `canceled`, default `trialing`)
- `stripe_customer_id` (text, nullable)
- `stripe_subscription_id` (text, nullable — se llena en Fase B)
- `plan` (text libre, default `'estandar'` — informativo, no gatea módulos)
- `whatsapp_phone_number_id`, `whatsapp_business_account_id` (text, nullable — se llenan en Fase D)
- `rfc`, `direccion_completa`, `logo_url`, `contacto_facturacion_email` (text, nullable)

**Enum `app_role`:** agregar valor `super_admin`.

**Función nueva `clinic_is_active(_clinic_id uuid) RETURNS boolean`:** `SELECT subscription_status = 'active' FROM clinics WHERE id = _clinic_id` (o `'trialing'` también cuenta como activo — trialing permite acceso normal, solo `past_due`/`canceled` bloquean). Se usa para el bloqueo duro (ver más abajo).

## Rol `super_admin` y alcance de sus permisos

`super_admin` NO obtiene acceso a datos clínicos (pacientes, citas, recetas, farmacia) de ningún hospital — su alcance es exclusivamente administrar tenants. Policies nuevas SOLO en tabla `clinics`:

```sql
-- Ejemplo de policy nueva (nombres/sintaxis exactos se definen en el plan)
CREATE POLICY "super_admin_full_access_clinics" ON public.clinics
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));
```

Ninguna otra tabla del sistema se modifica para dar acceso a `super_admin` — si en el futuro se necesita soporte técnico viendo datos de un hospital específico, es una decisión aparte y explícita, no un efecto colateral de este rol.

## Bloqueo duro por suspensión

Las policies RLS existentes que ya filtran por `clinic_id` se extienden agregando `AND clinic_is_active(clinic_id)` a la condición `USING`. Esto se hace tabla por tabla en el plan de implementación (es un cambio mecánico repetido, no una decisión de diseño por tabla) — cubre todas las tablas operativas con columna `clinic_id` (citas, pacientes, farmacia, caja, etc.). Tablas de catálogo/configuración sin datos sensibles del hospital pueden excluirse si no aplica (a decidir caso por caso en el plan).

Efecto: un hospital con `subscription_status IN ('past_due','canceled')` deja de poder leer/escribir sus propios datos operativos por completo. El panel debe mostrar un banner claro explicando el bloqueo (no solo un error de RLS crudo) — se resuelve con un check de `subscription_status` en el frontend antes de renderizar, adicional al bloqueo real en BD.

## Panel `/admin/tenants`

Ruta nueva, React, protegida con guard `has_role(super_admin)` en el router (patrón ya usado para otras rutas admin-only).

**Vista lista:** tabla con nombre clínica, `subscription_status` (badge de color), plan, fecha de alta, acciones (suspender/reactivar).

**Wizard "Nuevo cliente"** (form único, no multi-step separado por llamadas):
- Campos: nombre clínica, RFC, dirección completa, logo (upload a Storage), contacto facturación (email), email del admin inicial del hospital, plan (select, default `estandar`).
- Submit → una sola llamada a la edge function `create-tenant`.

**Acción suspender/reactivar:** botón en la tabla → RPC `set_clinic_subscription_status(clinic_id uuid, new_status text)`, `SECURITY DEFINER`, solo ejecutable por `super_admin` (check interno `has_role`).

## Edge function `create-tenant`

Nueva función (patrón similar a `admin-users` ya existente en `supabase/functions/`), pasos en orden con rollback manual si falla alguno:

1. `INSERT INTO clinics (...)` con `subscription_status = 'trialing'` → obtiene `clinic_id` nuevo.
2. Crear Stripe customer (reusa cliente Stripe ya configurado en `stripe-checkout`/`stripe-webhook`) → `UPDATE clinics SET stripe_customer_id = ...`.
3. `supabase.auth.admin.inviteUserByEmail(email_admin)` → el trigger existente de creación de `profiles` corre igual que hoy; después, `INSERT INTO user_roles (user_id, role, clinic_id)` con `role='admin'` y el `clinic_id` nuevo.
4. Si paso 2 o 3 lanza error: `DELETE FROM clinics WHERE id = clinic_id` (limpieza del paso 1) y se retorna error descriptivo al wizard — no hay transacción real cross-servicio (Stripe + Supabase Auth + Postgres), por eso el rollback es manual y explícito en el código, no automático.

Idempotencia no es requisito en Fase A (alta la hace el equipo integrika manualmente, volumen bajo — 2-10 clientes). Si el wizard falla a medias y se reintenta, el operador ve el mensaje de error y decide si reintentar desde cero.

## Testing

- Unit/integration tests de `create-tenant` con mocks de Stripe y `supabase.auth.admin`: happy path completo, y un caso de rollback por cada punto de falla (2 y 3).
- Test RLS: clínica con `subscription_status='canceled'` no puede leer/escribir en al menos una tabla operativa representativa (ej. `patients` o `citas`) — patrón ya usado en el proyecto para tests de RLS existentes.
- Test manual: flujo completo wizard → login del admin invitado → banner de bloqueo al suspender.

## Fuera de alcance de Fase A

- Self-service signup público (alta la hace integrika manualmente).
- Feature-gating por plan (columna `plan` es informativa).
- Cobro real de Stripe (customer se crea, pero sin subscription — eso es Fase B).
- Número de WhatsApp (columnas quedan `null`, se llenan en Fase D).
