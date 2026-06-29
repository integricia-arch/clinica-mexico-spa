-- =============================================================================
-- Fix Fase 5: status values corregidos (confirmada→verificada, aprobada→aprobado_gerente)
-- Fase 2: Triggers automáticos del ciclo de compras
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX FASE 5: confirmar_recepcion_mercancia usa 'verificada' (status válido)
-- ─────────────────────────────────────────────────────────────────────────────

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
  SET estatus    = 'verificada',
      updated_at = now()
  WHERE id = p_recepcion_id
    AND clinic_id IN (
      SELECT clinic_id FROM public.clinic_memberships WHERE user_id = auth.uid()
    )
    AND estatus = 'pendiente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recepción no encontrada, ya verificada, o sin acceso';
  END IF;
END;
$$;

-- Fix RLS: 'verificada' es el status protegido (no 'confirmada')
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
      estatus <> 'verificada'
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX FASE 5: aprobar_diferencia_factura usa 'aprobado_gerente' (status válido)
-- ─────────────────────────────────────────────────────────────────────────────

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
  SET match_status      = 'aprobado_gerente',
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

-- Fix RLS: check usa 'aprobado_gerente'
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
      NOT (
        match_status = 'aprobado_gerente'
        AND match_diferencia_centavos IS NOT NULL
        AND match_diferencia_centavos <> 0
      )
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 2: Trigger 1 — OC creada con solicitud_id → SC pasa a 'convertida'
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_fn_sc_convertida_on_oc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.solicitud_id IS NOT NULL THEN
    UPDATE public.solicitudes_compra
    SET estatus    = 'convertida',
        updated_at = now()
    WHERE id = NEW.solicitud_id
      AND estatus IN ('aprobada', 'enviada');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sc_convertida_on_oc ON public.ordenes_compra;

CREATE TRIGGER trg_sc_convertida_on_oc
  AFTER INSERT OR UPDATE OF solicitud_id ON public.ordenes_compra
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_sc_convertida_on_oc();

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 2: Trigger 2 — GR verificada → OC pasa a 'recibida'
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_fn_oc_recibida_on_gr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estatus = 'verificada' AND OLD.estatus <> 'verificada' AND NEW.orden_id IS NOT NULL THEN
    UPDATE public.ordenes_compra
    SET estatus    = 'recibida',
        updated_at = now()
    WHERE id = NEW.orden_id
      AND estatus IN ('confirmada', 'parcial');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_oc_recibida_on_gr ON public.recepciones_mercancia;

CREATE TRIGGER trg_oc_recibida_on_gr
  AFTER UPDATE OF estatus ON public.recepciones_mercancia
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_oc_recibida_on_gr();

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 2: Trigger 3 — pago registrado → actualiza saldo + estatus factura
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_fn_pago_actualiza_factura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_nuevo bigint;
BEGIN
  UPDATE public.facturas_proveedor
  SET saldo_pendiente_centavos = GREATEST(0, saldo_pendiente_centavos - NEW.monto_centavos),
      updated_at               = now()
  WHERE id = NEW.factura_id
  RETURNING saldo_pendiente_centavos INTO v_saldo_nuevo;

  IF v_saldo_nuevo = 0 THEN
    UPDATE public.facturas_proveedor
    SET estatus    = 'pagada',
        updated_at = now()
    WHERE id = NEW.factura_id AND estatus NOT IN ('cancelada', 'en_disputa');
  ELSIF v_saldo_nuevo > 0 THEN
    UPDATE public.facturas_proveedor
    SET estatus    = 'parcial',
        updated_at = now()
    WHERE id = NEW.factura_id AND estatus = 'pendiente';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pago_actualiza_factura ON public.pagos_proveedor;

CREATE TRIGGER trg_pago_actualiza_factura
  AFTER INSERT ON public.pagos_proveedor
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_pago_actualiza_factura();
