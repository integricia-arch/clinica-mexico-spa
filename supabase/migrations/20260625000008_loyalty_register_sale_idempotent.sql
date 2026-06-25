-- supabase/migrations/20260625000008_loyalty_register_sale_idempotent.sql
-- Agrega idempotency guard: si ya existe movimiento de acumulación para
-- esta pharmacy_sale_id, retorna ok:true sin duplicar puntos.
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
  -- Idempotency guard: si ya existe un movimiento de acumulación para
  -- esta venta, retornar éxito sin duplicar puntos.
  IF EXISTS (
    SELECT 1 FROM loyalty_movimientos
     WHERE pharmacy_sale_id = p_sale_id
       AND tipo = 'acumulacion'
  ) THEN
    SELECT puntos_disponibles, nivel
      INTO v_saldo_nuevo, v_nivel_nuevo
      FROM loyalty_members WHERE id = p_member_id;
    RETURN json_build_object(
      'ok', true,
      'puntos_ganados', 0,
      'saldo_nuevo', v_saldo_nuevo,
      'nivel', v_nivel_nuevo,
      'idempotent', true
    );
  END IF;

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

  -- Actualizar saldo (atómico)
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

-- Permisos sin cambio — solo authenticated puede llamar esta función
GRANT EXECUTE ON FUNCTION loyalty_register_sale(uuid,uuid,uuid) TO authenticated;
