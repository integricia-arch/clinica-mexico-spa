
CREATE OR REPLACE FUNCTION public.generate_prescription_number_for_doctor(_doctor_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
  v_prefix text;
  v_count int;
  v_doc record;
BEGIN
  SELECT cedula_profesional, apellidos, nombre INTO v_doc
    FROM public.doctors WHERE id = _doctor_id;

  IF v_doc IS NULL THEN
    RAISE EXCEPTION 'Médico no encontrado';
  END IF;

  IF v_doc.cedula_profesional IS NOT NULL AND length(regexp_replace(v_doc.cedula_profesional, '\D', '', 'g')) >= 4 THEN
    v_code := right(regexp_replace(v_doc.cedula_profesional, '\D', '', 'g'), 4);
  ELSE
    v_code := upper(left(regexp_replace(COALESCE(v_doc.apellidos, 'DR'), '\s', '', 'g'), 3) ||
                    left(regexp_replace(COALESCE(v_doc.nombre, 'X'), '\s', '', 'g'), 1));
  END IF;

  v_prefix := 'RX-' || to_char(now() AT TIME ZONE 'America/Mexico_City', 'YYYYMMDD') || '-' || v_code;

  SELECT COUNT(*) + 1 INTO v_count
    FROM public.prescriptions
    WHERE prescription_number LIKE v_prefix || '%';

  RETURN v_prefix || '-' || lpad(v_count::text, 5, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_prescription_number_for_doctor(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_prescription_number_for_doctor(uuid) TO service_role;
