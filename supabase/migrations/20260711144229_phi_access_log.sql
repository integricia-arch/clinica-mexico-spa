-- supabase/migrations/20260711144229_phi_access_log.sql

CREATE TABLE public.phi_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  tabla text NOT NULL,
  accion text NOT NULL CHECK (accion IN ('select', 'export')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_phi_access_log_patient ON public.phi_access_log(patient_id, created_at DESC);
CREATE INDEX idx_phi_access_log_clinic ON public.phi_access_log(clinic_id, created_at DESC);

ALTER TABLE public.phi_access_log ENABLE ROW LEVEL SECURITY;

-- La service role de Supabase tiene BYPASSRLS: ignora RLS por diseño de
-- Postgres/Supabase. El unico control real de "append-only ni para la
-- service role" es REVOKE de privilegios a nivel de tabla — RLS por si
-- sola NO alcanza.
REVOKE ALL ON public.phi_access_log FROM PUBLIC;
REVOKE ALL ON public.phi_access_log FROM authenticated;
REVOKE ALL ON public.phi_access_log FROM service_role;

-- Solo SELECT para revisión, gateado por RLS (platform_staff o admin de
-- la propia clínica). INSERT nunca se otorga directo a ningún rol externo
-- a la DB — solo pasa por la función SECURITY DEFINER de abajo, que corre
-- como el owner de la tabla y no necesita GRANT explícito.
GRANT SELECT ON public.phi_access_log TO authenticated;

CREATE POLICY "phi_access_log_read_platform_staff"
ON public.phi_access_log
FOR SELECT
TO authenticated
USING (public.is_global_admin(auth.uid()));

CREATE POLICY "phi_access_log_read_clinic_admin"
ON public.phi_access_log
FOR SELECT
TO authenticated
USING (
  public.user_has_clinic_role(auth.uid(), clinic_id, 'admin')
);

-- Nota: no se crea NINGUNA policy de INSERT/UPDATE/DELETE. Sin GRANT de
-- esos privilegios a ningún rol (revocados arriba), ninguna policy podría
-- habilitarlos de todas formas — defensa en profundidad, ambas capas.

CREATE OR REPLACE FUNCTION public.log_phi_access(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_tabla text,
  p_accion text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_has_clinic_access(auth.uid(), p_clinic_id) THEN
    RAISE EXCEPTION 'sin acceso a la clinica';
  END IF;

  INSERT INTO public.phi_access_log (user_id, clinic_id, patient_id, tabla, accion)
  VALUES (auth.uid(), p_clinic_id, p_patient_id, p_tabla, p_accion);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_phi_access(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_phi_access(uuid, uuid, text, text) TO authenticated;
