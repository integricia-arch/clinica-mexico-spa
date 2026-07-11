-- supabase/migrations/20260710000001_clinics_archived_at.sql

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_clinic_archived(_clinic_id uuid, _archived boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_global_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  UPDATE public.clinics
  SET archived_at = CASE WHEN _archived THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = _clinic_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_clinic_archived(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_clinic_archived(uuid, boolean) TO authenticated;
