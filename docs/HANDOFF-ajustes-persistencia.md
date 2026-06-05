# Handoff — Persistencia /ajustes

**Última sesión:** 2026-06-04. Rama `main`. Costo alto → cierre.

## Hecho (committed + pushed)
- `clinics` UPDATE policy + tabla `clinic_settings` → migración
  `supabase/migrations/20260604191834_clinic_settings_and_clinic_update_policy.sql`
  **⚠️ PENDIENTE APLICAR EN LOVABLE:** prompt `"Apply pending Supabase migrations"`.
  Hasta aplicarla, General NO guarda.
- **General** → tabla `clinics` (`useClinicGeneral.ts`).
- **Servicios** CRUD → `servicios` (`useServicios.ts`, `sections/servicios.tsx`).
- **Doctores** CRUD → `doctors` (`useDoctores.ts`, `sections/doctores.tsx`).
- `lib/repositories/clinicSettingsRepository.ts` — `getSection`/`saveSection` JSONB.
- `useClinicSettingsForm.ts` — hook genérico JSONB (mismo shape que `useClinicGeneral`).
- **Citas** → section `"citas"` (`sections/basic.tsx`, controlado + `registerSave`).
- **Recordatorios** → section `"recordatorios"` (`sections/basic.tsx`, controlado + `registerSave`).
  ⚠️ Citas/Recordatorios persisten en `clinic_settings`; requieren la migración aplicada
  (igual que General).

## Patrón establecido
- `useActiveClinic()` → `activeClinicId`, `isGlobalAdmin` (gate edición a admin).
- Shell `AjustesPlataforma.tsx`: secciones registran guardado vía
  `registerSave({ save, reset })` (prop opcional en `SectionProps`). Save/Cancel
  del header llaman al saver registrado; demo si no hay.
- CRUD por-fila (Servicios/Doctores) = guardado inmediato, ignoran `registerSave`.
- Config singleton = guardado on-Guardar vía `registerSave`.
- Errores: `friendlyError` de `lib/errors.ts`. Inmutable: `setForm(prev => ({...prev}))`.

## Próximo paso (barato, sin explorar)
Citas y Recordatorios ya cableados (ver arriba). Siguiente candidato barato:
**Formularios/Checklists** (toggles) o **Pagos** (políticas) — mismo patrón:
`useClinicSettingsForm<T>(clinicId, section, defaults)` + controlar inputs + `registerSave`.

## Sigue pendiente después
- Horarios (7 días + excepciones, más pesado), Facturación CFDI, Pagos políticas,
  Formularios/Checklists toggles, Auditoría políticas, matriz Permisos.
- Recursos: NO cablear, ya vive en `/configuracion` (rooms).
