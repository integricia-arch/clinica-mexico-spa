-- M3: Per-expediente permission sharing
-- Allows admin/owner to grant view or edit access to other doctors

CREATE TABLE public.expediente_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expediente_id uuid NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('view', 'edit')),
  granted_by uuid REFERENCES public.doctors(id),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(expediente_id, doctor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expediente_permissions TO authenticated;
GRANT ALL ON public.expediente_permissions TO service_role;

ALTER TABLE public.expediente_permissions ENABLE ROW LEVEL SECURITY;

-- Clinic staff (any role) can manage permissions for their clinic
CREATE POLICY "Clinic staff manage expediente_permissions"
ON public.expediente_permissions FOR ALL TO authenticated
USING (
  clinic_id IN (
    SELECT clinic_id FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
)
WITH CHECK (
  clinic_id IN (
    SELECT clinic_id FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE INDEX idx_exp_permissions_expediente
  ON public.expediente_permissions(expediente_id);
CREATE INDEX idx_exp_permissions_doctor
  ON public.expediente_permissions(doctor_id);

CREATE TRIGGER trg_exp_permissions_audit
AFTER INSERT OR UPDATE OR DELETE ON public.expediente_permissions
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
