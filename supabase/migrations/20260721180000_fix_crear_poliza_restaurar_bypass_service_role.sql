-- Bug de fase 7 (20260719150000_fase7_cierre_mensual.sql): al agregar el candado
-- de período, se colapsaron los 2 checks de fase 6B en uno solo:
--   IF v_clinic_id IS NULL OR NOT EXISTS(...) THEN forbidden;
-- perdiendo el bypass "auth.uid() IS NOT NULL AND" que fase 6B dejó a propósito
-- para llamadas cron/service_role (contab_devengar_honorarios, triggers internos).
-- Restaura los 2 checks separados, sin tocar el candado de período (intacto).
CREATE OR REPLACE FUNCTION public.crear_poliza(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_clinic_id uuid := (p_payload->>'clinic_id')::uuid;
  v_tipo text := p_payload->>'tipo';
  v_reference_type text := p_payload->>'reference_type';
  v_reference_id uuid := NULLIF(p_payload->>'reference_id', '')::uuid;
  v_evento text := COALESCE(p_payload->>'evento', 'registro');
  v_fecha date := COALESCE((p_payload->>'fecha')::date, current_date);
  v_partidas jsonb := p_payload->'partidas';
  v_partida jsonb;
  v_folio integer;
  v_poliza_id uuid;
  v_suma_debe bigint := 0;
  v_suma_haber bigint := 0;
  v_orden integer := 0;
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_tipo NOT IN ('ingreso', 'egreso', 'diario') THEN
    RAISE EXCEPTION 'tipo_poliza_invalido: %', v_tipo;
  END IF;

  IF v_partidas IS NULL OR jsonb_array_length(v_partidas) < 2 THEN
    RAISE EXCEPTION 'poliza_requiere_al_menos_2_partidas';
  END IF;

  IF v_reference_type IS NOT NULL AND v_reference_id IS NOT NULL THEN
    SELECT id INTO v_poliza_id FROM public.polizas
    WHERE reference_type = v_reference_type AND reference_id = v_reference_id AND evento = v_evento;
    IF v_poliza_id IS NOT NULL THEN
      RETURN v_poliza_id;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contab_cierres cc
    WHERE cc.clinic_id = v_clinic_id AND cc.cerrado_at IS NOT NULL
      AND cc.periodo = date_trunc('month', v_fecha)::date
  ) THEN
    RAISE EXCEPTION 'periodo_cerrado: % está cerrado, usa una fecha del período abierto', to_char(v_fecha, 'YYYY-MM');
  END IF;

  FOR v_partida IN SELECT * FROM jsonb_array_elements(v_partidas)
  LOOP
    DECLARE
      v_debe bigint := COALESCE((v_partida->>'debe_centavos')::bigint, 0);
      v_haber bigint := COALESCE((v_partida->>'haber_centavos')::bigint, 0);
    BEGIN
      IF v_partida->>'cuenta_id' IS NULL THEN
        RAISE EXCEPTION 'partida_sin_cuenta_id';
      END IF;
      IF NOT ((v_debe > 0 AND v_haber = 0) OR (v_haber > 0 AND v_debe = 0)) THEN
        RAISE EXCEPTION 'partida_debe_tener_exactamente_un_lado_positivo';
      END IF;
      v_suma_debe := v_suma_debe + v_debe;
      v_suma_haber := v_suma_haber + v_haber;
    END;
  END LOOP;

  IF v_suma_debe <> v_suma_haber THEN
    RAISE EXCEPTION 'poliza_desbalanceada: debe=% haber=%', v_suma_debe, v_suma_haber;
  END IF;

  INSERT INTO public.poliza_folios (clinic_id, tipo, ultimo_folio)
  VALUES (v_clinic_id, v_tipo, 1)
  ON CONFLICT (clinic_id, tipo) DO UPDATE SET ultimo_folio = public.poliza_folios.ultimo_folio + 1
  RETURNING ultimo_folio INTO v_folio;

  INSERT INTO public.polizas
    (clinic_id, folio, tipo, fecha, concepto, uuid_cfdi, reference_type, reference_id, evento, created_by)
  VALUES
    (v_clinic_id, v_folio, v_tipo, v_fecha,
     p_payload->>'concepto',
     NULLIF(p_payload->>'uuid_cfdi', '')::uuid,
     v_reference_type, v_reference_id, v_evento, auth.uid())
  RETURNING id INTO v_poliza_id;

  FOR v_partida IN SELECT * FROM jsonb_array_elements(v_partidas)
  LOOP
    v_orden := v_orden + 1;
    INSERT INTO public.poliza_partidas (poliza_id, orden, cuenta_id, debe_centavos, haber_centavos, descripcion)
    VALUES (
      v_poliza_id, v_orden, (v_partida->>'cuenta_id')::uuid,
      COALESCE((v_partida->>'debe_centavos')::bigint, 0),
      COALESCE((v_partida->>'haber_centavos')::bigint, 0),
      v_partida->>'descripcion'
    );
  END LOOP;

  RETURN v_poliza_id;
END;
$function$;
