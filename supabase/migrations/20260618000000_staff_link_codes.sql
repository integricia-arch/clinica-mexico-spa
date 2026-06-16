-- staff_link_codes ya existía en prod (aplicada manualmente) sin migración
-- en git. Esta migración cierra el drift documentándola en el repo.

CREATE TABLE IF NOT EXISTS public.staff_link_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

ALTER TABLE public.staff_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff genera y ve su propio código" ON public.staff_link_codes
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
