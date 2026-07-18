-- Folio correlativo de apertura + explicación obligatoria en diferencia de apertura (Task 6)
CREATE SEQUENCE IF NOT EXISTS public.turnos_apertura_folio_seq
  START WITH 1 INCREMENT BY 1 NO CYCLE;
GRANT USAGE, SELECT ON SEQUENCE public.turnos_apertura_folio_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.turnos_apertura_folio_seq TO service_role;

ALTER TABLE public.turnos
  ADD COLUMN IF NOT EXISTS folio_apertura bigint,
  ADD COLUMN IF NOT EXISTS conteo_apertura numeric(12,2),
  ADD COLUMN IF NOT EXISTS fondo_esperado numeric(12,2),
  ADD COLUMN IF NOT EXISTS denominaciones_apertura jsonb;

CREATE OR REPLACE FUNCTION public.turno_open(
  p_clinic_id uuid,
  p_caja_id uuid,
  p_monto_apertura numeric,
  p_conteo_apertura numeric,
  p_fondo_esperado numeric DEFAULT NULL,
  p_denominaciones jsonb DEFAULT NULL,
  p_notas text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user uuid := auth.uid();
  v_folio bigint;
  v_turno record;
  v_diff numeric(12,2);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF NOT public.user_has_clinic_access(v_user, p_clinic_id) THEN
    RAISE EXCEPTION 'Sin acceso a esta clínica';
  END IF;
  IF NOT public.is_caja_staff(v_user) THEN
    RAISE EXCEPTION 'Sin permiso para abrir turno';
  END IF;
  IF p_monto_apertura IS NULL OR p_monto_apertura < 0 THEN
    RAISE EXCEPTION 'Monto de apertura inválido';
  END IF;

  IF p_fondo_esperado IS NOT NULL THEN
    v_diff := p_conteo_apertura - p_fondo_esperado;
    IF v_diff <> 0 AND (p_notas IS NULL OR length(trim(p_notas)) = 0) THEN
      RAISE EXCEPTION 'NOTES_REQUIRED_ON_DIFF|%', v_diff;
    END IF;
  END IF;

  v_folio := nextval('public.turnos_apertura_folio_seq');

  INSERT INTO public.turnos (
    clinic_id, caja_id, cajero_user_id, monto_apertura, conteo_apertura,
    fondo_esperado, denominaciones_apertura, folio_apertura, notas_apertura, estado
  ) VALUES (
    p_clinic_id, p_caja_id, v_user, p_monto_apertura, p_conteo_apertura,
    p_fondo_esperado, p_denominaciones, v_folio, p_notas, 'abierto'
  )
  RETURNING id, caja_id, estado, monto_apertura, abierto_at, pharmacy_shift_id
  INTO v_turno;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (v_user, 'crear', 'turnos', v_turno.id,
          jsonb_build_object('event', 'turno_abierto', 'folio_apertura', v_folio,
            'monto_apertura', p_monto_apertura, 'fondo_esperado', p_fondo_esperado), p_clinic_id);

  RETURN jsonb_build_object(
    'id', v_turno.id, 'folio_apertura', v_folio, 'caja_id', v_turno.caja_id,
    'estado', v_turno.estado, 'monto_apertura', v_turno.monto_apertura,
    'abierto_at', v_turno.abierto_at, 'pharmacy_shift_id', v_turno.pharmacy_shift_id
  );
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.turno_open(uuid, uuid, numeric, numeric, numeric, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.turno_open(uuid, uuid, numeric, numeric, numeric, jsonb, text) TO authenticated;
