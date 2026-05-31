
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cajero';

CREATE TABLE public.turnos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL,
  caja_id UUID NOT NULL REFERENCES public.cajas(id) ON DELETE RESTRICT,
  cajero_user_id UUID NOT NULL,
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','cerrado','cancelado')),
  monto_apertura NUMERIC(12,2) NOT NULL DEFAULT 0,
  notas_apertura TEXT,
  notas_cierre TEXT,
  abierto_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_turnos_clinic ON public.turnos(clinic_id);
CREATE INDEX idx_turnos_cajero ON public.turnos(cajero_user_id);
CREATE UNIQUE INDEX uq_turnos_un_abierto_por_cajero
  ON public.turnos(cajero_user_id) WHERE estado = 'abierto';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.turnos TO authenticated;
GRANT ALL ON public.turnos TO service_role;

ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "turnos_select_clinic_members"
ON public.turnos FOR SELECT
TO authenticated
USING (public.user_has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "turnos_insert_own"
ON public.turnos FOR INSERT
TO authenticated
WITH CHECK (
  cajero_user_id = auth.uid()
  AND public.user_has_clinic_access(auth.uid(), clinic_id)
);

CREATE POLICY "turnos_update_own_or_admin"
ON public.turnos FOR UPDATE
TO authenticated
USING (
  public.user_has_clinic_access(auth.uid(), clinic_id)
  AND (
    cajero_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
)
WITH CHECK (
  public.user_has_clinic_access(auth.uid(), clinic_id)
);

CREATE TRIGGER update_turnos_updated_at
BEFORE UPDATE ON public.turnos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
