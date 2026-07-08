-- supabase/migrations/20260707140200_fix_set_clinic_whatsapp_verified_user_id.sql
--
-- Bug: set_clinic_whatsapp_verified() validaba autorizacion con auth.uid(),
-- pero la unica llamadora real (edge function whatsapp-test-send) invoca la
-- RPC con un cliente service_role, donde auth.uid() siempre resuelve NULL.
-- Resultado: la funcion SIEMPRE lanzaba 'No autorizado' y whatsapp_status
-- nunca pasaba a 'verified', sin que el error se propagara al usuario.
-- Fix: recibir _user_id explicito desde la edge function (que ya lo conoce
-- via supaUser.auth.getUser()) en vez de depender de auth.uid().

CREATE OR REPLACE FUNCTION public.set_clinic_whatsapp_verified(_clinic_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_global_admin(_user_id)
    OR public.user_has_clinic_role(_user_id, _clinic_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  UPDATE public.clinics SET whatsapp_status = 'verified', updated_at = now()
  WHERE id = _clinic_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_clinic_whatsapp_verified(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_clinic_whatsapp_verified(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_clinic_whatsapp_verified(uuid, uuid) TO authenticated;

-- La firma vieja (uuid) ya no se usa -- eliminarla para que no quede
-- ambiguedad de sobrecarga ni una version insegura huerfana.
DROP FUNCTION IF EXISTS public.set_clinic_whatsapp_verified(uuid);
