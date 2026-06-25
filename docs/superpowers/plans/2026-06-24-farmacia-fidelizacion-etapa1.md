# Módulo Fidelización Farmacia — Etapa 1 MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo de puntos/monedero integrado en el POS de farmacia: afiliación en caja, acumulación automática por venta, PWA cliente con saldo + código de barras, panel admin de configuración y miembros, email de bienvenida.

**Architecture:** Nuevas tablas Supabase con RLS multi-tenant (`clinic_id`). RPCs SECURITY DEFINER para calcular puntos sin exponer service_role al frontend. Panel lateral en `PuntoDeVenta.tsx` existente. PWA cliente en ruta separada `/loyalty/{slug}` dentro del mismo Cloudflare Worker.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase (PostgreSQL + RLS + RPCs) + Resend (email) + `react-barcode` (código de barras) + vitest + **Motion (Emil Kowalski)** + **Geist (Vercel)** + **Vercel (PWA deploy)**

## Filosofía de Diseño

### Emil Kowalski — Micro-interactions & Motion
Spring physics sobre durations lineales. Cada interacción tiene respuesta inmediata + ease-out fluido. Referencias: [motion.dev](https://motion.dev), tarjetas con `whileHover`, botones con presión táctil (`whileTap: { scale: 0.97 }`), número de saldo con count-up animado al cargar.

### Huashu Design — Dashboard Density & Grid
Admin panel con grid 12 col, datos densos pero respirados. Tablas con hover rows de 40px, headers sticky, no card-wrapping innecesario — datos directos en superficie. Jerarquía visual por tamaño de tipo, no por color. Referencia: dashboards de [Linear](https://linear.app), [Vercel dashboard](https://vercel.com/dashboard).

### Vercel Design System — Typography & Tokens
Fuente: **Geist Sans** (variable font de Vercel, libre). Escala tipográfica estricta: 12/14/16/20/24/32/48px. Paleta tokens semánticos: `--color-success`, `--color-warning`, `--color-brand`. Modo oscuro first-class con CSS variables. Radius: 6px (cards) / 4px (inputs) / 9999px (badges). Shadow: solo `0 1px 3px rgba(0,0,0,.12)` — sin sombras dramáticas.

## Global Constraints

- Multi-tenant: toda tabla nueva tiene `clinic_id uuid NOT NULL REFERENCES clinics(id)` con RLS
- TypeScript strict: `tsc --noEmit` debe pasar en 0 errores antes de cada commit
- Inmutabilidad: no mutar estado directamente — usar spread/map
- `loyalty_movimientos` append-only: sin UPDATE ni DELETE en RLS
- Niveles calculados sobre puntos acumulados en últimos 12 meses (no histórico total)
- `permite_publicidad = false` por defecto en medicamentos controlados/receta
- 3 consentimientos LFPDPPP separados: privacidad (obligatorio), historial (obligatorio), marketing (opcional)
- Opt-out en un solo paso, sin confirmación
- Comandos: usar `bun` no `npm` (el proyecto usa bun)
- Tests: vitest, archivos en `src/test/` o `src/features/**/**.test.tsx`
- Commits: conventional (`feat:`, `fix:`, `test:`, `chore:`)

## Review Gates — Protocolo de Auditoría

Cada gate se corre **inmediatamente después del commit** del task indicado antes de avanzar. Los issues CRITICAL/HIGH bloquean el siguiente task hasta resolverse. MEDIUM/LOW se registran como tareas de deuda técnica.

### Severidades

| Nivel | Acción requerida |
|-------|-----------------|
| CRITICAL | Detener. Corregir antes de continuar. |
| HIGH | Corregir en el mismo task o crear fix-task inmediato. |
| MEDIUM | Registrar — resolver antes del deploy final. |
| LOW | Registrar — resolver en siguiente iteración. |

### Agentes disponibles por dominio

| Agente | Dominio | Cuándo usar |
|--------|---------|-------------|
| `claude-db:schema-integrity-auditor` | Normalización, FKs, naming, RLS, multi-tenant | Después de migrations DB |
| `claude-db:migration-safety-auditor` | Lock levels, reversibilidad, operaciones destructivas | Después de migrations DB |
| `claude-db:performance-scale-auditor` | Índices, query patterns, pg_cron, conexiones | Después de migrations + RPCs |
| `caveman:cavecrew-reviewer` | Code quality, mutations, error paths, dead code | Después de cada task de código |
| Security Agent (`subagent_type: claude`) | OWASP top 10, LFPDPPP compliance, secrets, XSS, SQL injection | Después de RPCs, panel POS, PWA, email |

### Checklist de seguridad base (aplica a todos los gates de código)

```
[ ] No hardcoded secrets (API keys, tokens, passwords)
[ ] Inputs sanitizados antes de queries Supabase (no string interpolation en .eq/.ilike)
[ ] XSS: sin dangerouslySetInnerHTML, sin innerHTML no sanitizado
[ ] RLS activo en todas las tablas nuevas
[ ] SECURITY DEFINER RPCs: sin parámetros que permitan inyección
[ ] LFPDPPP: consentimientos registrados con timestamp y versión
[ ] Opt-out accesible en 1 paso, sin confirmación extra
[ ] Email HTML: sin contenido de usuario sin sanitizar en templates
[ ] localStorage: sin datos médicos ni credenciales sensibles
[ ] Errores: no exponen stack traces ni detalles internos al usuario
```

---

## Mapa de Archivos

### Nuevos
```
supabase/migrations/20260624000001_loyalty_tables.sql
supabase/migrations/20260624000002_loyalty_rpcs.sql
supabase/migrations/20260624000003_medicamentos_permite_publicidad.sql
src/features/lealtad/types.ts
src/features/lealtad/hooks/useLoyaltyConfig.ts
src/features/lealtad/hooks/useLoyaltyMember.ts
src/features/lealtad/LoyaltyPanel.tsx          ← panel en POS
src/features/lealtad/LoyaltyAfiliacionModal.tsx ← registro nuevo miembro
src/features/lealtad/LoyaltyConfig.tsx          ← admin: configurar reglas
src/features/lealtad/LoyaltyMiembros.tsx        ← admin: lista miembros
src/pages/Lealtad.tsx                           ← página admin con tabs
src/pwa/LoyaltyApp.tsx                          ← root PWA cliente
src/pwa/pages/Inicio.tsx
src/pwa/pages/Monedero.tsx
src/pwa/pages/Promos.tsx
src/pwa/pages/Cuenta.tsx
src/pwa/components/BottomNav.tsx
src/pwa/hooks/useLoyaltyPWA.ts
supabase/functions/loyalty-send-welcome/index.ts
src/test/lealtad/loyalty-points.test.ts
src/test/lealtad/loyalty-panel.test.tsx
src/test/lealtad/loyalty-pwa.test.tsx
```

### Modificados
```
src/features/farmacia/PuntoDeVenta.tsx    ← añadir LoyaltyPanel
src/App.tsx                               ← rutas /lealtad y /loyalty/:slug
src/components/AppLayout.tsx              ← nav "Lealtad" para admin/manager
```

---

## Task 1: Migrations — Tablas y Columna

**Files:**
- Create: `supabase/migrations/20260624000001_loyalty_tables.sql`
- Create: `supabase/migrations/20260624000003_medicamentos_permite_publicidad.sql`

**Interfaces:**
- Produces: tablas `loyalty_members`, `loyalty_movimientos`, `loyalty_config`, `loyalty_planes`, `loyalty_planes_progreso`, `loyalty_campanas`; columna `medicamentos.permite_publicidad`

- [ ] **Step 1: Crear migration tablas principales**

```sql
-- supabase/migrations/20260624000001_loyalty_tables.sql

-- Columna permite_publicidad en medicamentos
ALTER TABLE medicamentos ADD COLUMN IF NOT EXISTS permite_publicidad boolean NOT NULL DEFAULT false;
-- Medicamentos OTC (sin receta y no controlados) pueden ser publicidad
UPDATE medicamentos SET permite_publicidad = true
  WHERE requires_prescription = false
    AND is_controlled = false;

-- Config del programa por clínica
CREATE TABLE loyalty_config (
  clinic_id                    uuid PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
  nombre_programa              text NOT NULL DEFAULT 'Monedero Farmacia',
  slug_farmacia                text NOT NULL UNIQUE,
  color_primario               text NOT NULL DEFAULT '#1a56db',
  logo_url                     text,
  pesos_por_punto              numeric(10,2) NOT NULL DEFAULT 10.00,
  valor_punto_mxn              numeric(10,4) NOT NULL DEFAULT 0.10,
  puntos_minimos_canje         integer NOT NULL DEFAULT 100,
  nivel_plata_umbral           integer NOT NULL DEFAULT 500,
  nivel_oro_umbral             integer NOT NULL DEFAULT 1500,
  nivel_diamante_umbral        integer NOT NULL DEFAULT 4000,
  multiplicador_plata          numeric(4,2) NOT NULL DEFAULT 1.10,
  multiplicador_oro            numeric(4,2) NOT NULL DEFAULT 1.25,
  multiplicador_diamante       numeric(4,2) NOT NULL DEFAULT 1.50,
  expiracion_dias_inactividad  integer NOT NULL DEFAULT 180,
  programa_activo              boolean NOT NULL DEFAULT false,
  actualizado_at               timestamptz NOT NULL DEFAULT now()
);

-- Miembros del programa
CREATE TABLE loyalty_members (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                   uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  patient_id                  uuid REFERENCES patients(id) ON DELETE SET NULL,
  nombre                      text NOT NULL,
  telefono                    text,
  email                       text,
  fecha_nacimiento            date,
  codigo_barras               text NOT NULL UNIQUE,
  nivel                       text NOT NULL DEFAULT 'bronce'
                              CHECK (nivel IN ('bronce','plata','oro','diamante')),
  puntos_disponibles          integer NOT NULL DEFAULT 0 CHECK (puntos_disponibles >= 0),
  puntos_acumulados_historico integer NOT NULL DEFAULT 0,
  consent_privacidad          boolean NOT NULL DEFAULT false,
  consent_privacidad_at       timestamptz,
  consent_historial_compras   boolean NOT NULL DEFAULT false,
  consent_historial_at        timestamptz,
  consent_marketing           boolean NOT NULL DEFAULT false,
  consent_marketing_at        timestamptz,
  consent_marketing_canales   text[] DEFAULT '{}',
  consent_version             text,
  activo                      boolean NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, email),
  UNIQUE (clinic_id, telefono)
);

-- Movimientos de puntos (append-only)
CREATE TABLE loyalty_movimientos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  member_id        uuid NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  tipo             text NOT NULL
                   CHECK (tipo IN ('acumulacion','canje','vencimiento','bonus','ajuste','referido')),
  puntos           integer NOT NULL,
  saldo_post       integer NOT NULL,
  pharmacy_sale_id uuid REFERENCES pharmacy_sales(id) ON DELETE SET NULL,
  plan_id          uuid REFERENCES loyalty_planes(id) ON DELETE SET NULL,
  descripcion      text,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Planes de lealtad (3x1, puntos dobles, etc.)
CREATE TABLE loyalty_planes (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                 uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  nombre                    text NOT NULL,
  descripcion               text,
  tipo                      text NOT NULL
                            CHECK (tipo IN ('compras_frecuentes','puntos_bonus','descuento_directo')),
  medicamento_id            uuid REFERENCES medicamentos(id) ON DELETE SET NULL,
  categoria_medicamento     text,
  meta_cantidad             integer,
  recompensa_tipo           text NOT NULL
                            CHECK (recompensa_tipo IN ('producto_gratis','puntos','descuento_pct','descuento_mxn')),
  recompensa_valor          numeric(10,2),
  recompensa_medicamento_id uuid REFERENCES medicamentos(id) ON DELETE SET NULL,
  vigencia_inicio           date,
  vigencia_fin              date,
  activo                    boolean NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- Progreso de miembros en planes
CREATE TABLE loyalty_planes_progreso (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id               uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  member_id               uuid NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  plan_id                 uuid NOT NULL REFERENCES loyalty_planes(id) ON DELETE CASCADE,
  avance_actual           integer NOT NULL DEFAULT 0,
  completado_at           timestamptz,
  recompensa_entregada    boolean NOT NULL DEFAULT false,
  recompensa_entregada_at timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, plan_id)
);

-- Campañas y boletines
CREATE TABLE loyalty_campanas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  titulo         text NOT NULL,
  descripcion    text,
  imagen_url     text,
  tipo           text NOT NULL CHECK (tipo IN ('oferta','boletin','evento','reactivacion')),
  segmento       text NOT NULL DEFAULT 'todos'
                 CHECK (segmento IN ('todos','bronce','plata','oro','diamante','inactivos_30d','inactivos_60d')),
  canal_email    boolean NOT NULL DEFAULT true,
  canal_telegram boolean NOT NULL DEFAULT false,
  canal_inapp    boolean NOT NULL DEFAULT true,
  programado_at  timestamptz,
  enviado_at     timestamptz,
  estado         text NOT NULL DEFAULT 'borrador'
                 CHECK (estado IN ('borrador','programada','enviando','enviada','cancelada')),
  destinatarios  integer,
  aperturas      integer DEFAULT 0,
  created_by     uuid REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_loyalty_members_clinic ON loyalty_members(clinic_id);
CREATE INDEX idx_loyalty_members_telefono ON loyalty_members(clinic_id, telefono) WHERE telefono IS NOT NULL;
CREATE INDEX idx_loyalty_members_email ON loyalty_members(clinic_id, email) WHERE email IS NOT NULL;
CREATE INDEX idx_loyalty_movimientos_member ON loyalty_movimientos(member_id, created_at DESC);
CREATE INDEX idx_loyalty_movimientos_clinic ON loyalty_movimientos(clinic_id, created_at DESC);
CREATE INDEX idx_loyalty_planes_clinic ON loyalty_planes(clinic_id) WHERE activo = true;

-- Trigger updated_at en loyalty_members
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_loyalty_members_updated_at
  BEFORE UPDATE ON loyalty_members
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- RLS
ALTER TABLE loyalty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_planes_progreso ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_campanas ENABLE ROW LEVEL SECURITY;

-- loyalty_config: solo admin/manager de la clínica
CREATE POLICY "loyalty_config_clinic_member" ON loyalty_config
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

-- loyalty_members: admin/manager CRUD; anon puede leer por codigo_barras (para PWA)
CREATE POLICY "loyalty_members_staff" ON loyalty_members
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships WHERE user_id = auth.uid()
    )
  );

-- loyalty_movimientos: staff puede leer/insertar, no UPDATE/DELETE
CREATE POLICY "loyalty_mov_select" ON loyalty_movimientos
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM clinic_memberships WHERE user_id = auth.uid())
  );
CREATE POLICY "loyalty_mov_insert" ON loyalty_movimientos
  FOR INSERT WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM clinic_memberships WHERE user_id = auth.uid())
  );

-- loyalty_planes, progreso, campanas: admin/manager
CREATE POLICY "loyalty_planes_staff" ON loyalty_planes
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships
      WHERE user_id = auth.uid() AND role IN ('admin','manager','farmacista','cajero')
    )
  );
CREATE POLICY "loyalty_progreso_staff" ON loyalty_planes_progreso
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM clinic_memberships WHERE user_id = auth.uid())
  );
CREATE POLICY "loyalty_campanas_staff" ON loyalty_campanas
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );
```

- [ ] **Step 2: Aplicar migration**

```bash
supabase db push --linked --include-all
```
Expected: migration aplicada sin errores.

- [ ] **Step 3: Verificar tablas en Supabase**

```bash
supabase db query --linked "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'loyalty%' ORDER BY table_name;"
```
Expected: 6 filas (loyalty_campanas, loyalty_config, loyalty_members, loyalty_movimientos, loyalty_planes, loyalty_planes_progreso).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260624000001_loyalty_tables.sql
git commit -m "chore: add loyalty module DB migrations — 6 tables + RLS"
```

---

## Gate R1: Auditoría DB Schema (después de Task 1)

**Bloquea Task 2 si hay findings CRITICAL/HIGH sin resolver.**

- [ ] **R1-A: Schema integrity** — lanzar `claude-db:schema-integrity-auditor`

  Prompt al agente:
  ```
  Audita supabase/migrations/20260624000001_loyalty_tables.sql.
  Revisar: normalización (6 tablas loyalty), estrategia PK (uuid), integridad referencial
  (FKs a clinics/patients/pharmacy_sales/auth.users), tipos/precisión (numeric, text CHECK),
  constraints/defaults, naming convention, multi-tenant (clinic_id en todas las tablas),
  RLS policies (¿cubren todos los roles: admin/manager/cajero/anon?),
  columnas temporales (created_at/updated_at con DEFAULT now()),
  loyalty_movimientos append-only (¿RLS bloquea UPDATE/DELETE?).
  Reporta findings con severidad CRITICAL/HIGH/MEDIUM/LOW.
  ```

- [ ] **R1-B: Migration safety** — lanzar `claude-db:migration-safety-auditor`

  Prompt al agente:
  ```
  Audita supabase/migrations/20260624000001_loyalty_tables.sql.
  Revisar: nivel de lock (ACCESS EXCLUSIVE en CREATE TABLE/ALTER TABLE),
  reversibilidad (¿existe migration DOWN o instrucciones rollback?),
  operaciones destructivas (UPDATE masivo en medicamentos.permite_publicidad — ¿impacto en tabla grande?),
  idempotencia (IF NOT EXISTS, ADD COLUMN IF NOT EXISTS),
  seguridad en cron job (loyalty_expire_points — ¿quién puede ejecutarlo?).
  Reporta findings con severidad.
  ```

- [ ] **R1-C: Performance & indexes** — lanzar `claude-db:performance-scale-auditor`

  Prompt al agente:
  ```
  Audita supabase/migrations/20260624000001_loyalty_tables.sql.
  Revisar: cobertura de índices (¿las queries de búsqueda en loyalty_members por telefono/email/clinic_id
  usan los índices creados?), falta de índices en loyalty_movimientos (member_id + created_at DESC para
  historial), índice en loyalty_planes (clinic_id WHERE activo=true), hot-spot en puntos_disponibles
  (UPDATE frecuente en loyalty_members — ¿contention?), estrategia de particionado para
  loyalty_movimientos a largo plazo.
  Reporta findings con severidad.
  ```

- [ ] **R1-D: Resolver findings CRITICAL/HIGH antes de continuar**

  Para cada finding CRITICAL/HIGH: crear fix en la migration o nueva migration.
  Findings MEDIUM/LOW: documentar en sección "Deuda Técnica" al final del plan.

---

## Task 2: RPCs — Calcular Puntos y Canjear

**Files:**
- Create: `supabase/migrations/20260624000002_loyalty_rpcs.sql`

**Interfaces:**
- Consumes: tablas de Task 1
- Produces:
  - `loyalty_register_sale(p_sale_id uuid, p_member_id uuid, p_clinic_id uuid) → json`
  - `loyalty_redeem(p_member_id uuid, p_clinic_id uuid, p_puntos integer) → json`
  - `loyalty_generate_barcode(p_clinic_id uuid) → text`
  - `loyalty_recalculate_level(p_member_id uuid) → text`

- [ ] **Step 1: Crear migration RPCs**

```sql
-- supabase/migrations/20260624000002_loyalty_rpcs.sql

-- Genera código de barras único: {3-char clinic prefix}{10 digits}
CREATE OR REPLACE FUNCTION loyalty_generate_barcode(p_clinic_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefix text;
  v_code   text;
  v_exists boolean;
BEGIN
  SELECT UPPER(LEFT(REGEXP_REPLACE(nombre, '[^A-Za-z]', '', 'g'), 3))
    INTO v_prefix FROM clinics WHERE id = p_clinic_id;
  IF v_prefix IS NULL THEN v_prefix := 'FAR'; END IF;
  LOOP
    v_code := v_prefix || LPAD(FLOOR(RANDOM() * 9999999999)::text, 10, '0');
    SELECT EXISTS(SELECT 1 FROM loyalty_members WHERE codigo_barras = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

-- Recalcula nivel según puntos acumulados en últimos 12 meses
CREATE OR REPLACE FUNCTION loyalty_recalculate_level(p_member_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_clinic_id  uuid;
  v_puntos_12m integer;
  v_cfg        loyalty_config%ROWTYPE;
  v_nivel      text;
BEGIN
  SELECT clinic_id INTO v_clinic_id FROM loyalty_members WHERE id = p_member_id;
  SELECT * INTO v_cfg FROM loyalty_config WHERE clinic_id = v_clinic_id;

  SELECT COALESCE(SUM(puntos), 0) INTO v_puntos_12m
    FROM loyalty_movimientos
   WHERE member_id = p_member_id
     AND tipo = 'acumulacion'
     AND created_at >= now() - interval '12 months';

  v_nivel := CASE
    WHEN v_puntos_12m >= v_cfg.nivel_diamante_umbral THEN 'diamante'
    WHEN v_puntos_12m >= v_cfg.nivel_oro_umbral      THEN 'oro'
    WHEN v_puntos_12m >= v_cfg.nivel_plata_umbral    THEN 'plata'
    ELSE 'bronce'
  END;

  UPDATE loyalty_members SET nivel = v_nivel WHERE id = p_member_id;
  RETURN v_nivel;
END;
$$;

-- Registra puntos por venta
CREATE OR REPLACE FUNCTION loyalty_register_sale(
  p_sale_id   uuid,
  p_member_id uuid,
  p_clinic_id uuid
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cfg              loyalty_config%ROWTYPE;
  v_member           loyalty_members%ROWTYPE;
  v_sale_total       numeric;
  v_multiplicador    numeric := 1.0;
  v_puntos_ganados   integer;
  v_saldo_nuevo      integer;
  v_nivel_nuevo      text;
BEGIN
  -- Config del programa
  SELECT * INTO v_cfg FROM loyalty_config
   WHERE clinic_id = p_clinic_id AND programa_activo = true;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'programa_inactivo');
  END IF;

  -- Miembro activo
  SELECT * INTO v_member FROM loyalty_members
   WHERE id = p_member_id AND clinic_id = p_clinic_id AND activo = true;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'miembro_no_encontrado');
  END IF;

  -- Total de la venta
  SELECT total INTO v_sale_total FROM pharmacy_sales WHERE id = p_sale_id;
  IF v_sale_total IS NULL OR v_sale_total <= 0 THEN
    RETURN json_build_object('ok', false, 'error', 'venta_invalida');
  END IF;

  -- Multiplicador por nivel
  v_multiplicador := CASE v_member.nivel
    WHEN 'diamante' THEN v_cfg.multiplicador_diamante
    WHEN 'oro'      THEN v_cfg.multiplicador_oro
    WHEN 'plata'    THEN v_cfg.multiplicador_plata
    ELSE 1.0
  END;

  -- Calcular puntos (truncar hacia abajo)
  v_puntos_ganados := FLOOR((v_sale_total / v_cfg.pesos_por_punto) * v_multiplicador);

  IF v_puntos_ganados <= 0 THEN
    RETURN json_build_object('ok', true, 'puntos_ganados', 0,
      'saldo_nuevo', v_member.puntos_disponibles, 'nivel', v_member.nivel);
  END IF;

  -- Actualizar saldo
  UPDATE loyalty_members
     SET puntos_disponibles          = puntos_disponibles + v_puntos_ganados,
         puntos_acumulados_historico = puntos_acumulados_historico + v_puntos_ganados
   WHERE id = p_member_id
   RETURNING puntos_disponibles INTO v_saldo_nuevo;

  -- Insertar movimiento
  INSERT INTO loyalty_movimientos
    (clinic_id, member_id, tipo, puntos, saldo_post, pharmacy_sale_id, descripcion)
  VALUES
    (p_clinic_id, p_member_id, 'acumulacion', v_puntos_ganados, v_saldo_nuevo,
     p_sale_id, 'Compra registrada');

  -- Recalcular nivel
  v_nivel_nuevo := loyalty_recalculate_level(p_member_id);

  RETURN json_build_object(
    'ok', true,
    'puntos_ganados', v_puntos_ganados,
    'saldo_nuevo', v_saldo_nuevo,
    'nivel', v_nivel_nuevo
  );
END;
$$;

-- Canjear puntos como descuento
CREATE OR REPLACE FUNCTION loyalty_redeem(
  p_member_id uuid,
  p_clinic_id uuid,
  p_puntos    integer
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cfg          loyalty_config%ROWTYPE;
  v_member       loyalty_members%ROWTYPE;
  v_descuento    numeric;
  v_saldo_nuevo  integer;
BEGIN
  SELECT * INTO v_cfg FROM loyalty_config WHERE clinic_id = p_clinic_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'config_no_encontrada');
  END IF;

  SELECT * INTO v_member FROM loyalty_members
   WHERE id = p_member_id AND clinic_id = p_clinic_id AND activo = true;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'miembro_no_encontrado');
  END IF;

  IF p_puntos < v_cfg.puntos_minimos_canje THEN
    RETURN json_build_object('ok', false, 'error', 'minimo_no_alcanzado',
      'minimo', v_cfg.puntos_minimos_canje);
  END IF;

  IF v_member.puntos_disponibles < p_puntos THEN
    RETURN json_build_object('ok', false, 'error', 'saldo_insuficiente',
      'disponibles', v_member.puntos_disponibles);
  END IF;

  v_descuento := p_puntos * v_cfg.valor_punto_mxn;

  UPDATE loyalty_members
     SET puntos_disponibles = puntos_disponibles - p_puntos
   WHERE id = p_member_id
   RETURNING puntos_disponibles INTO v_saldo_nuevo;

  INSERT INTO loyalty_movimientos
    (clinic_id, member_id, tipo, puntos, saldo_post, descripcion)
  VALUES
    (p_clinic_id, p_member_id, 'canje', -p_puntos, v_saldo_nuevo,
     'Canje en punto de venta');

  RETURN json_build_object(
    'ok', true,
    'descuento_mxn', v_descuento,
    'saldo_nuevo', v_saldo_nuevo
  );
END;
$$;

-- Vencimiento de puntos (pg_cron job)
CREATE OR REPLACE FUNCTION loyalty_expire_points()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_member RECORD;
  v_cfg    loyalty_config%ROWTYPE;
  v_ultimo timestamptz;
BEGIN
  FOR v_member IN
    SELECT m.id, m.clinic_id, m.puntos_disponibles
      FROM loyalty_members m
     WHERE m.activo = true AND m.puntos_disponibles > 0
  LOOP
    SELECT * INTO v_cfg FROM loyalty_config WHERE clinic_id = v_member.clinic_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    SELECT MAX(created_at) INTO v_ultimo
      FROM loyalty_movimientos
     WHERE member_id = v_member.id AND tipo IN ('acumulacion','canje','bonus');

    IF v_ultimo IS NULL OR
       v_ultimo < now() - (v_cfg.expiracion_dias_inactividad || ' days')::interval THEN
      UPDATE loyalty_members SET puntos_disponibles = 0 WHERE id = v_member.id;
      INSERT INTO loyalty_movimientos
        (clinic_id, member_id, tipo, puntos, saldo_post, descripcion)
      VALUES
        (v_member.clinic_id, v_member.id, 'vencimiento',
         -v_member.puntos_disponibles, 0, 'Vencimiento por inactividad');
    END IF;
  END LOOP;
END;
$$;

-- pg_cron: expiración diaria 07:00 CST (13:00 UTC)
SELECT cron.schedule(
  'loyalty-expire-points',
  '0 13 * * *',
  $$SELECT loyalty_expire_points();$$
);

-- Permisos
GRANT EXECUTE ON FUNCTION loyalty_register_sale(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION loyalty_redeem(uuid,uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION loyalty_generate_barcode(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION loyalty_recalculate_level(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION loyalty_expire_points() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION loyalty_expire_points() TO service_role;
```

- [ ] **Step 2: Aplicar migration**

```bash
supabase db push --linked --include-all
```

- [ ] **Step 3: Smoke test RPCs**

```bash
supabase db query --linked "SELECT loyalty_generate_barcode('00000000-0000-0000-0000-000000000000'::uuid);"
```
Expected: string tipo `FAR0123456789` (el UUID de prueba dará `FAR` prefix).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260624000002_loyalty_rpcs.sql
git commit -m "feat: add loyalty RPCs — register_sale, redeem, expire, level calc"
```

---

## Gate R2: Auditoría Seguridad RPCs + Performance (después de Task 2)

**Bloquea Task 3 si hay findings CRITICAL/HIGH sin resolver.**

- [ ] **R2-A: Security review RPCs** — lanzar Agent con `subagent_type: claude` desde `C:\Users\pablo\clinica-mexico-spa`

  Prompt al agente:
  ```
  Eres un security reviewer especializado en Supabase PostgreSQL.
  Audita supabase/migrations/20260624000002_loyalty_rpcs.sql.

  Checklist obligatorio:
  1. SECURITY DEFINER: ¿search_path está fijo (SET search_path = public)?
     Sin esto, un atacante con schema propio puede hacer schema poisoning.
  2. Inyección SQL: ¿algún parámetro p_* se usa en string interpolation o EXECUTE?
     Verificar que todos los parámetros se pasan como $1/$2 en queries parametrizadas.
  3. loyalty_register_sale: ¿verifica que p_sale_id pertenece a p_clinic_id antes de leer total?
     Un usuario podría pasar un sale_id de otra clínica.
  4. loyalty_redeem: ¿es atómico? ¿hay race condition entre leer puntos_disponibles y hacer UPDATE?
     Verificar que UPDATE usa WHERE puntos_disponibles >= p_puntos (not a separate SELECT first).
  5. loyalty_expire_points: REVOKE PUBLIC — ¿solo service_role puede ejecutar?
  6. pg_cron job: ¿el job corre como qué rol? ¿puede acceder a tablas de otras clínicas?
  7. loyalty_generate_barcode: ¿RANDOM() es suficiente para no-adivinable o se necesita gen_random_bytes?
  8. GRANT EXECUTE: ¿solo authenticated o también anon?

  Reporta cada finding con: función afectada, línea, severidad (CRITICAL/HIGH/MEDIUM/LOW), fix sugerido.
  ```

- [ ] **R2-B: Performance RPCs** — lanzar `claude-db:performance-scale-auditor`

  Prompt al agente:
  ```
  Audita supabase/migrations/20260624000002_loyalty_rpcs.sql.
  Revisar:
  - loyalty_register_sale: ¿cuántas queries hace? ¿puede reducirse con CTEs?
  - loyalty_expire_points: itera TODOS los miembros activos — ¿qué pasa con 100K+ miembros?
    ¿Necesita LIMIT + offset o cursores para procesar en lotes?
  - loyalty_recalculate_level: se llama dentro de loyalty_register_sale — ¿query anidada es eficiente?
  - pg_cron a las 07:00 CST: ¿coincide con hora pico de ventas? Recomendar ventana de menor carga.
  Reporta findings con severidad.
  ```

- [ ] **R2-C: Resolver findings CRITICAL/HIGH**

  Fix más común esperado: añadir `SET search_path = public` a cada función SECURITY DEFINER.
  Ejemplo:
  ```sql
  CREATE OR REPLACE FUNCTION loyalty_register_sale(...)
  RETURNS json
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
  AS $$ ... $$;
  ```

---

## Task 2.5: Design System — Visual Identity + Motion Tokens

**Files:**
- Create: `src/styles/loyalty-tokens.css`
- Create: `src/features/lealtad/design/motion.ts`
- Create: `src/features/lealtad/design/tokens.ts`
- Create: `src/features/lealtad/design/NivelCard.tsx`

**Interfaces:**
- Produces: tokens CSS + constantes Motion + componente `<NivelCard>` reutilizado en PWA y POS

**Referentes:**
- Emil Kowalski: spring motion, magnetic hover, número animado
- Huashu Design: grid denso, tipo escalonado, sin decoración inútil
- Vercel: Geist font, tokens semánticos, modo oscuro

- [ ] **Step 1: Instalar dependencias de diseño**

```bash
bun add motion geist
```

Motion = biblioteca oficial Emil Kowalski (antes Framer Motion standalone).
Geist = fuente variable de Vercel.

- [ ] **Step 2: Configurar Geist en index.html/global CSS**

En `src/index.css` (o el archivo global existente), añadir al inicio:

```css
/* Geist — Vercel variable font */
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&display=swap');
```

O si ya hay un `@font-face` setup, añadir Geist como variable:

```css
:root {
  --font-sans: 'Geist', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, monospace;
}
```

En `tailwind.config.ts`, añadir en `theme.extend.fontFamily`:

```typescript
fontFamily: {
  sans: ['var(--font-sans)', 'ui-sans-serif'],
  mono: ['var(--font-mono)', 'ui-monospace'],
},
```

- [ ] **Step 3: Crear loyalty-tokens.css**

```css
/* src/styles/loyalty-tokens.css */
:root {
  /* Brand — Farmacia Premium */
  --loyalty-brand:        #0f766e;   /* teal-700 — salud + dinero */
  --loyalty-brand-light:  #14b8a6;   /* teal-400 */
  --loyalty-brand-dark:   #0d5c56;
  --loyalty-accent:       #d97706;   /* amber-600 — oro/premium */
  --loyalty-accent-light: #fbbf24;   /* amber-400 */

  /* Niveles */
  --loyalty-bronce:   #92400e;
  --loyalty-plata:    #64748b;
  --loyalty-oro:      #b45309;
  --loyalty-diamante: #6366f1;       /* indigo — premium máximo */

  /* Surfaces */
  --loyalty-card-bg: rgba(15, 118, 110, 0.06);
  --loyalty-card-border: rgba(15, 118, 110, 0.15);

  /* Typography scale (Vercel-style) */
  --text-xs:   0.75rem;   /* 12px */
  --text-sm:   0.875rem;  /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg:   1.25rem;   /* 20px */
  --text-xl:   1.5rem;    /* 24px */
  --text-2xl:  2rem;      /* 32px */
  --text-3xl:  3rem;      /* 48px */

  /* Motion (Emil Kowalski timing) */
  --spring-bounce:  cubic-bezier(0.34, 1.56, 0.64, 1);
  --spring-smooth:  cubic-bezier(0.25, 1, 0.5, 1);
  --duration-fast:  120ms;
  --duration-base:  200ms;
  --duration-slow:  350ms;

  /* Radii (Vercel) */
  --radius-sm:  4px;
  --radius-md:  6px;
  --radius-lg:  12px;
  --radius-xl:  20px;
  --radius-full: 9999px;
}

.dark {
  --loyalty-brand:       #14b8a6;
  --loyalty-card-bg:     rgba(20, 184, 166, 0.08);
  --loyalty-card-border: rgba(20, 184, 166, 0.20);
}
```

- [ ] **Step 4: Crear motion.ts — spring presets**

```typescript
// src/features/lealtad/design/motion.ts
// Emil Kowalski spring presets — usar con motion/react

export const spring = {
  /** Rebote ligero para tarjetas y badges */
  bounce: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 25,
  },
  /** Suave para números y saldos */
  smooth: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
    mass: 0.8,
  },
  /** Micro-presión táctil para botones */
  tap: {
    type: 'spring' as const,
    stiffness: 600,
    damping: 20,
  },
} as const

/** Variantes para tarjeta de nivel — entrada */
export const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ...spring.smooth, delay: 0.05 },
  },
}

/** Variantes para items de lista — stagger */
export const listItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { ...spring.smooth, delay: i * 0.04 },
  }),
}

/** Overlay fade */
export const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
}
```

- [ ] **Step 5: Crear tokens.ts — constantes semánticas**

```typescript
// src/features/lealtad/design/tokens.ts
import type { LoyaltyNivel } from '../types'

export const NIVEL_COLORS: Record<LoyaltyNivel, {
  bg: string
  text: string
  border: string
  gradient: string
}> = {
  bronce: {
    bg:       'bg-amber-50 dark:bg-amber-950/30',
    text:     'text-amber-800 dark:text-amber-300',
    border:   'border-amber-200 dark:border-amber-800',
    gradient: 'from-amber-700 via-amber-600 to-amber-500',
  },
  plata: {
    bg:       'bg-slate-50 dark:bg-slate-900/40',
    text:     'text-slate-700 dark:text-slate-300',
    border:   'border-slate-300 dark:border-slate-600',
    gradient: 'from-slate-500 via-slate-400 to-slate-300',
  },
  oro: {
    bg:       'bg-yellow-50 dark:bg-yellow-950/30',
    text:     'text-yellow-800 dark:text-yellow-300',
    border:   'border-yellow-300 dark:border-yellow-700',
    gradient: 'from-yellow-600 via-amber-500 to-yellow-400',
  },
  diamante: {
    bg:       'bg-indigo-50 dark:bg-indigo-950/30',
    text:     'text-indigo-700 dark:text-indigo-300',
    border:   'border-indigo-300 dark:border-indigo-700',
    gradient: 'from-indigo-600 via-purple-500 to-indigo-400',
  },
}

export const NIVEL_ICON: Record<LoyaltyNivel, string> = {
  bronce:   '🥉',
  plata:    '🥈',
  oro:      '🥇',
  diamante: '💎',
}
```

- [ ] **Step 6: Crear NivelCard.tsx — componente signature**

Este es el "elemento memorable" del diseño: la tarjeta virtual del cliente con gradiente de nivel, shimmer animado en Diamante (Emil Kowalski), código de barras, y número de saldo con spring count-up.

```typescript
// src/features/lealtad/design/NivelCard.tsx
import { motion, useSpring, useTransform, useMotionValue } from 'motion/react'
import { useEffect } from 'react'
import Barcode from 'react-barcode'
import { NIVEL_COLORS, NIVEL_ICON } from './tokens'
import { NIVEL_LABEL, valorCanjeMxn } from '../types'
import type { LoyaltyMember, LoyaltyConfig } from '../types'

interface Props {
  member: LoyaltyMember
  config: LoyaltyConfig
  showBarcode?: boolean
  compact?: boolean
}

/** Número animado con spring physics — Emil Kowalski */
function AnimatedNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const motionVal = useMotionValue(0)
  const spring = useSpring(motionVal, { stiffness: 200, damping: 20, mass: 0.8 })
  const display = useTransform(spring, v => `${prefix}${v.toFixed(2)}`)

  useEffect(() => { motionVal.set(value) }, [value, motionVal])

  return <motion.span>{display}</motion.span>
}

export function NivelCard({ member, config, showBarcode = false, compact = false }: Props) {
  const colors = NIVEL_COLORS[member.nivel]
  const saldo = valorCanjeMxn(member.puntos_disponibles, config.valor_punto_mxn)
  const isDiamante = member.nivel === 'diamante'

  return (
    <motion.div
      className={`relative overflow-hidden rounded-[20px] p-5 text-white select-none ${compact ? 'py-3' : ''}`}
      style={{
        background: `linear-gradient(135deg, var(--loyalty-brand-dark) 0%, var(--loyalty-brand) 60%, var(--loyalty-brand-light) 100%)`,
      }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      whileHover={{ scale: 1.015, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
    >
      {/* Shimmer Diamante — Emil Kowalski ambient effect */}
      {isDiamante && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)',
          }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
        />
      )}

      {/* Noise texture overlay — Huashu depth */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <div className="relative flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-medium opacity-70 tracking-wide uppercase">
            {config.nombre_programa}
          </p>
          <p className="text-lg font-semibold mt-0.5 leading-tight">{member.nombre}</p>
        </div>
        <motion.div
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}
          whileHover={{ scale: 1.08 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
        >
          <span>{NIVEL_ICON[member.nivel]}</span>
          <span>{NIVEL_LABEL[member.nivel].replace(/^[^\s]+\s/, '')}</span>
        </motion.div>
      </div>

      {/* Saldo con count-up animado */}
      {!compact && (
        <div className="relative mb-4">
          <p className="text-xs opacity-60 mb-0.5 tracking-wide">Saldo eS$</p>
          <p className="text-4xl font-bold tracking-tight font-mono">
            <AnimatedNumber value={saldo} prefix="$" />
          </p>
          <p className="text-xs opacity-50 mt-0.5">
            {member.puntos_disponibles.toLocaleString('es-MX')} puntos
          </p>
        </div>
      )}

      {/* Código de barras */}
      {showBarcode && (
        <motion.div
          className="relative bg-white rounded-xl p-3 flex justify-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 28 }}
        >
          <Barcode
            value={member.codigo_barras}
            width={1.4}
            height={52}
            fontSize={11}
            displayValue
            background="transparent"
          />
        </motion.div>
      )}
    </motion.div>
  )
}
```

- [ ] **Step 7: tsc check**

```bash
bun run tsc --noEmit
```
Expected: 0 errores

- [ ] **Step 8: Commit**

```bash
git add src/styles/loyalty-tokens.css src/features/lealtad/design/ src/index.css tailwind.config.ts
git commit -m "feat: loyalty design system — Geist + motion tokens + NivelCard component"
```

---

## Gate R2.5: UI/UX Design Review — Design System (después de Task 2.5)

**Bloquea Task 3 si hay issues CRITICAL en accesibilidad o token consistency.**

- [ ] **R2.5-A: Frontend Design Review** — lanzar Agent con `subagent_type: claude`

  Prompt al agente (actúa como design reviewer senior):
  ```
  Eres un design reviewer senior con estándares Emil Kowalski / Vercel Design / Huashu.
  Revisa estos archivos:
  - src/styles/loyalty-tokens.css
  - src/features/lealtad/design/motion.ts
  - src/features/lealtad/design/tokens.ts
  - src/features/lealtad/design/NivelCard.tsx

  Criterios:
  1. CONTRASTE: ¿Los colores de nivel (bronce/plata/oro/diamante) pasan WCAG AA (4.5:1) sobre fondo blanco y fondo oscuro?
  2. MOTION ACCESSIBILITY: ¿La animación shimmer de Diamante respeta prefers-reduced-motion?
     Debe tener: @media (prefers-reduced-motion: reduce) { animation: none }
     O en Motion: usar useReducedMotion() hook.
  3. SPRING PHYSICS: ¿Los valores stiffness/damping son coherentes con el feeling de una app financiera?
     (No demasiado bounce para monedero — dinero = confianza, no juego)
  4. FONT LOADING: ¿Geist carga con font-display: swap para evitar FOIT?
  5. TOKEN CONSISTENCY: ¿Se usan los tokens CSS o hay valores hardcoded (#0f766e) en el componente?
  6. DARK MODE: ¿NivelCard funciona en modo oscuro? ¿El texto blanco sobre gradiente teal mantiene contraste suficiente?
  7. MOBILE: ¿La tarjeta en 320px (iPhone SE) no se rompe? ¿El texto de saldo a 48px cabe?

  Reporta: archivo:línea, criterio fallido, fix concreto.
  ```

- [ ] **R2.5-B: Resolver findings — fix más crítico esperado**

  ```typescript
  // Añadir en NivelCard.tsx — reduced motion
  import { useReducedMotion } from 'motion/react'

  // Dentro del componente:
  const prefersReduced = useReducedMotion()

  // En el shimmer animation:
  animate={prefersReduced ? {} : { x: ['-100%', '200%'] }}
  ```

---

## Task 3: TypeScript Types y Hooks Base

**Files:**
- Create: `src/features/lealtad/types.ts`
- Create: `src/features/lealtad/hooks/useLoyaltyConfig.ts`
- Create: `src/features/lealtad/hooks/useLoyaltyMember.ts`
- Create: `src/test/lealtad/loyalty-points.test.ts`

**Interfaces:**
- Produces:
  - `LoyaltyMember`, `LoyaltyConfig`, `LoyaltyMovimiento` types
  - `useLoyaltyConfig(clinicId)` → `{ config, loading, save }`
  - `useLoyaltyMember(clinicId)` → `{ search, register, registerSale, redeem }`

- [ ] **Step 1: Escribir test que falla**

```typescript
// src/test/lealtad/loyalty-points.test.ts
import { describe, it, expect } from 'vitest'
import { calcularPuntosPreview } from '@/features/lealtad/types'

describe('calcularPuntosPreview', () => {
  it('calcula puntos con config base', () => {
    const result = calcularPuntosPreview(150.00, 10.00, 1.0)
    expect(result).toBe(15) // $150 / $10 por punto * 1.0 = 15
  })

  it('aplica multiplicador nivel plata', () => {
    const result = calcularPuntosPreview(100.00, 10.00, 1.10)
    expect(result).toBe(11) // floor(10 * 1.10) = 11
  })

  it('trunca hacia abajo', () => {
    const result = calcularPuntosPreview(95.00, 10.00, 1.0)
    expect(result).toBe(9) // floor(9.5) = 9
  })

  it('retorna 0 si monto menor que pesos_por_punto', () => {
    const result = calcularPuntosPreview(5.00, 10.00, 1.0)
    expect(result).toBe(0)
  })
})
```

- [ ] **Step 2: Correr test — debe fallar**

```bash
bun run vitest run src/test/lealtad/loyalty-points.test.ts
```
Expected: FAIL — `calcularPuntosPreview is not exported`

- [ ] **Step 3: Crear types.ts con la función**

```typescript
// src/features/lealtad/types.ts

export type LoyaltyNivel = 'bronce' | 'plata' | 'oro' | 'diamante'

export interface LoyaltyConfig {
  clinic_id: string
  nombre_programa: string
  slug_farmacia: string
  color_primario: string
  logo_url: string | null
  pesos_por_punto: number
  valor_punto_mxn: number
  puntos_minimos_canje: number
  nivel_plata_umbral: number
  nivel_oro_umbral: number
  nivel_diamante_umbral: number
  multiplicador_plata: number
  multiplicador_oro: number
  multiplicador_diamante: number
  expiracion_dias_inactividad: number
  programa_activo: boolean
  actualizado_at: string
}

export interface LoyaltyMember {
  id: string
  clinic_id: string
  patient_id: string | null
  nombre: string
  telefono: string | null
  email: string | null
  fecha_nacimiento: string | null
  codigo_barras: string
  nivel: LoyaltyNivel
  puntos_disponibles: number
  puntos_acumulados_historico: number
  consent_privacidad: boolean
  consent_privacidad_at: string | null
  consent_historial_compras: boolean
  consent_historial_at: string | null
  consent_marketing: boolean
  consent_marketing_at: string | null
  consent_marketing_canales: string[]
  consent_version: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface LoyaltyMovimiento {
  id: string
  clinic_id: string
  member_id: string
  tipo: 'acumulacion' | 'canje' | 'vencimiento' | 'bonus' | 'ajuste' | 'referido'
  puntos: number
  saldo_post: number
  pharmacy_sale_id: string | null
  plan_id: string | null
  descripcion: string | null
  created_at: string
}

export interface RegisterSaleResult {
  ok: boolean
  puntos_ganados?: number
  saldo_nuevo?: number
  nivel?: LoyaltyNivel
  error?: string
}

export interface RedeemResult {
  ok: boolean
  descuento_mxn?: number
  saldo_nuevo?: number
  error?: string
  minimo?: number
  disponibles?: number
}

export interface NuevoMiembroInput {
  nombre: string
  telefono: string
  email: string
  fecha_nacimiento?: string
  consent_privacidad: true       // siempre true si llega aquí
  consent_historial_compras: true
  consent_marketing: boolean
  consent_marketing_canales: string[]
}

/** Cálculo preview de puntos (sin DB) — misma lógica que loyalty_register_sale RPC */
export function calcularPuntosPreview(
  totalMxn: number,
  pesosPorPunto: number,
  multiplicador: number
): number {
  if (pesosPorPunto <= 0) return 0
  return Math.floor((totalMxn / pesosPorPunto) * multiplicador)
}

export function valorCanjeMxn(puntos: number, valorPuntoMxn: number): number {
  return Math.round(puntos * valorPuntoMxn * 100) / 100
}

export function nivelMultiplicador(nivel: LoyaltyNivel, cfg: LoyaltyConfig): number {
  switch (nivel) {
    case 'diamante': return cfg.multiplicador_diamante
    case 'oro':      return cfg.multiplicador_oro
    case 'plata':    return cfg.multiplicador_plata
    default:         return 1.0
  }
}

export const NIVEL_LABEL: Record<LoyaltyNivel, string> = {
  bronce: '🥉 Bronce',
  plata:  '🥈 Plata',
  oro:    '🥇 Oro',
  diamante: '💎 Diamante',
}
```

- [ ] **Step 4: Correr test — debe pasar**

```bash
bun run vitest run src/test/lealtad/loyalty-points.test.ts
```
Expected: PASS — 4 tests passing

- [ ] **Step 5: Crear useLoyaltyConfig.ts**

```typescript
// src/features/lealtad/hooks/useLoyaltyConfig.ts
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { LoyaltyConfig } from '../types'

export function useLoyaltyConfig(clinicId: string | null) {
  const [config, setConfig] = useState<LoyaltyConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicId) { setLoading(false); return }
    setLoading(true)
    supabase
      .from('loyalty_config' as never)
      .select('*')
      .eq('clinic_id', clinicId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setConfig(data as LoyaltyConfig | null)
        setLoading(false)
      })
  }, [clinicId])

  async function save(updates: Partial<LoyaltyConfig>): Promise<boolean> {
    if (!clinicId) return false
    const { error: err } = await supabase
      .from('loyalty_config' as never)
      .upsert({ ...updates, clinic_id: clinicId, actualizado_at: new Date().toISOString() })
    if (err) { setError(err.message); return false }
    setConfig(prev => prev ? { ...prev, ...updates } : null)
    return true
  }

  return { config, loading, error, save }
}
```

- [ ] **Step 6: Crear useLoyaltyMember.ts**

```typescript
// src/features/lealtad/hooks/useLoyaltyMember.ts
import { supabase } from '@/integrations/supabase/client'
import type {
  LoyaltyMember, NuevoMiembroInput,
  RegisterSaleResult, RedeemResult
} from '../types'

export function useLoyaltyMember(clinicId: string | null) {
  async function search(query: string): Promise<LoyaltyMember[]> {
    if (!clinicId || query.trim().length < 3) return []
    const q = query.trim().replace(/[%(),]/g, '')
    const { data } = await supabase
      .from('loyalty_members' as never)
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('activo', true)
      .or(`telefono.ilike.%${q}%,email.ilike.%${q}%,nombre.ilike.%${q}%`)
      .limit(5)
    return (data as LoyaltyMember[]) ?? []
  }

  async function register(input: NuevoMiembroInput): Promise<LoyaltyMember | null> {
    if (!clinicId) return null
    const now = new Date().toISOString()
    const { data: barcode } = await supabase.rpc('loyalty_generate_barcode', {
      p_clinic_id: clinicId,
    })
    const { data, error } = await supabase
      .from('loyalty_members' as never)
      .insert({
        clinic_id: clinicId,
        nombre: input.nombre,
        telefono: input.telefono || null,
        email: input.email || null,
        fecha_nacimiento: input.fecha_nacimiento || null,
        codigo_barras: barcode as string,
        consent_privacidad: true,
        consent_privacidad_at: now,
        consent_historial_compras: true,
        consent_historial_at: now,
        consent_marketing: input.consent_marketing,
        consent_marketing_at: input.consent_marketing ? now : null,
        consent_marketing_canales: input.consent_marketing_canales,
        consent_version: new Date().toISOString().slice(0, 7),
      })
      .select('*')
      .single()
    if (error) return null
    return data as LoyaltyMember
  }

  async function registerSale(
    saleId: string,
    memberId: string
  ): Promise<RegisterSaleResult> {
    if (!clinicId) return { ok: false, error: 'sin_clinica' }
    const { data, error } = await supabase.rpc('loyalty_register_sale', {
      p_sale_id: saleId,
      p_member_id: memberId,
      p_clinic_id: clinicId,
    })
    if (error) return { ok: false, error: error.message }
    return data as RegisterSaleResult
  }

  async function redeem(
    memberId: string,
    puntos: number
  ): Promise<RedeemResult> {
    if (!clinicId) return { ok: false, error: 'sin_clinica' }
    const { data, error } = await supabase.rpc('loyalty_redeem', {
      p_member_id: memberId,
      p_clinic_id: clinicId,
      p_puntos: puntos,
    })
    if (error) return { ok: false, error: error.message }
    return data as RedeemResult
  }

  async function getMovimientos(memberId: string) {
    const { data } = await supabase
      .from('loyalty_movimientos' as never)
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(50)
    return data ?? []
  }

  return { search, register, registerSale, redeem, getMovimientos }
}
```

- [ ] **Step 7: tsc check**

```bash
bun run tsc --noEmit
```
Expected: 0 errores

- [ ] **Step 8: Commit**

```bash
git add src/features/lealtad/types.ts src/features/lealtad/hooks/ src/test/lealtad/loyalty-points.test.ts
git commit -m "feat: loyalty types, hooks and point calculation logic"
```

---

## Gate R3: Code Review Types + Hooks (después de Task 3)

**Bloquea Task 4 si hay findings CRITICAL/HIGH.**

- [ ] **R3-A: Code review** — lanzar `caveman:cavecrew-reviewer`

  Archivos a revisar:
  ```
  src/features/lealtad/types.ts
  src/features/lealtad/hooks/useLoyaltyConfig.ts
  src/features/lealtad/hooks/useLoyaltyMember.ts
  src/test/lealtad/loyalty-points.test.ts
  ```

  Prompt al agente:
  ```
  Review these files for:
  - Immutability violations (state mutated in-place)
  - Missing error handling (supabase calls without .error check)
  - Race conditions in async hooks (multiple setState calls after unmount)
  - Type safety gaps (as never casts hiding real type errors)
  - Input sanitization in useLoyaltyMember.search() — is the query param
    sanitized before being used in .or() filter? Check for Supabase filter injection.
  - Missing loading/error states
  - Test coverage gaps — are edge cases covered (negative points, zero total, etc.)
  Report findings: path:line severity: problem. fix.
  ```

- [ ] **R3-B: Resolver findings CRITICAL/HIGH**

  Fix más común esperado: sanitización en `search()` — verificar que el `replace(/[%(),]/g, '')` cubre todos los caracteres especiales de Supabase filter syntax.

---

## Task 4: LoyaltyPanel — Panel en POS

**Files:**
- Create: `src/features/lealtad/LoyaltyPanel.tsx`
- Create: `src/features/lealtad/LoyaltyAfiliacionModal.tsx`
- Modify: `src/features/farmacia/PuntoDeVenta.tsx` (añadir panel)

**Interfaces:**
- Consumes: `useLoyaltyMember`, `useLoyaltyConfig`, types de Task 3
- Produces: `<LoyaltyPanel clinicId onMemberSelected onRedeemApplied />` exportado desde `lealtad/LoyaltyPanel.tsx`

- [ ] **Step 1: Crear LoyaltyAfiliacionModal.tsx**

```typescript
// src/features/lealtad/LoyaltyAfiliacionModal.tsx
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useLoyaltyMember } from './hooks/useLoyaltyMember'
import type { LoyaltyMember } from './types'

interface Props {
  clinicId: string
  open: boolean
  onClose: () => void
  onRegistered: (member: LoyaltyMember) => void
}

export function LoyaltyAfiliacionModal({ clinicId, open, onClose, onRegistered }: Props) {
  const { register } = useLoyaltyMember(clinicId)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    if (!telefono.trim() && !email.trim()) {
      setError('Ingresa teléfono o email')
      return
    }
    setSubmitting(true)
    setError(null)
    const member = await register({
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      email: email.trim(),
      consent_privacidad: true,
      consent_historial_compras: true,
      consent_marketing: consentMarketing,
      consent_marketing_canales: consentMarketing ? ['email'] : [],
    })
    setSubmitting(false)
    if (!member) { setError('Error al registrar. Verifica que el teléfono/email no esté duplicado.'); return }
    onRegistered(member)
    setNombre(''); setTelefono(''); setEmail(''); setConsentMarketing(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Afiliar nuevo cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="laf-nombre">Nombre completo *</Label>
            <Input id="laf-nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="laf-tel">Teléfono</Label>
            <Input id="laf-tel" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="laf-email">Email</Label>
            <Input id="laf-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          {/* Consentimientos LFPDPPP */}
          <div className="rounded border p-3 space-y-3 bg-muted/30 text-sm">
            <div className="flex items-start gap-2">
              <Checkbox id="laf-c1" checked disabled />
              <label htmlFor="laf-c1" className="text-muted-foreground leading-snug">
                <strong>Aviso de Privacidad:</strong> Acepto el tratamiento de mis datos personales para administrar mi Monedero. <span className="text-primary cursor-pointer underline">Ver aviso</span>
              </label>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox id="laf-c2" checked disabled />
              <label htmlFor="laf-c2" className="text-muted-foreground leading-snug">
                <strong>Historial de compras:</strong> Acepto que mis compras sean registradas para calcular puntos, incluyendo información sobre medicamentos adquiridos.
              </label>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="laf-c3"
                checked={consentMarketing}
                onCheckedChange={v => setConsentMarketing(v === true)}
              />
              <label htmlFor="laf-c3" className="leading-snug cursor-pointer">
                <strong>(Opcional)</strong> Acepto recibir ofertas y boletines por email y Telegram. Puedo cancelar en cualquier momento.
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Registrando...' : 'Afiliar cliente'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Crear LoyaltyPanel.tsx**

```typescript
// src/features/lealtad/LoyaltyPanel.tsx
import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserPlus, Coins, Search } from 'lucide-react'
import { useLoyaltyMember } from './hooks/useLoyaltyMember'
import { useLoyaltyConfig } from './hooks/useLoyaltyConfig'
import { LoyaltyAfiliacionModal } from './LoyaltyAfiliacionModal'
import { valorCanjeMxn, NIVEL_LABEL, calcularPuntosPreview, nivelMultiplicador } from './types'
import type { LoyaltyMember } from './types'

interface Props {
  clinicId: string
  totalVenta: number
  onMemberSelected: (member: LoyaltyMember | null) => void
  onRedeemApplied: (descuentoMxn: number, memberId: string) => void
}

export function LoyaltyPanel({ clinicId, totalVenta, onMemberSelected, onRedeemApplied }: Props) {
  const { config } = useLoyaltyConfig(clinicId)
  const { search, redeem } = useLoyaltyMember(clinicId)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LoyaltyMember[]>([])
  const [selected, setSelected] = useState<LoyaltyMember | null>(null)
  const [searching, setSearching] = useState(false)
  const [afiliacionOpen, setAfiliacionOpen] = useState(false)
  const [puntosACanjear, setPuntosACanjear] = useState('')
  const [canjeApplied, setCanjeApplied] = useState(false)
  const [canjeError, setCanjeError] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    if (query.trim().length < 3) return
    setSearching(true)
    const res = await search(query)
    setResults(res)
    setSearching(false)
  }, [query, search])

  function selectMember(m: LoyaltyMember) {
    setSelected(m)
    setResults([])
    setQuery('')
    onMemberSelected(m)
  }

  function clearMember() {
    setSelected(null)
    setCanjeApplied(false)
    setPuntosACanjear('')
    setCanjeError(null)
    onMemberSelected(null)
  }

  async function handleRedeem() {
    if (!selected || !config) return
    const puntos = parseInt(puntosACanjear, 10)
    if (isNaN(puntos) || puntos <= 0) return
    const result = await redeem(selected.id, puntos)
    if (!result.ok) {
      setCanjeError(
        result.error === 'saldo_insuficiente'
          ? `Saldo insuficiente (disponibles: ${result.disponibles} pts)`
          : result.error === 'minimo_no_alcanzado'
          ? `Mínimo para canjear: ${result.minimo} pts`
          : 'Error al canjear'
      )
      return
    }
    setCanjeApplied(true)
    setSelected(prev => prev ? { ...prev, puntos_disponibles: result.saldo_nuevo ?? 0 } : prev)
    onRedeemApplied(result.descuento_mxn ?? 0, selected.id)
  }

  if (!config?.programa_activo) return null

  const puntosGanarEstimado = selected && config
    ? calcularPuntosPreview(
        totalVenta,
        config.pesos_por_punto,
        nivelMultiplicador(selected.nivel, config)
      )
    : null

  return (
    <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Coins className="h-4 w-4 text-primary" />
        {config.nombre_programa}
      </div>

      {!selected ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Teléfono o email del cliente..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="text-sm h-8"
            />
            <Button size="sm" variant="outline" onClick={handleSearch} disabled={searching}>
              <Search className="h-3 w-3" />
            </Button>
          </div>

          {results.length > 0 && (
            <div className="border rounded bg-background shadow-sm max-h-32 overflow-y-auto">
              {results.map(m => (
                <button
                  key={m.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between"
                  onClick={() => selectMember(m)}
                >
                  <span>{m.nombre}</span>
                  <span className="text-muted-foreground">{m.telefono ?? m.email}</span>
                </button>
              ))}
            </div>
          )}

          {results.length === 0 && query.trim().length >= 3 && !searching && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              onClick={() => setAfiliacionOpen(true)}
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Cliente no encontrado — Afiliar nuevo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{selected.nombre}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs py-0">
                  {NIVEL_LABEL[selected.nivel]}
                </Badge>
                <span>eS$ {valorCanjeMxn(selected.puntos_disponibles, config.valor_punto_mxn).toFixed(2)}</span>
                <span className="text-muted-foreground">({selected.puntos_disponibles} pts)</span>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={clearMember}>
              Cambiar
            </Button>
          </div>

          {puntosGanarEstimado !== null && puntosGanarEstimado > 0 && (
            <p className="text-xs text-green-600 bg-green-50 rounded px-2 py-1">
              +{puntosGanarEstimado} puntos con esta compra
            </p>
          )}

          {!canjeApplied && selected.puntos_disponibles >= config.puntos_minimos_canje && (
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min={config.puntos_minimos_canje}
                max={selected.puntos_disponibles}
                placeholder={`Mín. ${config.puntos_minimos_canje} pts`}
                value={puntosACanjear}
                onChange={e => { setPuntosACanjear(e.target.value); setCanjeError(null) }}
                className="text-xs h-7 w-28"
              />
              <span className="text-xs text-muted-foreground">
                = ${puntosACanjear
                  ? valorCanjeMxn(parseInt(puntosACanjear, 10) || 0, config.valor_punto_mxn).toFixed(2)
                  : '0.00'} MXN
              </span>
              <Button size="sm" className="h-7 text-xs" onClick={handleRedeem}>
                Canjear
              </Button>
            </div>
          )}

          {canjeApplied && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">
              ✓ Canje aplicado — descuento en cobro
            </p>
          )}

          {canjeError && <p className="text-xs text-destructive">{canjeError}</p>}
        </div>
      )}

      <LoyaltyAfiliacionModal
        clinicId={clinicId}
        open={afiliacionOpen}
        onClose={() => setAfiliacionOpen(false)}
        onRegistered={m => { setAfiliacionOpen(false); selectMember(m) }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Integrar LoyaltyPanel en PuntoDeVenta.tsx**

Localizar en `PuntoDeVenta.tsx` el bloque donde se muestra el resumen de cobro (alrededor de la línea donde está el total y los métodos de pago). Añadir justo **antes** del `<PaymentCapture ...>`:

```typescript
// Añadir imports al inicio del archivo:
import { LoyaltyPanel } from '@/features/lealtad/LoyaltyPanel'

// Añadir estado en el componente (después de los estados existentes):
const [loyaltyMemberId, setLoyaltyMemberId] = useState<string | null>(null)
const [loyaltyDescuento, setLoyaltyDescuento] = useState(0)

// Añadir en el JSX, antes del PaymentCapture o del botón de cobro:
{activeClinicId && (
  <LoyaltyPanel
    clinicId={activeClinicId}
    totalVenta={total}
    onMemberSelected={m => setLoyaltyMemberId(m?.id ?? null)}
    onRedeemApplied={(desc, _mid) => setLoyaltyDescuento(desc)}
  />
)}
```

En `submitSale`, después de la llamada a `pharmacy_register_sale` exitosa, añadir:

```typescript
// Registrar puntos de fidelización si hay miembro seleccionado
if (loyaltyMemberId && saleId) {
  const { registerSale } = useLoyaltyMember(activeClinicId)
  // NOTA: usar directamente supabase.rpc para no crear hook dentro de función
  await supabase.rpc('loyalty_register_sale', {
    p_sale_id: saleId,
    p_member_id: loyaltyMemberId,
    p_clinic_id: activeClinicId,
  })
  setLoyaltyMemberId(null)
  setLoyaltyDescuento(0)
}
```

**IMPORTANTE:** En PuntoDeVenta.tsx los hooks se deben llamar al nivel del componente. Extraer el RPC call a una función `async`:

```typescript
// Al nivel del componente (no dentro de submitSale):
const loyaltyHook = useLoyaltyMember(activeClinicId)

// Dentro de submitSale, después del registro exitoso:
if (loyaltyMemberId && newSaleId) {
  await loyaltyHook.registerSale(newSaleId, loyaltyMemberId)
  setLoyaltyMemberId(null)
  setLoyaltyDescuento(0)
}
```

- [ ] **Step 4: tsc check**

```bash
bun run tsc --noEmit
```
Expected: 0 errores

- [ ] **Step 5: Commit**

```bash
git add src/features/lealtad/LoyaltyPanel.tsx src/features/lealtad/LoyaltyAfiliacionModal.tsx src/features/farmacia/PuntoDeVenta.tsx
git commit -m "feat: loyalty panel in POS — search, register, redeem points at checkout"
```

---

## Gate R4-UX: UI/UX Review POS Panel (después de Task 4, antes de Gate R4)

- [ ] **R4-UX: Frontend Design Review** — lanzar Agent con `subagent_type: claude`

  Prompt al agente:
  ```
  Eres un UI/UX reviewer con estándares Vercel Design / Emil Kowalski.
  Revisa src/features/lealtad/LoyaltyPanel.tsx y LoyaltyAfiliacionModal.tsx.

  Checklist de diseño POS:
  1. RESPUESTA INMEDIATA: ¿El botón "Buscar" tiene feedback visual instantáneo (spinner o disabled)?
     Un cajero necesita saber que el sistema respondió en <100ms perceptible.
  2. ESTADO VACÍO (Empty State): ¿Qué ve el cajero antes de buscar? ¿La instrucción es clara?
  3. LISTA DE RESULTADOS: ¿Los resultados de búsqueda tienen hover state animado (motion whileHover)?
     ¿Se puede navegar con teclado (Enter para seleccionar)?
  4. SELECCIÓN DE MIEMBRO: Al seleccionar, ¿hay transición visual que confirme la selección?
     Sugerencia: AnimatePresence con slide-in del panel de saldo.
  5. CANJE: ¿El campo de puntos muestra el equivalente en MXN en tiempo real mientras el cajero escribe?
     Esto es un "micro-moment" crítico — el cliente ve el valor en dinero real.
  6. CONFIRMACIÓN: Al aplicar el canje exitosamente, ¿hay micro-celebration?
     Sugerencia: checkmark animado + número de descuento en verde con spring.
  7. MODAL AFILIACIÓN: ¿Los 3 checkboxes de consentimiento son visualmente distintos?
     Privacidad/Historial (obligatorio, pre-chequeado con candado) vs Marketing (opcional, toggle visible).
  8. TIPOGRAFÍA: ¿Usa Geist? ¿Escala tipográfica coherente con loyalty-tokens.css?
  9. DARK MODE: ¿El panel funciona con el tema oscuro de la clínica?

  Propón fixes concretos con JSX/Tailwind classes. No proponer rediseño completo — mejoras quirúrgicas.
  ```

- [ ] **R4-UX-B: Aplicar fixes de motion en LoyaltyPanel**

  Fix mínimo esperado — añadir AnimatePresence en resultados de búsqueda:
  ```typescript
  import { motion, AnimatePresence } from 'motion/react'
  import { listItemVariants } from './design/motion'

  // En la lista de resultados:
  <AnimatePresence>
    {results.map((m, i) => (
      <motion.button
        key={m.id}
        variants={listItemVariants}
        initial="hidden"
        animate="visible"
        exit={{ opacity: 0, x: -8 }}
        custom={i}
        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between"
        onClick={() => selectMember(m)}
      >
        <span>{m.nombre}</span>
        <span className="text-muted-foreground">{m.telefono ?? m.email}</span>
      </motion.button>
    ))}
  </AnimatePresence>
  ```

---

## Gate R4: Auditoría LFPDPPP + Seguridad POS Panel (después de Task 4)

**Bloquea Task 5 si hay findings CRITICAL/HIGH.**

Este gate es el más crítico del plan — cubre compliance legal y el punto de mayor exposición (POS modificado).

- [ ] **R4-A: LFPDPPP compliance review** — lanzar Agent con `subagent_type: claude`

  Prompt al agente:
  ```
  Eres un experto en LFPDPPP (Ley Federal de Protección de Datos Personales en Posesión de Particulares, México).
  Audita los siguientes archivos:
  - src/features/lealtad/LoyaltyAfiliacionModal.tsx
  - src/features/lealtad/hooks/useLoyaltyMember.ts (función register)
  - supabase/migrations/20260624000001_loyalty_tables.sql (tabla loyalty_members)

  Verificar:
  1. CONSENTIMIENTO INFORMADO: ¿El aviso de privacidad es visible y legible ANTES de capturar datos?
     ¿Menciona: responsable del tratamiento, finalidad, transferencias, derechos ARCO?
  2. CONSENTIMIENTO GRANULAR: ¿Los 3 consentimientos están separados?
     a) Privacidad/tratamiento de datos (obligatorio para afiliarse)
     b) Historial de compras incluyendo medicamentos (obligatorio para acumular puntos)
     c) Marketing/comunicaciones (opcional, separado, con lista de canales)
  3. OPT-OUT: ¿El usuario puede cancelar el consentimiento de marketing en 1 paso sin fricción?
  4. REGISTRO DE CONSENTIMIENTO: ¿Se guarda timestamp + versión del aviso para cada consentimiento?
  5. DATOS SENSIBLES: El historial de compras incluye medicamentos — ¿hay aviso específico de datos sensibles (Art. 9 LFPDPPP)?
  6. DERECHO DE CANCELACIÓN: ¿Existe mecanismo para que el titular solicite borrado de datos (ARCO)?
  7. MENORES DE EDAD: ¿Hay restricción de edad mínima (18 años)?

  Reporta cada finding con artículo LFPDPPP aplicable, severidad, y fix requerido.
  ```

- [ ] **R4-B: Security review POS panel** — lanzar Agent con `subagent_type: claude`

  Prompt al agente:
  ```
  Security review de:
  - src/features/lealtad/LoyaltyPanel.tsx
  - src/features/lealtad/LoyaltyAfiliacionModal.tsx
  - src/features/farmacia/PuntoDeVenta.tsx (solo las modificaciones del loyalty panel)

  Checklist:
  1. XSS: ¿Algún valor del miembro (nombre, email, teléfono) se renderiza sin sanitizar?
     React escapa por defecto en JSX, pero verificar dangerouslySetInnerHTML.
  2. RACE CONDITION en canje: si el cajero hace click doble en "Canjear", ¿se llama redeem() dos veces?
     ¿Hay disabled state durante la llamada?
  3. REGISTRO DE PUNTOS: ¿El registerSale() en PuntoDeVenta falla silenciosamente?
     Si el RPC falla, ¿el cajero lo sabe? ¿Hay toast/error visible?
  4. AUTORIZACIÓN: ¿El LoyaltyPanel verifica que el cajero tiene rol autorizado para canjear puntos?
     O ¿cualquier usuario autenticado puede llamar loyalty_redeem?
  5. ENUMERACIÓN: ¿La búsqueda por teléfono/email revela si un número existe en el sistema
     a usuarios no autorizados?
  6. DESCUENTO NEGATIVO: ¿Qué pasa si onRedeemApplied recibe descuento_mxn = 0 o negativo?

  Reporta: path:line severidad: problema. fix.
  ```

- [ ] **R4-C: Code review POS integration** — lanzar `caveman:cavecrew-reviewer`

  Archivos:
  ```
  src/features/lealtad/LoyaltyPanel.tsx
  src/features/lealtad/LoyaltyAfiliacionModal.tsx
  src/features/farmacia/PuntoDeVenta.tsx (diff del task 4)
  ```

  Prompt al agente:
  ```
  Review for: state management correctness (loyaltyMemberId/loyaltyDescuento reset after sale),
  hook rules violations (hooks inside callbacks/conditions), missing cleanup on unmount,
  redundant re-renders (search results + member state coupling), error states not shown to user.
  path:line severity: problem. fix.
  ```

- [ ] **R4-D: Resolver findings CRITICAL/HIGH**

  Fixes típicos esperados:
  - Añadir `disabled={canjeando}` en botón Canjear para prevenir doble-submit
  - Añadir toast de error visible si registerSale() falla
  - Añadir aviso de datos sensibles (Art. 9) para historial de medicamentos en modal

---

## Task 5: Admin — LoyaltyConfig y LoyaltyMiembros

**Files:**
- Create: `src/features/lealtad/LoyaltyConfig.tsx`
- Create: `src/features/lealtad/LoyaltyMiembros.tsx`
- Create: `src/pages/Lealtad.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AppLayout.tsx`

**Interfaces:**
- Consumes: `useLoyaltyConfig`, `useLoyaltyMember`, types
- Produces: ruta `/lealtad` protegida con roles admin/manager

- [ ] **Step 1: Crear LoyaltyConfig.tsx**

```typescript
// src/features/lealtad/LoyaltyConfig.tsx
import { useState } from 'react'
import { useLoyaltyConfig } from './hooks/useLoyaltyConfig'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useActiveClinic } from '@/hooks/useActiveClinic'

export function LoyaltyConfig() {
  const { activeClinicId } = useActiveClinic()
  const { config, loading, save } = useLoyaltyConfig(activeClinicId)
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  // Form state inicializado desde config
  const [form, setForm] = useState({
    nombre_programa: config?.nombre_programa ?? 'Monedero Farmacia',
    slug_farmacia: config?.slug_farmacia ?? '',
    pesos_por_punto: config?.pesos_por_punto ?? 10,
    valor_punto_mxn: config?.valor_punto_mxn ?? 0.10,
    puntos_minimos_canje: config?.puntos_minimos_canje ?? 100,
    nivel_plata_umbral: config?.nivel_plata_umbral ?? 500,
    nivel_oro_umbral: config?.nivel_oro_umbral ?? 1500,
    nivel_diamante_umbral: config?.nivel_diamante_umbral ?? 4000,
    expiracion_dias_inactividad: config?.expiracion_dias_inactividad ?? 180,
    programa_activo: config?.programa_activo ?? false,
  })

  async function handleSave() {
    setSaving(true)
    const ok = await save(form)
    setSaving(false)
    toast({ title: ok ? 'Configuración guardada' : 'Error al guardar',
            variant: ok ? 'default' : 'destructive' })
  }

  if (loading) return <p className="text-sm text-muted-foreground p-4">Cargando...</p>

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">Programa activo</p>
          <p className="text-sm text-muted-foreground">Los clientes pueden acumular y canjear puntos</p>
        </div>
        <Switch
          checked={form.programa_activo}
          onCheckedChange={v => setForm(f => ({ ...f, programa_activo: v }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Nombre del programa</Label>
          <Input value={form.nombre_programa}
            onChange={e => setForm(f => ({ ...f, nombre_programa: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <Label>Slug URL (loyalty.integrika.mx/<strong>{form.slug_farmacia || 'tu-slug'}</strong>)</Label>
          <Input value={form.slug_farmacia} placeholder="farmacia-central"
            onChange={e => setForm(f => ({ ...f, slug_farmacia: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>$ MXN por punto</Label>
          <Input type="number" step="1" min="1" value={form.pesos_por_punto}
            onChange={e => setForm(f => ({ ...f, pesos_por_punto: parseFloat(e.target.value) }))} />
          <p className="text-xs text-muted-foreground mt-1">Ej: 10 = cada $10 MXN = 1 punto</p>
        </div>
        <div>
          <Label>Valor de 1 punto en $ MXN</Label>
          <Input type="number" step="0.01" min="0.01" value={form.valor_punto_mxn}
            onChange={e => setForm(f => ({ ...f, valor_punto_mxn: parseFloat(e.target.value) }))} />
          <p className="text-xs text-muted-foreground mt-1">Ej: 0.10 = 100 pts = $10 MXN</p>
        </div>
        <div>
          <Label>Mínimo pts para canjear</Label>
          <Input type="number" min="1" value={form.puntos_minimos_canje}
            onChange={e => setForm(f => ({ ...f, puntos_minimos_canje: parseInt(e.target.value) }))} />
        </div>
        <div>
          <Label>Días inactividad → vencer pts</Label>
          <Input type="number" min="30" value={form.expiracion_dias_inactividad}
            onChange={e => setForm(f => ({ ...f, expiracion_dias_inactividad: parseInt(e.target.value) }))} />
        </div>
      </div>

      <div>
        <p className="font-medium mb-2">Umbrales de nivel (puntos acumulados 12 meses)</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>🥈 Plata desde</Label>
            <Input type="number" value={form.nivel_plata_umbral}
              onChange={e => setForm(f => ({ ...f, nivel_plata_umbral: parseInt(e.target.value) }))} />
          </div>
          <div>
            <Label>🥇 Oro desde</Label>
            <Input type="number" value={form.nivel_oro_umbral}
              onChange={e => setForm(f => ({ ...f, nivel_oro_umbral: parseInt(e.target.value) }))} />
          </div>
          <div>
            <Label>💎 Diamante desde</Label>
            <Input type="number" value={form.nivel_diamante_umbral}
              onChange={e => setForm(f => ({ ...f, nivel_diamante_umbral: parseInt(e.target.value) }))} />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Guardando...' : 'Guardar configuración'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Crear LoyaltyMiembros.tsx**

```typescript
// src/features/lealtad/LoyaltyMiembros.tsx
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useActiveClinic } from '@/hooks/useActiveClinic'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { NIVEL_LABEL, valorCanjeMxn } from './types'
import { useLoyaltyConfig } from './hooks/useLoyaltyConfig'
import type { LoyaltyMember } from './types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function LoyaltyMiembros() {
  const { activeClinicId } = useActiveClinic()
  const { config } = useLoyaltyConfig(activeClinicId)
  const [members, setMembers] = useState<LoyaltyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!activeClinicId) return
    setLoading(true)
    const q = search.trim()
    let query = supabase
      .from('loyalty_members' as never)
      .select('*')
      .eq('clinic_id', activeClinicId)
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(100)

    if (q.length >= 2) {
      query = query.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,email.ilike.%${q}%`)
    }

    query.then(({ data }) => {
      setMembers((data as LoyaltyMember[]) ?? [])
      setLoading(false)
    })
  }, [activeClinicId, search])

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar por nombre, teléfono o email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin miembros registrados.</p>
      ) : (
        <div className="rounded border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2">Nombre</th>
                <th className="text-left px-3 py-2">Contacto</th>
                <th className="text-left px-3 py-2">Nivel</th>
                <th className="text-right px-3 py-2">Saldo eS$</th>
                <th className="text-right px-3 py-2">Puntos</th>
                <th className="text-left px-3 py-2">Registrado</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{m.nombre}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {m.telefono ?? m.email ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{NIVEL_LABEL[m.nivel]}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    ${config ? valorCanjeMxn(m.puntos_disponibles, config.valor_punto_mxn).toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {m.puntos_disponibles.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {format(new Date(m.created_at), 'dd/MM/yy', { locale: es })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Crear página Lealtad.tsx**

```typescript
// src/pages/Lealtad.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoyaltyConfig } from '@/features/lealtad/LoyaltyConfig'
import { LoyaltyMiembros } from '@/features/lealtad/LoyaltyMiembros'
import { Settings, Users } from 'lucide-react'

export default function Lealtad() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Programa de Lealtad</h1>
      <Tabs defaultValue="miembros">
        <TabsList>
          <TabsTrigger value="miembros"><Users className="h-4 w-4 mr-1" />Miembros</TabsTrigger>
          <TabsTrigger value="config"><Settings className="h-4 w-4 mr-1" />Configuración</TabsTrigger>
        </TabsList>
        <TabsContent value="miembros" className="pt-4"><LoyaltyMiembros /></TabsContent>
        <TabsContent value="config" className="pt-4"><LoyaltyConfig /></TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 4: Añadir ruta en App.tsx**

Localizar el bloque de rutas protegidas en `src/App.tsx` y añadir:

```typescript
// import al inicio:
import Lealtad from '@/pages/Lealtad'

// En el bloque de rutas (junto a /farmacia, /caja, etc.):
<Route path="/lealtad" element={
  <ProtectedRoute allowedRoles={['admin', 'manager']}>
    <Lealtad />
  </ProtectedRoute>
} />
```

- [ ] **Step 5: Añadir nav en AppLayout.tsx**

Localizar el menú lateral (sección "Operaciones" o similar) y añadir el ítem:

```typescript
// import al inicio:
import { Gift } from 'lucide-react'

// En el array de nav items de Operaciones:
{ href: '/lealtad', label: 'Lealtad', icon: Gift, roles: ['admin', 'manager'] },
```

- [ ] **Step 6: tsc check**

```bash
bun run tsc --noEmit
```
Expected: 0 errores

- [ ] **Step 7: Commit**

```bash
git add src/features/lealtad/LoyaltyConfig.tsx src/features/lealtad/LoyaltyMiembros.tsx src/pages/Lealtad.tsx src/App.tsx src/components/AppLayout.tsx
git commit -m "feat: loyalty admin — config panel + members list"
```

---

## Gate R5-UX: UI/UX Review Admin — Huashu Dashboard (después de Task 5)

- [ ] **R5-UX: Frontend Design Review Admin** — lanzar Agent con `subagent_type: claude`

  Prompt al agente:
  ```
  Eres un UI/UX reviewer con estándares Huashu Design / Linear / Vercel Dashboard.
  Revisa src/features/lealtad/LoyaltyConfig.tsx y LoyaltyMiembros.tsx.

  Filosofía Huashu para admin dashboards:
  - Datos densos pero con breathing room (16px gap mínimo entre elementos)
  - Tablas: hover row visible, click para expandir, no cards innecesarios
  - Forms: labels pequeños (12px), inputs 36px height, focus ring brand color
  - Sin decoración vacía — cada píxel debe transportar información

  Checklist:
  1. CONFIG FORM: ¿Los campos de umbrales (plata/oro/diamante) muestran un progress visual?
     Sugerencia: pequeño diagrama de niveles en línea (●—●—●—●) que se actualiza al escribir.
  2. SLUG PREVIEW: ¿El campo slug muestra la URL completa resultante en tiempo real?
     Ej: mientras el admin escribe "farmacia-central" → se muestra "loyalty.integrika.mx/farmacia-central"
  3. TABLA MIEMBROS (Huashu-style): ¿La tabla tiene sticky header? ¿Sort por columnas (puntos, nivel, fecha)?
  4. VACÍO DE TABLA: ¿Qué muestra cuando no hay miembros? ¿Instrucción de cómo empezar?
  5. TIPOGRAFÍA ADMIN: ¿Usa font-mono para números de puntos/saldo? Números monoespaciados
     alinean mejor en tablas (Huashu / Linear pattern).
  6. FEEDBACK DE GUARDADO: ¿Al guardar config hay feedback inmediato? ¿O solo toast?
     Sugerencia: el botón cambia a "✓ Guardado" con checkmark animado por 2s.
  7. MOTION: ¿Los tabs tienen transición suave al cambiar? AnimatePresence entre Miembros/Config.

  Propón fixes con JSX/Tailwind. Mejoras quirúrgicas, no rediseño.
  ```

- [ ] **R5-UX-B: Aplicar fix prioritario — sort en tabla**

  En LoyaltyMiembros.tsx, añadir sort por puntos:
  ```typescript
  const [sortBy, setSortBy] = useState<'created_at' | 'puntos_disponibles'>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // En la query:
  .order(sortBy, { ascending: sortDir === 'asc' })
  ```

---

## Gate R5: Code Review Admin Panel (después de Task 5)

**Bloquea Task 6 si hay findings CRITICAL/HIGH.**

- [ ] **R5-A: Security review admin** — lanzar Agent con `subagent_type: claude`

  Prompt al agente:
  ```
  Security review de:
  - src/features/lealtad/LoyaltyConfig.tsx
  - src/features/lealtad/LoyaltyMiembros.tsx
  - src/pages/Lealtad.tsx
  - src/App.tsx (solo las rutas /lealtad nuevas)

  Checklist:
  1. AUTORIZACIÓN: ¿La ruta /lealtad está protegida con ProtectedRoute roles=['admin','manager']?
     ¿Qué pasa si un cajero navega directamente a /lealtad?
  2. SLUG INJECTION: En LoyaltyConfig, el slug se sanitiza con toLowerCase().replace(/[^a-z0-9-]/g, '').
     ¿Es suficiente para prevenir path traversal o caracteres problemáticos en URL?
  3. CONFIGURACIÓN PELIGROSA: ¿Puede un admin malicioso configurar pesos_por_punto = 0.001
     para generar millones de puntos por compra? ¿Hay validación de rangos razonables?
  4. EXPOSICIÓN DE DATOS: LoyaltyMiembros muestra teléfono/email en tabla — ¿hay paginación
     para evitar dump masivo de PII en una sola petición?
  5. RLS CHECK: ¿El query de loyalty_members en LoyaltyMiembros filtra por clinic_id activo del usuario?
     ¿O podría ver miembros de otras clínicas?

  Reporta: path:line severidad: problema. fix.
  ```

- [ ] **R5-B: Code review admin** — lanzar `caveman:cavecrew-reviewer`

  Archivos:
  ```
  src/features/lealtad/LoyaltyConfig.tsx
  src/features/lealtad/LoyaltyMiembros.tsx
  ```

  Prompt al agente:
  ```
  Review for: uncontrolled form state (LoyaltyConfig form init from config — stale on re-render?),
  missing validation (pesos_por_punto <= 0, slug empty, umbrales fuera de orden plata < oro < diamante),
  missing pagination in LoyaltyMiembros (limit 100 hardcoded), search debounce missing (query on every keystroke),
  immutability violations.
  path:line severity: problem. fix.
  ```

- [ ] **R5-C: Resolver findings CRITICAL/HIGH**

  Fix típico esperado: validar que `nivel_plata_umbral < nivel_oro_umbral < nivel_diamante_umbral` antes de guardar config.

---

## Task 6: PWA Cliente — Setup y Monedero

**Files:**
- Create: `src/pwa/LoyaltyApp.tsx`
- Create: `src/pwa/components/BottomNav.tsx`
- Create: `src/pwa/hooks/useLoyaltyPWA.ts`
- Create: `src/pwa/pages/Monedero.tsx`
- Create: `src/pwa/pages/Inicio.tsx`
- Create: `src/pwa/pages/Cuenta.tsx`
- Create: `src/pwa/pages/Promos.tsx`
- Modify: `src/App.tsx` (rutas PWA)

**Interfaces:**
- Consumes: `useLoyaltyConfig`, `useLoyaltyMember`, tipos de Task 3
- Produces: rutas `/loyalty/:slug/*` — app pública sin auth staff

- [ ] **Step 1: Instalar react-barcode**

```bash
bun add react-barcode
bun add --dev @types/react-barcode
```

- [ ] **Step 2: Crear useLoyaltyPWA.ts**

```typescript
// src/pwa/hooks/useLoyaltyPWA.ts
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { LoyaltyConfig, LoyaltyMember, LoyaltyMovimiento } from '@/features/lealtad/types'

// PWA usa phone/email guardado en localStorage para identificar al miembro
const STORAGE_KEY = 'loyalty_member_id'

export function useLoyaltyPWA(slug: string) {
  const [config, setConfig] = useState<LoyaltyConfig | null>(null)
  const [member, setMember] = useState<LoyaltyMember | null>(null)
  const [movimientos, setMovimientos] = useState<LoyaltyMovimiento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    loadConfig()
  }, [slug])

  async function loadConfig() {
    setLoading(true)
    const { data } = await supabase
      .from('loyalty_config' as never)
      .select('*')
      .eq('slug_farmacia', slug)
      .eq('programa_activo', true)
      .maybeSingle()
    setConfig(data as LoyaltyConfig | null)

    const savedId = localStorage.getItem(STORAGE_KEY + '_' + slug)
    if (savedId && data) {
      await loadMember(savedId)
    }
    setLoading(false)
  }

  async function loadMember(memberId: string) {
    const { data: m } = await supabase
      .from('loyalty_members' as never)
      .select('*')
      .eq('id', memberId)
      .eq('activo', true)
      .maybeSingle()
    if (m) {
      setMember(m as LoyaltyMember)
      const { data: movs } = await supabase
        .from('loyalty_movimientos' as never)
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(30)
      setMovimientos((movs as LoyaltyMovimiento[]) ?? [])
    }
  }

  async function loginByContact(query: string): Promise<boolean> {
    if (!config) return false
    const q = query.trim().replace(/[%(),]/g, '')
    const { data } = await supabase
      .from('loyalty_members' as never)
      .select('*')
      .eq('clinic_id', config.clinic_id)
      .eq('activo', true)
      .or(`telefono.eq.${q},email.eq.${q}`)
      .maybeSingle()
    if (!data) return false
    const m = data as LoyaltyMember
    localStorage.setItem(STORAGE_KEY + '_' + slug, m.id)
    setMember(m)
    await loadMember(m.id)
    return true
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY + '_' + slug)
    setMember(null)
    setMovimientos([])
  }

  async function updateMarketingConsent(value: boolean) {
    if (!member) return
    const now = new Date().toISOString()
    await supabase
      .from('loyalty_members' as never)
      .update({
        consent_marketing: value,
        consent_marketing_at: value ? now : member.consent_marketing_at,
      })
      .eq('id', member.id)
    setMember(prev => prev ? { ...prev, consent_marketing: value } : prev)
  }

  return { config, member, movimientos, loading, loginByContact, logout, updateMarketingConsent }
}
```

- [ ] **Step 3: Crear BottomNav.tsx**

```typescript
// src/pwa/components/BottomNav.tsx
import { NavLink } from 'react-router-dom'
import { Home, Tag, CreditCard, User } from 'lucide-react'

interface Props { slug: string }

export function BottomNav({ slug }: Props) {
  const base = `/loyalty/${slug}`
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-0.5 py-2 px-4 text-xs ${isActive ? 'text-primary' : 'text-muted-foreground'}`

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t flex justify-around max-w-md mx-auto">
      <NavLink to={`${base}/`} end className={cls}><Home className="h-5 w-5" />Inicio</NavLink>
      <NavLink to={`${base}/promos`} className={cls}><Tag className="h-5 w-5" />Promos</NavLink>
      <NavLink to={`${base}/monedero`} className={cls}><CreditCard className="h-5 w-5" />Monedero</NavLink>
      <NavLink to={`${base}/cuenta`} className={cls}><User className="h-5 w-5" />Cuenta</NavLink>
    </nav>
  )
}
```

- [ ] **Step 4: Crear Monedero.tsx**

```typescript
// src/pwa/pages/Monedero.tsx
import Barcode from 'react-barcode'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { valorCanjeMxn, NIVEL_LABEL } from '@/features/lealtad/types'
import type { LoyaltyConfig, LoyaltyMember, LoyaltyMovimiento } from '@/features/lealtad/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  config: LoyaltyConfig
  member: LoyaltyMember
  movimientos: LoyaltyMovimiento[]
}

export function Monedero({ config, member, movimientos }: Props) {
  const [hideSaldo, setHideSaldo] = useState(false)
  const saldoMxn = valorCanjeMxn(member.puntos_disponibles, config.valor_punto_mxn)

  return (
    <div className="space-y-6 pb-20">
      {/* Tarjeta virtual */}
      <div className="mx-4 rounded-2xl p-5 text-white shadow-lg"
           style={{ background: `linear-gradient(135deg, ${config.color_primario}, ${config.color_primario}cc)` }}>
        <p className="text-xs opacity-75 mb-1">{config.nombre_programa}</p>
        <p className="text-2xl font-bold mb-1">{member.nombre}</p>
        <p className="text-sm opacity-75">{NIVEL_LABEL[member.nivel]}</p>
        <div className="mt-4 bg-white rounded-xl p-3 flex justify-center">
          <Barcode
            value={member.codigo_barras}
            width={1.5}
            height={60}
            fontSize={12}
            displayValue
          />
        </div>
      </div>

      {/* Saldo */}
      <div className="mx-4 rounded-xl border p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Saldo disponible</p>
          {hideSaldo
            ? <p className="text-3xl font-bold tracking-widest">••••••</p>
            : <p className="text-3xl font-bold">eS$ {saldoMxn.toFixed(2)}</p>
          }
          <p className="text-xs text-muted-foreground mt-1">
            {member.puntos_disponibles.toLocaleString()} puntos
          </p>
        </div>
        <button onClick={() => setHideSaldo(v => !v)} className="text-muted-foreground">
          {hideSaldo ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
        </button>
      </div>

      {/* Historial */}
      <div className="mx-4">
        <h2 className="font-semibold mb-3">Historial de movimientos</h2>
        {movimientos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos aún.</p>
        ) : (
          <div className="space-y-2">
            {movimientos.map(m => (
              <div key={m.id} className="flex justify-between items-center py-2 border-b">
                <div>
                  <p className="text-sm">{m.descripcion ?? m.tipo}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(m.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${m.puntos >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {m.puntos >= 0 ? '+' : ''}{m.puntos} pts
                  </p>
                  <p className="text-xs text-muted-foreground">Saldo: {m.saldo_post}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Crear Inicio.tsx, Promos.tsx, Cuenta.tsx**

```typescript
// src/pwa/pages/Inicio.tsx
import { valorCanjeMxn, NIVEL_LABEL } from '@/features/lealtad/types'
import type { LoyaltyConfig, LoyaltyMember } from '@/features/lealtad/types'
import { useNavigate } from 'react-router-dom'

interface Props { config: LoyaltyConfig; member: LoyaltyMember; slug: string }

export function Inicio({ config, member, slug }: Props) {
  const navigate = useNavigate()
  const saldo = valorCanjeMxn(member.puntos_disponibles, config.valor_punto_mxn)

  return (
    <div className="space-y-4 pb-20 px-4 pt-4">
      <div className="rounded-xl p-4 text-white"
           style={{ background: config.color_primario }}>
        <p className="text-sm opacity-75">Hola, {member.nombre.split(' ')[0]}</p>
        <p className="text-3xl font-bold mt-1">eS$ {saldo.toFixed(2)}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
            {NIVEL_LABEL[member.nivel]}
          </span>
          <span className="text-xs opacity-75">
            {member.puntos_disponibles.toLocaleString()} puntos
          </span>
        </div>
      </div>

      <button
        onClick={() => navigate(`/loyalty/${slug}/monedero`)}
        className="w-full rounded-xl border p-4 text-left hover:bg-muted/30"
      >
        <p className="font-semibold">Ver mi Monedero</p>
        <p className="text-sm text-muted-foreground">Código de barras + historial completo</p>
      </button>

      <div className="rounded-xl border p-4">
        <p className="text-xs text-muted-foreground mb-2">¿Cómo funciona?</p>
        <div className="space-y-1 text-sm">
          <p>💰 Cada ${config.pesos_por_punto} MXN = 1 punto</p>
          <p>🎁 {config.puntos_minimos_canje} puntos = eS$ {valorCanjeMxn(config.puntos_minimos_canje, config.valor_punto_mxn).toFixed(2)} de descuento</p>
          <p>⏱ Puntos vencen tras {config.expiracion_dias_inactividad} días sin compra</p>
        </div>
      </div>
    </div>
  )
}
```

```typescript
// src/pwa/pages/Promos.tsx
import type { LoyaltyConfig } from '@/features/lealtad/types'

interface Props { config: LoyaltyConfig }

export function Promos({ config }: Props) {
  return (
    <div className="pb-20 px-4 pt-4">
      <h1 className="text-xl font-bold mb-4">Promociones</h1>
      <div className="rounded-xl border p-6 text-center text-muted-foreground">
        <p className="text-4xl mb-2">🎁</p>
        <p className="font-medium">Próximamente</p>
        <p className="text-sm mt-1">Las promociones de {config.nombre_programa} aparecerán aquí.</p>
      </div>
    </div>
  )
}
```

```typescript
// src/pwa/pages/Cuenta.tsx
import type { LoyaltyConfig, LoyaltyMember } from '@/features/lealtad/types'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'

interface Props {
  config: LoyaltyConfig
  member: LoyaltyMember
  onUpdateMarketing: (v: boolean) => void
  onLogout: () => void
}

export function Cuenta({ config, member, onUpdateMarketing, onLogout }: Props) {
  return (
    <div className="pb-20 px-4 pt-4 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
          {member.nombre.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold">{member.nombre}</p>
          <p className="text-sm text-muted-foreground">{member.telefono ?? member.email}</p>
        </div>
      </div>

      <div className="space-y-4 border rounded-xl p-4">
        <h2 className="font-medium">Notificaciones y comunicaciones</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Recibir ofertas y boletines</p>
            <p className="text-xs text-muted-foreground">Email{member.consent_marketing_canales.includes('telegram') ? ' + Telegram' : ''}</p>
          </div>
          <Switch
            checked={member.consent_marketing}
            onCheckedChange={onUpdateMarketing}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Puedes cancelar en cualquier momento. Nunca compartiremos tus datos con terceros.
        </p>
      </div>

      <div className="border rounded-xl p-4 space-y-2">
        <h2 className="font-medium">Legales</h2>
        <a href="#" className="block text-sm text-primary">Aviso de Privacidad (LFPDPPP)</a>
        <a href="#" className="block text-sm text-primary">Términos del Programa</a>
        <a href="#" className="block text-sm text-primary">Solicitar derechos ARCO</a>
      </div>

      <Button variant="outline" className="w-full" onClick={onLogout}>
        Cerrar sesión en este dispositivo
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        {config.nombre_programa} · Powered by integrika.mx
      </p>
    </div>
  )
}
```

- [ ] **Step 6: Crear LoyaltyApp.tsx (root PWA)**

```typescript
// src/pwa/LoyaltyApp.tsx
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useLoyaltyPWA } from './hooks/useLoyaltyPWA'
import { BottomNav } from './components/BottomNav'
import { Inicio } from './pages/Inicio'
import { Monedero } from './pages/Monedero'
import { Promos } from './pages/Promos'
import { Cuenta } from './pages/Cuenta'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

function LoginScreen({ onLogin, programName, color }: {
  onLogin: (q: string) => Promise<boolean>
  programName: string
  color: string
}) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    setError(null)
    const ok = await onLogin(query)
    if (!ok) setError('No encontramos tu cuenta. Verifica tu teléfono o email.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-6">
      <div className="text-center">
        <div className="h-16 w-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold"
             style={{ background: color }}>💳</div>
        <h1 className="text-2xl font-bold">{programName}</h1>
        <p className="text-muted-foreground text-sm mt-1">Ingresa con tu teléfono o email</p>
      </div>
      <div className="w-full max-w-xs space-y-3">
        <Input
          placeholder="Teléfono o email registrado"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handle()}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" onClick={handle} disabled={loading || query.trim().length < 5}>
          {loading ? 'Buscando...' : 'Ver mi Monedero'}
        </Button>
      </div>
    </div>
  )
}

export function LoyaltyApp() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { config, member, movimientos, loading, loginByContact, logout, updateMarketingConsent } = useLoyaltyPWA(slug)

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando...</div>
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6">
        <div>
          <p className="text-4xl mb-4">💊</p>
          <p className="font-semibold">Programa no encontrado</p>
          <p className="text-sm text-muted-foreground mt-2">Verifica la URL o consulta con tu farmacia.</p>
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <LoginScreen
        onLogin={loginByContact}
        programName={config.nombre_programa}
        color={config.color_primario}
      />
    )
  }

  const base = `/loyalty/${slug}`

  return (
    <div className="max-w-md mx-auto min-h-screen relative">
      <Routes>
        <Route path="/" element={<Inicio config={config} member={member} slug={slug} />} />
        <Route path="/promos" element={<Promos config={config} />} />
        <Route path="/monedero" element={<Monedero config={config} member={member} movimientos={movimientos} />} />
        <Route path="/cuenta" element={
          <Cuenta
            config={config}
            member={member}
            onUpdateMarketing={updateMarketingConsent}
            onLogout={logout}
          />
        } />
        <Route path="*" element={<Navigate to={base} replace />} />
      </Routes>
      <BottomNav slug={slug} />
    </div>
  )
}
```

- [ ] **Step 7: Añadir rutas PWA en App.tsx**

```typescript
// import:
import { LoyaltyApp } from '@/pwa/LoyaltyApp'

// Ruta pública (sin ProtectedRoute) — antes del catch-all:
<Route path="/loyalty/:slug/*" element={<LoyaltyApp />} />
```

- [ ] **Step 8: tsc check**

```bash
bun run tsc --noEmit
```
Expected: 0 errores

- [ ] **Step 9: Commit**

```bash
git add src/pwa/ src/App.tsx
git commit -m "feat: loyalty PWA customer app — monedero, barcode, login by phone/email"
```

---

## Task 6.5: Vercel Deploy — PWA loyalty.integrika.mx

**Decisión arquitectónica:** La PWA cliente (`/loyalty/:slug`) se despliega en **Vercel** separado del SaaS principal (Cloudflare Workers). Ventajas:
- Edge Network de Vercel optimizado para SPAs públicas sin auth
- Preview deployments automáticos por branch
- Analytics de Vercel Web Analytics (free tier) para métricas PWA
- Domain: `loyalty.integrika.mx` → CNAME a Vercel

**Files:**
- Create: `loyalty-pwa/` (nuevo workspace separado dentro del monorepo o repo separado)
- Create: `loyalty-pwa/vercel.json`
- Create: `loyalty-pwa/vite.config.ts`
- Create: `loyalty-pwa/package.json`

**Opción A (recomendada): Workspace separado en el mismo repo**

- [ ] **Step 1: Crear workspace loyalty-pwa**

```bash
mkdir loyalty-pwa
cd loyalty-pwa
bun init -y
bun add react react-dom react-router-dom motion geist react-barcode @supabase/supabase-js date-fns
bun add -d vite @vitejs/plugin-react typescript tailwindcss autoprefixer
```

- [ ] **Step 2: Crear vercel.json**

```json
{
  "framework": "vite",
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ],
  "regions": ["iad1", "gru1"]
}
```

`gru1` = São Paulo — edge más cercano a México.

- [ ] **Step 3: Crear vite.config.ts con PWA manifest**

```typescript
// loyalty-pwa/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          motion: ['motion'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
```

- [ ] **Step 4: PWA Manifest (installable)**

En `loyalty-pwa/public/manifest.json`:
```json
{
  "name": "Mi Monedero Farmacia",
  "short_name": "Monedero",
  "description": "Tu programa de lealtad farmacia",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f766e",
  "theme_color": "#0f766e",
  "orientation": "portrait",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

En `loyalty-pwa/index.html`:
```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#0f766e" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

- [ ] **Step 5: Configurar variables en Vercel**

```bash
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
```

**NUNCA** poner service_role key en variables de Vercel PWA — solo `anon_key`.

- [ ] **Step 6: Deploy inicial**

```bash
vercel --cwd loyalty-pwa --prod
```

Expected: URL `loyalty-pwa-xxx.vercel.app`

- [ ] **Step 7: Configurar dominio loyalty.integrika.mx**

```bash
vercel domains add loyalty.integrika.mx --cwd loyalty-pwa
```

En DNS de integrika.mx, añadir:
```
CNAME  loyalty  cname.vercel-dns.com
```

- [ ] **Step 8: Vercel Analytics (opcional, free)**

```bash
bun add @vercel/analytics --cwd loyalty-pwa
```

En el root de la PWA:
```typescript
import { Analytics } from '@vercel/analytics/react'
// <Analytics /> en App root
```

- [ ] **Step 9: Commit**

```bash
git add loyalty-pwa/
git commit -m "feat: loyalty PWA Vercel deployment config + PWA manifest"
```

---

## Gate R6-UX: UI/UX Review PWA — Emil Kowalski Standard (después de Task 6 + 6.5)

**El gate más importante de diseño — es la cara del cliente final.**

- [ ] **R6-UX-A: Frontend Design Review PWA** — lanzar Agent con `subagent_type: claude`

  Prompt al agente:
  ```
  Eres un UI/UX reviewer con estándares Emil Kowalski (motion.dev) y Vercel Design.
  Revisa todos los archivos en src/pwa/ y loyalty-pwa/ (si existe).

  Referentes exactos para este review:
  - Emil Kowalski: https://emilkowal.ski — atención a micro-moments, spring physics
  - Vercel Design: tokens semánticos, tipografía Geist, modo oscuro
  - Farmacias del Ahorro app: referente de mercado local (simpleza + claridad)

  PANTALLA LOGIN (LoyaltyApp.tsx — LoginScreen):
  1. ¿Hay un "hero moment" al cargar? La primera impresión debe transmitir confianza + premium.
     ¿El logo de la farmacia se muestra con entrada animada?
  2. ¿El input de teléfono/email tiene keyboard type="tel" para móvil?
  3. ¿Hay feedback visual mientras se busca (shimmer skeleton o spinner)?

  PANTALLA INICIO (Inicio.tsx):
  4. ¿El saldo usa count-up animation (AnimatedNumber de NivelCard)?
  5. ¿La tarjeta tiene el NivelCard component con shimmer para Diamante?
  6. ¿Hay micro-interaction al tocar "Ver mi Monedero"?

  PANTALLA MONEDERO (Monedero.tsx):
  7. ¿NivelCard está integrado con showBarcode=true?
  8. ¿El historial de movimientos usa listItemVariants (stagger de entrada)?
  9. ¿Los movimientos positivos (+puntos) y negativos (-puntos) tienen colores distintos con motion?
  10. ¿El botón hide/show saldo tiene micro-animation (eye icon flip)?

  BOTTOM NAV (BottomNav.tsx):
  11. ¿El tab activo tiene indicador animado (underline o dot con layout animation)?
  12. ¿Los iconos tienen whileTap: {scale: 0.85}?

  PANTALLA CUENTA (Cuenta.tsx):
  13. ¿El toggle de marketing consent tiene feedback inmediato + confirmación toast?
  14. ¿El botón "Cerrar sesión" tiene confirmación o es one-tap directo?
     (Emil Kowalski: no pedir confirmación para acciones reversibles)

  GENERAL PWA:
  15. ¿Todas las transiciones entre rutas tienen AnimatePresence?
  16. ¿prefers-reduced-motion está respetado en todos los componentes con Motion?
  17. ¿La PWA se ve bien en 320px (iPhone SE), 375px (iPhone 14), 414px (Android xl)?

  Propón JSX/Tailwind fixes concretos. Prioriza por impacto visual en el cliente final.
  ```

- [ ] **R6-UX-B: Aplicar fixes de motion críticos**

  Fix prioritario — transiciones entre rutas PWA:
  ```typescript
  // En LoyaltyApp.tsx, envolver Routes con AnimatePresence:
  import { AnimatePresence, motion } from 'motion/react'
  import { useLocation } from 'react-router-dom'

  const location = useLocation()

  <AnimatePresence mode="wait">
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
    >
      <Routes location={location}>
        {/* rutas */}
      </Routes>
    </motion.div>
  </AnimatePresence>
  ```

- [ ] **R6-UX-C: Lighthouse PWA audit**

```bash
# Con Vercel deploy activo:
npx lighthouse https://loyalty.integrika.mx/test-slug --output json --only-categories=performance,accessibility,best-practices,pwa
```

Expected mínimo:
- Performance: ≥ 85
- Accessibility: ≥ 90
- Best Practices: ≥ 90
- PWA: ≥ 85 (installable)

Si falla Performance: revisar bundle size, lazy loading de react-barcode.

---

## Gate R6: Auditoría PWA — Seguridad + Privacidad Cliente (después de Task 6)

**Bloquea Task 7 si hay findings CRITICAL/HIGH.**

Este gate cubre la superficie más expuesta al cliente final (ruta pública sin auth).

- [ ] **R6-A: Security review PWA** — lanzar Agent con `subagent_type: claude`

  Prompt al agente:
  ```
  Security review de la PWA pública (ruta /loyalty/:slug sin autenticación staff):
  - src/pwa/LoyaltyApp.tsx
  - src/pwa/hooks/useLoyaltyPWA.ts
  - src/pwa/pages/Cuenta.tsx
  - src/pwa/pages/Monedero.tsx

  Checklist crítico:
  1. ENUMERACIÓN DE MIEMBROS: loginByContact() busca con .or(telefono.eq.X,email.eq.X).
     ¿Hay rate limiting en Supabase para esta query pública? Sin rate limiting, un atacante
     puede enumerar todos los teléfonos/emails registrados.
  2. PERSISTENCIA EN LOCALSTORAGE: Se guarda member_id (UUID) en localStorage bajo
     clave loyalty_member_id_{slug}. ¿Es suficiente para identificar sin revelar PII?
     ¿El UUID es predecible (secuencial) o aleatorio?
  3. AUTORIZACIÓN PWA: Las queries de la PWA (loyalty_members, loyalty_movimientos, loyalty_config)
     ¿están protegidas por RLS? ¿Un cliente puede ver movimientos de otro cliente con su UUID?
  4. OPT-OUT MARKETING: El toggle en Cuenta.tsx hace UPDATE directo a loyalty_members.
     ¿Hay validación de que el member_id en localStorage pertenece realmente a quien hace la request?
  5. SLUG ADIVINABLE: /loyalty/farmacia-central — ¿un atacante puede enumerar slugs?
     ¿La query de config revela info si el slug no existe?
  6. DATOS EN HISTORIAL: loyalty_movimientos muestra descripcion text — ¿puede contener PII
     ingresado por el cajero que no debería mostrarse al cliente?
  7. LOGOUT: ¿El logout solo borra localStorage o también invalida alguna sesión server-side?

  Reporta: path:line severidad: problema. fix.
  ```

- [ ] **R6-B: Code review PWA** — lanzar `caveman:cavecrew-reviewer`

  Archivos:
  ```
  src/pwa/LoyaltyApp.tsx
  src/pwa/hooks/useLoyaltyPWA.ts
  src/pwa/pages/Monedero.tsx
  src/pwa/components/BottomNav.tsx
  ```

  Prompt al agente:
  ```
  Review for: memory leaks (useEffect sin cleanup en loadConfig/loadMember),
  stale closure in useLoyaltyPWA (slug captured in closure — reacts to slug changes?),
  missing error states (config=null vs programa inactivo vs network error — same UI?),
  barcode accessibility (react-barcode alt text para lectores de pantalla),
  missing loading state in loginByContact,
  BottomNav NavLink to /loyalty/{slug}/ vs /loyalty/{slug} trailing slash mismatch.
  path:line severity: problem. fix.
  ```

- [ ] **R6-C: Resolver findings CRITICAL/HIGH**

  Fix típico más importante: confirmar que RLS en `loyalty_movimientos` bloquea que un cliente
  vea movimientos de otro cliente. La política actual solo cubre staff autenticado —
  verificar si la PWA usa anon key y si RLS permite lectura anon por member_id.

---

## Task 7: Email de Bienvenida (Resend)

**Files:**
- Create: `supabase/functions/loyalty-welcome/index.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `LoyaltyMember` recién creado, `LoyaltyConfig`
- Produces: email de bienvenida vía Resend cuando un miembro se registra

- [ ] **Step 1: Crear edge function**

```typescript
// supabase/functions/loyalty-welcome/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

serve(async (req) => {
  if (req.method === 'GET') return new Response('OK', { status: 200 })

  try {
    const { member_id, clinic_id } = await req.json()
    if (!member_id || !clinic_id) {
      return new Response(JSON.stringify({ error: 'member_id y clinic_id requeridos' }), { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const [{ data: member }, { data: cfg }] = await Promise.all([
      supabase.from('loyalty_members').select('nombre,email,puntos_disponibles,codigo_barras,nivel')
        .eq('id', member_id).single(),
      supabase.from('loyalty_config').select('nombre_programa,slug_farmacia,color_primario,valor_punto_mxn,pesos_por_punto')
        .eq('clinic_id', clinic_id).single(),
    ])

    if (!member?.email || !cfg) {
      return new Response(JSON.stringify({ ok: false, reason: 'sin_email_o_config' }), { status: 200 })
    }

    const pwaUrl = `https://loyalty.integrika.mx/${cfg.slug_farmacia}`
    const html = `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <div style="background:${cfg.color_primario};color:white;border-radius:12px;padding:24px;text-align:center">
    <h1 style="margin:0;font-size:24px">¡Bienvenido al ${cfg.nombre_programa}!</h1>
  </div>
  <div style="padding:24px">
    <p>Hola <strong>${member.nombre}</strong>,</p>
    <p>Ya eres miembro de <strong>${cfg.nombre_programa}</strong>. Cada $${cfg.pesos_por_punto} MXN que gastes acumulas puntos canjeables por descuentos.</p>
    <p><strong>Tu código:</strong> <code style="font-size:18px;letter-spacing:2px">${member.codigo_barras}</code></p>
    <p>Muéstralo en caja para acumular puntos en cada compra.</p>
    <a href="${pwaUrl}" style="display:inline-block;margin-top:16px;background:${cfg.color_primario};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
      Ver mi Monedero online
    </a>
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
    <p style="font-size:12px;color:#888">
      Recibiste este correo porque te registraste en ${cfg.nombre_programa}.<br>
      <a href="${pwaUrl}/cuenta" style="color:#888">Cancelar suscripción a comunicaciones</a>
    </p>
  </div>
</body></html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${cfg.nombre_programa} <noreply@integrika.mx>`,
        to: [member.email],
        subject: `¡Bienvenido al ${cfg.nombre_programa}!`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[loyalty-welcome] Resend error:', err)
      return new Response(JSON.stringify({ ok: false, error: err }), { status: 200 })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (e) {
    console.error('[loyalty-welcome] error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
```

- [ ] **Step 2: Registrar en config.toml**

```toml
[functions.loyalty-welcome]
verify_jwt = true
```

- [ ] **Step 3: Deploy**

```bash
supabase functions deploy loyalty-welcome --linked
```

- [ ] **Step 4: Llamar desde LoyaltyAfiliacionModal tras registro exitoso**

En `LoyaltyAfiliacionModal.tsx`, después de `onRegistered(member)`:

```typescript
// Trigger welcome email (best-effort, no bloquear UI)
supabase.functions.invoke('loyalty-welcome', {
  body: { member_id: member.id, clinic_id: clinicId },
}).catch(() => { /* best-effort */ })
```

- [ ] **Step 5: tsc check + commit**

```bash
bun run tsc --noEmit
git add supabase/functions/loyalty-welcome/ supabase/config.toml src/features/lealtad/LoyaltyAfiliacionModal.tsx
git commit -m "feat: loyalty welcome email via Resend on member registration"
```

---

## Gate R7: Security Review Email + Edge Function (después de Task 7)

**Bloquea Task 8 si hay findings CRITICAL/HIGH.**

- [ ] **R7-A: Security review edge function** — lanzar Agent con `subagent_type: claude`

  Prompt al agente:
  ```
  Security review de supabase/functions/loyalty-welcome/index.ts.

  Checklist:
  1. SECRETOS: RESEND_API_KEY y SUPABASE_SERVICE_ROLE_KEY — ¿solo se leen de Deno.env?
     ¿Nunca se loguean (console.log/console.error los valores)?
  2. HTML INJECTION: El template de email incluye member.nombre y cfg.nombre_programa
     sin sanitizar. ¿Puede un nombre con <script> o <img onerror=> inyectar HTML?
     Nota: el email se genera server-side, pero algunos clientes de email renderizan HTML.
  3. VALIDACIÓN INPUT: member_id y clinic_id se reciben del frontend como strings.
     ¿Se validan como UUIDs válidos antes de usarlos en queries?
     Un valor malicioso podría causar comportamiento inesperado en la query.
  4. SERVICE ROLE KEY: La edge function usa service_role para leer loyalty_members y loyalty_config.
     ¿Esto significa que bypasea RLS? ¿Es necesario o podría usarse anon key + RLS?
  5. UNSUBSCRIBE LINK: El link de cancelación apunta a {pwaUrl}/cuenta.
     ¿Es suficiente para cumplir CAN-SPAM y buenas prácticas de email?
     ¿Existe un unsubscribe link directo (one-click) o requiere login?
  6. AUTENTICACIÓN EDGE FUNCTION: verify_jwt = true — ¿la función solo es callable por
     usuarios autenticados? ¿Un anon podría trigger emails masivos?
  7. RATE LIMIT: ¿Hay protección contra spam de emails si se registran muchos miembros?

  Reporta: path:line severidad: problema. fix.
  ```

- [ ] **R7-B: Resolver findings CRITICAL/HIGH**

  Fix más crítico esperado: sanitizar `member.nombre` en HTML del email.
  Ejemplo:
  ```typescript
  function escapeHtml(str: string): string {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
              .replace(/"/g,'&quot;').replace(/'/g,'&#039;')
  }
  // Uso: escapeHtml(member.nombre)
  ```

---

## Task 8: Tests de Integración PWA y Panel

**Files:**
- Create: `src/test/lealtad/loyalty-panel.test.tsx`

- [ ] **Step 1: Escribir tests**

```typescript
// src/test/lealtad/loyalty-panel.test.tsx
import { describe, it, expect } from 'vitest'
import { calcularPuntosPreview, valorCanjeMxn, nivelMultiplicador, NIVEL_LABEL } from '@/features/lealtad/types'
import type { LoyaltyConfig } from '@/features/lealtad/types'

const mockConfig: LoyaltyConfig = {
  clinic_id: 'test',
  nombre_programa: 'Test',
  slug_farmacia: 'test',
  color_primario: '#000',
  logo_url: null,
  pesos_por_punto: 10,
  valor_punto_mxn: 0.10,
  puntos_minimos_canje: 100,
  nivel_plata_umbral: 500,
  nivel_oro_umbral: 1500,
  nivel_diamante_umbral: 4000,
  multiplicador_plata: 1.10,
  multiplicador_oro: 1.25,
  multiplicador_diamante: 1.50,
  expiracion_dias_inactividad: 180,
  programa_activo: true,
  actualizado_at: '',
}

describe('nivelMultiplicador', () => {
  it('bronce = 1.0', () => expect(nivelMultiplicador('bronce', mockConfig)).toBe(1.0))
  it('plata = 1.10', () => expect(nivelMultiplicador('plata', mockConfig)).toBe(1.10))
  it('oro = 1.25', () => expect(nivelMultiplicador('oro', mockConfig)).toBe(1.25))
  it('diamante = 1.50', () => expect(nivelMultiplicador('diamante', mockConfig)).toBe(1.50))
})

describe('valorCanjeMxn', () => {
  it('100 puntos = $10 MXN', () => expect(valorCanjeMxn(100, 0.10)).toBe(10))
  it('453 puntos = $45.30 MXN', () => expect(valorCanjeMxn(453, 0.10)).toBe(45.3))
  it('0 puntos = $0', () => expect(valorCanjeMxn(0, 0.10)).toBe(0))
})

describe('calcularPuntosPreview — flujo completo', () => {
  it('cliente oro compra $200', () => {
    const mult = nivelMultiplicador('oro', mockConfig)
    const pts = calcularPuntosPreview(200, mockConfig.pesos_por_punto, mult)
    expect(pts).toBe(25) // floor(200/10 * 1.25) = floor(25) = 25
  })

  it('cliente diamante compra $300', () => {
    const mult = nivelMultiplicador('diamante', mockConfig)
    const pts = calcularPuntosPreview(300, mockConfig.pesos_por_punto, mult)
    expect(pts).toBe(45) // floor(300/10 * 1.50) = floor(45) = 45
  })
})

describe('NIVEL_LABEL', () => {
  it('tiene todos los niveles', () => {
    expect(NIVEL_LABEL.bronce).toBeDefined()
    expect(NIVEL_LABEL.plata).toBeDefined()
    expect(NIVEL_LABEL.oro).toBeDefined()
    expect(NIVEL_LABEL.diamante).toBeDefined()
  })
})
```

- [ ] **Step 2: Correr tests**

```bash
bun run vitest run src/test/lealtad/
```
Expected: todos los tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/test/lealtad/
git commit -m "test: loyalty panel and points calculation tests"
```

---

## Gate R8: Auditoría Final Pre-Deploy (antes de Task 9)

**Bloquea deploy si hay findings CRITICAL/HIGH.**

Gate integral — revisa el diff completo del módulo, no archivo por archivo.

- [ ] **R8-A: Full security sweep** — lanzar Agent con `subagent_type: claude` desde `C:\Users\pablo\clinica-mexico-spa`

  Prompt al agente:
  ```
  Eres un pentester senior. Audita el módulo completo de fidelización antes de deploy a producción.
  Scope: todos los archivos en src/features/lealtad/, src/pwa/, supabase/migrations/*loyalty*,
  supabase/functions/loyalty-welcome/.

  OWASP Top 10 checklist:
  A01 Broken Access Control:
  - ¿Puede un cajero llamar loyalty_redeem para cualquier miembro de cualquier clínica?
  - ¿Puede un cliente PWA leer movimientos de otro cliente?
  - ¿Puede un admin de Clínica A ver miembros de Clínica B?

  A02 Cryptographic Failures:
  - ¿PII (teléfono, email, fecha_nacimiento) en loyalty_members está cifrado en reposo?
  - ¿codigo_barras es adivinable? ¿Es aceptable para este caso de uso?

  A03 Injection:
  - ¿Algún parámetro de usuario llega a SQL sin parametrización?
  - ¿Supabase .or() con strings del usuario — PostgREST filter injection posible?

  A05 Security Misconfiguration:
  - ¿RLS habilitado en TODAS las tablas loyalty_*?
  - ¿SECURITY DEFINER RPCs con SET search_path = public?
  - ¿verify_jwt en edge functions?

  A07 Identification and Authentication Failures:
  - ¿PWA identifica al cliente solo por UUID en localStorage — es suficiente?
  - ¿Existe mecanismo de revocación si un dispositivo se roba?

  Compliance México:
  - ¿LFPDPPP: 3 consentimientos separados con timestamp?
  - ¿COFEPRIS: medicamentos controlados excluidos de marketing (permite_publicidad)?
  - ¿Datos de menores — restricción de edad implementada?

  Formato: hallazgo, riesgo concreto, fix recomendado, severidad.
  ```

- [ ] **R8-B: Full DB audit final** — lanzar los 3 agentes DB en paralelo

  ```
  Agente 1 (claude-db:schema-integrity-auditor):
  Audita el esquema completo resultante después de todas las migrations loyalty.
  Revisar coherencia del esquema total — ¿loyalty_movimientos.plan_id puede ser NULL
  cuando el movimiento no es de un plan? ¿Es correcto o debería ser NOT NULL con valor especial?

  Agente 2 (claude-db:migration-safety-auditor):
  Audita las 2 migrations en conjunto:
  - ¿El orden de creación de tablas es correcto (loyalty_planes antes de loyalty_movimientos)?
  - ¿loyalty_expire_points() corre sin errores si loyalty_config no existe para una clínica?
  - ¿pg_cron job es idempotente (no crea duplicados si se re-ejecuta la migration)?

  Agente 3 (claude-db:performance-scale-auditor):
  Proyección a 12 meses con 50 farmacias × 500 miembros × 10 ventas/día:
  - loyalty_movimientos: ~27M filas/año — ¿índice member_id+created_at suficiente?
  - loyalty_expire_points(): ~25K miembros activos — ¿loop en PL/pgSQL escala?
  - Recomendación de particionado por created_at para loyalty_movimientos.
  ```

- [ ] **R8-C: Code review diff completo** — lanzar `caveman:cavecrew-reviewer`

  Prompt al agente:
  ```
  Run: git diff main...HEAD
  Review the complete diff of the loyalty module. Focus on:
  - Anything that would surprise a maintainer 6 months from now
  - Missing error boundaries in React components
  - console.log statements left in production code
  - Dead code or commented-out blocks
  - Inconsistent naming (loyalty_ vs lealtad_ — Spanish/English mixing)
  - Missing aria-labels on interactive elements (accessibility)
  path:line severity: problem. fix.
  ```

- [ ] **R8-D: Resolver todos los findings CRITICAL/HIGH antes de deploy**

  Si quedan MEDIUM/LOW sin resolver, documentar en sección "Deuda Técnica" abajo.

---

## Task 9: Build Final y Verificación

- [ ] **Step 1: Build completo**

```bash
bun run build
```
Expected: sin errores, bundle generado en `dist/`

- [ ] **Step 2: tsc final**

```bash
bun run tsc --noEmit
```
Expected: 0 errores

- [ ] **Step 3: Todos los tests**

```bash
bun run vitest run
```
Expected: todos los tests existentes + nuevos PASS

- [ ] **Step 4: Deploy**

```bash
wrangler deploy
```
Expected: deploy exitoso en integrika.mx

- [ ] **Step 5: Verificar en producción**

Abrir `integrika.mx`:
- [ ] Nav "Lealtad" visible para admin/manager
- [ ] `/lealtad` carga con tabs Miembros + Configuración
- [ ] POS farmacia: panel fidelización aparece en cobro
- [ ] `loyalty.integrika.mx/{slug}` → redirige al login de PWA

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "feat: loyalty module etapa 1 — MVP fidelización farmacia completo"
```

---

## Self-Review

**Spec coverage:**
- [x] 6 tablas DB con RLS multi-tenant — Task 1
- [x] RPCs register_sale, redeem, expiry, level calc — Task 2
- [x] TypeScript types + hooks — Task 3
- [x] Panel POS búsqueda/afiliación/canje — Task 4
- [x] 3 consentimientos LFPDPPP en afiliación — Task 4 (LoyaltyAfiliacionModal)
- [x] Admin LoyaltyConfig (reglas, niveles, slug) — Task 5
- [x] Admin LoyaltyMiembros (lista, búsqueda) — Task 5
- [x] PWA Inicio + Monedero + Cuenta + Promos — Task 6
- [x] Código de barras en PWA (react-barcode) — Task 6
- [x] Opt-out marketing en PWA Cuenta (toggle) — Task 6
- [x] Email bienvenida Resend — Task 7
- [x] pg_cron vencimiento puntos — Task 2 (loyalty_expire_points)
- [x] permite_publicidad en medicamentos — Task 1
- [x] Tests puntos, niveles, canje — Tasks 3 + 8
- [x] Build + deploy final — Task 9

**Gaps detectados y resueltos:**
- `loyalty_movimientos.plan_id` FK correctamente referenciando tabla que se crea en la misma migration — orden en SQL correcto (loyalty_planes antes de loyalty_movimientos)
- `react-barcode` se instala en Task 6 antes de usarlo en Monedero.tsx
- Email welcome es best-effort (no bloquea UI si falla)
- PWA login por contacto: búsqueda exacta (`.eq` no `.ilike`) para seguridad

---

## Deuda Técnica Registrada

Findings MEDIUM/LOW de los gates que no bloquean deploy pero deben resolverse antes de Etapa 2:

| # | Gate | Archivo | Finding | Severidad |
|---|------|---------|---------|-----------|
| — | — | — | (se llena durante ejecución del plan) | — |

---

## Resumen de Gates

| Gate | Después de Task | Dominio | Agentes | Bloquea |
|------|----------------|---------|---------|---------|
| R1 | Task 1 — DB Migrations | DB Schema | schema-integrity + migration-safety + performance (×3 paralelo) | Task 2 |
| R2 | Task 2 — RPCs | Seguridad DB | Security Agent + performance-scale (×2 paralelo) | Task 2.5 |
| R2.5 | Task 2.5 — Design System | UI/UX | Design Reviewer (contraste, motion, a11y) | Task 3 |
| R3 | Task 3 — Types/Hooks | Código | cavecrew-reviewer | Task 4 |
| R4-UX | Task 4 — POS Panel | UI/UX | Design Reviewer (Emil Kowalski micro-interactions) | Gate R4 |
| R4 | Task 4 — POS Panel | Seguridad/Legal | LFPDPPP Agent + Security Agent + cavecrew-reviewer (×3 paralelo) | Task 5 |
| R5-UX | Task 5 — Admin | UI/UX | Design Reviewer (Huashu dashboard density) | Gate R5 |
| R5 | Task 5 — Admin | Seguridad | Security Agent + cavecrew-reviewer (×2 paralelo) | Task 6 |
| R6-UX | Task 6 — PWA | UI/UX + Perf | Design Reviewer + Lighthouse (×2) | Gate R6 |
| R6 | Task 6 — PWA | Seguridad | Security Agent + cavecrew-reviewer (×2 paralelo) | Task 7 |
| R7 | Task 7 — Email | Seguridad | Security Agent | Task 8 |
| R8 | Task 8 — Tests | Final | Full security sweep + DB audit ×3 + Design final + cavecrew-reviewer (×6 paralelo) | Deploy |

**Total: 12 gates, 28 invocaciones de agentes especializados**

### Distribución por dominio
- 🗄️ DB Schema/Performance: 6 invocaciones (R1×3, R2×1, R8×3)
- 🔒 Seguridad / LFPDPPP / COFEPRIS: 10 invocaciones (R2, R4, R5, R6, R7, R8)
- 🎨 UI/UX / Diseño / Motion / a11y: 5 invocaciones (R2.5, R4-UX, R5-UX, R6-UX, R8)
- 🧹 Code Quality: 7 invocaciones (R3, R4, R5, R6, R8)

---

*Plan: 2026-06-24 | Etapa 1 MVP | Etapas 2-4 en planes separados*
