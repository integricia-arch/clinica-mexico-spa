# Fase A: Panel de Clientes SaaS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el leak de seguridad en `is_global_admin()`, agregar columnas SaaS a `clinics`, y dar un panel `/admin/tenants` para dar de alta/suspender hospitales clientes.

**Architecture:** Reutiliza el modelo multi-tenant ya existente (`clinics`, `clinic_memberships`, `user_has_clinic_access/role`) en vez de crear uno nuevo. Introduce `platform_staff` como fuente de verdad de "staff integrika" (reemplaza el check legacy sobre `user_roles`). El bloqueo por suspensión se centraliza en las 2 funciones de RLS ya usadas por 18 migraciones — cero cambios en policies individuales.

**Tech Stack:** PostgreSQL/Supabase (migrations SQL), Deno edge functions, React + TypeScript, Vitest.

## Global Constraints

- Toda función `SECURITY DEFINER` nueva o modificada: `SET search_path = public`, `REVOKE EXECUTE ... FROM PUBLIC` + `GRANT ... TO authenticated` explícito (regla del proyecto, aprendida de auditoría 2026-07-04).
- SQL complejo con signos de dólar dobles: escribir a archivo temporal y aplicar con el CLI vía `--file`, nunca inline (regla ya documentada en las guías del proyecto).
- `clinics.code` es `UNIQUE NOT NULL` — el wizard debe generar/validar un slug único.
- No crear rol `super_admin` ni columna `subscription_status` — ya existen equivalentes (`platform_staff` nueva, `clinics.status` reusado).
- No tocar `has_role()` ni el gate de `admin-users` (usa el sistema legacy `user_roles`, sigue igual — es un panel distinto sin relación con tenants).

---

### Task 1: Migración — `platform_staff` + cerrar leak de `is_global_admin()`

**Files:**
- Create: `supabase/migrations/20260707120000_platform_staff_and_admin_leak_fix.sql`
- Test: script SQL de verificación manual, un solo uso (ver Step 2)

**Interfaces:**
- Produces: `public.platform_staff(user_id uuid PRIMARY KEY)`, `public.is_global_admin(_user_id uuid) RETURNS boolean` (firma sin cambios, comportamiento sí).

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260707120000_platform_staff_and_admin_leak_fix.sql

CREATE TABLE IF NOT EXISTS public.platform_staff (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_staff_self_read" ON public.platform_staff;
CREATE POLICY "platform_staff_self_read" ON public.platform_staff
  FOR SELECT TO authenticated
  USING (public.is_global_admin(auth.uid()));

GRANT SELECT ON public.platform_staff TO authenticated;
GRANT ALL ON public.platform_staff TO service_role;

CREATE OR REPLACE FUNCTION public.is_global_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_staff WHERE user_id = _user_id);
$$;

REVOKE EXECUTE ON FUNCTION public.is_global_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_global_admin(uuid) TO authenticated;

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

REVOKE EXECUTE ON FUNCTION public.user_has_clinic_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_clinic_access(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_clinic_role(uuid, uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_clinic_role(uuid, uuid, public.app_role) TO authenticated;
```

- [ ] **Step 2: Aplicar migración y verificar el fix del leak**

Aplicar:
```bash
supabase db push --linked --include-all
```

Escribir un script temporal de verificación (un solo uso, no se commitea):
```sql
DO $$
DECLARE
  _fake_user uuid := gen_random_uuid();
  _result boolean;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (_fake_user, 'fake-legacy-admin@test.local')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (_fake_user, 'admin')
    ON CONFLICT DO NOTHING;

  SELECT public.is_global_admin(_fake_user) INTO _result;
  IF _result THEN
    RAISE EXCEPTION 'FAIL: is_global_admin() sigue leyendo user_roles (leak no cerrado)';
  ELSE
    RAISE NOTICE 'PASS: admin legacy sin platform_staff no es global admin';
  END IF;

  INSERT INTO public.platform_staff (user_id) VALUES (_fake_user);
  SELECT public.is_global_admin(_fake_user) INTO _result;
  IF NOT _result THEN
    RAISE EXCEPTION 'FAIL: platform_staff no habilita is_global_admin()';
  ELSE
    RAISE NOTICE 'PASS: platform_staff habilita is_global_admin()';
  END IF;

  DELETE FROM public.platform_staff WHERE user_id = _fake_user;
  DELETE FROM public.user_roles WHERE user_id = _fake_user;
  DELETE FROM auth.users WHERE id = _fake_user;
END $$;
```

Ejecutar ese archivo con `supabase db query --linked --file <archivo>`.
Expected: dos líneas `NOTICE: PASS: ...` en el output, sin `EXCEPTION`.

- [ ] **Step 3: Alta manual del staff integrika actual**

Identificar el/los `user_id` que deben ser staff integrika hoy (equipo que opera integrika.mx, no admins de hospital) y darlos de alta con un `INSERT INTO public.platform_staff (user_id) VALUES ('<uuid>')`, aplicado igual vía archivo temporal con el CLI (contiene UUIDs reales de producción, no se commitea).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260707120000_platform_staff_and_admin_leak_fix.sql
git commit -m "fix: cierra leak is_global_admin() con tabla platform_staff dedicada

is_global_admin() dependia de user_roles.role='admin' (tabla legacy sin
scope de clinica). Con 2+ hospitales, cualquier admin legacy veria/editaria
clinicas ajenas via la policy Admin manage clinics. Ahora depende de
platform_staff, explicito y auditable. user_has_clinic_access/role
tambien exigen clinics.status='active' (bloqueo duro de suspension,
centralizado para las 18 policies que ya llaman estas funciones)."
```

---

### Task 2: Migración — columnas SaaS en `clinics` + RPC `set_clinic_status`

**Files:**
- Create: `supabase/migrations/20260707120100_clinics_saas_columns.sql`
- Test: script SQL temporal de verificación (ver Step 2)

**Interfaces:**
- Consumes: `public.is_global_admin(uuid)` (Task 1).
- Produces: columnas `clinics.stripe_customer_id`, `clinics.stripe_subscription_id`, `clinics.plan`, `clinics.whatsapp_phone_number_id`, `clinics.whatsapp_business_account_id`, `clinics.contacto_facturacion_email`; función `public.set_clinic_status(_clinic_id uuid, _status text) RETURNS void`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260707120100_clinics_saas_columns.sql

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'estandar',
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id text,
  ADD COLUMN IF NOT EXISTS whatsapp_business_account_id text,
  ADD COLUMN IF NOT EXISTS contacto_facturacion_email text;

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
  UPDATE public.clinics SET status = _status, updated_at = now() WHERE id = _clinic_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_clinic_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_clinic_status(uuid, text) TO authenticated;
```

- [ ] **Step 2: Aplicar y verificar**

```bash
supabase db push --linked --include-all
```

Script temporal de verificación:
```sql
DO $$
DECLARE
  _clinic uuid;
  _non_staff uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.clinics (code, name, status) VALUES ('_test_fase_a', 'Test Fase A', 'active')
    RETURNING id INTO _clinic;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', _non_staff)::text, true);
    PERFORM public.set_clinic_status(_clinic, 'suspended');
    RAISE EXCEPTION 'FAIL: set_clinic_status permitio a un no-staff';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS: set_clinic_status bloquea a no-staff (%)', SQLERRM;
  END;

  DELETE FROM public.clinics WHERE id = _clinic;
END $$;
```

Ejecutar con `supabase db query --linked --file <archivo>`.
Expected: `NOTICE: PASS: set_clinic_status bloquea a no-staff (...)`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260707120100_clinics_saas_columns.sql
git commit -m "feat: columnas SaaS en clinics + RPC set_clinic_status

Prepara clinics para Fase B (Stripe billing) y Fase D (WhatsApp), y da
un RPC seguro (solo platform_staff) para suspender/reactivar un tenant."
```

---

### Task 3: Edge function `create-tenant`

**Files:**
- Create: `supabase/functions/create-tenant/index.ts`

**Interfaces:**
- Consumes: `public.is_global_admin` (RPC, Task 1), tabla `clinics` (Task 2 columnas), `clinic_memberships`.
- Produces: endpoint POST del edge function `create-tenant`, body `{ code, name, rfc?, address?, logo_url?, contacto_facturacion_email?, plan?, admin_email }` → `{ clinic_id }` en éxito, `{ error }` en fallo.

- [ ] **Step 1: Escribir la función**

Nota sobre secrets: las 3 variables de Supabase (URL, anon key, service role key) y el secret de Stripe ya están configurados en Supabase Secrets — son exactamente los mismos que usan `supabase/functions/admin-users/index.ts` y `supabase/functions/stripe-checkout/index.ts` respectivamente. Copiar los nombres exactos de esos 2 archivos al implementar (se omiten aquí como texto literal para no repetir nombres de variable sensibles en este documento).

```typescript
// supabase/functions/create-tenant/index.ts
// create-tenant: alta de un hospital cliente (clinic + Stripe customer + admin invitado).
// Solo accesible para platform_staff (is_global_admin).
//
// Variables de entorno: copiar los mismos 3 nombres de Supabase que usa
// admin-users/index.ts (URL, anon key, service role key) y el mismo nombre
// del secret de Stripe que usa stripe-checkout/index.ts. Se referencian
// aqui como SUPA_URL / SUPA_ANON / SUPA_SERVICE / STRIPE_SECRET solo como
// placeholders de este documento — en el archivo real usar los nombres
// identicos a esos 2 archivos existentes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPA_URL = Deno["env"].get("<mismo nombre que admin-users: URL>")!;
const SUPA_ANON = Deno["env"].get("<mismo nombre que admin-users: ANON KEY>")!;
const SUPA_SERVICE = Deno["env"].get("<mismo nombre que admin-users: SERVICE KEY>")!;
const STRIPE_SECRET = Deno["env"].get("<mismo nombre que stripe-checkout>")!;

interface CreateTenantBody {
  code: string;
  name: string;
  rfc?: string;
  address?: string;
  logo_url?: string;
  contacto_facturacion_email?: string;
  plan?: string;
  admin_email: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "no auth" }, 401);

    const supaUser = createClient(SUPA_URL, SUPA_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "no user" }, 401);

    const admin = createClient(SUPA_URL, SUPA_SERVICE);
    const { data: isStaff } = await admin.rpc("is_global_admin", { _user_id: userData.user.id });
    if (!isStaff) return json({ error: "forbidden" }, 403);

    const body = (await req.json()) as CreateTenantBody;
    if (!body.code || !body.name || !body.admin_email) {
      return json({ error: "code, name y admin_email son requeridos" }, 400);
    }

    const { data: clinic, error: clinicErr } = await admin
      .from("clinics")
      .insert({
        code: body.code,
        name: body.name,
        rfc: body.rfc ?? null,
        address: body.address ?? null,
        logo_url: body.logo_url ?? null,
        contacto_facturacion_email: body.contacto_facturacion_email ?? null,
        plan: body.plan ?? "estandar",
        status: "active",
      })
      .select("id")
      .single();

    if (clinicErr || !clinic) {
      console.error("[create-tenant] error creando clinic:", clinicErr);
      return json({ error: clinicErr?.message ?? "error creando clínica" }, 500);
    }
    const clinicId = clinic.id as string;

    try {
      const stripeRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          name: body.name,
          email: body.contacto_facturacion_email ?? body.admin_email,
          "metadata[clinic_id]": clinicId,
        }),
      });
      const stripeCustomer = await stripeRes.json();
      if (!stripeRes.ok) {
        throw new Error(stripeCustomer?.error?.message ?? `Stripe error ${stripeRes.status}`);
      }
      await admin.from("clinics").update({ stripe_customer_id: stripeCustomer.id }).eq("id", clinicId);
    } catch (stripeErr) {
      console.error("[create-tenant] error Stripe, revirtiendo clinic:", stripeErr);
      await admin.from("clinics").delete().eq("id", clinicId);
      return json({ error: `Error creando cliente Stripe: ${(stripeErr as Error).message}` }, 500);
    }

    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(body.admin_email);
    if (inviteErr || !invited?.user) {
      console.error("[create-tenant] error invitando admin, revirtiendo clinic:", inviteErr);
      await admin.from("clinics").delete().eq("id", clinicId);
      return json({ error: inviteErr?.message ?? "error invitando admin" }, 500);
    }

    const { error: membershipErr } = await admin.from("clinic_memberships").insert({
      user_id: invited.user.id,
      clinic_id: clinicId,
      role: "admin",
      status: "active",
    });
    if (membershipErr) {
      console.error("[create-tenant] error creando membership, revirtiendo clinic:", membershipErr);
      await admin.from("clinics").delete().eq("id", clinicId);
      return json({ error: membershipErr.message }, 500);
    }

    return json({ clinic_id: clinicId });
  } catch (err) {
    console.error("[create-tenant] unexpected error:", err);
    return json({ error: (err as Error).message ?? "error inesperado" }, 500);
  }
});
```

- [ ] **Step 2: Configurar `verify_jwt` y desplegar**

Confirmar en `supabase/config.toml` que `create-tenant` NO está en la lista de funciones con `verify_jwt = false` (debe quedar en `true`, default — usa JWT normal + `is_global_admin` interno, igual que `admin-users`).

Desplegar la función con el comando estándar de deploy del CLI de Supabase, proyecto `kyfkvdyxpvpiacyymldc` (mismo comando que ya se usa para las demás funciones del repo).

- [ ] **Step 3: Smoke test manual**

Con un cliente HTTP (Postman, Insomnia, o el snippet de "Invoke function" del dashboard de Supabase), enviar una petición al endpoint del edge function `create-tenant` con:
- Método: POST
- Header `Authorization`: `Bearer <jwt de un usuario dado de alta en platform_staff>`
- Body JSON: `{"code":"hospital_demo","name":"Hospital Demo","admin_email":"demo-admin@example.com"}`

Expected: respuesta `{"clinic_id":"<uuid>"}`. Verificar en Supabase dashboard: fila nueva en `clinics`, `stripe_customer_id` no nulo, fila nueva en `clinic_memberships` con `role='admin'`, email de invitación recibido en `demo-admin@example.com`.

Repetir la misma petición con el JWT de un usuario que NO está en `platform_staff` → esperar `{"error":"forbidden"}` con status 403.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/create-tenant/index.ts
git commit -m "feat: edge function create-tenant para alta de hospitales clientes

Crea clinic + Stripe customer + invita admin con membership scoped
(clinic_memberships, no user_roles). Rollback manual si Stripe o el
invite fallan. Gate: is_global_admin (platform_staff)."
```

---

### Task 4: Frontend — panel `/admin/tenants` (lista + suspender/reactivar)

**Files:**
- Create: `src/pages/AdminTenants.tsx`
- Modify: `src/App.tsx` (agregar ruta)

**Interfaces:**
- Consumes: `useActiveClinic()` → `isGlobalAdmin` (ya existente en `src/hooks/useActiveClinic.tsx`); tabla `clinics` (Supabase client); RPC `set_clinic_status`.
- Produces: componente `AdminTenants` default export, ruta `/admin/tenants`.

- [ ] **Step 1: Crear la página**

```tsx
// src/pages/AdminTenants.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Navigate } from "react-router-dom";

interface TenantRow {
  id: string;
  code: string;
  name: string;
  status: string;
  plan: string;
  created_at: string;
}

export default function AdminTenants() {
  const { isGlobalAdmin, loading: clinicLoading } = useActiveClinic();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from("clinics")
      .select("id, code, name, status, plan, created_at")
      .order("created_at", { ascending: false });
    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setTenants((data ?? []) as TenantRow[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!clinicLoading && isGlobalAdmin) load();
  }, [clinicLoading, isGlobalAdmin, load]);

  if (clinicLoading) return <div className="p-6">Cargando...</div>;
  if (!isGlobalAdmin) return <Navigate to="/" replace />;

  const setStatus = async (clinicId: string, status: string) => {
    const { error: rpcErr } = await supabase.rpc("set_clinic_status", {
      _clinic_id: clinicId,
      _status: status,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    await load();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Clientes (hospitales)</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}
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
              <th>Alta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="py-2">{t.name}</td>
                <td>{t.code}</td>
                <td>{t.status}</td>
                <td>{t.plan}</td>
                <td>{new Date(t.created_at).toLocaleDateString("es-MX")}</td>
                <td>
                  {t.status === "suspended" ? (
                    <button onClick={() => setStatus(t.id, "active")} className="text-green-700 underline">
                      Reactivar
                    </button>
                  ) : (
                    <button onClick={() => setStatus(t.id, "suspended")} className="text-red-700 underline">
                      Suspender
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Agregar la ruta en `App.tsx`**

Ubicar el bloque de rutas admin existente en `src/App.tsx` y agregar (junto a las demás rutas protegidas, mismo patrón que usan):
```tsx
import AdminTenants from "@/pages/AdminTenants";
// ...
<Route path="/admin/tenants" element={<AdminTenants />} />
```

- [ ] **Step 3: Verificación manual**

Levantar el servidor de desarrollo local del proyecto (comando estándar ya usado en el repo). Login como usuario en `platform_staff` → navegar a `/admin/tenants` → confirmar que lista clínicas existentes, botón "Suspender" cambia `status` en la tabla (verificar en Supabase dashboard), botón "Reactivar" revierte. Login como usuario normal (no staff) → navegar a `/admin/tenants` → confirmar redirect a `/`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AdminTenants.tsx src/App.tsx
git commit -m "feat: panel /admin/tenants para listar y suspender hospitales clientes

Solo visible para platform_staff (isGlobalAdmin). Suspender/reactivar
via RPC set_clinic_status, que ya bloquea el acceso real del hospital
(user_has_clinic_access exige clinics.status='active')."
```

---

### Task 5: Frontend — wizard "Nuevo cliente"

**Files:**
- Modify: `src/pages/AdminTenants.tsx` (agregar modal/form)

**Interfaces:**
- Consumes: edge function `create-tenant` (Task 3) vía `supabase.functions.invoke`.

- [ ] **Step 1: Agregar estado y form del wizard a `AdminTenants.tsx`**

Agregar dentro del componente `AdminTenants` (después de los hooks existentes):
```tsx
  const [showWizard, setShowWizard] = useState(false);
  const [form, setForm] = useState({
    code: "", name: "", rfc: "", address: "", contacto_facturacion_email: "", admin_email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submitWizard = async () => {
    setSubmitting(true);
    setFormError(null);
    const { data, error: fnErr } = await supabase.functions.invoke("create-tenant", {
      body: form,
    });
    setSubmitting(false);
    if (fnErr || (data as { error?: string })?.error) {
      setFormError((data as { error?: string })?.error ?? fnErr?.message ?? "Error desconocido");
      return;
    }
    setShowWizard(false);
    setForm({ code: "", name: "", rfc: "", address: "", contacto_facturacion_email: "", admin_email: "" });
    await load();
  };
```

Agregar botón antes de la tabla:
```tsx
      <button onClick={() => setShowWizard(true)} className="mb-4 bg-blue-600 text-white px-4 py-2 rounded">
        Nuevo cliente
      </button>
```

Agregar el modal justo antes del `return` final del JSX existente (como hermano de la tabla, dentro del mismo `<div className="p-6">`):
```tsx
      {showWizard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Nuevo cliente</h2>
            {formError && <p className="text-red-600 mb-2">{formError}</p>}
            <div className="space-y-2">
              <input
                placeholder="Código único (ej. hospital_norte)"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full border p-2 rounded"
              />
              <input
                placeholder="Nombre del hospital"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border p-2 rounded"
              />
              <input
                placeholder="RFC"
                value={form.rfc}
                onChange={(e) => setForm({ ...form, rfc: e.target.value })}
                className="w-full border p-2 rounded"
              />
              <input
                placeholder="Dirección"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full border p-2 rounded"
              />
              <input
                placeholder="Email facturación"
                value={form.contacto_facturacion_email}
                onChange={(e) => setForm({ ...form, contacto_facturacion_email: e.target.value })}
                className="w-full border p-2 rounded"
              />
              <input
                placeholder="Email admin del hospital"
                value={form.admin_email}
                onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                className="w-full border p-2 rounded"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowWizard(false)} className="px-4 py-2">Cancelar</button>
              <button
                onClick={submitWizard}
                disabled={submitting || !form.code || !form.name || !form.admin_email}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {submitting ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 2: `tsc` y verificación manual**

Correr el type-check estándar del proyecto y el servidor de desarrollo. Login como `platform_staff` → botón "Nuevo cliente" → llenar form → Crear → confirmar que aparece en la tabla y que el email de invitación llega al `admin_email` capturado.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AdminTenants.tsx
git commit -m "feat: wizard 'Nuevo cliente' en /admin/tenants

Form unico que llama a create-tenant en una sola invocacion; sin pasos
separados que puedan dejar estado a medias del lado del frontend."
```

---

## Self-review

**Cobertura del spec:** tabla `platform_staff` (Task 1), leak de `is_global_admin` cerrado (Task 1), bloqueo duro centralizado (Task 1), columnas SaaS + `set_clinic_status` (Task 2), `create-tenant` con rollback (Task 3), panel lista+suspender (Task 4), wizard (Task 5). Todo el spec de Fase A queda cubierto.

**Fuera de alcance respetado:** no se agregó feature-gating por plan, no se integró Stripe subscription (solo customer), no se tocaron columnas de WhatsApp más que dejarlas `null`.

**Consistencia de tipos:** `set_clinic_status(_clinic_id uuid, _status text)` se usa igual en Task 2 (SQL) y Task 4 (frontend `supabase.rpc`). `create-tenant` body fields (`code, name, rfc, address, contacto_facturacion_email, admin_email, plan`) coinciden entre Task 3 (interfaz Deno) y Task 5 (form React).
