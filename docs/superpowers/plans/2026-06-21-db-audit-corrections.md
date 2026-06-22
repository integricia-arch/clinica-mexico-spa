# DB Audit Corrections — clinica-mexico-spa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir las 73 findings del audit claude-db en orden de riesgo decreciente sin interrumpir farmacia, citas, CFDI ni el bot de Telegram en producción.

**Architecture:** Cada fase produce migraciones SQL timestamped idempotentes (`IF EXISTS` / `IF NOT EXISTS`), aplicadas vía `supabase db push --linked` o `supabase db query --linked --file`. Ninguna fase destruye datos existentes. Se verifica en producción antes de pasar a la siguiente.

**Tech Stack:** Supabase Postgres 15 · supabase-cli · psql · SQL puro (sin ORM)

## Global Constraints

- NUNCA ejecutar `supabase db reset` en producción
- TODA migración usa nombre timestamped: `YYYYMMDDHHMMSS_descripcion.sql`
- TODA migración es idempotente (IF EXISTS / IF NOT EXISTS / ON CONFLICT DO NOTHING)
- Las migraciones de índices usan `CREATE INDEX CONCURRENTLY IF NOT EXISTS` — no dentro de transacción
- Los RPCs críticos (pharmacy_register_sale, turno_close) se modifican solo en Fase 4 (nunca en Fase 0-1)
- Verificar con `SELECT` de diagnóstico después de cada migración antes de la siguiente
- Backup previo a cada fase: `supabase db dump --linked -f backup_fase_N_$(date +%Y%m%d).sql`

---

## Resumen de fases

| Fase | Nombre | SLA | Riesgo producción |
|------|--------|-----|-------------------|
| 0 | Emergencia — bugs activos en runtime | Mismo día | Ninguno: solo ADD/FIX policies |
| 1 | Seguridad — RLS, PIN, OAuth tokens | Esta semana | Muy bajo |
| 2 | Integridad referencial | Sprint 1 | Bajo (solo ADD CONSTRAINT) |
| 3 | Higiene de migraciones | Sprint 1 | Bajo (reorganización de archivos) |
| 4 | Fixes de lógica de negocio | Sprint 2 | Medio (RPCs críticos) |
| 5 | Performance — índices | Sprint 2 | Muy bajo (CONCURRENTLY) |
| 6 | Operacional — cron, GDPR | Sprint 3 | Muy bajo |

---

## FASE 0 — Emergencia (mismo día)

> Dos bugs que rompen producción ahora mismo. Zero downtime.

### Task 0.1: Arreglar RLS de `almacen_alertas` (tabla inexistente)

**Problema:** La policy `almacen_alertas_clinic_member_select` referencia `clinic_members` (no existe). Toda query SELECT a `almacen_alertas` falla con `relation "clinic_members" does not exist`.

**Files:**
- Create: `supabase/migrations/20260621100001_fix_almacen_alertas_rls.sql`

- [ ] **Step 1: Verificar el bug en producción**

```bash
supabase db query --linked "
SELECT policyname, qual
FROM pg_policies
WHERE tablename = 'almacen_alertas' AND schemaname = 'public';
"
```
Expected: ver `clinic_members` (tabla incorrecta) en la política SELECT.

- [ ] **Step 2: Crear la migración**

```sql
-- supabase/migrations/20260621100001_fix_almacen_alertas_rls.sql
-- Fix: RLS policy referenciaba 'clinic_members' (inexistente).
-- Tabla correcta: clinic_memberships.

-- DROP políticas rotas
DROP POLICY IF EXISTS "almacen_alertas_clinic_member_select" ON public.almacen_alertas;
DROP POLICY IF EXISTS "almacen_alertas_clinic_member_insert" ON public.almacen_alertas;
DROP POLICY IF EXISTS "almacen_alertas_clinic_member_update" ON public.almacen_alertas;
DROP POLICY IF EXISTS "almacen_alertas_clinic_member_delete" ON public.almacen_alertas;

-- CREAR políticas correctas
CREATE POLICY "almacen_alertas_select" ON public.almacen_alertas
  FOR SELECT TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR public.is_global_admin(auth.uid())
  );

CREATE POLICY "almacen_alertas_insert" ON public.almacen_alertas
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('admin', 'nurse')
    )
    OR public.is_global_admin(auth.uid())
  );

CREATE POLICY "almacen_alertas_update" ON public.almacen_alertas
  FOR UPDATE TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('admin', 'nurse')
    )
    OR public.is_global_admin(auth.uid())
  );
```

- [ ] **Step 3: Aplicar**

```bash
supabase db push --linked
```

- [ ] **Step 4: Verificar**

```bash
supabase db query --linked "
SELECT COUNT(*) FROM public.almacen_alertas LIMIT 1;
"
```
Expected: no error, devuelve número.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260621100001_fix_almacen_alertas_rls.sql
git commit -m "fix(db): corregir RLS almacen_alertas — clinic_members → clinic_memberships"
```

---

### Task 0.2: Habilitar RLS en `profiles` y proteger `supervisor_pin_hash`

**Problema:** `profiles` no tiene RLS. Cualquier usuario autenticado puede leer `supervisor_pin_hash` (bcrypt hashes de PIN de supervisores).

**Files:**
- Create: `supabase/migrations/20260621100002_enable_rls_profiles.sql`

- [ ] **Step 1: Verificar estado actual**

```bash
supabase db query --linked "
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'profiles' AND relnamespace = 'public'::regnamespace;
"
```
Expected: `relrowsecurity = false` (confirma el bug).

- [ ] **Step 2: Crear la migración**

```sql
-- supabase/migrations/20260621100002_enable_rls_profiles.sql
-- Habilitar RLS en profiles y proteger supervisor_pin_hash.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Usuario lee/actualiza solo su propio perfil
CREATE POLICY "profiles_own_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND supervisor_pin_hash IS NOT DISTINCT FROM OLD.supervisor_pin_hash);

-- Admin puede leer todos los perfiles (sin supervisor_pin_hash — ver nota)
CREATE POLICY "profiles_admin_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role mantiene acceso total para RPCs internos
-- (service_role bypasses RLS by default en Supabase)

-- Revocar UPDATE directo de supervisor_pin_hash desde la API pública.
-- El hash solo se modifica via RPC set_supervisor_pin() (SECURITY DEFINER).
REVOKE UPDATE (supervisor_pin_hash) ON public.profiles FROM authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;
```

- [ ] **Step 3: Aplicar y verificar**

```bash
supabase db push --linked
supabase db query --linked "
SELECT relrowsecurity FROM pg_class
WHERE relname = 'profiles' AND relnamespace = 'public'::regnamespace;
"
```
Expected: `relrowsecurity = true`.

- [ ] **Step 4: Test funcional — leer propio perfil**

```bash
# En Supabase Studio SQL Editor, con token de usuario normal:
supabase db query --linked "
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{\"sub\": \"<tu-user-id>\"}';
SELECT id, full_name FROM public.profiles WHERE id = '<tu-user-id>';
"
```
Expected: devuelve la fila propia sin error.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260621100002_enable_rls_profiles.sql
git commit -m "fix(security): habilitar RLS en profiles — proteger supervisor_pin_hash"
```

---

## FASE 1 — Seguridad (esta semana)

### Task 1.1: Migrar OAuth tokens de `doctor_calendars` a Supabase Vault

**Problema:** `access_token` y `refresh_token` almacenados en plaintext. Patrón correcto ya existe en `cfdi_upsert_secret` / `cfdi_get_secret`.

**Files:**
- Create: `supabase/migrations/20260622100001_doctor_calendars_vault.sql`

- [ ] **Step 1: Verificar que Vault está disponible**

```bash
supabase db query --linked "
SELECT COUNT(*) FROM vault.secrets LIMIT 1;
"
```
Expected: número (no error).

- [ ] **Step 2: Crear migración**

```sql
-- supabase/migrations/20260622100001_doctor_calendars_vault.sql
-- Migrar OAuth tokens de doctor_calendars a Supabase Vault.

-- 1. Agregar columnas para referencias a Vault
ALTER TABLE public.doctor_calendars
  ADD COLUMN IF NOT EXISTS vault_access_token_id  uuid,
  ADD COLUMN IF NOT EXISTS vault_refresh_token_id uuid;

-- 2. RPC para upsert de token OAuth (solo service_role)
CREATE OR REPLACE FUNCTION public.doctor_calendar_upsert_token(
  p_doctor_id     uuid,
  p_token_type    text,  -- 'access' | 'refresh'
  p_token_value   text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret_name text;
  v_existing_id uuid;
  v_vault_id    uuid;
BEGIN
  v_secret_name := 'doctor_calendar_' || p_token_type || '_' || p_doctor_id;

  SELECT id INTO v_existing_id
  FROM vault.secrets
  WHERE name = v_secret_name
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE vault.secrets SET secret = p_token_value WHERE id = v_existing_id;
    v_vault_id := v_existing_id;
  ELSE
    v_vault_id := vault.create_secret(p_token_value, v_secret_name, 'Google OAuth token');
  END IF;

  RETURN v_vault_id;
END;
$$;

REVOKE ALL ON FUNCTION public.doctor_calendar_upsert_token(uuid, text, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_calendar_upsert_token(uuid, text, text) TO service_role;

-- 3. RPC para leer token OAuth descifrado (solo service_role)
CREATE OR REPLACE FUNCTION public.doctor_calendar_get_token(
  p_doctor_id  uuid,
  p_token_type text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret_name text;
  v_decrypted   text;
BEGIN
  v_secret_name := 'doctor_calendar_' || p_token_type || '_' || p_doctor_id;
  SELECT decrypted_secret INTO v_decrypted
  FROM vault.decrypted_secrets
  WHERE name = v_secret_name
  LIMIT 1;
  RETURN v_decrypted;
END;
$$;

REVOKE ALL ON FUNCTION public.doctor_calendar_get_token(uuid, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_calendar_get_token(uuid, text) TO service_role;
```

- [ ] **Step 3: Script de migración de datos**

```sql
-- EJECUTAR MANUALMENTE (no como migración — tiene datos sensibles):
-- supabase db query --linked --file scripts/migrate_doctor_tokens_to_vault.sql

DO $$
DECLARE
  r RECORD;
  v_access_id  uuid;
  v_refresh_id uuid;
BEGIN
  FOR r IN SELECT id, access_token, refresh_token FROM public.doctor_calendars
           WHERE access_token IS NOT NULL
  LOOP
    v_access_id  := public.doctor_calendar_upsert_token(r.id, 'access',  r.access_token);
    v_refresh_id := public.doctor_calendar_upsert_token(r.id, 'refresh', r.refresh_token);
    UPDATE public.doctor_calendars
    SET vault_access_token_id  = v_access_id,
        vault_refresh_token_id = v_refresh_id
    WHERE id = r.id;
  END LOOP;
  RAISE NOTICE 'Tokens migrados a Vault';
END;
$$;
```

Guardar como `supabase/scripts/migrate_doctor_tokens_to_vault.sql`.

- [ ] **Step 4: Verificar migración de datos**

```bash
supabase db query --linked "
SELECT COUNT(*) as total,
       COUNT(vault_access_token_id) as con_vault
FROM public.doctor_calendars;
"
```
Expected: `total = con_vault`.

- [ ] **Step 5: Drop columnas plaintext (segunda migración)**

```sql
-- supabase/migrations/20260622100002_drop_plaintext_oauth_tokens.sql
-- Solo ejecutar DESPUÉS de verificar que vault_*_id está poblado en todos los rows.

ALTER TABLE public.doctor_calendars
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token;
```

- [ ] **Step 6: Actualizar Edge Function google-oauth-callback**

En `supabase/functions/google-oauth-callback/index.ts`, reemplazar:
```typescript
// ANTES:
await supabase.from('doctor_calendars').upsert({
  access_token: tokens.access_token,
  refresh_token: tokens.refresh_token,
  ...
})

// DESPUÉS (llamar RPC vía service_role):
const { data: accessVaultId } = await supabase.rpc('doctor_calendar_upsert_token', {
  p_doctor_id: doctorId,
  p_token_type: 'access',
  p_token_value: tokens.access_token
})
const { data: refreshVaultId } = await supabase.rpc('doctor_calendar_upsert_token', {
  p_doctor_id: doctorId,
  p_token_type: 'refresh',
  p_token_value: tokens.refresh_token
})
await supabase.from('doctor_calendars').upsert({
  vault_access_token_id: accessVaultId,
  vault_refresh_token_id: refreshVaultId,
  ...
})
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260622100001_doctor_calendars_vault.sql
git add supabase/migrations/20260622100002_drop_plaintext_oauth_tokens.sql
git add supabase/scripts/migrate_doctor_tokens_to_vault.sql
git add supabase/functions/google-oauth-callback/
git commit -m "fix(security): migrar OAuth tokens doctor_calendars a Supabase Vault"
```

---

### Task 1.2: Audit y documentar edge functions con `verify_jwt=false`

**Problema:** 9 funciones sin JWT. Algunas ya tienen auth propia (Stripe, Telegram) pero no está documentado.

**Files:**
- Modify: `supabase/config.toml` (solo comentarios)
- Create: `docs/edge-functions-auth.md`
- Modify cada función que falta validación

- [ ] **Step 1: Verificar auth en stripe-webhook**

```bash
cat supabase/functions/stripe-webhook/index.ts | grep -E "stripe-signature|constructEvent|webhook"
```
Expected: ver `Stripe.webhooks.constructEvent` o similar.

- [ ] **Step 2: Si stripe-webhook NO valida firma — agregar validación**

```typescript
// supabase/functions/stripe-webhook/index.ts
import Stripe from 'https://esm.sh/stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Unauthorized', { status: 401 })

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
  // ... handle event
})
```

- [ ] **Step 3: Verificar auth en telegram-webhook**

```bash
cat supabase/functions/telegram-webhook/index.ts | grep -E "secret|X-Telegram|bot-api"
```
Expected: ver validación del header `X-Telegram-Bot-Api-Secret-Token`.

- [ ] **Step 4: Si telegram-webhook NO valida — agregar validación**

```typescript
// supabase/functions/telegram-webhook/index.ts
Deno.serve(async (req) => {
  const telegramSecret = req.headers.get('x-telegram-bot-api-secret-token')
  if (telegramSecret !== Deno.env.get('TELEGRAM_WEBHOOK_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }
  // ... handle
})
```

- [ ] **Step 5: Funciones internas (enviar-recordatorios, auto-reorder, etc.) — agregar shared secret**

```typescript
// Patrón para funciones cron internas:
Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  const expectedToken = Deno.env.get('INTERNAL_CRON_SECRET')
  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  // ...
})
```

Agregar `INTERNAL_CRON_SECRET` a los secrets del proyecto vía Supabase Dashboard.

- [ ] **Step 6: Documentar en CLAUDE.md**

Agregar a `CLAUDE.md`:
```markdown
## Edge Functions — verify_jwt=false

| Función | Auth alternativa |
|---------|-----------------|
| stripe-webhook | X-Stripe-Signature (Stripe.webhooks.constructEvent) |
| telegram-webhook | X-Telegram-Bot-Api-Secret-Token header |
| google-oauth-callback | OAuth state param nonce |
| enviar-recordatorios | Bearer INTERNAL_CRON_SECRET |
| auto-reorder | Bearer INTERNAL_CRON_SECRET |
| notify-cxp-vencimiento | Bearer INTERNAL_CRON_SECRET |
| confirmar-cita | Bearer INTERNAL_CRON_SECRET |
| cfdi-parse | Bearer INTERNAL_CRON_SECRET |
| stripe-checkout | Validación session.id de Stripe antes de acción |
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/ docs/edge-functions-auth.md CLAUDE.md
git commit -m "fix(security): agregar auth a edge functions con verify_jwt=false"
```

---

## FASE 2 — Integridad referencial (Sprint 1)

### Task 2.1: Agregar FK de `clinic_id` a tablas financieras

**Problema:** `cajas`, `turnos`, `metodos_pago`, `conceptos`, `movimientos`, `cortes`, `impresoras`, `pharmacy_cash_shifts`, `pharmacy_sales`, `pharmacy_returns` no tienen FK a `clinics`.

**Files:**
- Create: `supabase/migrations/20260623100001_add_clinic_fk_financiero.sql`

- [ ] **Step 1: Verificar que no hay clinic_id huérfanos antes de agregar FK**

```bash
supabase db query --linked "
SELECT 'cajas' as tabla, COUNT(*) as huerfanos
FROM public.cajas c
WHERE NOT EXISTS (SELECT 1 FROM public.clinics cl WHERE cl.id = c.clinic_id)
UNION ALL
SELECT 'turnos', COUNT(*) FROM public.turnos t
WHERE NOT EXISTS (SELECT 1 FROM public.clinics cl WHERE cl.id = t.clinic_id)
UNION ALL
SELECT 'pharmacy_sales', COUNT(*) FROM public.pharmacy_sales ps
WHERE NOT EXISTS (SELECT 1 FROM public.clinics cl WHERE cl.id = ps.clinic_id);
"
```
Expected: todos con `huerfanos = 0`. Si hay huérfanos, corregirlos antes de continuar.

- [ ] **Step 2: Crear migración**

```sql
-- supabase/migrations/20260623100001_add_clinic_fk_financiero.sql
-- Agregar FK a clinics en tablas financieras.
-- ON DELETE RESTRICT: previene borrar una clínica con datos.

ALTER TABLE public.cajas
  ADD CONSTRAINT IF NOT EXISTS cajas_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

ALTER TABLE public.turnos
  ADD CONSTRAINT IF NOT EXISTS turnos_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

ALTER TABLE public.metodos_pago
  ADD CONSTRAINT IF NOT EXISTS metodos_pago_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

ALTER TABLE public.conceptos
  ADD CONSTRAINT IF NOT EXISTS conceptos_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

ALTER TABLE public.movimientos
  ADD CONSTRAINT IF NOT EXISTS movimientos_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

ALTER TABLE public.cortes
  ADD CONSTRAINT IF NOT EXISTS cortes_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

ALTER TABLE public.impresoras
  ADD CONSTRAINT IF NOT EXISTS impresoras_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

ALTER TABLE public.pharmacy_cash_shifts
  ADD CONSTRAINT IF NOT EXISTS pharmacy_cash_shifts_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

ALTER TABLE public.pharmacy_sales
  ADD CONSTRAINT IF NOT EXISTS pharmacy_sales_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

ALTER TABLE public.pharmacy_returns
  ADD CONSTRAINT IF NOT EXISTS pharmacy_returns_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

ALTER TABLE public.pharmacy_sale_items
  ADD CONSTRAINT IF NOT EXISTS pharmacy_sale_items_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;
```

- [ ] **Step 3: Aplicar y verificar**

```bash
supabase db push --linked
supabase db query --linked "
SELECT conname, conrelid::regclass
FROM pg_constraint
WHERE conname LIKE '%clinic_id_fkey'
  AND connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text;
"
```
Expected: ver todas las constraints listadas.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260623100001_add_clinic_fk_financiero.sql
git commit -m "fix(db): agregar FK clinic_id a tablas financieras (ON DELETE RESTRICT)"
```

---

### Task 2.2: Cambiar CASCADE → RESTRICT en expedientes/appointments

**Problema:** Borrar un paciente destruye todo su historial clínico (violación NOM-004).

**Files:**
- Create: `supabase/migrations/20260623100002_restrict_patient_delete.sql`

- [ ] **Step 1: Verificar constraints actuales**

```bash
supabase db query --linked "
SELECT conname, conrelid::regclass, confdeltype
FROM pg_constraint
WHERE confrelid = 'public.patients'::regclass
  AND contype = 'f'
ORDER BY conrelid::regclass::text;
"
```
Expected: ver `a` (CASCADE) en expedientes y appointments.

- [ ] **Step 2: Crear migración**

```sql
-- supabase/migrations/20260623100002_restrict_patient_delete.sql
-- Cambiar ON DELETE CASCADE → RESTRICT en registros clínicos.
-- NOM-004-SSA3-2012: retención mínima 5 años.

-- expedientes
ALTER TABLE public.expedientes
  DROP CONSTRAINT IF EXISTS expedientes_patient_id_fkey;
ALTER TABLE public.expedientes
  ADD CONSTRAINT expedientes_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE RESTRICT;

-- appointments
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE RESTRICT;

-- Eliminar DELETE policy de admin en patients — ahora se usa soft-delete vía activo=false
-- (La política de hard-delete queda revocada; se implementa gdpr_erase_patient en Fase 6)
DROP POLICY IF EXISTS "Admin deletes patients" ON public.patients;

-- RLS: admin puede hacer soft-delete (UPDATE activo=false) pero no DELETE
-- (La política de UPDATE para admin ya existe en la migración base)
```

- [ ] **Step 3: Aplicar y verificar**

```bash
supabase db push --linked
supabase db query --linked "
SELECT conname, confdeltype FROM pg_constraint
WHERE confrelid = 'public.patients'::regclass
  AND conrelid::regclass::text IN ('public.expedientes', 'public.appointments');
"
```
Expected: `confdeltype = r` (RESTRICT) en ambas.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260623100002_restrict_patient_delete.sql
git commit -m "fix(db): cambiar CASCADE→RESTRICT en expedientes/appointments (NOM-004)"
```

---

### Task 2.3: Eliminar columnas duplicadas en `medicamentos`

**Problema:** `requiere_receta`/`controlado` (catalogo) y `requires_prescription`/`is_controlled` (farmacia) son sinónimos con valores potencialmente divergentes.

**Files:**
- Create: `supabase/migrations/20260623100003_sync_medicamentos_flags.sql`
- Create: `supabase/migrations/20260623100004_drop_medicamentos_legacy_flags.sql`

- [ ] **Step 1: Verificar divergencia actual**

```bash
supabase db query --linked "
SELECT COUNT(*) as divergidos
FROM public.medicamentos
WHERE requiere_receta <> requires_prescription
   OR controlado <> is_controlled;
"
```

- [ ] **Step 2: Migración de sincronización**

```sql
-- supabase/migrations/20260623100003_sync_medicamentos_flags.sql
-- Sincronizar flags duplicados: mantener requires_prescription e is_controlled
-- como canónicos (usados por pharmacy_register_sale).

UPDATE public.medicamentos
SET requires_prescription = requiere_receta,
    is_controlled = controlado
WHERE requires_prescription <> requiere_receta
   OR is_controlled <> controlado;

-- Agregar constraint temporal para detectar divergencia futura
-- (se elimina cuando se droppean las columnas legacy)
ALTER TABLE public.medicamentos
  ADD CONSTRAINT medicamentos_prescription_sync
  CHECK (requires_prescription = requiere_receta AND is_controlled = controlado);
```

- [ ] **Step 3: Migración de drop (solo después de verificar que la app ya no usa las columnas legacy)**

```sql
-- supabase/migrations/20260623100004_drop_medicamentos_legacy_flags.sql
-- Eliminar columnas legacy después de verificar que el frontend
-- usa requires_prescription e is_controlled exclusivamente.

ALTER TABLE public.medicamentos
  DROP CONSTRAINT IF EXISTS medicamentos_prescription_sync,
  DROP COLUMN IF EXISTS requiere_receta,
  DROP COLUMN IF EXISTS controlado;
```

> ⚠️ PAUSAR aquí: buscar en el frontend referencias a `requiere_receta` y `controlado` antes de aplicar la segunda migración.

```bash
grep -r "requiere_receta\|\.controlado" src/ --include="*.ts" --include="*.tsx"
```
Expected: cero resultados → aplicar segunda migración.

- [ ] **Step 4: Eliminar columna `domicilio_ciudad` (CLAUDE.md invariant)**

```sql
-- supabase/migrations/20260623100005_drop_domicilio_ciudad.sql
-- domicilio_ciudad no debe existir. Municipio es el campo canónico.

UPDATE public.patients
SET municipio = COALESCE(municipio, domicilio_ciudad)
WHERE domicilio_ciudad IS NOT NULL
  AND (municipio IS NULL OR municipio = '');

ALTER TABLE public.patients
  DROP COLUMN IF EXISTS domicilio_ciudad;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260623100003_sync_medicamentos_flags.sql
git add supabase/migrations/20260623100004_drop_medicamentos_legacy_flags.sql
git add supabase/migrations/20260623100005_drop_domicilio_ciudad.sql
git commit -m "fix(db): consolidar flags duplicados medicamentos y eliminar domicilio_ciudad"
```

---

### Task 2.4: Eliminar `DEFAULT` hardcodeado de `clinic_id`

**Problema:** `lotes_medicamento`, `movimientos_inventario`, `pharmacy_sales` tienen `DEFAULT '106cc686-...'::uuid` — en multi-clínica asignan rows a clínica incorrecta silenciosamente.

**Files:**
- Create: `supabase/migrations/20260624100001_drop_hardcoded_clinic_defaults.sql`

- [ ] **Step 1: Verificar que todos los rows existentes tienen clinic_id explícito**

```bash
supabase db query --linked "
SELECT 'lotes_medicamento' as tabla, COUNT(*) as nulls
FROM public.lotes_medicamento WHERE clinic_id IS NULL
UNION ALL
SELECT 'movimientos_inventario', COUNT(*) FROM public.movimientos_inventario WHERE clinic_id IS NULL
UNION ALL
SELECT 'pharmacy_sales', COUNT(*) FROM public.pharmacy_sales WHERE clinic_id IS NULL;
"
```
Expected: todos con `nulls = 0`.

- [ ] **Step 2: Crear migración**

```sql
-- supabase/migrations/20260624100001_drop_hardcoded_clinic_defaults.sql
-- Eliminar DEFAULT hardcodeado de clinic_id.
-- Después de este cambio, cualquier INSERT que omita clinic_id fallará
-- con NOT NULL violation en lugar de usar la clínica incorrecta.

ALTER TABLE public.lotes_medicamento
  ALTER COLUMN clinic_id DROP DEFAULT;

ALTER TABLE public.movimientos_inventario
  ALTER COLUMN clinic_id DROP DEFAULT;

ALTER TABLE public.pharmacy_sales
  ALTER COLUMN clinic_id DROP DEFAULT;

ALTER TABLE public.pharmacy_sale_items
  ALTER COLUMN clinic_id DROP DEFAULT;
```

- [ ] **Step 3: Verificar que pharmacy_register_sale falla con clínica nula (en staging)**

En staging, ejecutar pharmacy_register_sale sin clinic_id. Debe retornar EXCEPTION, no insertar en clínica hardcodeada.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260624100001_drop_hardcoded_clinic_defaults.sql
git commit -m "fix(db): eliminar DEFAULT hardcodeado de clinic_id en tablas de farmacia"
```

---

### Task 2.5: Agregar UNIQUE en `movimientos.folio` y constraint de integridad en `recetas_capturadas`

**Files:**
- Create: `supabase/migrations/20260624100002_unique_constraints_folios.sql`

- [ ] **Step 1: Detectar folios duplicados existentes**

```bash
supabase db query --linked "
SELECT clinic_id, folio, COUNT(*) as dups
FROM public.movimientos
WHERE folio IS NOT NULL
GROUP BY clinic_id, folio
HAVING COUNT(*) > 1
LIMIT 20;
"
```
Si hay duplicados: resolverlos manualmente antes de continuar.

- [ ] **Step 2: Crear migración**

```sql
-- supabase/migrations/20260624100002_unique_constraints_folios.sql

-- UNIQUE en folio de movimientos (per-clinic)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_movimientos_clinic_folio
  ON public.movimientos(clinic_id, folio)
  WHERE folio IS NOT NULL;

-- UNIQUE en folio_secuencial de recetas (per-clinic) para detectar race conditions
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_recetas_clinic_folio
  ON public.recetas_capturadas(clinic_id, folio_secuencial)
  WHERE folio_secuencial IS NOT NULL;
```

> Nota: `CONCURRENTLY` no puede estar en un bloque BEGIN/COMMIT. Aplicar como archivo standalone.

- [ ] **Step 3: Aplicar**

```bash
supabase db query --linked --file supabase/migrations/20260624100002_unique_constraints_folios.sql
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260624100002_unique_constraints_folios.sql
git commit -m "fix(db): agregar UNIQUE en movimientos.folio y recetas_capturadas.folio_secuencial"
```

---

## FASE 3 — Higiene de migraciones (Sprint 1)

### Task 3.1: Recuperar DDL de stubs "Lovable applied"

**Problema:** 17 archivos stub contienen `-- Applied directly by Lovable to remote DB. Schema already exists in production.` — el DDL real no está en source control.

**Files:**
- Modify: cada stub en `supabase/migrations/20260601*.sql` y `20260602*.sql`

- [ ] **Step 1: Listar stubs**

```bash
grep -l "Applied directly by Lovable" supabase/migrations/*.sql
```

- [ ] **Step 2: Recuperar el DDL real de la base de datos**

```bash
supabase db query --linked "
SELECT version, name, statements
FROM supabase_migrations.schema_migrations
WHERE name LIKE '%lovable%'
   OR version IN (
     '20260601001316','20260601001455','20260601001542','20260601002137',
     '20260601002643','20260601003719','20260601183717','20260601183902',
     '20260601183912','20260601184022','20260601184100','20260601184317',
     '20260601184330','20260601194840','20260602060643','20260602184224',
     '20260602185930','20260602191308'
   )
ORDER BY version;
" > docs/lovable_applied_ddl_recovery.txt
```

- [ ] **Step 3: Reemplazar cada stub con el DDL real**

Para cada stub, reemplazar el contenido del archivo con el SQL real recuperado. Ejemplo:
```bash
# Por cada versión recuperada:
# cat el SQL real → sobreescribir el stub
```

- [ ] **Step 4: Mover archivos `_tmp_diag*.sql`, `_tmp_verify*.sql`, `_tmp_check*.sql`, `_tmp_pharma2.sql`, `_tmp_pharma3.sql` fuera de migrations**

```bash
mkdir -p supabase/scripts/diagnostics
mv supabase/migrations/_tmp_diag*.sql supabase/scripts/diagnostics/
mv supabase/migrations/_tmp_verify*.sql supabase/scripts/diagnostics/
mv supabase/migrations/_tmp_check*.sql supabase/scripts/diagnostics/
mv supabase/migrations/_tmp_pharma2.sql supabase/scripts/diagnostics/
mv supabase/migrations/_tmp_pharma3.sql supabase/scripts/diagnostics/
```

- [ ] **Step 5: Inventariar _tmp DDL pendiente**

Para cada `_tmp_*.sql` que contiene DDL real (no diagnóstico):
1. Verificar si ya está aplicado en producción via `pg_proc` / `information_schema`
2. Si está aplicado: convertirlo en migración timestamped apropiada
3. Si no está aplicado: evaluar si se necesita

```bash
supabase db query --linked "
SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE proname IN (
  'pharmacy_register_sale','turno_close','pharmacy_close_shift',
  'turno_close_with_pin','pharmacy_open_shift'
) AND pronamespace = 'public'::regnamespace;
"
```

- [ ] **Step 6: Actualizar CLAUDE.md — eliminar instrucción de usar _tmp**

```markdown
## Cambiar en CLAUDE.md — sección de SQL

# ANTES:
# Nunca pasar SQL con $function$ inline: supabase db query --linked '...' falla.
# Siempre escribir a _tmp_*.sql y usar: supabase db query --linked --file archivo.sql

# DESPUÉS:
# Para aplicar SQL con $function$ dollar-quoting:
# 1. Crear migración timestamped: supabase/migrations/YYYYMMDDHHMMSS_descripcion.sql
# 2. Aplicar: supabase db push --linked
# Para fixes one-off (sin registrar en migration history):
# supabase db query --linked --file supabase/scripts/adhoc/fix_YYYY-MM-DD.sql
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/ supabase/scripts/ CLAUDE.md
git commit -m "fix(migrations): recuperar DDL de stubs Lovable, mover diagnósticos fuera de migrations"
```

---

## FASE 4 — Fixes de lógica de negocio (Sprint 2)

> ⚠️ Esta fase modifica RPCs críticos (pharmacy_register_sale, turno_close). Aplicar en horario de baja actividad. Tener rollback preparado.

### Task 4.1: Corregir race condition en `assign_receta_folio`

**Problema:** `MAX(folio_secuencial) + 1` — dos inserts concurrentes producen folio duplicado.

**Files:**
- Create: `supabase/migrations/20260630100001_fix_receta_folio_sequence.sql`

- [ ] **Step 1: Backup de recetas antes de modificar**

```bash
supabase db query --linked "
SELECT clinic_id, COUNT(*), MAX(folio_secuencial)
FROM public.recetas_capturadas
GROUP BY clinic_id;
" > docs/backup_recetas_folios_$(date +%Y%m%d).txt
```

- [ ] **Step 2: Detectar duplicados existentes**

```bash
supabase db query --linked "
SELECT clinic_id, folio_secuencial, COUNT(*) as dups
FROM public.recetas_capturadas
WHERE folio_secuencial IS NOT NULL
GROUP BY clinic_id, folio_secuencial
HAVING COUNT(*) > 1;
"
```

- [ ] **Step 3: Crear migración**

```sql
-- supabase/migrations/20260630100001_fix_receta_folio_sequence.sql
-- Reemplazar MAX()+1 por SEQUENCE atómica para folios COFEPRIS.

-- Tabla de contadores por clínica (FOR UPDATE — atómica)
CREATE TABLE IF NOT EXISTS public.recetas_folio_contadores (
  clinic_id    uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE RESTRICT,
  ultimo_folio bigint NOT NULL DEFAULT 0
);

-- Inicializar contadores con el MAX actual por clínica
INSERT INTO public.recetas_folio_contadores (clinic_id, ultimo_folio)
SELECT clinic_id, COALESCE(MAX(folio_secuencial), 0)
FROM public.recetas_capturadas
GROUP BY clinic_id
ON CONFLICT (clinic_id) DO UPDATE
  SET ultimo_folio = GREATEST(recetas_folio_contadores.ultimo_folio, EXCLUDED.ultimo_folio);

-- Función atómica de asignación de folio
CREATE OR REPLACE FUNCTION public.next_receta_folio(p_clinic_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folio bigint;
BEGIN
  INSERT INTO public.recetas_folio_contadores (clinic_id, ultimo_folio)
  VALUES (p_clinic_id, 1)
  ON CONFLICT (clinic_id) DO UPDATE
    SET ultimo_folio = recetas_folio_contadores.ultimo_folio + 1
  RETURNING ultimo_folio INTO v_folio;
  RETURN v_folio;
END;
$$;

-- Reemplazar trigger con versión atómica
CREATE OR REPLACE FUNCTION public.assign_receta_folio()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.folio_secuencial IS NULL THEN
    NEW.folio_secuencial := public.next_receta_folio(NEW.clinic_id);
  END IF;
  RETURN NEW;
END;
$$;
```

- [ ] **Step 4: Aplicar y verificar**

```bash
supabase db push --linked
supabase db query --linked "
SELECT clinic_id, ultimo_folio FROM public.recetas_folio_contadores;
"
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260630100001_fix_receta_folio_sequence.sql
git commit -m "fix(db): reemplazar MAX()+1 por tabla de contadores atómica en folios COFEPRIS"
```

---

### Task 4.2: Corregir deadlock en `pharmacy_register_sale` — orden determinístico de locks

**Problema:** `FOR UPDATE` en loop sobre lotes en orden de `p_payload['items']` → deadlock bajo concurrencia.

**Files:**
- Create: `supabase/migrations/20260630100002_fix_pharmacy_sale_deadlock.sql`

> ⚠️ Este RPC está en producción. Aplicar en ventana de mantenimiento (antes de apertura de turno o después de cierre).

- [ ] **Step 1: Detectar la versión actual en producción**

```bash
supabase db query --linked "
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'pharmacy_register_sale'
  AND pronamespace = 'public'::regnamespace
LIMIT 1;" > docs/backup_pharmacy_register_sale_$(date +%Y%m%d).sql
```

- [ ] **Step 2: Crear migración con lock determinístico**

El cambio clave: reemplazar el loop de validación con un SELECT bulk ordenado:

```sql
-- supabase/migrations/20260630100002_fix_pharmacy_sale_deadlock.sql
-- Fix deadlock en pharmacy_register_sale: adquirir locks en orden determinístico (ORDER BY id).

CREATE OR REPLACE FUNCTION public.pharmacy_register_sale(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- [mantener TODAS las variables existentes igual]
  v_lote_ids    uuid[];
  v_lotes       RECORD;
BEGIN
  -- [mantener validaciones de apertura de turno, clinic_id, etc. igual]

  -- CAMBIO: recopilar todos los lote_ids que se necesitan ANTES de lockear
  SELECT ARRAY_AGG(DISTINCT (item->>'lote_id')::uuid)
  INTO v_lote_ids
  FROM jsonb_array_elements(p_payload->'items') AS item
  WHERE item->>'lote_id' IS NOT NULL;

  -- CAMBIO: adquirir todos los locks en orden determinístico (ORDER BY id)
  -- Una sola query, orden fijo → no hay deadlock
  FOR v_lotes IN
    SELECT * FROM public.lotes_medicamento
    WHERE id = ANY(v_lote_ids)
    ORDER BY id  -- <-- ORDEN DETERMINÍSTICO
    FOR UPDATE
  LOOP
    -- validar existencia
    IF v_lotes.existencia < 0 THEN
      RAISE EXCEPTION 'Stock insuficiente en lote %', v_lotes.id;
    END IF;
  END LOOP;

  -- [resto de la función igual — FIFO, INSERT, UPDATE, etc.]
  -- ...
END;
$$;
```

> Nota: insertar el cuerpo completo de la función actual con SOLO el cambio de los locks. No abreviar.

- [ ] **Step 3: Aplicar en staging primero**

```bash
# Aplicar en staging
supabase db push --linked  # si staging = linked
# Prueba de carga con 2 usuarios simultáneos comprando mismo medicamento
```

- [ ] **Step 4: Aplicar en producción en ventana de mantenimiento**

```bash
supabase db push --linked
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260630100002_fix_pharmacy_sale_deadlock.sql
git commit -m "fix(db): orden determinístico de locks en pharmacy_register_sale — elimina deadlock"
```

---

### Task 4.3: Eliminar fallback hardcodeado en `pharmacy_register_sale`

**Problema:** `COALESCE(..., '106cc686-...'::uuid)` silenciosamente usa clínica incorrecta.

**Files:**
- Create: `supabase/migrations/20260630100003_fix_pharmacy_sale_clinic_fallback.sql`

- [ ] **Step 1: Crear migración**

```sql
-- supabase/migrations/20260630100003_fix_pharmacy_sale_clinic_fallback.sql
-- Eliminar fallback hardcodeado de clinic_id en pharmacy_register_sale.
-- Ahora la función falla explícitamente si no se puede determinar la clínica.

CREATE OR REPLACE FUNCTION public.pharmacy_register_sale(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid;
  -- [resto de variables igual]
BEGIN
  -- CAMBIO: resolver clinic_id desde payload explícito primero
  v_clinic := NULLIF(p_payload->>'clinic_id', '')::uuid;

  IF v_clinic IS NULL THEN
    SELECT clinic_id INTO v_clinic
    FROM public.medicamentos
    WHERE id = (((p_payload->'items')->0)->>'medicamento_id')::uuid
    LIMIT 1;
  END IF;

  -- CAMBIO: fallar explícitamente en lugar de usar hardcoded UUID
  IF v_clinic IS NULL THEN
    RAISE EXCEPTION 'clinic_id requerido — no se pudo determinar la clínica para esta venta';
  END IF;

  -- [resto de función igual]
END;
$$;
```

- [ ] **Step 2: Actualizar el frontend para pasar clinic_id explícito**

```typescript
// En el POS/farmacia, pasar clinic_id siempre:
const { data, error } = await supabase.rpc('pharmacy_register_sale', {
  p_payload: {
    clinic_id: currentClinicId,  // <-- siempre explícito
    items: cartItems,
    // ...
  }
})
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260630100003_fix_pharmacy_sale_clinic_fallback.sql
git add src/  # cambios de frontend
git commit -m "fix(db): eliminar fallback hardcodeado de clinic_id en pharmacy_register_sale"
```

---

## FASE 5 — Performance — Índices (Sprint 2)

### Task 5.1: Agregar índices faltantes en tablas críticas

**Files:**
- Create: `supabase/migrations/20260701100001_add_missing_indexes.sql`

> Nota: `CREATE INDEX CONCURRENTLY` NO puede estar en un bloque BEGIN/COMMIT. Este archivo se aplica fuera de una transacción explícita.

- [ ] **Step 1: Crear migración**

```sql
-- supabase/migrations/20260701100001_add_missing_indexes.sql
-- Índices faltantes identificados en audit. CONCURRENTLY = no bloquea escrituras.

-- appointment_resources: FK sin index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointment_resources_appointment
  ON public.appointment_resources(appointment_id);

-- pharmacy_sale_items: FK sin index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_psi_medicamento
  ON public.pharmacy_sale_items(medicamento_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_psi_lote
  ON public.pharmacy_sale_items(lote_id)
  WHERE lote_id IS NOT NULL;

-- notas_consulta: FK sin index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notas_doctor
  ON public.notas_consulta(doctor_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notas_appointment
  ON public.notas_consulta(appointment_id)
  WHERE appointment_id IS NOT NULL;

-- has_role() — index compuesto para index-only scans
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_user_role
  ON public.user_roles(user_id, role);

-- appointments — composite para consultas doctor+fecha+status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_clinic_doctor_fecha
  ON public.appointments(clinic_id, doctor_id, fecha_inicio, status)
  WHERE status NOT IN ('cancelada', 'liberada');

-- Reemplazar idx_medicamentos_activo (boolean, baja cardinalidad) con composite
DROP INDEX CONCURRENTLY IF EXISTS public.idx_medicamentos_activo;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicamentos_clinic_activo
  ON public.medicamentos(clinic_id, activo)
  WHERE activo = true;

-- GIN trgm para FAQ similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Wrapper IMMUTABLE para unaccent (requerido para index funcional)
CREATE OR REPLACE FUNCTION public.unaccent_immutable(text)
  RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  RETURN unaccent($1);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_pendientes_pregunta_trgm
  ON public.chat_preguntas_pendientes
  USING GIN (public.unaccent_immutable(pregunta) gin_trgm_ops)
  WHERE aprobado = false;
```

- [ ] **Step 2: Aplicar (fuera de transacción)**

```bash
supabase db query --linked --file supabase/migrations/20260701100001_add_missing_indexes.sql
```

- [ ] **Step 3: Verificar que los índices son válidos**

```bash
supabase db query --linked "
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_appointment_resources_appointment',
    'idx_psi_medicamento',
    'idx_user_roles_user_role',
    'idx_chat_pendientes_pregunta_trgm'
  );
"
```
Expected: todos listados.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260701100001_add_missing_indexes.sql
git commit -m "perf(db): agregar índices faltantes (FKs, has_role compound, GIN trgm FAQ)"
```

---

### Task 5.2: Eliminar índices duplicados

**Files:**
- Create: `supabase/migrations/20260701100002_drop_duplicate_indexes.sql`

- [ ] **Step 1: Verificar duplicados antes de drop**

```bash
supabase db query --linked "
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_lotes_medicamento', 'idx_lotes_med',
    'idx_movimientos_medicamento', 'idx_movs_med',
    'idx_jis_journey'
  )
ORDER BY tablename, indexname;
"
```

- [ ] **Step 2: Crear migración**

```sql
-- supabase/migrations/20260701100002_drop_duplicate_indexes.sql
-- Eliminar índices redundantes identificados en audit (M12).

-- lotes_medicamento: idx_lotes_medicamento es prefijo de idx_lotes_fifo
DROP INDEX CONCURRENTLY IF EXISTS public.idx_lotes_medicamento;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_lotes_med;

-- movimientos_inventario: idx_movimientos_medicamento es prefijo de idx_movs_med
DROP INDEX CONCURRENTLY IF EXISTS public.idx_movimientos_medicamento;

-- journey_instance_steps: idx_jis_journey es prefijo de idx_jis_journey_key
DROP INDEX CONCURRENTLY IF EXISTS public.idx_jis_journey;
```

- [ ] **Step 3: Aplicar**

```bash
supabase db query --linked --file supabase/migrations/20260701100002_drop_duplicate_indexes.sql
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260701100002_drop_duplicate_indexes.sql
git commit -m "perf(db): eliminar índices duplicados en lotes, movimientos y journey_steps"
```

---

## FASE 6 — Operacional (Sprint 3)

### Task 6.1: Configurar pg_cron jobs

**Files:**
- Create: `supabase/migrations/20260708100001_setup_pg_cron.sql`

- [ ] **Step 1: Verificar que pg_cron está disponible**

```bash
supabase db query --linked "SELECT * FROM pg_extension WHERE extname = 'pg_cron';"
```

- [ ] **Step 2: Crear migración**

```sql
-- supabase/migrations/20260708100001_setup_pg_cron.sql
-- Programar jobs de mantenimiento vía pg_cron.

-- Limpiar sesiones bot abandonadas (PII GDPR)
SELECT cron.schedule(
  'cleanup-bot-sesiones',
  '0 * * * *',  -- cada hora
  'SELECT public.cleanup_abandoned_bot_sesiones()'
);

-- VACUUM en tablas de alta escritura
SELECT cron.schedule(
  'vacuum-audit-logs',
  '0 3 * * 0',  -- domingos 3am
  'VACUUM ANALYZE public.audit_logs'
);

SELECT cron.schedule(
  'vacuum-movimientos',
  '0 3 * * 0',
  'VACUUM ANALYZE public.movimientos_inventario'
);

SELECT cron.schedule(
  'vacuum-pharmacy-sales',
  '0 3 * * 0',
  'VACUUM ANALYZE public.pharmacy_sales'
);
```

- [ ] **Step 3: Verificar jobs**

```bash
supabase db query --linked "SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260708100001_setup_pg_cron.sql
git commit -m "ops(db): configurar pg_cron jobs para limpieza y VACUUM"
```

---

### Task 6.2: Agregar updated_at y trigger a `profiles`

**Files:**
- Create: `supabase/migrations/20260708100002_profiles_trigger.sql`

- [ ] **Step 1: Crear migración**

```sql
-- supabase/migrations/20260708100002_profiles_trigger.sql

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

- [ ] **Step 2: Aplicar y verificar**

```bash
supabase db push --linked
supabase db query --linked "
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'profiles' AND trigger_schema = 'public';
"
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260708100002_profiles_trigger.sql
git commit -m "fix(db): agregar trigger updated_at a profiles"
```

---

## Checklist de seguimiento

```markdown
### Fase 0 — Emergencia
- [ ] Task 0.1: Fix RLS almacen_alertas
- [ ] Task 0.2: Enable RLS profiles

### Fase 1 — Seguridad
- [ ] Task 1.1: OAuth tokens → Vault
- [ ] Task 1.2: Audit edge functions verify_jwt=false

### Fase 2 — Integridad
- [ ] Task 2.1: FK clinic_id tablas financieras
- [ ] Task 2.2: CASCADE → RESTRICT patients
- [ ] Task 2.3: Consolidar flags medicamentos
- [ ] Task 2.4: Drop DEFAULT hardcodeado clinic_id
- [ ] Task 2.5: UNIQUE constraints folios

### Fase 3 — Higiene migraciones
- [ ] Task 3.1: Recuperar DDL Lovable stubs + mover _tmp diagnósticos

### Fase 4 — Lógica de negocio
- [ ] Task 4.1: Fix receta folio race condition
- [ ] Task 4.2: Fix deadlock pharmacy_register_sale
- [ ] Task 4.3: Eliminar fallback clinic_id hardcodeado

### Fase 5 — Performance
- [ ] Task 5.1: Agregar índices faltantes
- [ ] Task 5.2: Eliminar índices duplicados

### Fase 6 — Operacional
- [ ] Task 6.1: pg_cron jobs
- [ ] Task 6.2: profiles trigger updated_at
```

---

## Verificación final post-Fase-0

Después de completar Fase 0, re-correr:
```bash
supabase db query --linked "
-- Verificar RLS activo en tablas críticas
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('profiles', 'almacen_alertas', 'patients', 'expedientes',
                  'pharmacy_sales', 'cajas', 'turnos', 'movimientos')
  AND relnamespace = 'public'::regnamespace
ORDER BY relname;
"
```
Expected: todas con `relrowsecurity = true`.
