-- Módulo Contable — Fase 3: núcleo de ingresos/egresos.
-- Plan: docs/superpowers/plans/2026-07-18-modulo-contable.md
--
-- Diseño:
-- * cuentas_contables: catálogo global simple (codigo_sat opcional, Anexo 24
--   preparado pero no implementado). es_fijo marca gastos fijos para punto de
--   equilibrio (Fase 4).
-- * movimientos_contables: base de devengo — fecha_devengo siempre,
--   fecha_pago cuando hay cobro/pago real. Append-only para clientes:
--   INSERT manual solo admin/manager (origen='manual'); el resto lo pueblan
--   triggers/cron SECURITY DEFINER. Sin UPDATE/DELETE de cliente.
-- * Idempotencia: UNIQUE (reference_type, reference_id, evento).
-- * Desviación consciente del plan: el egreso de compra se devenga desde
--   facturas_proveedor (tiene total_centavos y saldo), no desde
--   recepciones_mercancia (no tiene montos).

CREATE TABLE IF NOT EXISTS public.cuentas_contables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  es_fijo boolean NOT NULL DEFAULT false,
  codigo_sat text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cuentas_contables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read cuentas" ON public.cuentas_contables;
-- Catálogo global sin datos sensibles ni multi-tenant: lectura abierta a
-- usuarios autenticados (documentado; no es USING(true) sobre datos de clínica).
CREATE POLICY "Authenticated read cuentas"
  ON public.cuentas_contables FOR SELECT TO authenticated USING (true);

INSERT INTO public.cuentas_contables (codigo, nombre, tipo, es_fijo) VALUES
  ('ING_CONSULTAS', 'Ingresos por consultas', 'ingreso', false),
  ('ING_FARMACIA', 'Ingresos por farmacia', 'ingreso', false),
  ('ING_OTROS', 'Otros ingresos', 'ingreso', false),
  ('EGR_COMPRAS', 'Compras a proveedores', 'egreso', false),
  ('EGR_HONORARIOS', 'Honorarios médicos', 'egreso', false),
  ('EGR_RENTA', 'Renta', 'egreso', true),
  ('EGR_NOMINA', 'Nómina administrativa', 'egreso', true),
  ('EGR_SERVICIOS', 'Servicios (luz, agua, internet)', 'egreso', true),
  ('EGR_OTROS', 'Otros egresos', 'egreso', false)
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.movimientos_contables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  cuenta_id uuid NOT NULL REFERENCES public.cuentas_contables(id),
  origen text NOT NULL CHECK (origen IN ('manual', 'consulta', 'farmacia', 'compra', 'honorario')),
  -- Negativo = contramovimiento (ej. venta cancelada). Nunca 0.
  monto_centavos bigint NOT NULL CHECK (monto_centavos <> 0),
  fecha_devengo date NOT NULL,
  fecha_pago date,
  evento text NOT NULL DEFAULT 'devengo' CHECK (evento IN ('devengo', 'cancelacion')),
  reference_type text,
  reference_id uuid,
  descripcion text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT movimientos_contables_ref_completa
    CHECK ((reference_type IS NULL) = (reference_id IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_movimientos_contables_ref_evento
  ON public.movimientos_contables (reference_type, reference_id, evento)
  WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_contables_clinic_devengo
  ON public.movimientos_contables (clinic_id, fecha_devengo);
CREATE INDEX IF NOT EXISTS idx_movimientos_contables_clinic_pago
  ON public.movimientos_contables (clinic_id, fecha_pago) WHERE fecha_pago IS NOT NULL;

ALTER TABLE public.movimientos_contables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read movimientos contables" ON public.movimientos_contables;
CREATE POLICY "Members read movimientos contables"
  ON public.movimientos_contables FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND clinic_id = movimientos_contables.clinic_id
    )
  );

DROP POLICY IF EXISTS "Admins insert egresos manuales" ON public.movimientos_contables;
CREATE POLICY "Admins insert egresos manuales"
  ON public.movimientos_contables FOR INSERT TO authenticated
  WITH CHECK (
    origen = 'manual'
    AND created_by = auth.uid()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    AND EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND clinic_id = movimientos_contables.clinic_id
    )
  );

CREATE OR REPLACE FUNCTION public.cuenta_contable_id(p_codigo text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT id FROM public.cuentas_contables WHERE codigo = p_codigo $$;

-- ---------------------------------------------------------------------------
-- Trigger: cobro de caja pagado → ingreso (consulta si tiene cita, otros si no)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_movimiento_caja()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.estado = 'pagado' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'pagado')
     AND NEW.tipo IN ('cobro', 'ingreso') AND NEW.total > 0 THEN
    INSERT INTO public.movimientos_contables
      (clinic_id, cuenta_id, origen, monto_centavos, fecha_devengo, fecha_pago,
       evento, reference_type, reference_id, descripcion, created_by)
    VALUES
      (NEW.clinic_id,
       public.cuenta_contable_id(CASE WHEN NEW.appointment_id IS NOT NULL THEN 'ING_CONSULTAS' ELSE 'ING_OTROS' END),
       CASE WHEN NEW.appointment_id IS NOT NULL THEN 'consulta' ELSE 'manual' END,
       ROUND(NEW.total * 100)::bigint,
       (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date,
       (now() AT TIME ZONE 'America/Mexico_City')::date,
       'devengo', 'movimiento_caja', NEW.id,
       'Cobro caja folio ' || COALESCE(NEW.folio, NEW.id::text),
       NEW.cajero_user_id)
    ON CONFLICT (reference_type, reference_id, evento) WHERE reference_id IS NOT NULL
    DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_contab_movimiento_caja ON public.movimientos;
CREATE TRIGGER trg_contab_movimiento_caja
  AFTER INSERT OR UPDATE OF estado ON public.movimientos
  FOR EACH ROW EXECUTE FUNCTION public.contab_movimiento_caja();

-- ---------------------------------------------------------------------------
-- Trigger: venta de farmacia → ingreso; cancelación → contramovimiento
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_pharmacy_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'cancelled' AND NEW.total > 0 THEN
    INSERT INTO public.movimientos_contables
      (clinic_id, cuenta_id, origen, monto_centavos, fecha_devengo, fecha_pago,
       evento, reference_type, reference_id, descripcion, created_by)
    VALUES
      (NEW.clinic_id, public.cuenta_contable_id('ING_FARMACIA'), 'farmacia',
       ROUND(NEW.total * 100)::bigint,
       (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date,
       (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date,
       'devengo', 'pharmacy_sale', NEW.id,
       'Venta farmacia', NEW.created_by)
    ON CONFLICT (reference_type, reference_id, evento) WHERE reference_id IS NOT NULL
    DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    INSERT INTO public.movimientos_contables
      (clinic_id, cuenta_id, origen, monto_centavos, fecha_devengo, fecha_pago,
       evento, reference_type, reference_id, descripcion, created_by)
    SELECT clinic_id, cuenta_id, origen, -monto_centavos,
           (now() AT TIME ZONE 'America/Mexico_City')::date,
           (now() AT TIME ZONE 'America/Mexico_City')::date,
           'cancelacion', reference_type, reference_id,
           'Cancelación venta farmacia', auth.uid()
    FROM public.movimientos_contables
    WHERE reference_type = 'pharmacy_sale' AND reference_id = NEW.id AND evento = 'devengo'
    ON CONFLICT (reference_type, reference_id, evento) WHERE reference_id IS NOT NULL
    DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_contab_pharmacy_sale ON public.pharmacy_sales;
CREATE TRIGGER trg_contab_pharmacy_sale
  AFTER INSERT OR UPDATE OF status ON public.pharmacy_sales
  FOR EACH ROW EXECUTE FUNCTION public.contab_pharmacy_sale();

-- ---------------------------------------------------------------------------
-- Trigger: factura de proveedor → egreso devengado; saldo 0 → fecha_pago
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_factura_proveedor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND COALESCE(NEW.total_centavos, 0) > 0 THEN
    INSERT INTO public.movimientos_contables
      (clinic_id, cuenta_id, origen, monto_centavos, fecha_devengo, fecha_pago,
       evento, reference_type, reference_id, descripcion, created_by)
    VALUES
      (NEW.clinic_id, public.cuenta_contable_id('EGR_COMPRAS'), 'compra',
       NEW.total_centavos,
       COALESCE(NEW.fecha_factura, (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date),
       CASE WHEN COALESCE(NEW.saldo_pendiente_centavos, NEW.total_centavos) = 0
            THEN (now() AT TIME ZONE 'America/Mexico_City')::date END,
       'devengo', 'factura_proveedor', NEW.id,
       'Factura proveedor ' || COALESCE(NEW.folio_interno, NEW.id::text),
       NEW.created_by)
    ON CONFLICT (reference_type, reference_id, evento) WHERE reference_id IS NOT NULL
    DO NOTHING;
  ELSIF TG_OP = 'UPDATE'
        AND COALESCE(NEW.saldo_pendiente_centavos, 1) = 0
        AND COALESCE(OLD.saldo_pendiente_centavos, 1) <> 0 THEN
    -- Pago liquidado: fija fecha_pago del devengo (único UPDATE permitido, vía definer).
    UPDATE public.movimientos_contables
    SET fecha_pago = (now() AT TIME ZONE 'America/Mexico_City')::date
    WHERE reference_type = 'factura_proveedor' AND reference_id = NEW.id
      AND evento = 'devengo' AND fecha_pago IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_contab_factura_proveedor ON public.facturas_proveedor;
CREATE TRIGGER trg_contab_factura_proveedor
  AFTER INSERT OR UPDATE OF saldo_pendiente_centavos ON public.facturas_proveedor
  FOR EACH ROW EXECUTE FUNCTION public.contab_factura_proveedor();

-- ---------------------------------------------------------------------------
-- Cron: honorarios devengados (self-healing: inserta lo faltante hasta ayer)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_devengar_honorarios()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.movimientos_contables
    (clinic_id, cuenta_id, origen, monto_centavos, fecha_devengo, fecha_pago,
     evento, reference_type, reference_id, descripcion)
  SELECT d.clinic_id, public.cuenta_contable_id('EGR_HONORARIOS'), 'honorario',
         d.honorario_centavos, d.fecha, NULL,
         'devengo', 'honorario_appointment', d.appointment_id,
         'Honorario médico devengado'
  FROM public.doctor_honorarios_detalle d
  WHERE d.honorario_centavos > 0
    AND d.fecha < (now() AT TIME ZONE 'America/Mexico_City')::date
  ON CONFLICT (reference_type, reference_id, evento) WHERE reference_id IS NOT NULL
  DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_devengar_honorarios() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contab_devengar_honorarios() TO service_role;
REVOKE EXECUTE ON FUNCTION public.cuenta_contable_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cuenta_contable_id(text) TO authenticated, service_role;

-- Scheduling idempotente (regla del repo)
SELECT cron.unschedule('contab-devengar-honorarios')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'contab-devengar-honorarios');
SELECT cron.schedule('contab-devengar-honorarios', '30 8 * * *',
  $$ SELECT public.contab_devengar_honorarios(); $$);
