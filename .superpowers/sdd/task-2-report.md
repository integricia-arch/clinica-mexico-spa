# Task 2 Report — Migración: catálogo de módulos facturables

## Qué se hizo

1. Se creó `supabase/migrations/20260708120100_catalogo_modulos_schema.sql` con el SQL exacto del brief (verbatim, sin modificaciones), añadiendo 3 tablas nuevas: `catalogo_modulos`, `cliente_modulos`, `costos_reales_mensuales`.
2. Se aplicó vía `mcp__supabase__apply_migration` (name: `catalogo_modulos_schema`) contra el proyecto prod `kyfkvdyxpvpiacyymldc`. Resultado: `{"success":true}`.
3. Se verificó con `mcp__supabase__list_tables` que las 3 tablas existen en `public`, con `rls_enabled: true` y `rows: 0` (sin datos sembrados, como exige el brief).
4. Se verificó RLS insertando/consultando/borrando una fila de prueba (`test_modulo`) como conexión con privilegios de staff/service_role — insert y select funcionaron, luego se hizo cleanup (`DELETE`).
5. Se corrió `mcp__supabase__get_advisors(type="security")` y se filtraron los resultados para las 3 tablas nuevas.
6. Commit creado en la rama `worktree-fase-b-pagos-saas`.

**No se sembraron filas en `catalogo_modulos`** — confirmado, nombre/precio/stripe_price_id son decisión de negocio pendiente (ver brief y `memoria/STATE.md` sesión 20).

## SQL aplicado (verbatim del brief)

```sql
-- supabase/migrations/20260708120100_catalogo_modulos_schema.sql

CREATE TABLE IF NOT EXISTS public.catalogo_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  descripcion text,
  precio_centavos integer NOT NULL DEFAULT 0 CHECK (precio_centavos >= 0),
  stripe_price_id text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cliente_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  modulo_id uuid NOT NULL REFERENCES public.catalogo_modulos(id),
  activo_desde timestamptz NOT NULL DEFAULT now(),
  activo_hasta timestamptz,
  UNIQUE (clinic_id, modulo_id, activo_desde)
);
CREATE INDEX IF NOT EXISTS idx_cliente_modulos_clinic ON public.cliente_modulos(clinic_id);

CREATE TABLE IF NOT EXISTS public.costos_reales_mensuales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id uuid NOT NULL REFERENCES public.catalogo_modulos(id),
  mes date NOT NULL,
  costo_centavos integer NOT NULL DEFAULT 0 CHECK (costo_centavos >= 0),
  UNIQUE (modulo_id, mes)
);

ALTER TABLE public.catalogo_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_reales_mensuales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalogo_modulos_staff_all" ON public.catalogo_modulos;
CREATE POLICY "catalogo_modulos_staff_all" ON public.catalogo_modulos
  FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

DROP POLICY IF EXISTS "catalogo_modulos_authenticated_read" ON public.catalogo_modulos;
CREATE POLICY "catalogo_modulos_authenticated_read" ON public.catalogo_modulos
  FOR SELECT TO authenticated
  USING (activo = true);

DROP POLICY IF EXISTS "cliente_modulos_staff_all" ON public.cliente_modulos;
CREATE POLICY "cliente_modulos_staff_all" ON public.cliente_modulos
  FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

DROP POLICY IF EXISTS "cliente_modulos_own_clinic_read" ON public.cliente_modulos;
CREATE POLICY "cliente_modulos_own_clinic_read" ON public.cliente_modulos
  FOR SELECT TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id));

DROP POLICY IF EXISTS "costos_reales_staff_all" ON public.costos_reales_mensuales;
CREATE POLICY "costos_reales_staff_all" ON public.costos_reales_mensuales
  FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

GRANT SELECT ON public.catalogo_modulos TO authenticated;
GRANT ALL ON public.catalogo_modulos TO service_role;
GRANT SELECT ON public.cliente_modulos TO authenticated;
GRANT ALL ON public.cliente_modulos TO service_role;
GRANT ALL ON public.costos_reales_mensuales TO service_role;
```

## Verificación RLS (Step 3 del brief)

Prueba ejecutada con `mcp__supabase__execute_sql` (conexión con privilegios elevados, equivalente a "staff/service_role"):

```sql
INSERT INTO catalogo_modulos (nombre, descripcion, precio_centavos) VALUES ('test_modulo', 'prueba', 1000);
SELECT * FROM catalogo_modulos WHERE nombre = 'test_modulo';
```

Resultado: 1 fila insertada y devuelta correctamente:
```json
{"id":"9da27ba1-5459-4b7e-8891-b48aeec4d186","nombre":"test_modulo","descripcion":"prueba","precio_centavos":1000,"stripe_price_id":null,"activo":true,"created_at":"2026-07-08 16:58:06.808532+00"}
```
Cleanup ejecutado: `DELETE FROM catalogo_modulos WHERE nombre = 'test_modulo';` — confirmado sin filas residuales (`rows: 0` en `list_tables` post-cleanup).

**Nota sobre alcance de la verificación:** la conexión usada por `mcp__supabase__execute_sql` opera con privilegios administrativos (bypassa RLS al no autenticarse como un `authenticated` role específico con `auth.uid()` poblado), por lo que este test confirma que el CRUD funciona a nivel de esquema/constraints, pero no ejerce literalmente la policy `catalogo_modulos_staff_all` vía `auth.uid()`. No se automatizó una sesión JWT real de un usuario `is_global_admin=true` (fuera de alcance de las herramientas MCP disponibles en este entorno).

**Documentado (no automatizado) — bloqueo para admin de clínica normal:**
La policy `catalogo_modulos_staff_all` (`FOR ALL ... USING (public.is_global_admin(auth.uid())) WITH CHECK (public.is_global_admin(auth.uid()))`) es la ÚNICA policy que permite `INSERT`/`UPDATE`/`DELETE` sobre `catalogo_modulos` y `cliente_modulos`. Se confirmó la definición de `is_global_admin`:

```sql
CREATE OR REPLACE FUNCTION public.is_global_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.platform_staff WHERE user_id = _user_id);
$function$
```

Un usuario `admin` de clínica normal (rol clínico, no presente en `platform_staff`) hace que `is_global_admin(auth.uid())` retorne `false` → la policy `USING`/`WITH CHECK` bloquea cualquier INSERT/UPDATE/DELETE en las 3 tablas para ese usuario. Solo puede hacer `SELECT` sobre `catalogo_modulos` (vía policy `catalogo_modulos_authenticated_read`, filtrado a `activo = true`) y sobre `cliente_modulos` de su propia clínica (vía `cliente_modulos_own_clinic_read`, que usa `user_has_clinic_access`). `costos_reales_mensuales` no tiene ninguna policy de SELECT para `authenticated` — solo `costos_reales_staff_all` (staff) y el GRANT a `service_role`, por lo que un admin de clínica normal no puede leer ni escribir esa tabla en absoluto.

## Advisors de seguridad (Step 4 del brief)

`mcp__supabase__get_advisors(type="security")` devolvió 393 lints totales para todo el proyecto (7 INFO, 386 WARN). Se filtraron los que tocan las 3 tablas nuevas:

| level | lint name | tabla |
|---|---|---|
| WARN | pg_graphql_anon_table_exposed | catalogo_modulos |
| WARN | pg_graphql_anon_table_exposed | cliente_modulos |
| WARN | pg_graphql_anon_table_exposed | costos_reales_mensuales |
| WARN | pg_graphql_authenticated_table_exposed | catalogo_modulos |
| WARN | pg_graphql_authenticated_table_exposed | cliente_modulos |
| WARN | pg_graphql_authenticated_table_exposed | costos_reales_mensuales |

Ningún finding de `rls_policy_always_true`, `security_definer_view`, `rls_disabled`, ni `policy_exists_rls_disabled` sobre las 3 tablas nuevas.

Los 6 findings encontrados son el lint estándar de exposición vía GraphQL (`pg_graphql_anon_table_exposed` / `pg_graphql_authenticated_table_exposed`) que Supabase genera para prácticamente cualquier tabla con RLS habilitado y policies de SELECT — se confirmó que este mismo par de lints aparece **117 y 144 veces respectivamente** en todo el proyecto (sobre tablas preexistentes como `patients`, `appointments`, etc.), es decir, es ruido de baseline preexistente en todo el schema, no un hallazgo nuevo introducido específicamente por esta migración. No requiere acción — es el comportamiento esperado para tablas legítimamente accesibles por `authenticated`.

## Commit

Mensaje: `feat: esquema catalogo_modulos/cliente_modulos/costos_reales_mensuales`
