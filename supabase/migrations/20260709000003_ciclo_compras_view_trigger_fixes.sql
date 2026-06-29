-- =============================================================================
-- Fix revisión Fase 1+2:
-- 1. Vista: filtrar cotizacion seleccionada=true (evita fanout por cotizaciones no elegidas)
-- 2. Trigger SC: solo en INSERT o cuando solicitud_id pasa de NULL (no en re-asignaciones)
-- 3. Trigger pago DELETE: revertir saldo+estatus factura al borrar pago
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 1: v_ciclo_compras — solo cotización seleccionada
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.v_ciclo_compras;

CREATE VIEW public.v_ciclo_compras AS
-- Una fila por (SC, GR, Factura, Pago). Múltiples GRs o facturas por OC
-- producen múltiples filas — usar GROUP BY orden_id en queries analíticas.
SELECT
  sc.id                         AS solicitud_id,
  sc.clinic_id,
  sc.folio                      AS folio_solicitud,
  sc.estatus                    AS estatus_solicitud,
  sc.fecha_solicitud,
  sc.solicitante_nombre,

  cot.id                        AS cotizacion_id,
  cot.folio                     AS folio_cotizacion,
  cot.total_centavos            AS cotizacion_total_centavos,

  oc.id                         AS orden_id,
  oc.folio                      AS folio_orden,
  oc.estatus                    AS estatus_orden,
  oc.total_centavos             AS orden_total_centavos,
  oc.aprobada_by,
  oc.aprobada_at,

  gr.id                         AS recepcion_id,
  gr.folio_recepcion,
  gr.estatus                    AS estatus_recepcion,
  gr.fecha_recepcion,
  gr.recibido_por,

  fp.id                         AS factura_id,
  fp.folio_interno              AS folio_factura,
  fp.estatus                    AS estatus_factura,
  fp.total_centavos             AS factura_total_centavos,
  fp.match_status,
  fp.match_diferencia_centavos,
  fp.match_revisado_by,
  fp.match_revisado_at,

  pago.id                       AS pago_id,
  pago.fecha_pago,
  pago.monto_centavos           AS pago_monto_centavos,
  pago.metodo_pago

FROM public.solicitudes_compra sc
-- Solo la cotización ganadora (evita fanout por cotizaciones de otros proveedores)
LEFT JOIN public.cotizaciones cot
  ON cot.solicitud_compra_id = sc.id AND cot.seleccionada = true
LEFT JOIN public.ordenes_compra oc
  ON oc.id = cot.orden_compra_id
LEFT JOIN public.recepciones_mercancia gr
  ON gr.orden_id = oc.id
LEFT JOIN public.facturas_proveedor fp
  ON fp.orden_id = oc.id
LEFT JOIN public.pagos_proveedor pago
  ON pago.factura_id = fp.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 2: trigger SC→convertida solo en INSERT o asignación desde NULL
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_fn_sc_convertida_on_oc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo actuar cuando solicitud_id es nuevo (INSERT o asignación desde NULL)
  IF NEW.solicitud_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.solicitud_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.solicitudes_compra
  SET estatus    = 'convertida',
      updated_at = now()
  WHERE id = NEW.solicitud_id
    AND estatus IN ('aprobada', 'enviada');

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 3: ON DELETE trigger en pagos_proveedor — revertir saldo y estatus factura
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_fn_pago_revertir_factura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total          bigint;
  v_saldo_anterior bigint;
  v_saldo_nuevo    bigint;
BEGIN
  SELECT total_centavos, saldo_pendiente_centavos
  INTO v_total, v_saldo_anterior
  FROM public.facturas_proveedor
  WHERE id = OLD.factura_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN OLD;
  END IF;

  v_saldo_nuevo := LEAST(v_total, v_saldo_anterior + OLD.monto_centavos);

  UPDATE public.facturas_proveedor
  SET saldo_pendiente_centavos = v_saldo_nuevo,
      estatus = CASE
        WHEN v_saldo_nuevo >= v_total THEN 'pendiente'
        ELSE 'parcial'
      END,
      updated_at = now()
  WHERE id = OLD.factura_id
    AND estatus NOT IN ('cancelada', 'en_disputa');

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_pago_revertir_factura ON public.pagos_proveedor;

CREATE TRIGGER trg_pago_revertir_factura
  AFTER DELETE ON public.pagos_proveedor
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_pago_revertir_factura();
