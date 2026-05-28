# Plan: Base multi-clínica (Fase 1)

Objetivo: dejar la estructura, datos y RLS preparados para multi-clínica, asignando todo lo existente a la clínica default **Salud Integral MX**, sin romper la operación actual.

Trabajaré en migraciones incrementales y seguras. Cada paso es reversible (sin DROPs, sin borrar datos, sin desactivar RLS).

---

## Fase A — Esquema base (migración 1)

1. Crear `public.clinics` con los campos pedidos, check `status IN ('active','inactive','suspended')`, índices en `code` y `status`, trigger `update_updated_at_column`.
2. GRANTs: `SELECT` a `authenticated`, `ALL` a `service_role`. RLS habilitado:
   - SELECT: `user_has_clinic_access(auth.uid(), id)` o `is_global_admin(auth.uid())`.
   - INSERT/UPDATE/DELETE: solo `is_global_admin`.
3. Crear `public.clinic_memberships` con FKs a `clinics` y `auth.users`, unique `(clinic_id, user_id, role)`, check status, índices solicitados, trigger updated_at.
4. GRANTs equivalentes + RLS:
   - SELECT: el propio `user_id = auth.uid()` o `is_global_admin`.
   - INSERT/UPDATE/DELETE: solo `is_global_admin` (más adelante admin de clínica).
5. Insertar clínica default `salud_integral_mx` (idempotente con `ON CONFLICT (code) DO NOTHING`).
6. Backfill: por cada `user_roles(user_id, role)` insertar membership activa en la clínica default (`ON CONFLICT DO NOTHING`). `user_roles` se conserva intacta.

## Fase B — Helpers SQL (migración 2)

Crear funciones `SECURITY DEFINER`, `STABLE`, `SET search_path = public`:
- `is_global_admin(_user_id uuid) returns boolean` — usa `has_role(_user_id, 'admin')`.
- `user_has_clinic_access(_user_id, _clinic_id) returns boolean`.
- `user_has_clinic_role(_user_id, _clinic_id, _role app_role) returns boolean`.
- `current_user_clinic_ids() returns setof uuid`.

GRANT EXECUTE a `authenticated`.

## Fase C — `clinic_id` en tablas sensibles (migraciones 3..N, una por dominio)

Patrón por tabla (siempre seguro):
1. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);` (nullable).
2. `UPDATE ... SET clinic_id = <default> WHERE clinic_id IS NULL;`.
3. Validar `SELECT count(*) WHERE clinic_id IS NULL` = 0; si OK → `ALTER COLUMN clinic_id SET NOT NULL`. Si falla, dejar nullable y registrar en el doc.
4. Crear índice `idx_<tabla>_clinic_id` y los compuestos pedidos.

Tablas (solo si existen, agrupadas por migración):
- **Núcleo**: `patients`, `doctors`, `rooms`, `servicios`, `appointments`.
- **Expediente**: `expedientes`, `notas_consulta`, `consentimientos`, `patient_studies` (si existe).
- **Camino del paciente**: `journey_templates`, `journey_template_versions`, `journey_instances`, `journey_instance_steps`, `journey_instance_step_data`, `journey_instance_documents`, `journey_instance_overrides`, `journey_instance_audit`. `journey_step_definitions` queda sin clinic_id (vive bajo `template_version_id`); documentado.
- **Recetas**: `prescriptions`, `prescription_items` (si existe), `prescription_audit` (si existe), `prescription_print_events` (si existe), `doctor_prescription_templates`, `doctor_prescription_template_versions`.
- **Farmacia**: `medicamentos`, `lotes_medicamento`, `movimientos_inventario`.
- **Comunicación**: `conversaciones`, `mensajes`, `identidades_canal`, `recordatorios_cita` (si existe; en el schema actual hay `reminders` — se aplica al nombre real encontrado).
- **Auditoría**: `audit_logs`, `clinical_access_audit`/`appointment_notifications`/`secure_access_links` (si existen).

Índices compuestos pedidos: `appointments(clinic_id, fecha_inicio)`, `appointments(clinic_id, doctor_id)`, `patients(clinic_id, nombre)`, `prescriptions(clinic_id, patient_id)`, `prescriptions(clinic_id, doctor_id)`, `journey_instances(clinic_id, patient_id)`, `conversaciones(clinic_id, identidad_canal_id)`, `reminders/recordatorios(clinic_id, programado_para, status)`.

## Fase D — RLS por clínica (migración N+1)

Para cada tabla con `clinic_id`, reemplazar policies amplias por:
- SELECT: `is_global_admin(auth.uid()) OR user_has_clinic_access(auth.uid(), clinic_id)` combinado con las reglas de rol existentes (paciente dueño, doctor asignado, etc.).
- INSERT/UPDATE: `WITH CHECK` agrega `user_has_clinic_access(auth.uid(), clinic_id)`.
- DELETE: restringido a `is_global_admin` (o admin de clínica). Tablas append-only (`audit_logs`, `journey_*_audit`, `prescription_audit`) conservan deny.

Se preservan las policies de paciente-dueño y doctor-asignado actuales, añadiendo el filtro de clínica como AND. Ninguna policy queda con `USING (true)` en tabla sensible.

## Fase E — Frontend mínimo

1. `src/hooks/useActiveClinic.tsx`:
   - Consulta `clinic_memberships` del usuario (activos) + `is_global_admin` vía `has_role`.
   - Si 1 clínica → la usa. Si admin global sin membership → clínica default (lookup por code). Si nada → error seguro.
   - Devuelve `{ activeClinicId, activeClinic, userClinics, isGlobalAdmin, loading, error }`.
   - Persiste selección en `localStorage` (`activeClinicId`).
2. Integrar el hook en `AppLayout` (provider ligero vía context) sin nueva UI visible. Mostrar nombre de clínica en header (texto pequeño, sin selector).
3. Inserts del cliente: añadir `clinic_id: activeClinicId` en los servicios que crean datos:
   - `patients`, `doctors`, `servicios`, `appointments` (frontend), `expedientes`, `prescriptions`, `journey_instances`, `recordatorios`, `conversaciones`, `mensajes`, `notas_consulta`.
   - Cambios quirúrgicos en los servicios existentes (`src/features/.../services/*.ts`, `PacienteModal`, `NuevaCita`, `NotaConsultaModal`, `prescriptionService`, `journeyEngine`, etc.).

## Fase F — Edge Functions

Cambios mínimos en:
- `create-appointment`: resolver `clinic_id` desde el `patient.clinic_id`; validar que `doctor`, `room`, `servicio` coincidan; rechazar con 409 si no. Persistir `clinic_id` en `appointments` y `reminders`.
- `telegram-webhook`: usar clínica default (lookup por code). Comentario `TODO multi-clinic mapping`.
- `enviar-recordatorios`: propagar `clinic_id` del appointment al insert.
- `enviar-mensaje-humano`: propagar `clinic_id` desde `conversaciones`.
- `seed-demo-data`: asignar `clinic_id` default a todo lo creado.

## Fase G — Diagnóstico

1. `supabase/diagnostics/multiclinic_integrity_check.sql` — solo SELECTs:
   - Conteos nulos por tabla sensible.
   - Cruces de `clinic_id` entre appointments↔(patient/doctor/room/servicio), prescriptions↔(patient/doctor/appointment), expedientes↔patient, journey_instances↔(patient/appointment), mensajes↔conversaciones, reminders↔appointments.
   - Policies con `qual = 'true'` o `with_check = 'true'` en tablas sensibles (vía `pg_policies`).
   - Tablas sensibles sin RLS o sin policies (vía `pg_class`/`pg_policies`).
2. Página admin `/admin/diagnostico-multiclinica` (solo `admin`):
   - Llama una RPC `multiclinic_diagnostics()` que ejecuta los SELECTs y devuelve JSON.
   - Render: estado global (Seguro/Advertencia/Crítico), tablas con nulos, cruces inconsistentes, tablas sin protección, recomendaciones. UI sencilla con cards (sin librerías nuevas).
   - Ruta añadida en `App.tsx` con `ProtectedRoute allowedRoles={['admin']}`.

## Fase H — Auditoría

- `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinics(id)`; backfill default; índice.
- Actualizar `log_audit` para aceptar `_clinic_id` opcional (firma nueva, manteniendo la actual por compatibilidad vía overload o param default).
- Inserts críticos pasan `clinic_id` cuando esté disponible.

## Fase I — Documentación

`docs/MULTICLINIC_READINESS.md` con:
- Tablas con/ sin `clinic_id` y razón.
- Estrategia de backfill.
- Cómo funciona `useActiveClinic` y los helpers SQL.
- Cómo correr el diagnóstico.
- Limitaciones (sin selector, sin multi-sucursal, sin facturación SaaS).
- Próximos pasos.

## Fase J — Validación final

1. `npm run build` (lo dispara el harness).
2. Smoke manual en preview: login, AdminDashboard, Agenda, Pacientes, Citas, PanelDoctor, Recetas, CaminoPaciente.
3. Correr `multiclinic_diagnostics()` → 0 críticos.
4. Crear una cita de prueba y verificar `clinic_id` no nulo.

---

## Detalles técnicos clave

- Migraciones separadas por dominio para minimizar bloqueos y permitir rollback parcial.
- Toda nueva tabla incluye `GRANT` explícito + RLS + policies en la misma migración.
- Helpers se llaman con `auth.uid()` y son `SECURITY DEFINER` para evitar recursión RLS.
- Se conserva `user_roles` como roles globales; `admin` global se trata como super-acceso vía `is_global_admin` en cada policy nueva.
- No se hacen `DROP POLICY` masivos: cada policy modificada se reescribe con el mismo nombre (DROP+CREATE en la misma migración) preservando la lógica de paciente/doctor existente.
- Cambios de frontend son aditivos (campo extra en payloads). No se modifican formularios visibles.

## Riesgos y mitigaciones

- **RLS más estricta rompe queries**: helpers siempre permiten `is_global_admin`; el hook garantiza `clinic_id` antes de cualquier insert; backfill llena nulls antes de NOT NULL.
- **Edge functions de bot**: usan clínica default; no se cambia el contrato.
- **Tablas con cardinalidades pesadas**: backfill en una sola sentencia `UPDATE` con índice posterior; aceptable en data actual.
- **Si `NOT NULL` falla**: se deja nullable y se reporta en el doc + diagnóstico, sin abortar la migración.
