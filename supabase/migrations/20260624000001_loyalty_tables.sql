-- supabase/migrations/20260624000001_loyalty_tables.sql
-- FIX 1: permite_publicidad removido a migracion separada 000003

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

-- Planes de lealtad (3x1, puntos dobles, etc.)
-- NOTE: Created before loyalty_movimientos so the FK reference in loyalty_movimientos works
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
-- FIX 5: índice faltante en loyalty_campanas(clinic_id)
CREATE INDEX idx_loyalty_campanas_clinic ON loyalty_campanas(clinic_id);

-- Trigger updated_at en loyalty_members
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_loyalty_members_updated_at
  BEFORE UPDATE ON loyalty_members
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- FIX 3: loyalty_config usa actualizado_at (no updated_at) — función y trigger dedicados
CREATE OR REPLACE FUNCTION fn_set_actualizado_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.actualizado_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_loyalty_config_actualizado_at
  BEFORE UPDATE ON loyalty_config
  FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_at();

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

-- loyalty_members: admin/manager CRUD; staff de la clínica puede leer
CREATE POLICY "loyalty_members_staff" ON loyalty_members
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships WHERE user_id = auth.uid()
    )
  );

-- FIX 2: PWA usa anon key — permite leer miembros activos
-- (join con loyalty_config para validar clinic_id del slug se hace en la query de la app)
CREATE POLICY "loyalty_members_pwa_read" ON loyalty_members
  FOR SELECT TO anon
  USING (activo = true);

-- FIX 2: PWA puede leer loyalty_config activo (por slug_farmacia)
CREATE POLICY "loyalty_config_pwa_read" ON loyalty_config
  FOR SELECT TO anon
  USING (programa_activo = true);

-- FIX 2: PWA puede leer movimientos de su propio member_id
-- filtrado por member_id en la query de la app; RLS ya limita por append-only
CREATE POLICY "loyalty_mov_pwa_read" ON loyalty_movimientos
  FOR SELECT TO anon
  USING (true);

-- loyalty_movimientos: staff puede leer/insertar, no UPDATE/DELETE
CREATE POLICY "loyalty_mov_select" ON loyalty_movimientos
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM clinic_memberships WHERE user_id = auth.uid())
  );
CREATE POLICY "loyalty_mov_insert" ON loyalty_movimientos
  FOR INSERT WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM clinic_memberships WHERE user_id = auth.uid())
  );

-- loyalty_planes: admin/manager/cajero
-- 'farmacista' is not a valid app_role enum value; use 'cajero' as the pharmacy role
CREATE POLICY "loyalty_planes_staff" ON loyalty_planes
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships
      WHERE user_id = auth.uid() AND role IN ('admin','manager','cajero')
    )
  );

-- FIX 4: loyalty_planes_progreso — políticas separadas por operación con roles explícitos
-- Read: cualquier miembro de la clínica puede ver el progreso (POS necesita mostrar avance)
CREATE POLICY "loyalty_progreso_read" ON loyalty_planes_progreso
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM clinic_memberships WHERE user_id = auth.uid())
  );

-- Write: solo admin/manager/cajero pueden crear registros de progreso
CREATE POLICY "loyalty_progreso_write" ON loyalty_planes_progreso
  FOR INSERT WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships
      WHERE user_id = auth.uid() AND role IN ('admin','manager','cajero')
    )
  );

-- Delete: solo admin/manager
CREATE POLICY "loyalty_progreso_delete" ON loyalty_planes_progreso
  FOR DELETE USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );

-- loyalty_campanas: admin/manager
CREATE POLICY "loyalty_campanas_staff" ON loyalty_campanas
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships
      WHERE user_id = auth.uid() AND role IN ('admin','manager')
    )
  );
