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

---

## Supabase CLI + Migrations — addenda (added by /aprende 2026-06-24)

### Renombrar policy → DROP ambos nombres <!-- /aprende 2026-06-24 -->
```sql
DROP POLICY IF EXISTS "policy_old_name" ON tabla;
DROP POLICY IF EXISTS "policy_new_name" ON tabla;
CREATE POLICY "policy_new_name" ON tabla ...;
```

### Migration parcialmente aplicada → repair + re-push <!-- /aprende 2026-06-24 -->
1. `supabase migration repair --status reverted <version>`
2. Agregar `DROP ... IF EXISTS` (idempotencia)
3. `supabase db push --linked`

### --include-all: trigger específico <!-- /aprende 2026-06-24 -->
Usar cuando timestamps de nuevas migrations están intercalados entre timestamps ya registrados en historial remoto.

---

## Módulo Fidelización — Learnings (added by /aprende 2026-06-24)

### Normalizar teléfono a E.164 en registro POS <!-- /aprende 2026-06-24 -->
- loyalty_members.telefono debe almacenar `+52XXXXXXXXXX` (E.164), nunca 10 dígitos raw.
- Sin normalización, `telefono = auth.users.phone` nunca coincide y el wallet PWA devuelve vacío.

### LFPDPPP Art. 8 — consentimiento activo (opt-in) <!-- /aprende 2026-06-24 -->
- Checkboxes de consentimiento: iniciar desmarcados, interactivos, Submit bloqueado hasta check activo.
- Pre-checked + disabled = consentimiento inválido.

### RLS PWA: USING(true) es agujero en multi-tenant <!-- /aprende 2026-06-24 -->
- Scopear siempre: `USING(telefono = (SELECT phone FROM auth.users WHERE id = auth.uid()))`.
- Auditar todos los DML del cliente PWA — SELECT-only no cubre UPDATE.

### RPCs SECURITY DEFINER <!-- /aprende 2026-06-24 -->
- Incluir `SET search_path = public` en todas las RPCs SECURITY DEFINER.
- RPCs internas: `REVOKE EXECUTE ON FUNCTION nombre FROM PUBLIC`.

### pg_cron: scheduling idempotente <!-- /aprende 2026-06-24 -->
```sql
SELECT cron.unschedule('nombre-job');
SELECT cron.schedule('nombre-job', '0 2 * * *', $$ ... $$);
```

---

## Learnings (added by /aprende 2026-06-28)

### BI: tasaRetencion mide frecuencia intra-período, NO retención cross-período <!-- /aprende 2026-06-28 -->
- `tasaRetencion` = % pacientes con ≥2 citas dentro del período seleccionado.
- Label "Retención ≤90d" era incorrecto — implica cross-período.
- Fix: label "Pac. frecuentes" + suffix "≥2 citas/período". Sin cambio de lógica.
- Retención real (cross-período) es métrica diferente: pacientes con cita en período N que también tuvieron cita en N-1.

## Learnings (added by /aprende 2026-07-18)

- **CSP vive en `public/_headers`.** Todo script/widget de terceros nuevo debe agregarse ahí o queda bloqueado silenciosamente. Turnstile requiere `https://challenges.cloudflare.com` en `script-src` Y `frame-src`. Ojo: /login puede tardar ~1 min en reflejar headers nuevos por cache de edge. <!-- /aprende 2026-07-18 -->
- **`supabase.functions.invoke` NO lanza excepción.** Siempre revisar `{ data, error }` del retorno; un try/catch alrededor nunca detecta el fallo (bug real corregido en AdminUsuarios). <!-- /aprende 2026-07-18 -->
- **Staff de plataforma nuevo = `INSERT INTO platform_staff_pending (email) VALUES ('<email en minúsculas>')`.** Se promueve solo a `platform_staff` en su primer login Google (trigger JIT). Doctores/enfermeras: alta con email en AdminUsuarios y entran con Google, cero pasos manuales. <!-- /aprende 2026-07-18 -->
