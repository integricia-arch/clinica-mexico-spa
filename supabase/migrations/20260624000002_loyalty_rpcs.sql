-- supabase/migrations/20260624000002_loyalty_rpcs.sql
-- Loyalty RPCs: register_sale, redeem, expire (batch), level calc, barcode gen
-- Gate R1 compliance: SECURITY DEFINER + SET search_path = public on ALL functions

-- ─── loyalty_generate_barcode ───────────────────────────────────────────────
-- Genera código de barras único: {3-char clinic prefix}{10 digits}
CREATE OR REPLACE FUNCTION loyalty_generate_barcode(p_clinic_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_code   text;
  v_exists boolean;
BEGIN
  SELECT UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-z]', '', 'g'), 3))
    INTO v_prefix FROM clinics WHERE id = p_clinic_id;
  IF v_prefix IS NULL OR v_prefix = '' THEN v_prefix := 'FAR'; END IF;
  LOOP
    v_code := v_prefix || LPAD(FLOOR(RANDOM() * 9999999999)::text, 10, '0');
    SELECT EXISTS(SELECT 1 FROM loyalty_members WHERE codigo_barras = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

-- ─── loyalty_recalculate_level ───────────────────────────────────────────────
-- Recalcula nivel según puntos acumulados en últimos 12 meses
CREATE OR REPLACE FUNCTION loyalty_recalculate_level(p_member_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

-- ─── loyalty_register_sale ───────────────────────────────────────────────────
-- Registra puntos por venta
-- Gate R1-4: verifica que p_sale_id pertenece a p_clinic_id (cross-clinic check)
CREATE OR REPLACE FUNCTION loyalty_register_sale(
  p_sale_id   uuid,
  p_member_id uuid,
  p_clinic_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg              loyalty_config%ROWTYPE;
  v_member           loyalty_members%ROWTYPE;
  v_sale_total       numeric;
  v_sale_clinic_id   uuid;
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

  -- Gate R1-4: leer total Y clinic_id juntos para verificar propiedad de la venta
  SELECT ps.total, ps.clinic_id INTO v_sale_total, v_sale_clinic_id
    FROM pharmacy_sales ps WHERE ps.id = p_sale_id;
  IF NOT FOUND OR v_sale_total IS NULL OR v_sale_total <= 0 THEN
    RETURN json_build_object('ok', false, 'error', 'venta_invalida');
  END IF;
  -- Cross-clinic security: la venta debe pertenecer a la misma clínica
  IF v_sale_clinic_id != p_clinic_id THEN
    RETURN json_build_object('ok', false, 'error', 'sale_clinic_mismatch');
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

  -- Actualizar saldo (atómico — UPDATE en PG es siempre atómico)
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

-- ─── loyalty_redeem ──────────────────────────────────────────────────────────
-- Canjear puntos como descuento
-- Gate R1 atomicity: UPDATE uses puntos_disponibles >= p_puntos guard in WHERE
-- to prevent race conditions between the earlier SELECT and this UPDATE
CREATE OR REPLACE FUNCTION loyalty_redeem(
  p_member_id uuid,
  p_clinic_id uuid,
  p_puntos    integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg          loyalty_config%ROWTYPE;
  v_member       loyalty_members%ROWTYPE;
  v_descuento    numeric;
  v_saldo_nuevo  integer;
  v_updated      integer;
BEGIN
  -- FIX 2 [MEDIUM-SEC]: reject zero/negative point values before any DB access
  IF p_puntos <= 0 THEN
    RETURN json_build_object('ok', false, 'error', 'puntos_invalidos');
  END IF;

  SELECT * INTO v_cfg FROM loyalty_config WHERE clinic_id = p_clinic_id AND programa_activo = true;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'programa_inactivo_o_sin_config');
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

  -- Atomic UPDATE with puntos_disponibles >= p_puntos guard to prevent race conditions
  UPDATE loyalty_members
     SET puntos_disponibles = puntos_disponibles - p_puntos
   WHERE id = p_member_id
     AND puntos_disponibles >= p_puntos
   RETURNING puntos_disponibles INTO v_saldo_nuevo;

  -- If 0 rows updated, concurrent redemption consumed the points
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'saldo_insuficiente_concurrente');
  END IF;

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

-- ─── loyalty_expire_points ───────────────────────────────────────────────────
-- Vencimiento de puntos por inactividad
-- Gate R1: BATCH UPDATE via CTE (not a PL/pgSQL FOR loop) to scale beyond 10K members
-- Gate R1: REVOKE PUBLIC, GRANT service_role only
-- Note: Members without an active loyalty_config are silently skipped (COALESCE 999999 days).
-- This is intentional: if the program is inactive, no points should expire.
CREATE OR REPLACE FUNCTION loyalty_expire_points()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use a CTE to capture the actual puntos_disponibles BEFORE zeroing,
  -- then UPDATE and INSERT in one atomic operation.
  -- pre_values captures the exact balance to expire (avoids proxy via saldo_post
  -- which can be inaccurate when manual 'ajuste' entries exist).
  --
  -- FIX 4 [HIGH-PERF]: Replaced 3 correlated subqueries per member row with LEFT JOINs.
  -- This avoids O(n) independent index lookups for MAX(created_at) and expiracion_dias_inactividad.
  -- Note: Members with no active loyalty_config (COALESCE to 999999 days) are intentionally skipped.
  WITH pre_values AS (
    SELECT
      lm.id,
      lm.clinic_id,
      lm.puntos_disponibles AS puntos_antes,
      COALESCE(MAX(mv2.created_at), lm.created_at) AS last_activity,
      COALESCE(lc.expiracion_dias_inactividad, 999999) AS dias_expiracion
    FROM loyalty_members lm
    LEFT JOIN loyalty_movimientos mv2
      ON mv2.member_id = lm.id
     AND mv2.tipo IN ('acumulacion', 'canje', 'bonus')
    LEFT JOIN loyalty_config lc
      ON lc.clinic_id = lm.clinic_id
     AND lc.programa_activo = true
    WHERE lm.activo = true
      AND lm.puntos_disponibles > 0
      AND NOT EXISTS (
        SELECT 1 FROM loyalty_movimientos mv_check
         WHERE mv_check.member_id = lm.id
           AND mv_check.tipo = 'vencimiento'
           AND mv_check.created_at >= date_trunc('day', now())
      )
    GROUP BY lm.id, lm.clinic_id, lm.puntos_disponibles, lm.created_at,
             lc.expiracion_dias_inactividad
    HAVING COALESCE(MAX(mv2.created_at), lm.created_at)
         < now() - COALESCE(lc.expiracion_dias_inactividad, 999999) * INTERVAL '1 day'
  ),
  expired AS (
    UPDATE loyalty_members lm
       SET puntos_disponibles = 0
      FROM pre_values pv
     WHERE lm.id = pv.id
    RETURNING lm.id, lm.clinic_id
  )
  INSERT INTO loyalty_movimientos (clinic_id, member_id, tipo, puntos, saldo_post, descripcion)
  SELECT e.clinic_id, e.id, 'vencimiento', -pv.puntos_antes, 0,
         'Vencimiento automático por inactividad'
    FROM expired e
    JOIN pre_values pv ON pv.id = e.id
   WHERE pv.puntos_antes > 0;
END;
$$;

-- ─── pg_cron: expiración diaria 07:00 CST (13:00 UTC) ───────────────────────
-- Gate R1-3: Idempotent — unschedule first to avoid duplicate job errors
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'loyalty-expire-points') THEN
    PERFORM cron.unschedule('loyalty-expire-points');
  END IF;
END;
$$;
SELECT cron.schedule(
  'loyalty-expire-points',
  '0 13 * * *',
  $$SELECT loyalty_expire_points();$$
);

-- ─── Permisos ─────────────────────────────────────────────────────────────────
-- Only authenticated users may call customer-facing RPCs
GRANT EXECUTE ON FUNCTION loyalty_generate_barcode(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION loyalty_register_sale(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION loyalty_redeem(uuid,uuid,integer) TO authenticated;

-- FIX 1 [HIGH-SEC]: recalculate_level is called only from register_sale (SECURITY DEFINER);
-- no external caller needs it -- REVOKE from PUBLIC entirely.
REVOKE EXECUTE ON FUNCTION loyalty_recalculate_level(uuid) FROM PUBLIC;

-- expire_points runs only via pg_cron (service_role); PUBLIC must not call it
REVOKE EXECUTE ON FUNCTION loyalty_expire_points() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION loyalty_expire_points() TO service_role;
