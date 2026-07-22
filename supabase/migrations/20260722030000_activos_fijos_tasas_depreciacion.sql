-- Tasas de depreciación fiscal para activos fijos (LISR Art. 34).
-- Catálogo global (sin clinic_id, mismo patrón que cuentas_contables): las tasas
-- las fija la ley, no cambian por clínica.
--
-- Investigación (2026-07-21): LISR Art. 34 fija por ley mobiliario y equipo de
-- oficina 10%, equipo de cómputo electrónico 30%, construcciones 5%, autos 25%.
-- Son tasas MÁXIMAS FIJAS (no variables/negociables) — el contribuyente puede
-- aplicar un % menor pero no mayor. Equipo médico NO tiene fracción explícita
-- en el texto del Art. 34 revisado (SDV Asesores, SAT Fácil, ilovecfdi.com.mx) —
-- la clasificación más citada en foros/despachos es la tasa residual de
-- mobiliario/equipo (10%), pero es criterio de clasificación, no un vacío legal
-- de tasa. Por eso el campo queda editable aquí: si el contador de Pablo
-- confirma una fracción distinta para equipo médico, se corrige el % sin migración.
CREATE TABLE IF NOT EXISTS public.activos_fijos_tasas (
  categoria text PRIMARY KEY,
  tasa_depreciacion_fiscal_pct numeric(5,2) NOT NULL CHECK (tasa_depreciacion_fiscal_pct > 0 AND tasa_depreciacion_fiscal_pct <= 100),
  fuente text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.activos_fijos_tasas (categoria, tasa_depreciacion_fiscal_pct, fuente) VALUES
  ('mobiliario_equipo', 10.00, 'LISR Art. 34 — mobiliario y equipo de oficina, tasa fija por ley'),
  ('equipo_medico', 10.00, 'LISR Art. 34 sin fracción explícita para equipo médico — clasificación más citada (foros/despachos fiscales) es la tasa residual de mobiliario/equipo. Confirmar con contador antes de usar en declaración real.'),
  ('equipo_computo', 30.00, 'LISR Art. 34 — equipo de cómputo electrónico, tasa fija por ley'),
  ('otro', 10.00, 'LISR Art. 34 — tasa residual "otros activos", tasa fija por ley')
ON CONFLICT (categoria) DO NOTHING;

ALTER TABLE public.activos_fijos_tasas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read tasas depreciacion" ON public.activos_fijos_tasas;
CREATE POLICY "Authenticated read tasas depreciacion"
  ON public.activos_fijos_tasas FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins update tasas depreciacion" ON public.activos_fijos_tasas;
CREATE POLICY "Admins update tasas depreciacion"
  ON public.activos_fijos_tasas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_activos_fijos_tasas_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_activos_fijos_tasas_updated_by ON public.activos_fijos_tasas;
CREATE TRIGGER trg_activos_fijos_tasas_updated_by
  BEFORE UPDATE ON public.activos_fijos_tasas
  FOR EACH ROW EXECUTE FUNCTION public.set_activos_fijos_tasas_updated_by();

-- activos_fijos: columna de tasa fiscal snapshot al momento del alta (no se
-- recalcula si luego cambia el catálogo — congela lo aplicado a ese activo).
ALTER TABLE public.activos_fijos
  ADD COLUMN IF NOT EXISTS tasa_depreciacion_fiscal_pct numeric(5,2);

UPDATE public.activos_fijos af
SET tasa_depreciacion_fiscal_pct = t.tasa_depreciacion_fiscal_pct
FROM public.activos_fijos_tasas t
WHERE af.categoria = t.categoria AND af.tasa_depreciacion_fiscal_pct IS NULL;

CREATE OR REPLACE FUNCTION public.registrar_activo_fijo(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_clinic_id uuid := (p_payload->>'clinic_id')::uuid;
  v_nombre text := p_payload->>'nombre';
  v_categoria text := COALESCE(p_payload->>'categoria', 'mobiliario_equipo');
  v_costo_centavos bigint := (p_payload->>'costo_centavos')::bigint;
  v_fecha date := COALESCE((p_payload->>'fecha_adquisicion')::date, current_date);
  v_proveedor_id uuid := NULLIF(p_payload->>'proveedor_id', '')::uuid;
  v_cuenta_abono_codigo text := COALESCE(p_payload->>'cuenta_abono_codigo', '102');
  v_notas text := p_payload->>'notas';
  v_tasa numeric(5,2);
  v_cuenta_cargo_id uuid;
  v_cuenta_abono_id uuid;
  v_activo_id uuid;
  v_poliza_id uuid;
BEGIN
  IF v_clinic_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_nombre IS NULL OR trim(v_nombre) = '' OR v_costo_centavos IS NULL OR v_costo_centavos <= 0 THEN
    RAISE EXCEPTION 'datos_invalidos_activo_fijo';
  END IF;

  SELECT id INTO v_cuenta_cargo_id FROM public.cuentas_contables WHERE codigo = '130';
  SELECT id INTO v_cuenta_abono_id FROM public.cuentas_contables WHERE codigo = v_cuenta_abono_codigo;
  IF v_cuenta_cargo_id IS NULL OR v_cuenta_abono_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_no_encontrada';
  END IF;

  SELECT tasa_depreciacion_fiscal_pct INTO v_tasa
  FROM public.activos_fijos_tasas WHERE categoria = v_categoria;

  INSERT INTO public.activos_fijos (clinic_id, nombre, categoria, costo_centavos, fecha_adquisicion, proveedor_id, notas, tasa_depreciacion_fiscal_pct, created_by)
  VALUES (v_clinic_id, trim(v_nombre), v_categoria, v_costo_centavos, v_fecha, v_proveedor_id, v_notas, v_tasa, auth.uid())
  RETURNING id INTO v_activo_id;

  v_poliza_id := public.crear_poliza(jsonb_build_object(
    'clinic_id', v_clinic_id, 'tipo', 'diario', 'fecha', v_fecha,
    'concepto', 'Alta activo fijo: ' || trim(v_nombre),
    'reference_type', 'activo_fijo', 'reference_id', v_activo_id, 'evento', 'registro',
    'partidas', jsonb_build_array(
      jsonb_build_object('cuenta_id', v_cuenta_cargo_id, 'debe_centavos', v_costo_centavos, 'haber_centavos', 0, 'descripcion', trim(v_nombre)),
      jsonb_build_object('cuenta_id', v_cuenta_abono_id, 'debe_centavos', 0, 'haber_centavos', v_costo_centavos, 'descripcion', trim(v_nombre))
    )
  ));

  UPDATE public.activos_fijos SET poliza_id = v_poliza_id WHERE id = v_activo_id;

  RETURN v_activo_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.registrar_activo_fijo(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_activo_fijo(jsonb) TO authenticated;
