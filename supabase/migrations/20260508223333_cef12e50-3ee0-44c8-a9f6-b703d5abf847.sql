
-- Enums
DO $$ BEGIN
  CREATE TYPE public.movimiento_tipo AS ENUM ('entrada', 'salida', 'ajuste');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Medicamentos (duplicado de 20260508000002_farmacia.sql -- idempotente para CI de DB efímera)
CREATE TABLE IF NOT EXISTS public.medicamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  categoria text NOT NULL DEFAULT 'Otro',
  descripcion text,
  precio_unitario numeric(10,2) NOT NULL DEFAULT 0,
  stock_minimo integer NOT NULL DEFAULT 0,
  unidad text NOT NULL DEFAULT 'pieza',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medicamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view medicamentos" ON public.medicamentos;
CREATE POLICY "Staff view medicamentos" ON public.medicamentos FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'receptionist') OR has_role(auth.uid(), 'doctor') OR has_role(auth.uid(), 'nurse'));

DROP POLICY IF EXISTS "Admin/nurse insert medicamentos" ON public.medicamentos;
CREATE POLICY "Admin/nurse insert medicamentos" ON public.medicamentos FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'nurse'));

DROP POLICY IF EXISTS "Admin/nurse update medicamentos" ON public.medicamentos;
CREATE POLICY "Admin/nurse update medicamentos" ON public.medicamentos FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'nurse'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'nurse'));

DROP POLICY IF EXISTS "Admin delete medicamentos" ON public.medicamentos;
CREATE POLICY "Admin delete medicamentos" ON public.medicamentos FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_meds_updated ON public.medicamentos;
CREATE TRIGGER trg_meds_updated BEFORE UPDATE ON public.medicamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lotes
CREATE TABLE IF NOT EXISTS public.lotes_medicamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicamento_id uuid NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  numero_lote text NOT NULL,
  fecha_caducidad date NOT NULL,
  existencia integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lotes_med ON public.lotes_medicamento(medicamento_id);
ALTER TABLE public.lotes_medicamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view lotes" ON public.lotes_medicamento;
CREATE POLICY "Staff view lotes" ON public.lotes_medicamento FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'receptionist') OR has_role(auth.uid(), 'doctor') OR has_role(auth.uid(), 'nurse'));

DROP POLICY IF EXISTS "Admin/nurse manage lotes" ON public.lotes_medicamento;
CREATE POLICY "Admin/nurse manage lotes" ON public.lotes_medicamento FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'nurse'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'nurse'));

DROP TRIGGER IF EXISTS trg_lotes_updated ON public.lotes_medicamento;
CREATE TRIGGER trg_lotes_updated BEFORE UPDATE ON public.lotes_medicamento
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Movimientos
CREATE TABLE IF NOT EXISTS public.movimientos_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicamento_id uuid NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  lote_id uuid REFERENCES public.lotes_medicamento(id) ON DELETE SET NULL,
  tipo movimiento_tipo NOT NULL,
  cantidad integer NOT NULL,
  motivo text,
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movs_med ON public.movimientos_inventario(medicamento_id, created_at DESC);
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view movs" ON public.movimientos_inventario;
CREATE POLICY "Staff view movs" ON public.movimientos_inventario FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'receptionist') OR has_role(auth.uid(), 'doctor') OR has_role(auth.uid(), 'nurse'));

DROP POLICY IF EXISTS "Admin/nurse insert movs" ON public.movimientos_inventario;
CREATE POLICY "Admin/nurse insert movs" ON public.movimientos_inventario FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'nurse'));

DROP POLICY IF EXISTS "Admin delete movs" ON public.movimientos_inventario;
CREATE POLICY "Admin delete movs" ON public.movimientos_inventario FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));
