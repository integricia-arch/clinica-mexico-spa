-- CxP BI: vendor master enrichment, fraud controls, analytics views
-- Based on COSO AP Controls + IMCP Mexico + APQC benchmarks

-- ─── 1. Enrich vendor master ───────────────────────────────────────────────
ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS clasificacion_abc         char(1)         DEFAULT 'C'
    CHECK (clasificacion_abc IN ('A','B','C')),
  ADD COLUMN IF NOT EXISTS rfc_verificado            boolean         NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cuenta_clabe              varchar(18),
  ADD COLUMN IF NOT EXISTS banco_nombre              varchar(100),
  ADD COLUMN IF NOT EXISTS limite_credito_centavos   bigint          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dias_credito              int             NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS descuento_pronto_pago_pct numeric(5,2)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dias_pronto_pago          int             NOT NULL DEFAULT 10;

-- ─── 2. Early-payment deadline on invoices ─────────────────────────────────
ALTER TABLE facturas_proveedor
  ADD COLUMN IF NOT EXISTS fecha_limite_pronto_pago date;

-- ─── 3. CLABE change audit trail (dual-approval COSO control) ──────────────
CREATE TABLE IF NOT EXISTS historial_clabe_proveedor (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      uuid        NOT NULL,
  proveedor_id   uuid        NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  clabe_anterior varchar(18),
  clabe_nueva    varchar(18) NOT NULL,
  cambiado_por   uuid        NOT NULL,
  aprobado_por   uuid,
  aprobado_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE historial_clabe_proveedor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic staff manage clabe history" ON historial_clabe_proveedor;
CREATE POLICY "clinic staff manage clabe history"
  ON historial_clabe_proveedor
  FOR ALL
  USING (clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid()));

-- ─── 4. CxP alerts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cxp_alertas (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    uuid        NOT NULL,
  tipo         text        NOT NULL
    CHECK (tipo IN ('duplicado','limite_excedido','clabe_sin_verificar',
                    'vencimiento_hoy','pago_sin_gr','fraccionamiento_sospechoso')),
  proveedor_id uuid        REFERENCES proveedores(id),
  factura_id   uuid        REFERENCES facturas_proveedor(id),
  descripcion  text        NOT NULL,
  severidad    text        NOT NULL DEFAULT 'media'
    CHECK (severidad IN ('critica','alta','media','baja')),
  resuelta     boolean     NOT NULL DEFAULT false,
  resuelta_por uuid,
  resuelta_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cxp_alertas_clinic_resuelta
  ON cxp_alertas(clinic_id, resuelta, created_at DESC);

ALTER TABLE cxp_alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic staff manage cxp alertas" ON cxp_alertas;
CREATE POLICY "clinic staff manage cxp alertas"
  ON cxp_alertas
  FOR ALL
  USING (clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid()));

-- ─── 5. Duplicate invoice detection ───────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_check_factura_duplicada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.uuid_sat IS NOT NULL AND NEW.uuid_sat <> '' THEN
    IF EXISTS (
      SELECT 1 FROM facturas_proveedor
      WHERE uuid_sat     = NEW.uuid_sat
        AND proveedor_id = NEW.proveedor_id
        AND clinic_id    = NEW.clinic_id
        AND id           <> NEW.id
        AND estatus      <> 'cancelada'
    ) THEN
      INSERT INTO cxp_alertas (clinic_id, tipo, proveedor_id, factura_id, descripcion, severidad)
      VALUES (NEW.clinic_id, 'duplicado', NEW.proveedor_id, NEW.id,
              'UUID SAT duplicado: ' || NEW.uuid_sat, 'critica');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_factura_duplicada ON facturas_proveedor;
CREATE TRIGGER trg_check_factura_duplicada
  AFTER INSERT OR UPDATE OF uuid_sat ON facturas_proveedor
  FOR EACH ROW EXECUTE FUNCTION fn_check_factura_duplicada();

-- ─── 6. Credit limit exceeded detection ───────────────────────────────────
CREATE OR REPLACE FUNCTION fn_check_limite_credito()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limite      bigint;
  v_saldo_total bigint;
BEGIN
  SELECT COALESCE(limite_credito_centavos, 0)
    INTO v_limite
    FROM proveedores WHERE id = NEW.proveedor_id;

  IF v_limite > 0 THEN
    SELECT COALESCE(SUM(saldo_pendiente_centavos), 0)
      INTO v_saldo_total
      FROM facturas_proveedor
     WHERE proveedor_id = NEW.proveedor_id
       AND clinic_id    = NEW.clinic_id
       AND estatus NOT IN ('pagada','cancelada');

    IF v_saldo_total > v_limite THEN
      INSERT INTO cxp_alertas (clinic_id, tipo, proveedor_id, factura_id, descripcion, severidad)
      VALUES (
        NEW.clinic_id, 'limite_excedido', NEW.proveedor_id, NEW.id,
        format('Saldo $%s excede límite $%s',
               (v_saldo_total/100.0)::numeric(12,2),
               (v_limite/100.0)::numeric(12,2)),
        'alta'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_limite_credito ON facturas_proveedor;
CREATE TRIGGER trg_check_limite_credito
  AFTER INSERT ON facturas_proveedor
  FOR EACH ROW EXECUTE FUNCTION fn_check_limite_credito();

-- ─── 7. BI views ──────────────────────────────────────────────────────────

-- DPO per vendor (APQC pharma benchmark: 30-45 días)
CREATE OR REPLACE VIEW kpi_dpo_proveedor AS
SELECT
  f.clinic_id,
  f.proveedor_id,
  p.nombre                                                     AS proveedor_nombre,
  COUNT(DISTINCT pg.factura_id)                                AS facturas_pagadas,
  ROUND(AVG(pg.fecha_pago::date - f.fecha_factura::date), 1)  AS dpo_promedio_dias,
  MIN(pg.fecha_pago::date - f.fecha_factura::date)             AS dpo_min,
  MAX(pg.fecha_pago::date - f.fecha_factura::date)             AS dpo_max
FROM facturas_proveedor f
JOIN pagos_proveedor    pg ON pg.factura_id = f.id
JOIN proveedores        p  ON p.id          = f.proveedor_id
GROUP BY f.clinic_id, f.proveedor_id, p.nombre;

-- Pareto 80/20 vendor concentration
CREATE OR REPLACE VIEW concentracion_proveedores AS
SELECT
  f.clinic_id,
  f.proveedor_id,
  p.nombre                                                               AS proveedor_nombre,
  p.clasificacion_abc,
  SUM(f.total_centavos)                                                  AS compras_totales_centavos,
  ROUND(
    100.0 * SUM(f.total_centavos)
    / NULLIF(SUM(SUM(f.total_centavos)) OVER (PARTITION BY f.clinic_id), 0),
    2
  )                                                                       AS pct_del_total,
  SUM(SUM(f.total_centavos)) OVER (
    PARTITION BY f.clinic_id
    ORDER BY SUM(f.total_centavos) DESC
  )                                                                       AS acumulado_centavos
FROM facturas_proveedor f
JOIN proveedores p ON p.id = f.proveedor_id
WHERE f.estatus <> 'cancelada'
GROUP BY f.clinic_id, f.proveedor_id, p.nombre, p.clasificacion_abc;

-- Early-payment discount capture rate
CREATE OR REPLACE VIEW kpi_descuento_pronto_pago AS
SELECT
  f.clinic_id,
  f.proveedor_id,
  p.nombre                                                               AS proveedor_nombre,
  p.descuento_pronto_pago_pct,
  COUNT(*)                                                               AS facturas_con_descuento,
  SUM(CASE
    WHEN f.fecha_limite_pronto_pago IS NOT NULL
     AND pg.fecha_pago <= f.fecha_limite_pronto_pago
    THEN ROUND(f.total_centavos * p.descuento_pronto_pago_pct / 100)
    ELSE 0
  END)                                                                   AS descuento_capturado_centavos,
  SUM(ROUND(f.total_centavos * p.descuento_pronto_pago_pct / 100))      AS descuento_disponible_centavos
FROM facturas_proveedor f
JOIN proveedores     p  ON p.id          = f.proveedor_id
JOIN pagos_proveedor pg ON pg.factura_id = f.id
WHERE p.descuento_pronto_pago_pct > 0
  AND f.estatus <> 'cancelada'
GROUP BY f.clinic_id, f.proveedor_id, p.nombre, p.descuento_pronto_pago_pct;

-- Unresolved alerts dashboard
CREATE OR REPLACE VIEW resumen_alertas_cxp AS
SELECT
  clinic_id,
  tipo,
  severidad,
  COUNT(*) AS total,
  MIN(created_at) AS mas_antigua
FROM cxp_alertas
WHERE resuelta = false
GROUP BY clinic_id, tipo, severidad
ORDER BY
  CASE severidad WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
  total DESC;
