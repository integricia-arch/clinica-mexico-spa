CREATE OR REPLACE FUNCTION public.get_prescription_audit(_prescription_id uuid)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  user_id uuid,
  accion public.audit_action,
  event text,
  payload jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  -- Verifica que el usuario tenga acceso a la receta (staff o paciente dueño)
  SELECT EXISTS (
    SELECT 1 FROM public.prescriptions p
    WHERE p.id = _prescription_id
      AND (
        public.is_clinic_staff(auth.uid())
        OR p.patient_id IN (SELECT pat.id FROM public.patients pat WHERE pat.user_id = auth.uid())
      )
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'No tiene permisos para ver la bitácora de esta receta';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.created_at,
    a.user_id,
    a.accion,
    (a.datos_nuevos->>'event') AS event,
    a.datos_nuevos AS payload
  FROM public.audit_logs a
  WHERE a.tabla = 'prescriptions'
    AND a.registro_id = _prescription_id
  ORDER BY a.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_prescription_audit(uuid) TO authenticated;