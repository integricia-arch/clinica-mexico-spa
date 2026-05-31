
CREATE TABLE public.cajas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  fondo_default NUMERIC(12,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cajas_clinic ON public.cajas(clinic_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cajas TO authenticated;
GRANT ALL ON public.cajas TO service_role;

ALTER TABLE public.cajas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cajas_select_clinic_members"
ON public.cajas FOR SELECT
TO authenticated
USING (public.user_has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "cajas_insert_admin_manager"
ON public.cajas FOR INSERT
TO authenticated
WITH CHECK (
  public.user_has_clinic_access(auth.uid(), clinic_id)
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "cajas_update_admin_manager"
ON public.cajas FOR UPDATE
TO authenticated
USING (
  public.user_has_clinic_access(auth.uid(), clinic_id)
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
)
WITH CHECK (
  public.user_has_clinic_access(auth.uid(), clinic_id)
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "cajas_delete_admin"
ON public.cajas FOR DELETE
TO authenticated
USING (
  public.user_has_clinic_access(auth.uid(), clinic_id)
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE TRIGGER update_cajas_updated_at
BEFORE UPDATE ON public.cajas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
