-- RPC para que admin/manager pueda ver qué doctores tienen Google Calendar conectado.
-- doctor_calendars tiene RLS service_role only (tokens OAuth); esta función expone
-- solo doctor_id + google_email (sin tokens) usando SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.get_doctor_calendars(p_clinic_id uuid)
RETURNS TABLE(doctor_id uuid, google_email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dc.doctor_id, dc.google_email
  FROM public.doctor_calendars dc
  WHERE (p_clinic_id IS NULL OR dc.clinic_id = p_clinic_id)
    AND dc.activo = true;
$$;

REVOKE ALL ON FUNCTION public.get_doctor_calendars(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_doctor_calendars(uuid) TO authenticated;
