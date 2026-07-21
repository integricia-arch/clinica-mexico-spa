-- 1. contab_generar_poliza_evento ya existe (fase 6B) pero solo tiene GRANT a
--    service_role. El corrector lo dispara desde el navegador (usuario autenticado),
--    así que necesita poder llamarlo. crear_poliza() ya valida membership cuando
--    auth.uid() IS NOT NULL, así que este GRANT no abre ningún hueco de seguridad
--    nuevo -- solo permite que un miembro de la clínica dispare la generación para
--    SU PROPIA clínica (el payload trae clinic_id, crear_poliza lo valida).
GRANT EXECUTE ON FUNCTION public.contab_generar_poliza_evento(
  uuid, text, bigint, date, text, text, uuid, text, text, uuid
) TO authenticated;

-- 2. Diagnóstico de un hueco puntual: dado un movimiento_contables sin póliza,
--    resuelve qué póliza le correspondería según el motor de reglas ya existente
--    (contab_reglas_asiento / contab_resolver_regla), sin escribir nada.
CREATE OR REPLACE FUNCTION public.contab_diagnosticar_hueco(p_movimiento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_mov public.movimientos_contables%ROWTYPE;
  v_regla record;
  v_cargo record;
  v_abono record;
BEGIN
  SELECT * INTO v_mov FROM public.movimientos_contables WHERE id = p_movimiento_id;
  IF v_mov IS NULL THEN
    RAISE EXCEPTION 'movimiento_no_encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = v_mov.clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_regla FROM public.contab_resolver_regla(v_mov.clinic_id, v_mov.evento);

  IF v_regla.cuenta_cargo_id IS NULL OR v_regla.cuenta_abono_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'regla_no_encontrada', 'evento', v_mov.evento);
  END IF;

  SELECT id, codigo, nombre INTO v_cargo FROM public.cuentas_contables WHERE id = v_regla.cuenta_cargo_id;
  SELECT id, codigo, nombre INTO v_abono FROM public.cuentas_contables WHERE id = v_regla.cuenta_abono_id;

  RETURN jsonb_build_object(
    'ok', true,
    'movimiento_id', v_mov.id,
    'clinic_id', v_mov.clinic_id,
    'evento', v_mov.evento,
    'reference_type', v_mov.reference_type,
    'reference_id', v_mov.reference_id,
    'monto_centavos', abs(v_mov.monto_centavos),
    'fecha_devengo', v_mov.fecha_devengo,
    'descripcion', v_mov.descripcion,
    'cuenta_cargo', jsonb_build_object('id', v_cargo.id, 'codigo', v_cargo.codigo, 'nombre', v_cargo.nombre),
    'cuenta_abono', jsonb_build_object('id', v_abono.id, 'codigo', v_abono.codigo, 'nombre', v_abono.nombre)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_diagnosticar_hueco(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contab_diagnosticar_hueco(uuid) TO authenticated;
