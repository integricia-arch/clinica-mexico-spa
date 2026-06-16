-- Aprobación/rechazo atómico de solicitudes_insumos (enfermería → farmacia).
-- Ver investigación memoria/proyectos/investigacion-enfermeria-operativa.md
-- Prioridad 3. FEFO: descuenta del lote con caducidad más próxima.

CREATE OR REPLACE FUNCTION public.aprobar_solicitud_insumo(p_solicitud_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_solicitud record;
  v_lote record;
  v_movimiento_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_solicitud FROM public.solicitudes_insumos WHERE id = p_solicitud_id FOR UPDATE;
  IF v_solicitud IS NULL THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;
  IF v_solicitud.status <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud ya fue resuelta';
  END IF;

  SELECT * INTO v_lote FROM public.lotes_medicamento
  WHERE medicamento_id = v_solicitud.medicamento_id AND existencia >= v_solicitud.cantidad
  ORDER BY fecha_caducidad ASC
  LIMIT 1
  FOR UPDATE;

  IF v_lote IS NULL THEN
    RAISE EXCEPTION 'Sin stock suficiente en un solo lote para esta cantidad';
  END IF;

  UPDATE public.lotes_medicamento
  SET existencia = existencia - v_solicitud.cantidad, updated_at = now()
  WHERE id = v_lote.id;

  INSERT INTO public.movimientos_inventario
    (medicamento_id, lote_id, tipo, cantidad, motivo, created_by, clinic_id, reference_type, reference_id)
  VALUES
    (v_solicitud.medicamento_id, v_lote.id, 'uso_interno', v_solicitud.cantidad,
     coalesce(v_solicitud.motivo, 'Solicitud de insumos enfermería'),
     auth.uid(), v_solicitud.clinic_id, 'solicitud_insumo', v_solicitud.id)
  RETURNING id INTO v_movimiento_id;

  UPDATE public.solicitudes_insumos
  SET status = 'aprobada', aprobado_por = auth.uid(), movimiento_id = v_movimiento_id, resolved_at = now()
  WHERE id = p_solicitud_id;

  RETURN v_movimiento_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rechazar_solicitud_insumo(p_solicitud_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.solicitudes_insumos
  SET status = 'rechazada', aprobado_por = auth.uid(), resolved_at = now()
  WHERE id = p_solicitud_id AND status = 'pendiente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada o ya resuelta';
  END IF;
END;
$function$;
