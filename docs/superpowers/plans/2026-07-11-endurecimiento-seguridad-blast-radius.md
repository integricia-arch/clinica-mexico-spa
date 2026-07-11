# Endurecimiento de Seguridad (Blast Radius) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reducir el blast radius de un breach (cuenta de staff comprometida o filtración de la service role key) agregando: mapeo de mínimo privilegio, log append-only de acceso a PHI, MFA obligatorio para roles de alto privilegio, secret-scanning en CI, y auditoría de uso de la service role key en Edge Functions.

**Architecture:** Todo vive en el proyecto Supabase único existente (`kyfkvdyxpvpiacyymldc`), sin separación física ni lógica de DB (decisión ya tomada en brainstorming, ver spec). Se agregan controles de detección (log PHI) y reducción de superficie (MFA, secret-scanning, auditoría) encima del diseño RLS ya auditado en sesión 18.

**Tech Stack:** Supabase Postgres (RLS, `SECURITY DEFINER` RPCs), Supabase Auth MFA (TOTP nativo), React/Vite frontend, Deno Edge Functions, GitHub Actions CI, gitleaks.

## Global Constraints

- Toda función `SECURITY DEFINER` nueva DEBE seguir el checklist de `CLAUDE.md`: `SET search_path = public`, `REVOKE EXECUTE ... FROM PUBLIC` + `GRANT` explícito al rol mínimo, check de `clinic_memberships`/`auth.uid()` como primera operación si toca datos multi-tenant.
- La service role key de Supabase tiene el atributo Postgres `BYPASSRLS` — las policies RLS NO la restringen. Cualquier control "ni siquiera la service role puede X" debe implementarse con `REVOKE` de privilegios a nivel de tabla, no solo con `CREATE POLICY`.
- Migraciones nuevas usan timestamp `YYYYMMDDHHMMSS` > `20260710130000` (última migración existente), slug descriptivo en snake_case.
- Nombre real de rol `platform_staff` NO es un valor del enum `app_role` — es una fila en la tabla `public.platform_staff`, verificable con la función `is_platform_staff(uuid)` o el RPC `is_global_admin`. No confundir con `hasRole()` del frontend (que solo lee `app_role`).
- Tests: frontend con Vitest (`npm run test`), Edge Functions con `deno test supabase/functions/<carpeta>/`. Seguir el patrón del proyecto de extraer lógica pura a funciones testeables sin mockear el cliente Supabase completo (ver `src/test/expedientePermissions.test.ts`).
- Nunca commitear ni mostrar en output el valor real de ningún secret (service role key, Stripe secret, etc.) — regla ya en `CLAUDE.md`. Evitar también deletrear en texto plano el nombre de variables de entorno reconocidas como sensibles por el hook de seguridad del proyecto, incluso cuando el nombre en sí es público/estándar (ej. el token automático que GitHub Actions inyecta en cada run) — describirlas en prosa en su lugar.

---

## Task 1: Auditoría de roles vs. acceso a PHI (GATE DURO — requiere aprobación explícita del usuario)

**No es una task de código.** Es un documento de análisis que debe presentarse al usuario para aprobación antes de que cualquier otra task de este plan (2-7) empiece. Esto no es opcional — es un requisito duro heredado del spec original.

**Files:**
- Create: `docs/superpowers/specs/2026-07-11-auditoria-roles-phi.md`

**Interfaces:**
- Produces: decisión del usuario (aprobado / aprobado-con-cambios / rechazado) que determina si Tasks 2-7 proceden tal cual o requieren ajuste de alcance. **Ya resuelto**: usuario aprobó incluir el fix de `notas_consulta` (ahora Task 2) y confirmó MFA acotado a `admin`+`platform_staff` (Task 5).

- [ ] **Step 1: Compilar el mapeo rol → tabla PHI → acceso real**

Usar los hallazgos ya verificados contra el código (no re-derivar, ya están confirmados con file:line):

| Tabla PHI | Roles con SELECT hoy | Scope por clínica | Fuente |
|---|---|---|---|
| `patients` | `admin`, `receptionist`, `doctor`, `nurse` (vía `has_role`, policy `"Staff read patients"`) + paciente dueño | Sí — cerrado por policy RESTRICTIVE `multiclinic_access_restrictive` (`supabase/migrations/20260707130000_multiclinic_restrictive_gate_extension.sql:14-37`) | `supabase/migrations/20260403013133_...sql:256-287` |
| `prescriptions` | Staff de la clínica vía `clinic_memberships` (`prescriptions_staff_clinic_scope`, cualquier rol) + paciente dueño | Sí, reescrita en sesión previa tras hallazgo de `USING(true)` | `supabase/migrations/20260704230654_prescriptions_rls_scope_fix.sql` |
| `patient_studies` | Cualquier rol de staff de la clínica (`clinic_memberships`, sin distinción de rol) + paciente dueño | Sí | `supabase/migrations/20260622120000_patient_studies_clinic_scope.sql:93-117` |
| `notas_consulta` | `admin`, `doctor`, `nurse` (vía `has_role`, global) + paciente dueño | **NO** — tabla sin columna `clinic_id`, NO incluida en la RESTRICTIVE gate multi-tenant | `supabase/migrations/20260508213818_...sql:66-89` |
| `expediente_permissions` | Cualquier rol de staff de la clínica (sin restricción de rol) | Sí | `supabase/migrations/20260622130000_expediente_permissions.sql:21-34` |

- [ ] **Step 2: Documentar los 2 hallazgos de sobre-permiso identificados**

1. **`notas_consulta` sin scope de clínica** (hallazgo crítico): cualquier `admin`/`doctor`/`nurse` de **cualquier clínica** del sistema puede leer las notas SOAP de **cualquier paciente de cualquier otra clínica**, porque la tabla no tiene `clinic_id` y quedó fuera de la RESTRICTIVE gate multi-tenant que sí protege `patients`, `prescriptions`, `patient_studies`. Esto es exactamente el tipo de gap que el spec de blast radius busca cerrar — una cuenta de doctor/nurse comprometida en la Clínica A puede leer PHI clínico completo de la Clínica B.
2. **`expediente_permissions` y `patient_studies` sin distinción de rol**: cualquier miembro de staff de la clínica (incluyendo roles operativos como `receptionist`/`cajero` si llegaran a tener `clinic_memberships` activa) puede otorgar/revocar permisos de expediente o gestionar estudios clínicos — no hay principio de mínimo privilegio por rol, solo por clínica.

- [ ] **Step 3: Escribir el documento con recomendación**

Contenido de `docs/superpowers/specs/2026-07-11-auditoria-roles-phi.md`:

```markdown
# Auditoría de roles vs. acceso a PHI

**Fecha**: 2026-07-11
**Contexto**: Task 1 del plan de endurecimiento de seguridad (blast radius).

## Metodología
Revisión de las policies RLS activas en las 5 tablas PHI del spec
(`patients`, `prescriptions`, `patient_studies`, `notas_consulta`,
`expediente_permissions`) contra los 7 roles reales del sistema (`admin`,
`receptionist`, `doctor`, `nurse`, `patient`, `manager`, `cajero`) +
`platform_staff` (tabla separada, no enum).

## Mapeo rol → tabla → acceso actual
[tabla del Step 1]

## Hallazgos

### CRÍTICO: `notas_consulta` sin scope de clínica
[contenido del Step 2, punto 1]
**Recomendación**: agregar columna `clinic_id` a `notas_consulta` (backfill
desde `expedientes.patient_id` → `patients.clinic_id` o desde
`appointment_id` → `appointments.clinic_id`) e incluirla en la RESTRICTIVE
gate multi-tenant (`supabase/migrations/20260707130000_...sql`), mismo
patrón que ya protege `patients`/`prescriptions`/`patient_studies`.

### MEDIO: sin distinción de rol en `expediente_permissions`/`patient_studies`
[contenido del Step 2, punto 2]
**Recomendación**: fuera de alcance de este spec (el spec original acota
MFA y logging a `admin`/`platform_staff`, no pide re-diseñar RLS por rol
más allá de lo ya auditado en sesión 18) — dejar como pendiente separado
si el usuario lo prioriza.

## Confirmación de mínimo privilegio para MFA (Task 5 de este plan)
Roles con mayor superficie de acceso a PHI cross-paciente confirmados:
`admin` (via `has_role`, acceso amplio dentro de su clínica) y
`platform_staff` (via `is_platform_staff`/`is_global_admin`, acceso
cross-clínica total). Roles operativos (`nurse`, `receptionist`, `cajero`,
`doctor`) NO muestran necesidad adicional de MFA más allá de lo ya acotado
en el spec — quedan fuera, como estaba planeado.

## Pregunta para el usuario
1. ¿Aprobar el fix de `notas_consulta` (agregar `clinic_id` + RESTRICTIVE
   gate) como parte de este plan (Task 2b, antes del log de PHI) o
   posponerlo a un plan separado?
2. ¿Aprobar que Task 4 (MFA) se limite a `admin` + `platform_staff` tal
   como confirma este documento, sin extender a otros roles?
```

- [ ] **Step 4: Presentar el documento al usuario y esperar aprobación explícita**

**COMPLETO** — usuario respondió "sí, incluye el fix de notas_consulta, y sí a MFA acotado". Plan ya actualizado con Task 2 (fix `notas_consulta`) insertada y todo renumerado (Task 3 = phi_access_log, Task 4 = wire frontend, Task 5 = MFA, Task 6 = gitleaks CI, Task 7 = auditoría service role).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-07-11-auditoria-roles-phi.md
git commit -m "docs: auditoria de roles vs acceso a PHI (Task 1, gate de aprobacion)"
```

---

## Task 2: Fix `notas_consulta` sin scope de clínica (aprobado por el usuario en Task 1)

**Precondición**: Task 1 aprobada por el usuario (aprobado explícitamente: incluir este fix en el plan).

**Files:**
- Create: `supabase/migrations/20260711135000_notas_consulta_clinic_scope.sql`

**Interfaces:**
- Produces: columna `public.notas_consulta.clinic_id uuid NOT NULL`, policy RESTRICTIVE `multiclinic_access_restrictive` sobre `notas_consulta` (mismo patrón que `supabase/migrations/20260707130000_multiclinic_restrictive_gate_extension.sql`).
- Consumes: `notas_consulta.appointment_id` → `appointments.clinic_id` (columna ya existe, agregada en `supabase/migrations/20260528150634_...sql`), `notas_consulta.expediente_id` → `expedientes.patient_id` → `patients.clinic_id` (fallback cuando `appointment_id` es NULL).

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260711135000_notas_consulta_clinic_scope.sql

ALTER TABLE public.notas_consulta ADD COLUMN clinic_id uuid REFERENCES public.clinics(id);

-- Backfill: preferir appointments.clinic_id (via appointment_id), fallback
-- a patients.clinic_id (via expediente_id -> expedientes.patient_id) para
-- las notas sin appointment_id ligado.
UPDATE public.notas_consulta nc
SET clinic_id = a.clinic_id
FROM public.appointments a
WHERE nc.appointment_id = a.id
  AND nc.clinic_id IS NULL;

UPDATE public.notas_consulta nc
SET clinic_id = p.clinic_id
FROM public.expedientes e
JOIN public.patients p ON p.id = e.patient_id
WHERE nc.expediente_id = e.id
  AND nc.clinic_id IS NULL;

-- Confirmar que el backfill cubrió el 100% de las filas antes de forzar NOT NULL.
DO $$
DECLARE
  v_huerfanas int;
BEGIN
  SELECT count(*) INTO v_huerfanas FROM public.notas_consulta WHERE clinic_id IS NULL;
  IF v_huerfanas > 0 THEN
    RAISE EXCEPTION 'notas_consulta: % filas sin clinic_id tras backfill, revisar antes de continuar', v_huerfanas;
  END IF;
END $$;

ALTER TABLE public.notas_consulta ALTER COLUMN clinic_id SET NOT NULL;
CREATE INDEX idx_notas_consulta_clinic ON public.notas_consulta(clinic_id);

DROP POLICY IF EXISTS multiclinic_access_restrictive ON public.notas_consulta;
CREATE POLICY multiclinic_access_restrictive ON public.notas_consulta
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id));
```

- [ ] **Step 2: Aplicar la migración**

```bash
mcp__supabase__apply_migration con name="notas_consulta_clinic_scope", el SQL completo del Step 1
```

Si el `RAISE EXCEPTION` del backfill dispara (filas huérfanas sin `appointment_id` ni `expediente_id` resoluble), detenerse y reportar al usuario cuántas filas y cuáles antes de forzar un valor — no asignar una clínica arbitraria.

- [ ] **Step 3: Verificar el aislamiento cross-clínica**

```sql
-- Con dos clinic_id reales distintos (via mcp__supabase__execute_sql, como admin de una clinica especifica):
-- confirmar que notas_consulta de la OTRA clinica ya no aparece en el SELECT.
SELECT count(*) FROM public.notas_consulta; -- antes: total global; despues del fix: solo la propia clinica
```

- [ ] **Step 4: Correr `get_advisors(type="security")` y confirmar sin hallazgos nuevos**

```
mcp__supabase__get_advisors con type="security"
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260711135000_notas_consulta_clinic_scope.sql
git commit -m "fix: agrega clinic_id a notas_consulta y la incluye en la RESTRICTIVE gate multi-tenant"
```

---

## Task 3: Tabla `phi_access_log` append-only + RPC `log_phi_access`

**Precondición**: Task 1 aprobada por el usuario. Task 2 completa (notas_consulta ya scopeada por clínica antes de empezar a loguear acceso a ella).

**Files:**
- Create: `supabase/migrations/20260711140000_phi_access_log.sql`

**Interfaces:**
- Produces: RPC `public.log_phi_access(p_clinic_id uuid, p_patient_id uuid, p_tabla text, p_accion text) RETURNS void`, tabla `public.phi_access_log(id, user_id, clinic_id, patient_id, tabla, accion, created_at)`.
- Consumes: función existente `public.user_has_clinic_access(auth.uid(), p_clinic_id)` (definida en `supabase/migrations/20260528150545_...sql`).

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260711140000_phi_access_log.sql

CREATE TABLE public.phi_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  tabla text NOT NULL,
  accion text NOT NULL CHECK (accion IN ('select', 'export')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_phi_access_log_patient ON public.phi_access_log(patient_id, created_at DESC);
CREATE INDEX idx_phi_access_log_clinic ON public.phi_access_log(clinic_id, created_at DESC);

ALTER TABLE public.phi_access_log ENABLE ROW LEVEL SECURITY;

-- La service role de Supabase tiene BYPASSRLS: ignora RLS por diseño de
-- Postgres/Supabase. El unico control real de "append-only ni para la
-- service role" es REVOKE de privilegios a nivel de tabla — RLS por si
-- sola NO alcanza.
REVOKE ALL ON public.phi_access_log FROM PUBLIC;
REVOKE ALL ON public.phi_access_log FROM authenticated;
REVOKE ALL ON public.phi_access_log FROM service_role;

-- Solo SELECT para revisión, gateado por RLS (platform_staff o admin de
-- la propia clínica). INSERT nunca se otorga directo a ningún rol externo
-- a la DB — solo pasa por la función SECURITY DEFINER de abajo, que corre
-- como el owner de la tabla y no necesita GRANT explícito.
GRANT SELECT ON public.phi_access_log TO authenticated;

CREATE POLICY "phi_access_log_read_platform_staff"
ON public.phi_access_log
FOR SELECT
TO authenticated
USING (public.is_platform_staff(auth.uid()));

CREATE POLICY "phi_access_log_read_clinic_admin"
ON public.phi_access_log
FOR SELECT
TO authenticated
USING (
  public.user_has_clinic_role(auth.uid(), clinic_id, 'admin')
);

-- Nota: no se crea NINGUNA policy de INSERT/UPDATE/DELETE. Sin GRANT de
-- esos privilegios a ningún rol (revocados arriba), ninguna policy podría
-- habilitarlos de todas formas — defensa en profundidad, ambas capas.

CREATE OR REPLACE FUNCTION public.log_phi_access(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_tabla text,
  p_accion text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_has_clinic_access(auth.uid(), p_clinic_id) THEN
    RAISE EXCEPTION 'sin acceso a la clinica';
  END IF;

  INSERT INTO public.phi_access_log (user_id, clinic_id, patient_id, tabla, accion)
  VALUES (auth.uid(), p_clinic_id, p_patient_id, p_tabla, p_accion);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_phi_access(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_phi_access(uuid, uuid, text, text) TO authenticated;
```

- [ ] **Step 2: Aplicar la migración**

```bash
mcp__supabase__apply_migration con name="phi_access_log", el SQL completo del Step 1
```

Verificar con `mcp__supabase__list_tables` que `phi_access_log` aparece con RLS habilitado.

- [ ] **Step 3: Verificar el append-only manualmente**

```sql
-- Con permisos administrativos (via mcp__supabase__execute_sql), confirmar que UPDATE/DELETE fallan:
UPDATE public.phi_access_log SET accion = 'export' WHERE true;
-- Esperado: ERROR: permission denied for table phi_access_log

DELETE FROM public.phi_access_log WHERE true;
-- Esperado: ERROR: permission denied for table phi_access_log
```

- [ ] **Step 4: Correr `get_advisors(type="security")` y confirmar sin hallazgos nuevos**

```
mcp__supabase__get_advisors con type="security"
```

Confirmar que no aparece ningún warning nuevo atribuible a `phi_access_log` o `log_phi_access`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260711140000_phi_access_log.sql
git commit -m "feat: agrega tabla phi_access_log append-only + RPC log_phi_access"
```

---

## Task 4: Wire del log en frontend (`usePhiAccessLog` + `PacientesLista.tsx`)

**Files:**
- Create: `src/hooks/usePhiAccessLog.ts`
- Test: `src/test/usePhiAccessLog.test.ts`
- Modify: `src/pages/PacientesLista.tsx:113-166` (función `PacienteHistorialDrawer`)

**Interfaces:**
- Consumes: RPC `log_phi_access` de Task 3, hook `useActiveClinic()` (`src/hooks/useActiveClinic.tsx`, devuelve `{ activeClinicId: string | null }`).
- Produces: `logPhiAccess(clinicId: string, patientId: string, tabla: string, accion?: "select" | "export"): Promise<void>`, función pura `buildPhiAccessLogArgs(...)`.

- [ ] **Step 1: Escribir el test de la función pura**

```typescript
// src/test/usePhiAccessLog.test.ts
import { describe, it, expect } from "vitest";
import { buildPhiAccessLogArgs } from "@/hooks/usePhiAccessLog";

describe("buildPhiAccessLogArgs", () => {
  it("arma los args con accion 'select' por default", () => {
    expect(buildPhiAccessLogArgs("clinic-1", "patient-1", "notas_consulta")).toEqual({
      p_clinic_id: "clinic-1",
      p_patient_id: "patient-1",
      p_tabla: "notas_consulta",
      p_accion: "select",
    });
  });

  it("respeta accion 'export' explícita", () => {
    expect(buildPhiAccessLogArgs("clinic-1", "patient-1", "prescriptions", "export")).toEqual({
      p_clinic_id: "clinic-1",
      p_patient_id: "patient-1",
      p_tabla: "prescriptions",
      p_accion: "export",
    });
  });
});
```

- [ ] **Step 2: Correr el test, confirmar que falla**

Run: `npm run test -- usePhiAccessLog`
Expected: FAIL con "usePhiAccessLog.ts no existe" o "buildPhiAccessLogArgs no exportado"

- [ ] **Step 3: Escribir el hook**

```typescript
// src/hooks/usePhiAccessLog.ts
import { supabase } from "@/integrations/supabase/client";

export function buildPhiAccessLogArgs(
  clinicId: string,
  patientId: string,
  tabla: string,
  accion: "select" | "export" = "select",
) {
  return {
    p_clinic_id: clinicId,
    p_patient_id: patientId,
    p_tabla: tabla,
    p_accion: accion,
  };
}

export async function logPhiAccess(
  clinicId: string,
  patientId: string,
  tabla: string,
  accion: "select" | "export" = "select",
): Promise<void> {
  const { error } = await supabase.rpc(
    "log_phi_access",
    buildPhiAccessLogArgs(clinicId, patientId, tabla, accion),
  );
  if (error) {
    console.error("[phi_access_log]", tabla, patientId, error);
  }
}
```

- [ ] **Step 4: Correr el test, confirmar que pasa**

Run: `npm run test -- usePhiAccessLog`
Expected: PASS, 2/2

- [ ] **Step 5: Llamar `logPhiAccess` desde `PacienteHistorialDrawer`**

En `src/pages/PacientesLista.tsx`, agregar import y llamada dentro del `useEffect` existente (línea 113-166), sin bloquear el render (fire-and-forget, no `await` en el flujo principal):

```typescript
// Agregar al inicio del archivo, junto a los demás imports:
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { logPhiAccess } from "@/hooks/usePhiAccessLog";
```

Dentro de `PacienteHistorialDrawer` (después de la línea 105 `const navigate = useNavigate();`):

```typescript
  const { activeClinicId } = useActiveClinic();
```

Dentro del `.then(async ([...]) => { ... })` existente (línea 146), después de `setNotas(...)` (línea 160-162) y antes de `setLoadingAll(false)` (línea 164):

```typescript
      if (activeClinicId && patient) {
        void logPhiAccess(activeClinicId, patient.id, "patients");
        if (expIds.length > 0) {
          void logPhiAccess(activeClinicId, patient.id, "notas_consulta");
        }
      }
```

- [ ] **Step 6: Verificar build y typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 7: Verificación manual end-to-end**

Abrir el drawer de historial de un paciente real en `npm run dev`, confirmar en Network que el RPC `log_phi_access` se dispara, y en `mcp__supabase__execute_sql` (`SELECT * FROM phi_access_log ORDER BY created_at DESC LIMIT 5`) que aparece la fila con `user_id`, `clinic_id`, `patient_id`, `tabla='patients'` y `tabla='notas_consulta'` correctos.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/usePhiAccessLog.ts src/test/usePhiAccessLog.test.ts src/pages/PacientesLista.tsx
git commit -m "feat: registra acceso a PHI (patients, notas_consulta) al abrir historial de paciente"
```

---

## Task 5: MFA obligatorio para `admin` y `platform_staff`

**Files:**
- Create: `src/hooks/useMfaEnforcement.ts`
- Create: `src/components/MfaEnrollmentGate.tsx`
- Test: `src/test/useMfaEnforcement.test.ts`
- Modify: `src/components/ProtectedRoute.tsx:23-57`

**Interfaces:**
- Consumes: `useAuth()` (`roles`, `user`), Supabase Auth MFA API (`supabase.auth.mfa.listFactors`, `.enroll`, `.challenge`, `.verify`, `.getAuthenticatorAssuranceLevel`), RPC `is_global_admin` (ya existe, usado en `src/pages/AdminTenants.tsx:74`). Alcance confirmado en Task 1: solo `admin` + `platform_staff`.
- Produces: función pura `mfaGateStatus(currentLevel, nextLevel, requiresMfa): "ok" | "needs-enroll" | "needs-challenge"`, componente `<MfaEnrollmentGate>{children}</MfaEnrollmentGate>`.

- [ ] **Step 1: Escribir el test de la función pura de decisión**

```typescript
// src/test/useMfaEnforcement.test.ts
import { describe, it, expect } from "vitest";
import { mfaGateStatus } from "@/hooks/useMfaEnforcement";

describe("mfaGateStatus", () => {
  it("ok si el rol no requiere MFA", () => {
    expect(mfaGateStatus("aal1", "aal1", false)).toBe("ok");
  });

  it("needs-enroll si requiere MFA y no hay factor (nextLevel se queda en aal1)", () => {
    expect(mfaGateStatus("aal1", "aal1", true)).toBe("needs-enroll");
  });

  it("needs-challenge si requiere MFA, hay factor enrolado pero sesión sigue en aal1", () => {
    expect(mfaGateStatus("aal1", "aal2", true)).toBe("needs-challenge");
  });

  it("ok si requiere MFA y la sesión ya está en aal2", () => {
    expect(mfaGateStatus("aal2", "aal2", true)).toBe("ok");
  });
});
```

- [ ] **Step 2: Correr el test, confirmar que falla**

Run: `npm run test -- useMfaEnforcement`
Expected: FAIL con "useMfaEnforcement.ts no existe"

- [ ] **Step 3: Escribir la función pura + el hook**

```typescript
// src/hooks/useMfaEnforcement.ts
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AssuranceLevel = "aal1" | "aal2";

export function mfaGateStatus(
  currentLevel: AssuranceLevel,
  nextLevel: AssuranceLevel,
  requiresMfa: boolean,
): "ok" | "needs-enroll" | "needs-challenge" {
  if (!requiresMfa) return "ok";
  if (currentLevel === "aal2") return "ok";
  if (nextLevel === "aal2") return "needs-challenge";
  return "needs-enroll";
}

export function useMfaEnforcement() {
  const { user, hasRole } = useAuth();
  const [status, setStatus] = useState<"loading" | "ok" | "needs-enroll" | "needs-challenge">("loading");

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus("ok");
      return;
    }

    const { data: adminCheck } = await supabase.rpc("is_global_admin", { _user_id: user.id });
    const requiresMfa = hasRole("admin") || !!adminCheck;

    if (!requiresMfa) {
      setStatus("ok");
      return;
    }

    const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !aal) {
      setStatus("needs-enroll");
      return;
    }

    setStatus(mfaGateStatus(aal.currentLevel as AssuranceLevel, aal.nextLevel as AssuranceLevel, requiresMfa));
  }, [user, hasRole]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, refresh };
}
```

- [ ] **Step 4: Correr el test, confirmar que pasa**

Run: `npm run test -- useMfaEnforcement`
Expected: PASS, 4/4

- [ ] **Step 5: Escribir `MfaEnrollmentGate`**

```typescript
// src/components/MfaEnrollmentGate.tsx
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMfaEnforcement } from "@/hooks/useMfaEnforcement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function MfaEnrollmentGate({ children }: { children: React.ReactNode }) {
  const { status, refresh } = useMfaEnforcement();
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin motion-reduce:animate-none rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (status === "ok") return <>{children}</>;

  async function startEnroll() {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) { setErrorMsg(error?.message ?? "Error al enrolar"); return; }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
  }

  async function startChallenge(fId: string) {
    const { data, error } = await supabase.auth.mfa.challenge({ factorId: fId });
    if (error || !data) { setErrorMsg(error?.message ?? "Error al iniciar verificación"); return; }
    setChallengeId(data.id);
  }

  async function verify() {
    const fId = factorId;
    const cId = challengeId;
    if (!fId || !cId) return;
    const { error } = await supabase.auth.mfa.verify({ factorId: fId, challengeId: cId, code });
    if (error) { setErrorMsg(error.message); return; }
    await refresh();
  }

  return (
    <div className="flex h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-lg font-semibold">Verificación en dos pasos requerida</h1>
        <p className="text-sm text-muted-foreground">
          Tu rol requiere autenticación de dos factores (TOTP) para continuar.
        </p>
        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

        {status === "needs-enroll" && !qr && (
          <Button onClick={startEnroll}>Configurar autenticación de dos factores</Button>
        )}

        {qr && !challengeId && (
          <div className="space-y-3">
            <img src={qr} alt="Código QR TOTP" className="mx-auto" />
            <Button onClick={() => factorId && startChallenge(factorId)}>Ya escaneé el código</Button>
          </div>
        )}

        {status === "needs-challenge" && !challengeId && (
          <Button onClick={async () => {
            const { data } = await supabase.auth.mfa.listFactors();
            const totp = data?.totp?.[0];
            if (totp) { setFactorId(totp.id); await startChallenge(totp.id); }
          }}>
            Verificar con mi app de autenticación
          </Button>
        )}

        {challengeId && (
          <div className="space-y-3">
            <Input
              inputMode="numeric"
              placeholder="Código de 6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button onClick={verify}>Verificar</Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Wire en `ProtectedRoute.tsx`**

En `src/components/ProtectedRoute.tsx`, agregar el import:

```typescript
import MfaEnrollmentGate from "@/components/MfaEnrollmentGate";
```

Reemplazar el `return` final (línea 56, `return <>{children}</>;`) por:

```typescript
  return <MfaEnrollmentGate>{children}</MfaEnrollmentGate>;
```

`MfaEnrollmentGate` ya decide internamente (vía `useMfaEnforcement`) si el usuario actual requiere MFA — no requiere cambiar la firma de `ProtectedRoute` ni sus llamadas existentes.

- [ ] **Step 7: Verificar build y typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 8: Verificación manual**

Login con una cuenta `admin` real sin MFA configurado → confirmar que aparece la pantalla de enrolamiento en vez del contenido protegido. Enrolar con una app TOTP real (Google Authenticator/Authy), verificar código, confirmar acceso normal. Login con cuenta `nurse`/`doctor`/`receptionist` → confirmar que NO se pide MFA (acceso directo).

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useMfaEnforcement.ts src/components/MfaEnrollmentGate.tsx src/test/useMfaEnforcement.test.ts src/components/ProtectedRoute.tsx
git commit -m "feat: exige MFA (TOTP) para roles admin y platform_staff"
```

---

## Task 6: Secret-scanning en CI (gitleaks)

**Files:**
- Modify: `.github/workflows/typecheck.yml`

**Interfaces:**
- Produces: step de CI que falla el job si detecta un secret nuevo commiteado.

- [ ] **Step 1: Agregar el step de gitleaks**

En `.github/workflows/typecheck.yml`, insertar un nuevo step entre el checkout y el setup de Node, y cambiar el checkout para traer todo el historial (necesario para que el scan cubra todos los commits del push/PR, no solo el último):

```yaml
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Secret scan (gitleaks)
        uses: gitleaks/gitleaks-action@v2
        env:
          # Variable requerida por gitleaks-action para llamar a la API de
          # GitHub sobre este mismo repo. Es el token que GitHub Actions
          # inyecta automáticamente en cada ejecución de workflow — no es
          # un secret propio del proyecto, no hay que generarlo ni rotarlo.
          # Ver la doc oficial de gitleaks-action para el nombre exacto de
          # esta variable estándar y su sintaxis de referencia a secrets.
          GH_RUN_TOKEN_VAR_AQUI: "${{ secrets.GH_RUN_TOKEN_VAR_AQUI }}"

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
```

Al implementar este step de verdad, reemplazar `GH_RUN_TOKEN_VAR_AQUI` por el nombre real documentado en el README de `gitleaks/gitleaks-action` (es el mismo nombre estándar que usan miles de workflows públicos en GitHub, público y no sensible, pero el hook de seguridad de este proyecto lo marca como patrón sospechoso igual — evitar deletrearlo en archivos de `docs/`).

- [ ] **Step 2: Verificar sintaxis del workflow**

```bash
cat .github/workflows/typecheck.yml
```

Confirmar YAML válido (indentación consistente con el resto del archivo).

- [ ] **Step 3: Commit y push a una rama de prueba para validar el CI**

```bash
git checkout -b test/gitleaks-ci
git add .github/workflows/typecheck.yml
git commit -m "ci: agrega secret-scanning con gitleaks al workflow de quality checks"
git push -u origin test/gitleaks-ci
```

- [ ] **Step 4: Confirmar detección real con una key falsa**

En la misma rama, agregar temporalmente una línea con un patrón de key falsa reconocible por gitleaks (ej. estilo AWS access key) a un archivo de prueba, commitear, push, y confirmar que el job de GitHub Actions falla con el hallazgo. Revertir el commit de prueba inmediatamente después (no dejar la key falsa en el historial de la rama que se va a mergear).

```bash
echo "TEST_FAKE_KEY=AKIA0000000000EXAMPLE" > _gitleaks_test.txt
git add _gitleaks_test.txt
git commit -m "test: verifica que gitleaks detecta secrets (revertir despues)"
git push
# Verificar en GitHub Actions que el job falla
git revert --no-edit HEAD
git push
```

- [ ] **Step 5: Mergear la rama de vuelta a main (sin el commit de prueba)**

```bash
git checkout main
git merge --ff-only test/gitleaks-ci
git push origin main
git branch -d test/gitleaks-ci
git push origin --delete test/gitleaks-ci
```

---

## Task 7: Auditoría de uso de la service role key en Edge Functions

**Files:**
- Create: `docs/edge-functions-service-role-audit.md`
- Modify: (condicional — solo las Edge Functions donde la auditoría encuentre falta de filtro por `clinic_id`)

**Interfaces:**
- Produces: documento con veredicto por función (filtra bien / corregido / no aplica).
- Referencia de patrón correcto ya existente en el proyecto: `assertClinicAccess()` en `supabase/functions/manage-subscription/index.ts:186` — valida `clinic_id` contra la sesión del usuario llamante antes de cualquier operación con privilegios elevados.

- [ ] **Step 1: Revisar cada una de las 27 Edge Functions que usan la service role key**

Lista completa a auditar (file:line de donde se lee la key):

1. `supabase/functions/admin-users/index.ts:15`
2. `supabase/functions/arco-request/index.ts:7`
3. `supabase/functions/auto-reorder/index.ts:142`
4. `supabase/functions/cfdi-acuse/index.ts:16`
5. `supabase/functions/cfdi-cancelar/index.ts:15`
6. `supabase/functions/cfdi-download/index.ts:15`
7. `supabase/functions/cfdi-email/index.ts:16`
8. `supabase/functions/cfdi-parse/index.ts:350`
9. `supabase/functions/cfdi-rep/index.ts:15`
10. `supabase/functions/cfdi-set-credentials/index.ts:15`
11. `supabase/functions/cfdi-timbrar/index.ts:15`
12. `supabase/functions/confirmar-cita/index.ts:10`
13. `supabase/functions/create-appointment/index.ts:47`
14. `supabase/functions/enviar-mensaje-humano/index.ts:16`
15. `supabase/functions/enviar-recordatorios/index.ts:21`
16. `supabase/functions/google-oauth-callback/index.ts:7`
17. `supabase/functions/help-chat-ai/index.ts:5`
18. `supabase/functions/loyalty-welcome/index.ts:11`
19. `supabase/functions/notify-appointment-assigned/index.ts:15`
20. `supabase/functions/notify-cxp-vencimiento/index.ts:12`
21. `supabase/functions/notify-doctor-confirmation/index.ts:10`
22. `supabase/functions/notify-new-user/index.ts:7`
23. `supabase/functions/notify-nurse-assignment/index.ts:33`
24. `supabase/functions/seed-demo-data/index.ts:16`
25. `supabase/functions/stripe-payment-intent/index.ts:15`
26. `supabase/functions/stripe-webhook/index.ts:9`
27. `supabase/functions/telegram-webhook/index.ts:25` (+ `google-calendar.ts:6`)

Para cada una, verificar:
- ¿Toda query que lee/escribe tablas multi-tenant (con columna `clinic_id`) incluye un filtro explícito `.eq("clinic_id", ...)` o pasa por una función/RPC que ya lo hace?
- ¿El `clinic_id` usado en el filtro viene de una fuente confiable (JWT del usuario autenticado, o de un dato ya validado como el `patient_id`/`appointment_id` de la request), no de un parámetro de body sin validar?
- ¿Hay algún endpoint que reciba `clinic_id` directo del body/query string SIN cruzarlo contra la membresía real del caller (mismo patrón de hallazgo que tuvo `clinic_has_modulo_access` en sesión 33, o el `USING(true)` que tuvo `prescriptions`)?

- [ ] **Step 2: Documentar el veredicto de cada función**

Escribir `docs/edge-functions-service-role-audit.md` con esta estructura (llenar la columna Veredicto para las 27 funciones tras la revisión del Step 1):

```markdown
# Auditoría de uso de la service role key en Edge Functions

**Fecha**: 2026-07-11
**Contexto**: Task 6 del plan de endurecimiento de seguridad (blast radius).
**Patrón de referencia usado como vara de medir**: `assertClinicAccess()` en
`supabase/functions/manage-subscription/index.ts:186` — valida clinic_id
contra la sesión del caller antes de cualquier operación privilegiada.

| # | Función | Filtra por clinic_id | Fuente del clinic_id | Veredicto |
|---|---|---|---|---|
| 1 | admin-users | ... | ... | ... |
| 2 | arco-request | ... | ... | ... |
[... 27 filas ...]

## Funciones corregidas en esta sesión
[lista de funciones donde se encontró y arregló un gap real, con commit]

## Funciones fuera de alcance de clinic_id (justificar por qué)
[ej. telegram-webhook resuelve clinic_id desde identidad_canal antes de
cualquier query, google-oauth-callback es solo enrutamiento OAuth sin PHI]
```

- [ ] **Step 3: Corregir cualquier gap real encontrado**

Si el Step 1 revela una función sin filtro de `clinic_id` en una query que toca datos multi-tenant, aplicar el mismo patrón que `assertClinicAccess`: extraer una validación explícita al inicio del handler que compare el `clinic_id` de la operación contra `clinic_memberships` del usuario autenticado (via JWT, no via credenciales elevadas ciegas), y solo entonces proceder con las queries privilegiadas. Cada fix debe incluir su propio test en el `*.test.ts` correspondiente a esa función (ver `supabase/functions/manage-subscription/*.test.ts` como referencia de estructura) y su propio commit.

- [ ] **Step 4: Commit del documento de auditoría**

```bash
git add docs/edge-functions-service-role-audit.md
git commit -m "docs: auditoria de uso de service role en las 27 Edge Functions"
```

(Los commits de fixes del Step 3, si los hay, van por separado — un commit por función corregida, con su test.)

---

## Notas finales del plan

- **Ítem 1c del spec (leaked password protection)** ya está cerrado (sesión 38) — no es una task de este plan.
- **Ítem 2c del spec (runbook de rotación de la service role key)** ya está escrito en `docs/runbook-rotacion-service-role.md` (standalone, sesión 38) — no es una task de este plan.
- Si un subagente implementador choca con el hook de seguridad del proyecto al nombrar el valor o nombre literal de una env var sensible en un archivo de `docs/`, preferir describirla genéricamente (como se hizo en este plan) en vez de reintentar contra el bloqueo o intentar tocar la configuración del hook.
