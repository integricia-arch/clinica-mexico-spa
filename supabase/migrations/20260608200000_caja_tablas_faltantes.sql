-- ============================================================
-- Caja: tablas faltantes en remote
-- metodos_pago, conceptos, movimientos, movimiento_lineas,
-- movimiento_pagos, cortes, impresoras
-- Safe to run multiple times (IF NOT EXISTS throughout)
-- ============================================================

-- ============================================================
-- Enum values
-- NOTE: ALTER TYPE ADD VALUE cannot run in same txn as its usage.
-- These were applied in a separate query before the rest of this file.
-- Kept here for documentation; safe to re-run (IF NOT EXISTS guards).
-- ============================================================
-- ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
-- ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cajero';

-- ============================================================
-- Helper functions (idempotent — CREATE OR REPLACE)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_caja_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'manager'::app_role)
      OR public.has_role(_user_id, 'cajero'::app_role)
      OR public.has_role(_user_id, 'receptionist'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.can_configure_caja(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'manager'::app_role);
$$;

GRANT EXECUTE ON FUNCTION public.is_caja_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_configure_caja(uuid) TO authenticated;

-- ============================================================
-- metodos_pago: catálogo formas de pago SAT
CREATE TABLE IF NOT EXISTS public.metodos_pago (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  codigo_sat text NOT NULL,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, codigo_sat)
);
CREATE INDEX IF NOT EXISTS idx_metodos_pago_clinic ON public.metodos_pago(clinic_id);
ALTER TABLE public.metodos_pago ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_metodos_pago_updated'
  ) THEN
    CREATE TRIGGER trg_metodos_pago_updated
      BEFORE UPDATE ON public.metodos_pago
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

DROP POLICY IF EXISTS "Caja staff lee metodos_pago" ON public.metodos_pago;
CREATE POLICY "Caja staff lee metodos_pago" ON public.metodos_pago
  FOR SELECT TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_caja_staff(auth.uid()));

DROP POLICY IF EXISTS "Admin gestiona metodos_pago" ON public.metodos_pago;
CREATE POLICY "Admin gestiona metodos_pago" ON public.metodos_pago
  FOR ALL TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.can_configure_caja(auth.uid()))
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.can_configure_caja(auth.uid()));

-- conceptos: servicios y productos facturables
CREATE TABLE IF NOT EXISTS public.conceptos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  clave text NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  precio_default numeric(10,2) NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'servicio' CHECK (tipo IN ('servicio','producto','descuento','otro')),
  clave_sat text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, clave)
);
CREATE INDEX IF NOT EXISTS idx_conceptos_clinic ON public.conceptos(clinic_id);
ALTER TABLE public.conceptos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_conceptos_updated'
  ) THEN
    CREATE TRIGGER trg_conceptos_updated
      BEFORE UPDATE ON public.conceptos
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

DROP POLICY IF EXISTS "Caja staff lee conceptos" ON public.conceptos;
CREATE POLICY "Caja staff lee conceptos" ON public.conceptos
  FOR SELECT TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_caja_staff(auth.uid()));

DROP POLICY IF EXISTS "Admin gestiona conceptos" ON public.conceptos;
CREATE POLICY "Admin gestiona conceptos" ON public.conceptos
  FOR ALL TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.can_configure_caja(auth.uid()))
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.can_configure_caja(auth.uid()));

-- movimientos: encabezado de cobro / devolución / ajuste
CREATE TABLE IF NOT EXISTS public.movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  turno_id uuid REFERENCES public.turnos(id),
  caja_id uuid REFERENCES public.cajas(id),
  folio text,
  tipo text NOT NULL DEFAULT 'cobro' CHECK (tipo IN ('cobro','devolucion','ajuste','ingreso','egreso')),
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','pagado','cancelado','parcial')),
  patient_id uuid REFERENCES public.patients(id),
  appointment_id uuid REFERENCES public.appointments(id),
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  descuento numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  notas text,
  cajero_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movimientos_clinic_fecha ON public.movimientos(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_turno ON public.movimientos(turno_id);
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_movimientos_updated'
  ) THEN
    CREATE TRIGGER trg_movimientos_updated
      BEFORE UPDATE ON public.movimientos
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

DROP POLICY IF EXISTS "Caja staff lee movimientos" ON public.movimientos;
CREATE POLICY "Caja staff lee movimientos" ON public.movimientos
  FOR SELECT TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_caja_staff(auth.uid()));

DROP POLICY IF EXISTS "Caja staff crea movimientos" ON public.movimientos;
CREATE POLICY "Caja staff crea movimientos" ON public.movimientos
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_caja_staff(auth.uid()));

DROP POLICY IF EXISTS "Caja staff actualiza movimientos" ON public.movimientos;
CREATE POLICY "Caja staff actualiza movimientos" ON public.movimientos
  FOR UPDATE TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_caja_staff(auth.uid()))
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_caja_staff(auth.uid()));

DROP POLICY IF EXISTS "Admin cancela movimientos" ON public.movimientos;
CREATE POLICY "Admin cancela movimientos" ON public.movimientos
  FOR DELETE TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.has_role(auth.uid(), 'admin'::app_role));

-- movimiento_lineas: renglones de cada movimiento
CREATE TABLE IF NOT EXISTS public.movimiento_lineas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  movimiento_id uuid NOT NULL REFERENCES public.movimientos(id) ON DELETE CASCADE,
  concepto_id uuid REFERENCES public.conceptos(id),
  descripcion text NOT NULL,
  cantidad numeric(10,3) NOT NULL DEFAULT 1,
  precio_unitario numeric(10,2) NOT NULL,
  descuento numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mov_lineas_movimiento ON public.movimiento_lineas(movimiento_id);
CREATE INDEX IF NOT EXISTS idx_mov_lineas_clinic ON public.movimiento_lineas(clinic_id);
ALTER TABLE public.movimiento_lineas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_movimiento_lineas_updated'
  ) THEN
    CREATE TRIGGER trg_movimiento_lineas_updated
      BEFORE UPDATE ON public.movimiento_lineas
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

DROP POLICY IF EXISTS "Caja staff gestiona lineas" ON public.movimiento_lineas;
CREATE POLICY "Caja staff gestiona lineas" ON public.movimiento_lineas
  FOR ALL TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_caja_staff(auth.uid()))
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_caja_staff(auth.uid()));

-- movimiento_pagos: pagos por forma de pago (split payment)
CREATE TABLE IF NOT EXISTS public.movimiento_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  movimiento_id uuid NOT NULL REFERENCES public.movimientos(id) ON DELETE CASCADE,
  metodo_pago_id uuid NOT NULL REFERENCES public.metodos_pago(id),
  monto numeric(10,2) NOT NULL,
  referencia text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mov_pagos_movimiento ON public.movimiento_pagos(movimiento_id);
CREATE INDEX IF NOT EXISTS idx_mov_pagos_clinic ON public.movimiento_pagos(clinic_id);
ALTER TABLE public.movimiento_pagos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_movimiento_pagos_updated'
  ) THEN
    CREATE TRIGGER trg_movimiento_pagos_updated
      BEFORE UPDATE ON public.movimiento_pagos
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

DROP POLICY IF EXISTS "Caja staff gestiona pagos" ON public.movimiento_pagos;
CREATE POLICY "Caja staff gestiona pagos" ON public.movimiento_pagos
  FOR ALL TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_caja_staff(auth.uid()))
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_caja_staff(auth.uid()));

-- cortes: cierres de turno X (parcial) y Z (final)
CREATE TABLE IF NOT EXISTS public.cortes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  turno_id uuid NOT NULL REFERENCES public.turnos(id),
  tipo text NOT NULL DEFAULT 'X' CHECK (tipo IN ('X','Z')),
  total_efectivo numeric(10,2) NOT NULL DEFAULT 0,
  total_tarjeta numeric(10,2) NOT NULL DEFAULT 0,
  total_transferencia numeric(10,2) NOT NULL DEFAULT 0,
  total_otros numeric(10,2) NOT NULL DEFAULT 0,
  total_general numeric(10,2) NOT NULL DEFAULT 0,
  conteo_movimientos integer NOT NULL DEFAULT 0,
  datos_json jsonb NOT NULL DEFAULT '{}',
  generado_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cortes_clinic_fecha ON public.cortes(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cortes_turno ON public.cortes(turno_id);
ALTER TABLE public.cortes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cortes_updated'
  ) THEN
    CREATE TRIGGER trg_cortes_updated
      BEFORE UPDATE ON public.cortes
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

DROP POLICY IF EXISTS "Caja staff lee cortes" ON public.cortes;
CREATE POLICY "Caja staff lee cortes" ON public.cortes
  FOR SELECT TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_caja_staff(auth.uid()));

DROP POLICY IF EXISTS "Caja staff genera cortes" ON public.cortes;
CREATE POLICY "Caja staff genera cortes" ON public.cortes
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_caja_staff(auth.uid()));

DROP POLICY IF EXISTS "Admin modifica cortes" ON public.cortes;
CREATE POLICY "Admin modifica cortes" ON public.cortes
  FOR UPDATE TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin elimina cortes" ON public.cortes;
CREATE POLICY "Admin elimina cortes" ON public.cortes
  FOR DELETE TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.has_role(auth.uid(), 'admin'::app_role));

-- impresoras: configuración de impresoras por clínica
CREATE TABLE IF NOT EXISTS public.impresoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  nombre text NOT NULL,
  tipo text NOT NULL DEFAULT 'ticket' CHECK (tipo IN ('ticket','a4','laser')),
  conexion text NOT NULL DEFAULT 'usb' CHECK (conexion IN ('usb','red','bluetooth','virtual')),
  direccion_ip text,
  puerto integer,
  activo boolean NOT NULL DEFAULT true,
  es_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_impresoras_clinic ON public.impresoras(clinic_id);
ALTER TABLE public.impresoras ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_impresoras_updated'
  ) THEN
    CREATE TRIGGER trg_impresoras_updated
      BEFORE UPDATE ON public.impresoras
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

DROP POLICY IF EXISTS "Caja staff lee impresoras" ON public.impresoras;
CREATE POLICY "Caja staff lee impresoras" ON public.impresoras
  FOR SELECT TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.is_caja_staff(auth.uid()));

DROP POLICY IF EXISTS "Admin gestiona impresoras" ON public.impresoras;
CREATE POLICY "Admin gestiona impresoras" ON public.impresoras
  FOR ALL TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.can_configure_caja(auth.uid()))
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id) AND public.can_configure_caja(auth.uid()));

-- ============================================================
-- Permisos
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metodos_pago TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conceptos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimientos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimiento_lineas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimiento_pagos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cortes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.impresoras TO authenticated;

GRANT ALL ON public.metodos_pago TO service_role;
GRANT ALL ON public.conceptos TO service_role;
GRANT ALL ON public.movimientos TO service_role;
GRANT ALL ON public.movimiento_lineas TO service_role;
GRANT ALL ON public.movimiento_pagos TO service_role;
GRANT ALL ON public.cortes TO service_role;
GRANT ALL ON public.impresoras TO service_role;

-- ============================================================
-- Seed: métodos de pago SAT para clínicas existentes
-- ============================================================
INSERT INTO public.metodos_pago (clinic_id, codigo_sat, nombre)
SELECT c.id, mp.codigo_sat, mp.nombre
FROM public.clinics c
CROSS JOIN (
  VALUES
    ('01', 'Efectivo'),
    ('02', 'Cheque nominativo'),
    ('03', 'Transferencia electrónica SPEI'),
    ('04', 'Tarjeta de crédito'),
    ('28', 'Tarjeta de débito'),
    ('99', 'Por definir')
) AS mp(codigo_sat, nombre)
ON CONFLICT (clinic_id, codigo_sat) DO NOTHING;
