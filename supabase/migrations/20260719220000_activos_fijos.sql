-- Activos fijos (bienes muebles: mobiliario, equipo médico, equipo de cómputo).
-- Sin depreciación todavía (pendiente confirmar tasas LISR Art. 34 con el
-- contador, ver memoria técnica §11) — solo registro de alta + póliza contable.
INSERT INTO public.cuentas_contables (codigo, nombre, tipo, naturaleza, nivel, es_fijo)
SELECT '130', 'Mobiliario y equipo', 'activo', 'deudora', 1, false
WHERE NOT EXISTS (SELECT 1 FROM public.cuentas_contables WHERE codigo = '130');

CREATE TABLE IF NOT EXISTS public.activos_fijos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  nombre text NOT NULL,
  categoria text NOT NULL DEFAULT 'mobiliario_equipo',
  costo_centavos bigint NOT NULL CHECK (costo_centavos > 0),
  fecha_adquisicion date NOT NULL DEFAULT current_date,
  proveedor_id uuid REFERENCES public.proveedores(id),
  notas text,
  poliza_id uuid REFERENCES public.polizas(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activos_fijos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read activos_fijos" ON public.activos_fijos;
CREATE POLICY "Members read activos_fijos"
  ON public.activos_fijos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND clinic_id = activos_fijos.clinic_id
    )
  );
-- Sin policies de escritura: alta SOLO vía RPC registrar_activo_fijo (SECURITY DEFINER).

-- RPC: alta de activo fijo. Cargo 130 Mobiliario y equipo; abono elegido por
-- el usuario (102 Bancos si es de contado, 201 Proveedores si es a crédito).
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

  INSERT INTO public.activos_fijos (clinic_id, nombre, categoria, costo_centavos, fecha_adquisicion, proveedor_id, notas, created_by)
  VALUES (v_clinic_id, trim(v_nombre), v_categoria, v_costo_centavos, v_fecha, v_proveedor_id, v_notas, auth.uid())
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
