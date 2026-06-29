-- =============================================================================
-- Fase 1: Trazabilidad BD — Ciclo de Compras (FKs + vista)
-- Fase 5: COSO Segregación de funciones (RLS + RPCs)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 1: Columnas FK faltantes
-- ─────────────────────────────────────────────────────────────────────────────

-- ordenes_compra → cotización ganadora (lookup directo desde OC)
ALTER TABLE public.ordenes_compra
  ADD COLUMN IF NOT EXISTS cotizacion_id UUID REFERENCES public.cotizaciones(id);

CREATE INDEX IF NOT EXISTS idx_ordenes_compra_cotizacion_id
  ON public.ordenes_compra(cotizacion_id);

-- facturas_proveedor → solicitud de compra origen (trazabilidad directa)
ALTER TABLE public.facturas_proveedor
  ADD COLUMN IF NOT EXISTS solicitud_id UUID REFERENCES public.solicitudes_compra(id);

CREATE INDEX IF NOT EXISTS idx_facturas_proveedor_solicitud_id
  ON public.facturas_proveedor(solicitud_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 1: Vista v_ciclo_compras
-- Cadena: SC → Cotización → OC → GR → Factura → Pago
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.v_ciclo_compras;

CREATE VIEW public.v_ciclo_compras AS
SELECT
  sc.id                         AS solicitud_id,
  sc.clinic_id,
  sc.folio                      AS folio_solicitud,
  sc.estatus                    AS estatus_solicitud,
  sc.fecha_solicitud,
  sc.solicitante_nombre,

  cot.id                        AS cotizacion_id,
  cot.folio                     AS folio_cotizacion,
  cot.seleccionada              AS cotizacion_seleccionada,
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
LEFT JOIN public.cotizaciones cot
  ON cot.solicitud_compra_id = sc.id
LEFT JOIN public.ordenes_compra oc
  ON oc.id = cot.orden_compra_id
LEFT JOIN public.recepciones_mercancia gr
  ON gr.orden_id = oc.id
LEFT JOIN public.facturas_proveedor fp
  ON fp.orden_id = oc.id
LEFT JOIN public.pagos_proveedor pago
  ON pago.factura_id = fp.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 5 COSO: recepciones_mercancia — solo admin/manager pueden confirmar GR
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "clinic members can update recepciones" ON public.recepciones_mercancia;
DROP POLICY IF EXISTS "coso_update_recepciones" ON public.recepciones_mercancia;

CREATE POLICY "coso_update_recepciones"
  ON public.recepciones_mercancia
  FOR UPDATE TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships WHERE user_id = auth.uid()
    )
    AND (
      -- Confirmar GR requiere admin o manager (COSO: segregación almacén)
      estatus <> 'confirmada'
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );

-- RPC canónica: confirmar GR (COSO enforced en SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.confirmar_recepcion_mercancia(p_recepcion_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'COSO: solo admin o manager pueden confirmar recepciones de mercancía';
  END IF;

  UPDATE public.recepciones_mercancia
  SET estatus    = 'confirmada',
      updated_at = now()
  WHERE id = p_recepcion_id
    AND clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships WHERE user_id = auth.uid()
    )
    AND estatus <> 'confirmada';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recepción no encontrada, ya confirmada, o sin acceso';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 5 COSO: facturas_proveedor — aprobar diferencia 4-way match requiere manager
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "clinic members can update facturas_proveedor" ON public.facturas_proveedor;
DROP POLICY IF EXISTS "coso_update_facturas_proveedor" ON public.facturas_proveedor;

CREATE POLICY "coso_update_facturas_proveedor"
  ON public.facturas_proveedor
  FOR UPDATE TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships WHERE user_id = auth.uid()
    )
    AND (
      -- Aprobar factura con diferencia en 4-way match requiere admin/manager (COSO)
      NOT (
        match_status = 'aprobada'
        AND match_diferencia_centavos IS NOT NULL
        AND match_diferencia_centavos <> 0
      )
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );

-- RPC canónica: aprobar diferencia 4-way match (COSO enforced)
CREATE OR REPLACE FUNCTION public.aprobar_diferencia_factura(
  p_factura_id UUID,
  p_notas      TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'COSO: solo admin o manager pueden aprobar facturas con diferencia en 4-way match';
  END IF;

  UPDATE public.facturas_proveedor
  SET match_status      = 'aprobada',
      match_revisado_by = auth.uid(),
      match_revisado_at = now(),
      match_notas       = coalesce(p_notas, match_notas),
      updated_at        = now()
  WHERE id = p_factura_id
    AND clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships WHERE user_id = auth.uid()
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada o sin acceso';
  END IF;
END;
$$;
