
-- doctor_servicios
CREATE TABLE public.doctor_servicios (
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  servicio_id uuid NOT NULL REFERENCES public.servicios(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doctor_id, servicio_id)
);
ALTER TABLE public.doctor_servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view doctor_servicios"
  ON public.doctor_servicios FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff manage doctor_servicios"
  ON public.doctor_servicios FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'receptionist'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'receptionist'));

-- Seed relations
INSERT INTO public.doctor_servicios (doctor_id, servicio_id) VALUES
  ('02edb38c-9ee5-49a6-9742-8537b2a70a93','12b1a9cd-3cae-43a3-b344-519d3ddf7d29'), -- Carlos -> Limpieza dental
  ('02edb38c-9ee5-49a6-9742-8537b2a70a93','468ab95e-f7a6-4b6c-885c-3614aec17091'), -- Carlos -> Consulta general
  ('ef41f99f-628d-495a-870b-cfd754e867ca','468ab95e-f7a6-4b6c-885c-3614aec17091'), -- María Elena -> Consulta general
  ('ef41f99f-628d-495a-870b-cfd754e867ca','03c9841b-c3a0-4deb-8f1f-979999df45f9'), -- María Elena -> Seguimiento
  ('ef41f99f-628d-495a-870b-cfd754e867ca','e254c230-aed8-474e-9f2e-871ae7802be7'), -- María Elena -> Control prenatal
  ('b222f455-1c14-445e-a5c6-1d19f833601e','468ab95e-f7a6-4b6c-885c-3614aec17091'), -- Ana Lucía -> Consulta general
  ('b222f455-1c14-445e-a5c6-1d19f833601e','03c9841b-c3a0-4deb-8f1f-979999df45f9'), -- Ana Lucía -> Seguimiento
  ('b222f455-1c14-445e-a5c6-1d19f833601e','4307ee64-92d7-48cc-a050-f1a2e4bb7be6'); -- Ana Lucía -> Estudios de laboratorio

-- bot_sesiones
CREATE TABLE public.bot_sesiones (
  identidad_canal_id uuid PRIMARY KEY REFERENCES public.identidades_canal(id) ON DELETE CASCADE,
  paso_actual text,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  servicio_id uuid REFERENCES public.servicios(id),
  doctor_id uuid REFERENCES public.doctors(id),
  slot_propuesto timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_sesiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage bot_sesiones"
  ON public.bot_sesiones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'nurse'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'nurse'));

CREATE TRIGGER trg_bot_sesiones_updated_at
  BEFORE UPDATE ON public.bot_sesiones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
