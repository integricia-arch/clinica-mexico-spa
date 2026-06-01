-- CRITICAL #3: Move authorize_step_override logic to SECURITY DEFINER function
-- Eliminates app-layer-only role check; DB enforces admin authorization independently.

CREATE OR REPLACE FUNCTION authorize_step_override(p_override_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_is_admin BOOLEAN;
  v_override journey_instance_overrides%ROWTYPE;
  v_now      TIMESTAMPTZ := NOW();
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autenticado');
  END IF;

  SELECT has_role(v_user_id, 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo administradores pueden autorizar overrides');
  END IF;

  SELECT * INTO v_override FROM journey_instance_overrides WHERE id = p_override_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Override no encontrado');
  END IF;
  IF v_override.status != 'requested' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Override ya procesado');
  END IF;

  UPDATE journey_instance_overrides
  SET status = 'authorized', authorized_by = v_user_id, authorized_at = v_now
  WHERE id = p_override_id;

  UPDATE journey_instance_steps
  SET status = 'override_authorized', closed_at = v_now, closed_by = v_user_id
  WHERE id = v_override.journey_instance_step_id;

  PERFORM update_journey_progress(v_override.journey_instance_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Only authenticated users can call; DB validates admin role internally
REVOKE ALL ON FUNCTION authorize_step_override(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authorize_step_override(UUID) TO authenticated;
