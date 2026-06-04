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
  **Foundation lista, sin caller todavía.**

## Patrón establecido
- `useActiveClinic()` → `activeClinicId`, `isGlobalAdmin` (gate edición a admin).
- Shell `AjustesPlataforma.tsx`: secciones registran guardado vía
  `registerSave({ save, reset })` (prop opcional en `SectionProps`). Save/Cancel
  del header llaman al saver registrado; demo si no hay.
- CRUD por-fila (Servicios/Doctores) = guardado inmediato, ignoran `registerSave`.
- Config singleton = guardado on-Guardar vía `registerSave`.
- Errores: `friendlyError` de `lib/errors.ts`. Inmutable: `setForm(prev => ({...prev}))`.

## Próximo paso (barato, sin explorar)
Cablear **Citas** y **Recordatorios** vía `clinicSettingsRepository`.

1. Crear `src/hooks/useClinicSettingsForm.ts` — hook genérico:
   `useClinicSettingsForm<T>(clinicId, section, defaults)` →
   `{ form, setField, loading, saving, dirty, error, save, reset }`.
   - load: `getSection<T>` merge sobre `defaults`.
   - save: `saveSection(clinicId, section, form)`.
   - mismo shape que `useClinicGeneral`.
2. Editar `sections/basic.tsx`:
   - **SectionCitas** → section `"citas"`, defaults:
     `{ duracionDefault:30, anticipacionMin:2, reprogramaciones:3, plazoCancelacion:24,
        citasEnLinea:true, listaEspera:true, confirmacionAuto:false, cobroAnticipo:false }`.
     Inputs number controlados + 4 Switch. Estados flow queda visual.
   - **SectionRecordatorios** → section `"recordatorios"`, defaults:
     `{ canales:{whatsapp:true,sms:true,email:true,llamada:false},
        tiempos:{h72:false,h24:true,h3:true,h1:true},
        asunto:"Recordatorio de su cita en Integriclínica", mensaje:"Hola {{paciente}}..." }`.
   - Cada una: `registerSave({ save, reset })` vía `useEffect`, `onChange()` al editar,
     gate `disabled={!isGlobalAdmin}`.
3. Verificar: `npx tsc --noEmit` + `npx eslint <archivos>`. Commit + push.

## Sigue pendiente después
- Horarios (7 días + excepciones, más pesado), Facturación CFDI, Pagos políticas,
  Formularios/Checklists toggles, Auditoría políticas, matriz Permisos.
- Recursos: NO cablear, ya vive en `/configuracion` (rooms).
