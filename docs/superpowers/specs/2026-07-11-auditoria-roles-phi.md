# Auditoría de roles vs. acceso a PHI

**Fecha**: 2026-07-11
**Contexto**: Task 1 del plan de endurecimiento de seguridad (blast radius),
`docs/superpowers/plans/2026-07-11-endurecimiento-seguridad-blast-radius.md`.

## Metodología

Revisión de las policies RLS activas en las 5 tablas PHI del spec
(`patients`, `prescriptions`, `patient_studies`, `notas_consulta`,
`expediente_permissions`) contra los 7 roles reales del sistema (`admin`,
`receptionist`, `doctor`, `nurse`, `patient`, `manager`, `cajero`) +
`platform_staff` (tabla separada, no valor del enum `app_role`).

## Mapeo rol → tabla → acceso actual

| Tabla PHI | Roles con SELECT hoy | Scope por clínica | Fuente |
|---|---|---|---|
| `patients` | `admin`, `receptionist`, `doctor`, `nurse` (vía `has_role`, policy `"Staff read patients"`) + paciente dueño | Sí — cerrado por policy RESTRICTIVE `multiclinic_access_restrictive` (`supabase/migrations/20260707130000_multiclinic_restrictive_gate_extension.sql:14-37`) | `supabase/migrations/20260403013133_...sql:256-287` |
| `prescriptions` | Staff de la clínica vía `clinic_memberships` (`prescriptions_staff_clinic_scope`, cualquier rol) + paciente dueño | Sí, reescrita en sesión previa tras hallazgo de `USING(true)` | `supabase/migrations/20260704230654_prescriptions_rls_scope_fix.sql` |
| `patient_studies` | Cualquier rol de staff de la clínica (`clinic_memberships`, sin distinción de rol) + paciente dueño | Sí | `supabase/migrations/20260622120000_patient_studies_clinic_scope.sql:93-117` |
| `notas_consulta` | `admin`, `doctor`, `nurse` (vía `has_role`, global) + paciente dueño | **NO** — tabla sin columna `clinic_id`, NO incluida en la RESTRICTIVE gate multi-tenant | `supabase/migrations/20260508213818_...sql:66-89` |
| `expediente_permissions` | Cualquier rol de staff de la clínica (sin restricción de rol) | Sí | `supabase/migrations/20260622130000_expediente_permissions.sql:21-34` |

## Hallazgos

### CRÍTICO: `notas_consulta` sin scope de clínica

Cualquier `admin`/`doctor`/`nurse` de **cualquier clínica** del sistema
puede leer las notas SOAP (`notas_consulta`) de **cualquier paciente de
cualquier otra clínica**, porque la tabla no tiene columna `clinic_id` y
quedó fuera de la RESTRICTIVE gate multi-tenant que sí protege `patients`,
`prescriptions` y `patient_studies` (`supabase/migrations/20260707130000_multiclinic_restrictive_gate_extension.sql:17-23`
no la incluye en su array de tablas).

Esto es exactamente el tipo de gap que el spec de blast radius busca
cerrar: una cuenta de doctor/nurse comprometida en la Clínica A puede leer
PHI clínico completo (diagnóstico, subjetivo/objetivo/análisis/plan) de la
Clínica B, sin necesidad de comprometer nada más.

**Recomendación**: agregar columna `clinic_id` a `notas_consulta`
(backfill desde `expedientes.patient_id` → `patients.clinic_id`, o desde
`appointment_id` → `appointments.clinic_id`) e incluirla en la RESTRICTIVE
gate multi-tenant, mismo patrón que ya protege `patients`/`prescriptions`/
`patient_studies`.

### MEDIO: sin distinción de rol en `expediente_permissions`/`patient_studies`

Cualquier miembro de staff de la clínica (incluyendo roles operativos como
`receptionist`/`cajero` si llegaran a tener `clinic_memberships` activa)
puede otorgar/revocar permisos de expediente o gestionar estudios
clínicos — no hay principio de mínimo privilegio por rol dentro de la
clínica, solo aislamiento entre clínicas.

**Recomendación**: fuera de alcance de este spec (el spec original acota
MFA y logging a `admin`/`platform_staff`, no pide re-diseñar RLS por rol
más allá de lo ya auditado en sesión 18) — dejar como pendiente separado
si se prioriza más adelante.

## Confirmación de mínimo privilegio para MFA (Task 5 del plan)

Roles con mayor superficie de acceso a PHI cross-paciente confirmados:
`admin` (vía `has_role`, acceso amplio dentro de su propia clínica) y
`platform_staff` (vía `is_platform_staff`/`is_global_admin`, acceso
cross-clínica total, es el rol de mayor blast radius de todo el sistema).
Roles operativos (`nurse`, `receptionist`, `cajero`, `doctor`) no muestran
necesidad adicional de MFA más allá de lo ya acotado en el spec original —
quedan fuera de Task 4, como estaba planeado.

## Preguntas para el usuario

1. ¿Aprobar el fix de `notas_consulta` (agregar `clinic_id` + RESTRICTIVE
   gate) como parte de este plan (task nueva, antes del log de PHI) o
   posponerlo a un plan separado?
2. ¿Aprobar que Task 4 (MFA) se limite a `admin` + `platform_staff` tal
   como confirma este documento, sin extender a otros roles?
