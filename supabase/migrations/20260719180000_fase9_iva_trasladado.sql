-- Fase 9: IVA y preparación fiscal.
-- El lado de IVA acreditable (compras) ya existe desde fase 6B (facturas_proveedor.iva_centavos
-- + cuenta 118). Esta migración construye el lado de IVA trasladado (ventas: caja/farmacia)
-- y el reporte. Tratamiento de IVA es configurable POR CUENTA de ingreso (nunca hardcodeado:
-- exención de servicios médicos depende del tipo de persona del emisor, algo que este sistema
-- no puede inferir con seguridad) y arranca en 'sin_configurar' — no asume nada hasta que el
-- admin lo confirme con su contador.

ALTER TABLE public.cuentas_contables
  ADD COLUMN IF NOT EXISTS iva_tratamiento text NOT NULL DEFAULT 'sin_configurar'
    CHECK (iva_tratamiento IN ('sin_configurar', 'exento', 'tasa_0', 'tasa_general')),
  ADD COLUMN IF NOT EXISTS iva_tasa_pct numeric(5,2);

-- Extiende el helper genérico de pólizas de 2 partidas: si la cuenta de abono es un
-- ingreso con tratamiento de IVA gravado, separa la póliza en 3 líneas
-- (Caja debe total / Ingreso haber subtotal / IVA trasladado haber iva), calculando
-- el IVA hacia atrás desde el total ya cobrado (total = subtotal + iva, IVA-incluido,
-- que es como ya se cobra hoy en producción). Si la cuenta está exenta, en tasa 0%, o
-- sin configurar, se comporta exactamente igual que antes (2 partidas, sin tocar 209).
CREATE OR REPLACE FUNCTION public.contab_generar_poliza_evento(
  p_clinic_id uuid,
  p_evento text,
  p_monto_centavos bigint,
  p_fecha date,
  p_concepto text,
  p_reference_type text,
  p_reference_id uuid,
  p_evento_poliza text DEFAULT 'registro',
  p_tipo_poliza text DEFAULT 'diario',
  p_uuid_cfdi uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_regla record;
  v_cuenta_ingreso record;
  v_cuenta_iva_trasladado_id uuid;
  v_iva_centavos bigint := 0;
  v_subtotal_centavos bigint;
  v_payload jsonb;
  v_partidas jsonb;
BEGIN
  IF p_monto_centavos IS NULL OR p_monto_centavos <= 0 THEN
    RAISE EXCEPTION 'monto_invalido_para_poliza: %', p_monto_centavos;
  END IF;

  SELECT * INTO v_regla FROM public.contab_resolver_regla(p_clinic_id, p_evento);
  IF v_regla.cuenta_cargo_id IS NULL OR v_regla.cuenta_abono_id IS NULL THEN
    RAISE EXCEPTION 'regla_no_encontrada: %', p_evento;
  END IF;

  SELECT tipo, iva_tratamiento, iva_tasa_pct INTO v_cuenta_ingreso
  FROM public.cuentas_contables WHERE id = v_regla.cuenta_abono_id;

  IF v_cuenta_ingreso.tipo = 'ingreso'
     AND v_cuenta_ingreso.iva_tratamiento IN ('tasa_0', 'tasa_general')
     AND v_cuenta_ingreso.iva_tasa_pct IS NOT NULL
     AND v_cuenta_ingreso.iva_tasa_pct > 0 THEN
    v_iva_centavos := ROUND(p_monto_centavos - p_monto_centavos / (1 + v_cuenta_ingreso.iva_tasa_pct / 100))::bigint;
  END IF;

  IF v_iva_centavos > 0 THEN
    SELECT id INTO v_cuenta_iva_trasladado_id FROM public.cuentas_contables WHERE codigo = '209';
    IF v_cuenta_iva_trasladado_id IS NULL THEN
      RAISE EXCEPTION 'cuenta_209_iva_trasladado_no_encontrada';
    END IF;
    v_subtotal_centavos := p_monto_centavos - v_iva_centavos;
    v_partidas := jsonb_build_array(
      jsonb_build_object('cuenta_id', v_regla.cuenta_cargo_id, 'debe_centavos', p_monto_centavos, 'haber_centavos', 0, 'descripcion', p_concepto),
      jsonb_build_object('cuenta_id', v_regla.cuenta_abono_id, 'debe_centavos', 0, 'haber_centavos', v_subtotal_centavos, 'descripcion', p_concepto),
      jsonb_build_object('cuenta_id', v_cuenta_iva_trasladado_id, 'debe_centavos', 0, 'haber_centavos', v_iva_centavos, 'descripcion', 'IVA trasladado')
    );
  ELSE
    v_partidas := jsonb_build_array(
      jsonb_build_object('cuenta_id', v_regla.cuenta_cargo_id, 'debe_centavos', p_monto_centavos, 'haber_centavos', 0, 'descripcion', p_concepto),
      jsonb_build_object('cuenta_id', v_regla.cuenta_abono_id, 'debe_centavos', 0, 'haber_centavos', p_monto_centavos, 'descripcion', p_concepto)
    );
  END IF;

  v_payload := jsonb_build_object(
    'clinic_id', p_clinic_id,
    'tipo', p_tipo_poliza,
    'fecha', p_fecha,
    'concepto', p_concepto,
    'uuid_cfdi', p_uuid_cfdi,
    'reference_type', p_reference_type,
    'reference_id', p_reference_id,
    'evento', p_evento_poliza,
    'partidas', v_partidas
  );

  RETURN public.crear_poliza(v_payload);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_generar_poliza_evento(uuid, text, bigint, date, text, text, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contab_generar_poliza_evento(uuid, text, bigint, date, text, text, uuid, text, text, uuid) TO service_role;

-- Reporte IVA: trasladado (209) vs acreditable (118) en un rango, por movimiento de
-- póliza (mismo patrón que estado_resultados/balanza — lee directo de poliza_partidas).
CREATE OR REPLACE FUNCTION public.reporte_iva(p_clinic_id uuid, p_desde date, p_hasta date)
RETURNS TABLE (
  tipo text,
  cuenta_codigo text,
  cuenta_nombre text,
  monto_centavos bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = p_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    CASE WHEN cc.codigo = '209' THEN 'trasladado' ELSE 'acreditable' END,
    cc.codigo, cc.nombre,
    (CASE WHEN cc.codigo = '209'
          THEN COALESCE(SUM(pp.haber_centavos), 0) - COALESCE(SUM(pp.debe_centavos), 0)
          ELSE COALESCE(SUM(pp.debe_centavos), 0) - COALESCE(SUM(pp.haber_centavos), 0) END)::bigint
  FROM public.cuentas_contables cc
  JOIN public.poliza_partidas pp ON pp.cuenta_id = cc.id
  JOIN public.polizas p ON p.id = pp.poliza_id
  WHERE p.clinic_id = p_clinic_id AND p.fecha BETWEEN p_desde AND p_hasta
    AND cc.codigo IN ('209', '118')
  GROUP BY cc.codigo, cc.nombre;
END;
$function$;

-- REVOKE debe incluir anon/authenticated explícitos: en Supabase, ALTER DEFAULT
-- PRIVILEGES ya les da EXECUTE al crear la función, y "FROM PUBLIC" a secas NO
-- lo revoca (lección de fase 6B, ver STATE.md — CRITICAL ya encontrado una vez).
REVOKE EXECUTE ON FUNCTION public.reporte_iva(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reporte_iva(uuid, date, date) TO authenticated, service_role;
