-- Fase 1 del plan de trazabilidad (memoria/proyectos/plan-trazabilidad-contable-almacen.md).
-- Resuelve (reference_type, reference_id) -> el asiento contable que le corresponde,
-- ya sea póliza (partida doble) o movimiento_contables (devengo simple), o NULL limpio
-- si el trámite todavía no genera ninguno. Base para "Ver asiento contable" en las
-- pantallas operativas (Fase 3, pendiente) y para "Ver trámite" en reportes (Fase 2,
-- pendiente) una vez que existan rutas/páginas de detalle para cita/venta/compra
-- individual (hoy no existen — hallazgo de Fase 0, sesión 2026-07-21).
CREATE OR REPLACE FUNCTION public.contab_resolver_asiento(p_reference_type text, p_reference_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_poliza record;
  v_mov record;
BEGIN
  SELECT id, clinic_id INTO v_poliza FROM public.polizas
  WHERE reference_type = p_reference_type AND reference_id = p_reference_id AND evento = 'registro'
  LIMIT 1;

  IF v_poliza.id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND clinic_id = v_poliza.clinic_id
    ) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    RETURN jsonb_build_object('tipo', 'poliza', 'id', v_poliza.id);
  END IF;

  SELECT id, clinic_id INTO v_mov FROM public.movimientos_contables
  WHERE reference_type = p_reference_type AND reference_id = p_reference_id AND evento = 'devengo'
  LIMIT 1;

  IF v_mov.id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND clinic_id = v_mov.clinic_id
    ) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    RETURN jsonb_build_object('tipo', 'movimiento_contable', 'id', v_mov.id);
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_resolver_asiento(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contab_resolver_asiento(text, uuid) TO authenticated;
