-- Permite deshacer una recepción de mercancía mal capturada (cantidad/precio/lote
-- erróneo), revirtiendo inventario, cantidad_recibida en la OC, y borrando el
-- accrual provisional asociado. Bloquea si ya hay CFDI real o pagos aplicados,
-- o si el lote ya fue consumido por debajo de lo recibido (venta ya ocurrida).

CREATE OR REPLACE FUNCTION public.recepcion_revertir(p_recepcion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_orden_id uuid;
  v_item RECORD;
  v_factura RECORD;
  v_existencia_actual integer;
  v_pendientes integer;
BEGIN
  SELECT clinic_id, orden_id INTO v_clinic_id, v_orden_id
  FROM recepciones_mercancia WHERE id = p_recepcion_id;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Recepción no encontrada';
  END IF;

  SELECT * INTO v_factura FROM facturas_proveedor WHERE recepcion_id = p_recepcion_id LIMIT 1;
  IF FOUND THEN
    IF NOT v_factura.es_provisional THEN
      RAISE EXCEPTION 'No se puede revertir: ya existe un CFDI real registrado para esta recepción.';
    END IF;
    IF v_factura.saldo_pendiente_centavos < v_factura.total_centavos THEN
      RAISE EXCEPTION 'No se puede revertir: la factura provisional ya tiene pagos aplicados.';
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM recepciones_items WHERE recepcion_id = p_recepcion_id LOOP
    IF v_item.lote_id IS NOT NULL THEN
      SELECT existencia INTO v_existencia_actual FROM lotes_medicamento WHERE id = v_item.lote_id;
      IF v_existencia_actual IS NOT NULL AND (v_existencia_actual - v_item.cantidad_recibida) < 0 THEN
        RAISE EXCEPTION 'No se puede revertir: el lote % ya tiene existencia consumida por debajo de lo recibido.', v_item.numero_lote;
      END IF;

      UPDATE lotes_medicamento
      SET existencia = existencia - v_item.cantidad_recibida, updated_at = now()
      WHERE id = v_item.lote_id;

      INSERT INTO movimientos_inventario (clinic_id, medicamento_id, lote_id, tipo, cantidad, motivo)
      VALUES (v_clinic_id, v_item.medicamento_id, v_item.lote_id, 'salida', v_item.cantidad_recibida, 'Reversión de recepción');
    END IF;

    IF v_item.orden_item_id IS NOT NULL THEN
      UPDATE ordenes_compra_items
      SET cantidad_recibida = GREATEST(0, cantidad_recibida - v_item.cantidad_recibida)
      WHERE id = v_item.orden_item_id;
    END IF;
  END LOOP;

  DELETE FROM facturas_proveedor WHERE recepcion_id = p_recepcion_id AND es_provisional = true;
  DELETE FROM recepciones_items WHERE recepcion_id = p_recepcion_id;
  DELETE FROM recepciones_mercancia WHERE id = p_recepcion_id;

  IF v_orden_id IS NOT NULL THEN
    SELECT count(*) INTO v_pendientes
    FROM ordenes_compra_items
    WHERE orden_id = v_orden_id AND cantidad_recibida > 0;

    IF v_pendientes = 0 THEN
      UPDATE ordenes_compra SET estatus = 'confirmada' WHERE id = v_orden_id AND estatus IN ('parcial', 'recibida');
    ELSE
      UPDATE ordenes_compra SET estatus = 'parcial' WHERE id = v_orden_id AND estatus = 'recibida';
    END IF;
  END IF;
END;
$$;
