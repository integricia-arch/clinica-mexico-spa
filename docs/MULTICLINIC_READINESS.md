# Multi-clínica — Estado base (Fase 1)

Sistema preparado para multi-clínica conservando operación single-tenant actual.

## Lo que se implementó

### Esquema base
- `public.clinics` — catálogo de clínicas (code, name, rfc, dirección, timezone, status).
- `public.clinic_memberships` — vincula `auth.users` ↔ `clinics` con un `app_role` y `status`.
- Clínica default sembrada: **Salud Integral MX** (`code = salud_integral_mx`, `America/Mexico_City`).
- Todos los usuarios existentes en `user_roles` recibieron una membresía activa en la clínica default con su mismo rol. `user_roles` se conserva intacta como roles globales.

### Helpers SQL (SECURITY DEFINER, search_path=public)
- `is_global_admin(_user_id)` — true si tiene rol global `admin`.
- `user_has_clinic_access(_user_id, _clinic_id)` — admin global o membership activa.
- `user_has_clinic_role(_user_id, _clinic_id, _role)` — chequeo de rol por clínica.
- `current_user_clinic_ids()` — IDs de clínica del usuario actual.

### `clinic_id` en tablas operativas
Agregado a: `patients, doctors, rooms, servicios, appointments, appointment_resources, expedientes, notas_consulta, consentimientos, patient_studies, journey_templates, journey_template_versions, journey_instances, journey_instance_steps, journey_instance_step_data, journey_instance_documents, journey_instance_overrides, journey_instance_audit, prescriptions, prescription_items, doctor_prescription_templates, doctor_prescription_template_versions, medicamentos, lotes_medicamento, movimientos_inventario, conversaciones, mensajes, identidades_canal, recordatorios_cita, audit_logs, post_consultation_followups, patient_checkout_events, bot_sesiones`.

- Backfill: todos los registros existentes asignados a Salud Integral MX.
- `NOT NULL` activado en todas excepto `audit_logs` (eventos sistémicos pueden ser globales).
- `DEFAULT` apuntando al UUID de la clínica default — permite que el código actual siga insertando sin enviar `clinic_id` explícitamente.
- Índices simples (`idx_<tabla>_clinic_id`) y compuestos (`appointments(clinic_id, fecha_inicio)`, `appointments(clinic_id, doctor_id)`, `patients(clinic_id, apellidos)`, `prescriptions(clinic_id, patient_id|doctor_id)`, `journey_instances(clinic_id, patient_id)`, `conversaciones(clinic_id, identidad_canal_id)`, `recordatorios_cita(clinic_id, programado_para, status)`).

### Tablas que NO recibieron `clinic_id` (con razón)
- `journey_step_definitions`, `journey_step_fields`, `journey_validation_rules`, `journey_option_catalogs`, `journey_option_items`: viven bajo `template_version_id`, que sí tiene `clinic_id`.
- `journey_configuration_audit`, `permanent_admins`, `user_roles`, `doctor_servicios`: tablas globales o de meta-config.
- `doctors_public` (view).

### RLS por clínica
- Política `multiclinic_access_restrictive` **RESTRICTIVE** en todas las tablas con `clinic_id`. Se aplica como AND sobre las policies existentes (no reescritas), exigiendo `user_has_clinic_access(auth.uid(), clinic_id)`.
- Admins globales mantienen acceso total vía `is_global_admin`.
- `audit_logs`: permite `clinic_id IS NULL` para eventos sistémicos.

### Frontend
- `src/hooks/useActiveClinic.tsx` — provider + hook.
  - Carga memberships activas del usuario, selecciona única o persistida en `localStorage`.
  - Admin global sin memberships → usa Salud Integral MX.
  - Expone `{ activeClinicId, activeClinic, userClinics, isGlobalAdmin, loading, error, setActiveClinicId, refresh }`.
- `src/lib/activeClinic.ts` — helper sincrónico `getActiveClinicId()` para servicios fuera de React.
- `ActiveClinicProvider` montado en `src/App.tsx` envolviendo todas las rutas autenticadas.

## Cómo validar integridad

Diagnóstico rápido por SQL:

```sql
-- Registros sin clinic_id (debería ser 0 en todas excepto audit_logs)
SELECT 'patients' tbl, count(*) FROM patients WHERE clinic_id IS NULL
UNION ALL SELECT 'appointments', count(*) FROM appointments WHERE clinic_id IS NULL
UNION ALL SELECT 'prescriptions', count(*) FROM prescriptions WHERE clinic_id IS NULL;

-- Cruces inconsistentes
SELECT a.id FROM appointments a
JOIN patients p ON p.id = a.patient_id
WHERE a.clinic_id <> p.clinic_id;
```

## Limitaciones actuales (intencionales)

- **Sin selector visual de clínica** — el hook elige automáticamente la única membresía o la default.
- Inserts del cliente confían en el `DEFAULT` de DB en lugar de enviar `clinic_id` explícitamente. Esto se debe migrar gradualmente a inserts explícitos por seguridad (Fase 2).
- Edge functions (`create-appointment`, `telegram-webhook`, `enviar-recordatorios`, `enviar-mensaje-humano`, `seed-demo-data`) usan el `DEFAULT` de DB. **No validan que `patient/doctor/room/servicio` pertenezcan a la misma clínica** — pendiente para Fase 2.
- Página de diagnóstico `/admin/diagnostico-multiclinica` — pendiente.
- Sin facturación SaaS, sin selector complejo, sin reportes multi-clínica.

## Próximos pasos (Fase 2)

1. Página admin `/admin/diagnostico-multiclinica` consumiendo una RPC `multiclinic_diagnostics()`.
2. Inserts explícitos de `clinic_id` desde el frontend (eliminar dependencia del DEFAULT).
3. Validación en `create-appointment` de que `patient/doctor/room/servicio` comparten `clinic_id`.
4. Mapping `identidades_canal` → `clinic_id` para que el bot soporte multi-clínica real.
5. Selector visual de clínica (cuando aparezca el segundo tenant).
6. Migrar `log_audit` a aceptar `_clinic_id` opcional.

## Rollback

- Cero `DROP TABLE` o `DELETE`.
- Para revertir RLS: `DROP POLICY multiclinic_access_restrictive ON public.<tabla>` por tabla.
- Para revertir `clinic_id`: `ALTER TABLE ... ALTER COLUMN clinic_id DROP NOT NULL`, luego `DROP COLUMN clinic_id`.
- `user_roles` nunca fue modificada — el login no cambia.
