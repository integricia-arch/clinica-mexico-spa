-- ===========================================
-- FARMACIA E INVENTARIO
-- ===========================================

CREATE TYPE public.movimiento_tipo AS ENUM ('entrada', 'salida', 'ajuste', 'caducidad');

CREATE TABLE public.medicamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  categoria text NOT NULL,
  descripcion text,
  precio_unitario numeric(10,2) NOT NULL DEFAULT 0,
  stock_minimo integer NOT NULL DEFAULT 0,
  unidad text NOT NULL DEFAULT 'pieza',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lotes_medicamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicamento_id uuid NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  numero_lote text NOT NULL,
  fecha_caducidad date NOT NULL,
  existencia integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT existencia_positiva CHECK (existencia >= 0)
);

CREATE TABLE public.movimientos_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicamento_id uuid NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  lote_id uuid REFERENCES public.lotes_medicamento(id) ON DELETE SET NULL,
  tipo public.movimiento_tipo NOT NULL,
  cantidad integer NOT NULL,
  motivo text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_medicamentos_activo ON public.medicamentos(activo);
CREATE INDEX idx_lotes_medicamento ON public.lotes_medicamento(medicamento_id);
CREATE INDEX idx_lotes_caducidad ON public.lotes_medicamento(fecha_caducidad);
CREATE INDEX idx_movimientos_medicamento ON public.movimientos_inventario(medicamento_id);
CREATE INDEX idx_movimientos_fecha ON public.movimientos_inventario(created_at DESC);

-- Triggers
CREATE TRIGGER trg_medicamentos_updated_at BEFORE UPDATE ON public.medicamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lotes_updated_at BEFORE UPDATE ON public.lotes_medicamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.medicamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_medicamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;

-- medicamentos
CREATE POLICY "Staff read medicamentos" ON public.medicamentos
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'nurse') OR
    public.has_role(auth.uid(), 'receptionist') OR
    public.has_role(auth.uid(), 'doctor')
  );

CREATE POLICY "Admin/nurse manage medicamentos" ON public.medicamentos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'nurse'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'nurse'));

-- lotes
CREATE POLICY "Staff read lotes" ON public.lotes_medicamento
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'nurse') OR
    public.has_role(auth.uid(), 'receptionist') OR
    public.has_role(auth.uid(), 'doctor')
  );

CREATE POLICY "Admin/nurse manage lotes" ON public.lotes_medicamento
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'nurse'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'nurse'));

-- movimientos
CREATE POLICY "Staff read movimientos" ON public.movimientos_inventario
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'nurse') OR
    public.has_role(auth.uid(), 'receptionist')
  );

CREATE POLICY "Admin/nurse create movimientos" ON public.movimientos_inventario
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'nurse'));
