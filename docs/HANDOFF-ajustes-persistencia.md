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
- **Facturación** → section `"facturacion"` (`sections/finance.tsx`, selects/inputs/toggles).
- **Pagos** → section `"pagos"` (`sections/finance.tsx`, toggles métodos + políticas).
- **Formularios** → section `"formularios"` (`sections/clinical.tsx`, toggles bloques).
  ⚠️ Todas las secciones JSONB persisten en `clinic_settings`; requieren la migración
  aplicada en Lovable (igual que General).

## Patrón establecido
- `useActiveClinic()` → `activeClinicId`, `isGlobalAdmin` (gate edición a admin).
- Shell `AjustesPlataforma.tsx`: secciones registran guardado vía
  `registerSave({ save, reset })` (prop opcional en `SectionProps`). Save/Cancel
  del header llaman al saver registrado; demo si no hay.
- CRUD por-fila (Servicios/Doctores) = guardado inmediato, ignoran `registerSave`.
- Config singleton = guardado on-Guardar vía `registerSave`.
- Errores: `friendlyError` de `lib/errors.ts`. Inmutable: `setForm(prev => ({...prev}))`.

## Próximo paso
Secciones config singleton cableadas: General, Citas, Recordatorios, Facturación,
Pagos, Formularios. Mismo patrón para las que faltan:
`useClinicSettingsForm<T>(clinicId, section, defaults)` + controlar inputs + `registerSave`.

## Sigue pendiente después
- ~~**Auditoría** + matriz **Permisos** → section `"auditoria"`/`"permisos"`~~ ✅ HECHO
  (`sections/admin.tsx`). Auditoría = toggles trazabilidad + políticas (retención,
  respaldo, aviso URL, responsable). Permisos = matriz rol×módulo, clic cicla
  all→read→none, persiste blob completo. Ambas admin-gated + `registerSave`.
  Migración `clinic_settings` ya aplicada en Lovable (commit `6cdfb9d`).
- ~~**Horarios** (7 días + excepciones)~~ ✅ HECHO (`sections/basic.tsx`).
  Decisión: JSONB en `clinic_settings/horarios` (NO tabla propia) — estructura acotada
  (7 días fijos + lista chica de excepciones), sin queries relacionales, cero migración.
  `semana[7]{activo,apertura,cierre,descanso}` + `excepciones[]{id,fecha,motivo,tipo}`.
  Excepciones add/edit/remove inmutables sobre el array. Admin-gated + `registerSave`.
- ~~**Checklists**~~ ✅ HECHO. Tabla `checklists` (`useChecklists.ts`,
  `sections/clinical.tsx`). CRUD por-fila: servicio, pasos, responsable,
  bloquear_avance, permitir_justificacion, activo. Admin-gated.
- ~~**Inventario**~~ ✅ HECHO. 3 pestañas reales (`sections/inventario.tsx`,
  extraída de `finance.tsx`):
  - **Insumos** → tabla `insumos` (`useInsumos.ts`): stock/mínimo/caducidad(date)/
    costo(centavos)/proveedor(FK opcional). Badge "Bajo" si stock < mínimo.
  - **Kits** → tabla `kits` (`useKits.ts`): v1 plano (costo/precio capturados,
    sin join a insumos). Margen derivado en UI. Futuro: tabla `kit_items` para
    calcular costo desde insumos reales.
  - **Proveedores** → tabla `proveedores` (`useProveedores.ts`).
  Helper compartido `lib/untypedTable.ts` para `.from()` de tablas aún no
  presentes en los tipos generados de Supabase (mismo patrón que
  `clinicSettingsRepository`).
  **⚠️ PENDIENTE APLICAR EN LOVABLE:** migración
  `20260605010000_checklists_and_inventario.sql` — prompt
  `"Apply pending Supabase migrations"`. Hasta aplicarla, las 4 tablas no
  existen y las secciones muestran error de carga.
- **Recursos**: ya vive en `/configuracion` (rooms) → NO cablear.

## Estado final (2026-06-05)
Todas las secciones de /ajustes tienen persistencia real. Solo queda aplicar la
migración `20260605010000` en Lovable. `tsc` + `eslint` en verde.
