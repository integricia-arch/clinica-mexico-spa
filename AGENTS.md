## Schema Drift — Mapeo de columnas reales (learnings Jun 22, 2026) <!-- /aprende 2026-06-22 -->

Columnas frecuentemente asumidas con nombres incorrectos. Siempre verificar contra `types.ts` generado.

### Tabla `patients`
- `apellidos` (no `apellido_paterno` / `apellido_materno`)
- `sexo` CHECK constraint: solo `'M'`, `'F'`, `'Otro'`

### Tabla `appointments`
- `motivo_consulta` (no `motivo`)
- `appointment_status` enum: NO incluye `"no_show"` — comparar con `(status as string) === "no_show"`

### Tabla `prescriptions`
- `prescription_number` (no `numero_receta`)
- `diagnosis` (no `diagnostico`)

### Tabla `recepciones_mercancia`
- `folio_recepcion` (no `folio`)

### Tabla `solicitudes_compra`
- `motivo` (no `descripcion`)

### Interface `ClinicLite` (useActiveClinic.tsx)
- `.name` (no `.nombre`) para nombre de clínica

### Tablas NO en `types.ts` → usar `untypedTable()`
`expediente_permissions`, `ordenes_compra_items`, `recepciones_items`, `recepciones_mercancia`, `facturas_proveedor`.

### Cast anti-patrón prohibido
`supabase.from("x" as never) as ReturnType<typeof supabase.from>` — NUNCA usar. Rompe cuando types.ts está correcto.
