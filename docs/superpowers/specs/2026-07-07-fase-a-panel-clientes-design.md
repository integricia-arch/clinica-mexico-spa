# Diseño — Fase A: Panel de clientes SaaS (onboarding + gestión de tenants)

**Fecha:** 2026-07-07 (revisado — ver "Corrección tras auditoría de código existente")
**Depende de:** `2026-07-06-saas-multitenant-whatsapp-design.md` (spec maestro)
**Estado:** Listo para plan de implementación.

## Corrección tras auditoría de código existente

La primera versión de este spec asumía que el proyecto no tenía multi-tenant real. Falso: la migración `20260528150545` ya creó `clinics`, `clinic_memberships(user_id, clinic_id, role, status)`, y las funciones `is_global_admin()`, `user_has_clinic_access()`, `user_has_clinic_role()`, `current_user_clinic_ids()` — usadas en **18 archivos de migración** para RLS. El frontend (`src/hooks/useActiveClinic.tsx`) ya switch-ea entre clínicas y ya calcula `isGlobalAdmin`.

Esta versión reemplaza la anterior: no se crea rol `super_admin`, no se crea `subscription_status`, no se tocan políticas tabla por tabla. Se reutiliza y se corrige la infraestructura existente.

**Riesgo de seguridad encontrado (a cerrar en esta fase):** `is_global_admin()` hoy verifica `has_role(_user_id, 'admin')` contra la tabla vieja `user_roles` (global, sin `clinic_id`). El backfill de esa misma migración insertó a los admins actuales tanto en `user_roles` (global) como en `clinic_memberships` (scoped a la clínica default). Con una sola clínica en producción esto no se nota — pero en cuanto exista un segundo hospital, **cualquier usuario con `user_roles.role='admin'` heredado (los admins actuales del hospital único de hoy) vería y editaría clínicas de otros hospitales**, porque la policy `"Admin manage clinics"` usa `is_global_admin()` sin distinguir "staff de integrika" de "admin de un hospital cualquiera". Cerrar esto es parte obligatoria de Fase A, no opcional.

## Cambios de datos

**Tabla nueva `platform_staff`:**
```sql
CREATE TABLE public.platform_staff (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
```
Sin RLS pública de lectura para usuarios normales (solo se consulta desde `is_global_admin()`, `SECURITY DEFINER`). Alta de un miembro de staff = INSERT manual por el equipo integrika (operación rara, no necesita UI en Fase A).

**Redefinir `is_global_admin()`** (reemplaza la definición actual, mismo nombre — nada que la llama cambia de firma):
```sql
CREATE OR REPLACE FUNCTION public.is_global_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_staff WHERE user_id = _user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.is_global_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_global_admin(uuid) TO authenticated;
```
Efecto inmediato: deja de importar `user_roles.role='admin'` para el acceso global — cierra el leak. Los 18 archivos que ya usan `is_global_admin()`/`user_has_clinic_access()`/`user_has_clinic_role()` heredan el fix sin tocarlos.

**Extender `user_has_clinic_access()` y `user_has_clinic_role()`** para exigir que la clínica esté activa (bloqueo duro de suspensión, centralizado — no se toca ninguna policy individual de las 18):
```sql
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
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_clinic_role(_user_id uuid, _clinic_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_global_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      JOIN public.clinics c ON c.id = cm.clinic_id
      WHERE cm.user_id = _user_id
        AND cm.clinic_id = _clinic_id
        AND cm.role = _role
        AND cm.status = 'active'
        AND c.status = 'active'
    );
$$;
```
`is_global_admin` (ahora = staff integrika real) sigue viendo todo incluso si una clínica está suspendida — necesario para poder reactivarla desde el panel.

**Columnas nuevas en `clinics`** (las demás — `rfc`, `logo_url`, `status` — ya existen, no se duplican):
- `stripe_customer_id` (text, nullable)
- `stripe_subscription_id` (text, nullable — se llena en Fase B)
- `plan` (text, default `'estandar'` — informativo, no gatea módulos)
- `whatsapp_phone_number_id`, `whatsapp_business_account_id` (text, nullable — se llenan en Fase D)
- `contacto_facturacion_email` (text, nullable)

`clinics.status` ya soporta `'active'|'inactive'|'suspended'` — se reutiliza tal cual como el estado de suspensión SaaS. No se agrega `subscription_status`.

## Panel `/admin/tenants`

Ruta nueva, React, guard: `isGlobalAdmin` de `useActiveClinic()` (ya expuesto por el contexto existente, ahora respaldado por `platform_staff` en vez del rol legacy).

**Vista lista:** tabla de `clinics` — nombre, `status` (badge), plan, fecha alta (`created_at`), acciones (suspender → `status='suspended'`, reactivar → `status='active'`).

**Wizard "Nuevo cliente":** form único → una sola llamada a edge function `create-tenant`. Campos: nombre, `code` (slug único, requerido por `clinics.code UNIQUE NOT NULL`), RFC, dirección, logo, contacto facturación, email del admin inicial, plan.

**Acción suspender/reactivar:** RPC `SECURITY DEFINER` nueva `set_clinic_status(_clinic_id uuid, _status text)`:
```sql
CREATE OR REPLACE FUNCTION public.set_clinic_status(_clinic_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_global_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF _status NOT IN ('active','inactive','suspended') THEN
    RAISE EXCEPTION 'Estado inválido: %', _status;
  END IF;
  UPDATE public.clinics SET status = _status WHERE id = _clinic_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_clinic_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_clinic_status(uuid, text) TO authenticated;
```

## Edge function `create-tenant`

Nueva función (patrón similar a `admin-users` ya existente), pasos con rollback manual si falla alguno:

1. `INSERT INTO clinics (code, name, rfc, address, logo_url, contacto_facturacion_email, status) VALUES (..., 'active')` → obtiene `clinic_id`.
2. Crear Stripe customer (reusa cliente Stripe ya configurado en `stripe-checkout`) → `UPDATE clinics SET stripe_customer_id = ...`.
3. `supabase.auth.admin.inviteUserByEmail(email_admin)` → trigger existente crea `profiles`; luego `INSERT INTO clinic_memberships (user_id, clinic_id, role, status) VALUES (..., clinic_id, 'admin', 'active')`. **No se toca `user_roles`** — así el nuevo admin queda scoped únicamente a su hospital, sin el leak que tenían los admins legacy.
4. Si paso 2 o 3 falla: `DELETE FROM clinics WHERE id = clinic_id` y error descriptivo al wizard.

## Testing

- Unit test de `is_global_admin()` redefinida: usuario en `platform_staff` → true; usuario con `user_roles.role='admin'` pero SIN fila en `platform_staff` → false (test de regresión del leak, el más importante de esta fase).
- Test RLS: 2 clínicas ficticias, admin de clínica A no puede leer `clinics` de clínica B ni datos operativos de B.
- Test RLS: clínica con `status='suspended'` bloquea lectura/escritura de un usuario con membership activa en ella (tabla operativa representativa, ej. `patients`).
- Unit/integration test de `create-tenant`: happy path + rollback en fallo de paso 2 y de paso 3.
- Test manual: wizard → login admin invitado → suspender clínica → confirmar bloqueo real (no solo visual).

## Fuera de alcance de Fase A

- Self-service signup público.
- Feature-gating por plan.
- Cobro real de Stripe (customer se crea, subscription es Fase B).
- Número de WhatsApp (columnas quedan `null`, Fase D).
- Migrar a `platform_staff` a los admins legacy actuales — es una decisión manual de negocio (a quién considerar "staff integrika" hoy), se documenta como paso operativo en el plan, no se automatiza.
