# Task 2 report — devoluciones exigen PIN de supervisor

## Qué se hizo

1. **Migración** `supabase/migrations/20260716150100_pharmacy_register_return_pin.sql`
   (nuevo archivo, copiado literal del brief): `CREATE OR REPLACE FUNCTION
   public.pharmacy_register_return(p_payload jsonb)`. Reemplaza la validación
   de "rol admin/manager permite auto-autorización" por verificación server-side
   de PIN: exige `p_payload.supervisor_id` y `p_payload.supervisor_pin`, llama
   `PERFORM public.verify_supervisor_pin(v_clinic, v_authorized, v_pin)` (RPC de
   Task 1) y usa `v_authorized` (el supervisor) como `authorized_by`, nunca el
   cajero (`v_user`) que ejecuta la llamada. Incluye
   `REVOKE EXECUTE ... FROM PUBLIC` + `GRANT ... TO authenticated`.

2. **`src/features/farmacia/ReturnDialog.tsx`** modificado:
   - Import `useAuth` reemplazado por `import SupervisorPinDialog from
     "@/components/turno/SupervisorPinDialog"` (ya no se necesita `user.id`
     como `authorized_by`).
   - Quité `const { user } = useAuth();` (ya no se usa).
   - Nuevo state `pinDialogOpen`.
   - `handleSubmit()` original se dividió: `requestSubmit()` (valida
     `saleId`/`selectedLines`/`motivo`, abre el diálogo de PIN) y
     `handleSubmit(supervisorId, pin)` (arma el payload con
     `supervisor_id`/`supervisor_pin` en vez de `authorized_by: user.id`, y
     hace el RPC).
   - Botón del footer ahora llama `requestSubmit` en vez de `handleSubmit`.
   - Se agregó `<SupervisorPinDialog open={pinDialogOpen} clinicId={clinicId}
     onAuthorized={handleSubmit} onCancel={() => setPinDialogOpen(false)} />`
     dentro de `<Dialog>`, junto a `DialogContent` — coincide con la firma real
     de `SupervisorPinDialog` de Task 1 (`onAuthorized: (supervisorId, pin) =>
     void`), verificado leyendo el componente antes de escribir.

## Typecheck

Comando exacto corrido desde la raíz del worktree:

```
npx tsc --noEmit
```

Salida real: vacía (exit limpio, sin errores).

## Pasos NO ejecutados (sin credenciales Supabase en este entorno)

- Step 2 (`supabase db push --linked`) — no se aplicó la migración a ninguna
  DB. El archivo SQL está escrito y es el entregable de este paso, pero no fue
  verificado contra Postgres real.
- Step 5 (verificación manual en navegador: abrir Farmacia → Devoluciones,
  probar PIN incorrecto/correcto, y el `SELECT authorized_by, created_by FROM
  pharmacy_returns ...`) — no se ejecutó, requiere sesión autenticada y datos
  reales.

Estos dos pasos quedan pendientes para cuando se aplique la migración contra
el proyecto Supabase real (`kyfkvdyxpvpiacyymldc`).

## Verificación de cambios antes de commit

`git diff --stat --cached` mostró únicamente los dos archivos esperados:
- `src/features/farmacia/ReturnDialog.tsx` (27 líneas cambiadas)
- `supabase/migrations/20260716150100_pharmacy_register_return_pin.sql` (145
  líneas, archivo nuevo)

`.superpowers/sdd/task-1-report.md` (modificado por Task 1, preexistente) NO
se incluyó en el commit de esta tarea.

## Commit

`ee02262` — `feat: devoluciones exigen PIN de supervisor (segregación de funciones)`

## Concerns

- No se pudo correr la migración ni la verificación manual (sin credenciales
  Supabase en este entorno) — riesgo residual: un typo en SQL que `tsc` no
  detecta (es SQL, no TS) solo se descubre al aplicar la migración real. El
  SQL es una copia literal del brief, que ya fue diseñado/revisado como parte
  del plan, así que el riesgo es bajo pero no cero.
- El resto del repo tiene cambios sin commitear ajenos a esta tarea
  (`memoria/STATE.md`, `graphify-out/*`, `.superpowers/sdd/task-1-report.md`)
  — no tocados, tal como se pidió.

---

## (Contenido previo de este archivo, de una ejecución anterior con distinto alcance — conservado por referencia histórica, no aplica a este run)

# Task 2 Report: `clinic_has_modulo_access` (gating real, SECURITY DEFINER)

## Estado: DONE_WITH_CONCERNS

## Bloqueo inicial (Step 1) y decisión del coordinador

`catalogo_modulos` NO tenía columna `slug` (solo `id, nombre, descripcion, precio_centavos,
stripe_price_id, activo, created_at`). Reporté BLOCKED antes de escribir Step 2, como pedía
el brief. El coordinador decidió opción 2: agregar `slug text UNIQUE NOT NULL` a
`catalogo_modulos` en la misma migración, en vez de cambiar la firma de la función a
`p_modulo_id uuid`, para mantener consistencia con Tasks 5 (RLS policies) y 6 (frontend hook)
que ya asumen slugs legibles tipo `'compras'`, `'farmacia'`.

Los 5 módulos reales encontrados y sus slugs asignados:

| id | nombre | slug asignado |
|---|---|---|
| 6b09129e-6df7-4775-8db1-aaaad393a7aa | Agenda | `agenda` |
| 9e9966ea-d297-4a18-819f-efd799123bd9 | Almacén | `almacen` |
| 8b179da8-3034-4886-8a48-858c11db937a | Compras | `compras` |
| 3a8ca56b-3bee-4e53-b049-eb87c2bb82cc | Facturación CFDI | `facturacion_cfdi` |
| 39d5c7ec-c005-4078-b892-88d008b14214 | POS / Farmacia | `pos_farmacia` |

## Qué se implementó

Archivo: `supabase/migrations/20260709194627_clinic_has_modulo_access.sql`

1. `ALTER TABLE catalogo_modulos ADD COLUMN slug text` + 5 `UPDATE` (uno por módulo real) +
   `ALTER COLUMN slug SET NOT NULL` + `UNIQUE (slug)`.
2. Función `clinic_has_modulo_access(p_clinic_id uuid, p_modulo_slug text) RETURNS boolean`,
   `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`, exactamente la lógica del
   brief: `cliente_modulos.activo_hasta IS NULL OR activo_hasta > now()` (fecha, no solo
   existencia de fila), `clinics.subscription_status IN ('active','past_due','canceling')`,
   y para `past_due` exige `grace_period_ends_at > now()`.
3. `REVOKE EXECUTE ... FROM PUBLIC` + `GRANT ... TO authenticated`.
4. **Hallazgo agregado durante self-review** (no estaba en el brief): el `REVOKE FROM PUBLIC`
   NO bastaba. Supabase otorga EXECUTE a `anon`/`authenticated`/`service_role` vía default
   privileges del schema `public`, independiente de PUBLIC. `information_schema.role_routine_grants`
   mostró `anon` con EXECUTE tras aplicar la migración original. Corregí con
   `REVOKE EXECUTE ... FROM anon` (aplicado primero como migración separada en vivo para no
   perder tiempo, luego fusionado al archivo de migración único antes del commit, para que git
   refleje exactamente el estado desplegado).

## SQL ejecutado y resultados clave

Columnas reales confirmadas (Step 1):
- `catalogo_modulos`: `id, nombre, descripcion, precio_centavos, stripe_price_id, activo, created_at` (sin slug antes de esta migración)
- `cliente_modulos`: `id, clinic_id, modulo_id, activo_desde, activo_hasta`
- `clinics`: incluye `subscription_status, grace_period_ends_at, subscription_cancel_at` (de Task 1)

Grants finales (`information_schema.role_routine_grants`):
```
service_role | EXECUTE
authenticated | EXECUTE
postgres | EXECUTE
```
(`anon` ya no aparece — confirmado tras el fix.)

`pg_proc`: `prosecdef = true`, `proconfig = {search_path=public}` — confirmado SECURITY DEFINER
con search_path pinneado.

Verificación funcional (Step 3), usando datos reales en un `BEGIN; ... ROLLBACK;` para no
mutar producción (no había clínicas con `subscription_status = 'active'` en la data real —
solo `trialing` y `canceled` — así que simulé el caso positivo dentro de una transacción
revertida sobre una clínica `trialing` real):

- Clínica `canceled` + módulo `agenda` (sí contratado) → `false` (correcto, status no permitido)
- Slug inexistente (`nope_not_a_slug`) → `false` (correcto)
- Clínica temporalmente `active` (rollback) + módulo `agenda` contratado → `true` (correcto)
- Misma clínica + módulo `compras` NO contratado → `false` (correcto)

## get_advisors (security) — resumen

Output completo es grande (382k caracteres, mayormente hallazgos preexistentes no relacionados:
`pg_graphql_*_table_exposed` para casi todas las tablas del schema, funciones SECURITY DEFINER
preexistentes, etc.). Filtrado por lo introducido en esta migración:

- `clinic_has_modulo_access` aparece **una sola vez**: `authenticated_security_definer_function_executable`
  — esperado y buscado (la función debe ser invocable por `authenticated` para que Task 5 la use en
  RLS policies). No aparece en `anon_security_definer_function_executable` ni en
  `function_search_path_mutable`.
- `catalogo_modulos` aparece en los hallazgos genéricos `pg_graphql_*_table_exposed`, pero esa
  categoría ya existe para prácticamente todas las tablas públicas del schema — no es un hallazgo
  nuevo introducido por agregar la columna `slug`.

Ningún finding nuevo sin explicación.

## Archivos cambiados

- `supabase/migrations/20260709194627_clinic_has_modulo_access.sql` (nuevo)

## Commit

`b9227c4` — feat: función clinic_has_modulo_access para gating real por módulo

## Self-review

- Función retorna `true`/`false` correctamente para casos reales con y sin módulo — verificado.
- REVOKE/GRANT confirmado vía `information_schema.role_routine_grants` (solo
  `service_role`, `authenticated`, `postgres`; sin `anon`, sin PUBLIC implícito).
- `search_path` confirmado pinneado (`proconfig = {search_path=public}`).
- **Pendiente explícito**: el brief marca `ecc:security-reviewer` como agente obligatorio antes
  de mergear esta función (precedente: hallazgo crítico de `cfdi_get_secret`, auditoría
  2026-07-04). No lo ejecuté en este task — lo dejo señalado como bloqueante para el merge, no
  para el cierre de este task individual.

## Concerns

1. **No hay clínicas `active`/`past_due`/`canceling` en los datos reales actuales** (solo
   `trialing` y `canceled`). La verificación positiva se hizo con una transacción revertida
   sobre datos reales, no con una clínica persistente en ese estado — funcionalmente correcto,
   pero significa que hoy, en producción, esta función devolvería `false` para TODAS las
   clínicas reales incluyendo las `trialing`. Esto es fiel al brief (que no incluye `trialing`
   en la lista de estados permitidos) pero vale la pena confirmar con el dueño del producto si
   `trialing` debería tener acceso a módulos contratados — no lo cambié porque no estaba en el
   scope de este task ni en la especificación del brief.
2. `ecc:security-reviewer` obligatorio por el brief no se corrió en este task — recomendado antes
   de mergear a main.
3. El fix de `anon` no estaba en el brief original; lo añadí porque el checklist del proyecto
   (`CLAUDE.md`, sección SECURITY DEFINER) exige que el REVOKE/GRANT sea efectivo, no solo
   sintácticamente presente.

---

## Addendum: fix del hallazgo Important (cross-tenant disclosure oracle)

### Estado: DONE_WITH_CONCERNS

### El hallazgo

`security-reviewer` marcó `clinic_has_modulo_access` como Important: `SECURITY DEFINER` +
`GRANT EXECUTE TO authenticated`, pero sin ningún check de que el usuario que llama
(`auth.uid()`) pertenece a `p_clinic_id`. Cualquier usuario autenticado, de cualquier clínica,
podía invocar la función vía `/rest/v1/rpc/clinic_has_modulo_access` con un `p_clinic_id`
arbitrario y aprender el estado de módulos/suscripción de otro tenant — violación directa del
checklist obligatorio de `CLAUDE.md`, item 3 ("check de `clinic_memberships`/`auth.uid()` como
PRIMERA operación del body").

### Qué se cambió

Nueva migración (no se edita la ya aplicada, por convención del proyecto):
`supabase/migrations/20260709200000_clinic_has_modulo_access_tenant_check.sql`.

`CREATE OR REPLACE FUNCTION clinic_has_modulo_access(p_clinic_id uuid, p_modulo_slug text)`
ahora evalúa **primero** `public.user_has_clinic_access(auth.uid(), p_clinic_id)` con `AND`
antes del `EXISTS` de módulos/suscripción — si el usuario no pertenece a la clínica, la
expresión completa corto-circuita a `false` sin evaluar (ni filtrar) el estado de esa clínica.

### Por qué se reutilizó `user_has_clinic_access` en vez de un check inline

Se encontró el helper ya establecido (`public.user_has_clinic_access(_user_id uuid, _clinic_id uuid)`,
`SECURITY DEFINER`, `SET search_path = public`), definido originalmente en
`20260528150545_...sql` y reemplazado más recientemente en
`20260707120000_platform_staff_and_admin_leak_fix.sql` y
`20260708120000_clinics_saas_billing_columns.sql` (versión vigente, usada aquí). Es el patrón
establecido del proyecto para exactamente este check — usado en decenas de policies RLS
clinic-scoped (`checklists`, `proveedores`, `insumos`, `kits`, `kit_items`, `clinics`, etc. en
`20260606200000_inventory_rls_clinic_scoping.sql` y otras). Reutilizarlo es DRY y evita
reimplementar semántica de membresía que ya tiene su propia lógica de `is_global_admin` +
`clinic_memberships.status = 'active'` + `clinics.status = 'active'` +
`subscription_status <> 'canceled'` con grace period para `past_due`.

Nota: `user_has_clinic_access` es ligeramente más estricto que el check de suscripción propio
de `clinic_has_modulo_access` en un aspecto (exige también `clinics.status = 'active'`, columna
que `clinic_has_modulo_access` no miraba), pero los estados de `subscription_status` que
permite (`active`, `past_due` con grace, cualquier otro no-`canceled`) son un superset
compatible con `('active','past_due','canceling')` — no se detectó ningún caso legítimo que
antes retornara `true` y ahora retorne `false` por esta razón adicional; se señala igual como
posible endurecimiento marginal de comportamiento, no solo de seguridad.

### Verificación

No hay sesión de usuario autenticado real disponible desde el SQL editor (`auth.uid()` es
`NULL` fuera de un request context), así que se verificó la lógica de membresía llamando
`user_has_clinic_access` con pares `(user_id, clinic_id)` reales explícitos, vía `execute_sql`
de solo lectura (sin `BEGIN/ROLLBACK`, sin mutación):

1. Con un usuario `is_global_admin = true`: `access_own_clinic = true`,
   `access_foreign_clinic = true` — correcto (los admins globales ven cualquier clínica, por
   diseño de `user_has_clinic_access`, no es un bypass del fix).
2. Repetido excluyendo admins globales (`NOT is_global_admin`), con un miembro real
   `user_id = 6a987836-...` de la clínica `a63a7f60-...` (`clinic_memberships.status='active'`):
   `access_own_clinic = true`, `access_foreign_clinic` (clínica `607f2a33-...`, sin membresía)
   `= false`. **Esto confirma el fix**: un usuario no-admin sin membresía en una clínica ajena
   obtiene `false` — antes de este fix, `clinic_has_modulo_access` habría evaluado
   módulos/suscripción de esa clínica ajena sin ningún gate.

Limitación explícita: no se probó `clinic_has_modulo_access` completa con un JWT real de
usuario autenticado (requeriría una sesión de app, fuera del alcance de este fix vía MCP/SQL
editor). La verificación anterior aísla y confirma la pieza nueva (el gate de membresía) contra
datos reales; la lógica de módulos/suscripción no se tocó (es exactamente la misma `EXISTS` de
la migración original, ya verificada en el reporte principal de este task).

### `get_advisors(type="security")` — delta

Idéntico al estado anterior: sigue apareciendo exactamente el mismo hallazgo esperado,
`authenticated_security_definer_function_executable` para `clinic_has_modulo_access`
(`public.clinic_has_modulo_access(p_clinic_id uuid, p_modulo_slug text)` ejecutable por
`authenticated` vía `/rest/v1/rpc/clinic_has_modulo_access`). Este linter es ciego al cuerpo de
la función — solo detecta "SECURITY DEFINER + authenticated puede ejecutar", que sigue siendo
intencional (Task 5 necesita invocarla vía RPC/RLS). No aparece ningún hallazgo nuevo
introducido por este fix; el hallazgo Important original no es detectable por este linter (es
lógica de negocio dentro del body, no un problema de grants).

### Commit

Ver commit siguiente en el log de git de esta rama (mensaje: `fix: cross-tenant disclosure en
clinic_has_modulo_access — gate de membresía como primera operación`).

### Concerns (addendum)

1. Endurecimiento marginal de comportamiento señalado arriba (`clinics.status='active'`
   adicional vía `user_has_clinic_access`) — no se corrigió porque reusar el helper tal cual es
   el patrón correcto del proyecto (DRY, checklist `CLAUDE.md`); si se considera indeseado,
   la alternativa es un check inline solo de `clinic_memberships` sin pasar por
   `user_has_clinic_access`, pero eso reintroduce duplicación de lógica de membresía.
2. No se probó con una sesión JWT real de usuario autenticado vía RPC HTTP (`/rest/v1/rpc/...`)
   — solo se aisló y verificó la lógica SQL subyacente contra datos reales, como permite el
   brief cuando no hay sesión autenticada disponible.
3. `ecc:security-reviewer` no se re-ejecutó tras este fix puntual (fue el reviewer quien generó
   el hallazgo original); recomendable una pasada de confirmación antes de mergear a main.

---

## Fix: trim() on motivo

### El hallazgo

En `supabase/migrations/20260716150100_pharmacy_register_return_pin.sql`, el campo
`motivo` de `pharmacy_returns` se calculaba como
`COALESCE(NULLIF(p_payload->>'motivo',''),'Sin motivo especificado')` sin `trim()`.
Un payload con `motivo: "   "` (solo espacios) pasa `NULLIF(...,'')` como no-vacío
(la cadena no es literalmente `''`) y se guarda como whitespace literal en vez de
caer al fallback `'Sin motivo especificado'`. La RPC es invocable directamente por
cualquier usuario `authenticated` (`GRANT EXECUTE ... TO authenticated`), así que la
validación server-side no puede depender de que el cliente ya haya hecho trim —
viola la Global Constraint del plan: "Motivo/notas siempre trim() antes de validar
vacío — patrón ya usado en turno_fondo_movimiento".

### Qué se cambió

Línea 90 del mismo archivo, único cambio:

```sql
-- antes
COALESCE(NULLIF(p_payload->>'motivo',''),'Sin motivo especificado'),
-- después
COALESCE(NULLIF(trim(p_payload->>'motivo'),''),'Sin motivo especificado'),
```

### Revisión de consistencia (otros campos de texto en la misma función)

- `refund_method` viene de `v_refund_meth`, no de un `COALESCE(NULLIF(p_payload->>...,''),...)`
  contra texto libre del usuario — no aplica el mismo patrón, fuera de alcance del hallazgo.
- Los dos usos de `motivo` en `movimientos_inventario` (líneas 114/117) usan un literal fijo
  construido por el servidor (`'Devolución ref ' || v_return_id::text`), no input directo del
  payload — no requieren trim.
- Ningún otro campo en este archivo sigue el patrón `NULLIF(p_payload->>'x','')` sobre texto
  libre de usuario.

### Typecheck

Comando exacto corrido desde la raíz del worktree:

```
npx tsc --noEmit
```

Salida real: vacía (exit limpio, sin errores) — esperado, cambio es SQL-only.

### Verificación

Archivo SQL nuevo, nunca aplicado a ninguna base de datos (sin credenciales Supabase en
este entorno) — no hay migración en vivo que re-verificar. Cambio revisado por lectura
directa del archivo: la línea 90 ahora envuelve `p_payload->>'motivo'` en `trim()` antes
del `NULLIF`, consistente con el patrón ya usado en `turno_fondo_movimiento` referenciado
por el plan.

### Commit

Nuevo commit (no amend, para mantener historial claro por convención del proyecto):
`fix: trim motivo before empty-check in pharmacy_register_return`.
