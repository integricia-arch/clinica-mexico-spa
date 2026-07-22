-- Test manual de contab_generar_poliza_evento (tarea E1, ver
-- memoria/proyectos/plan-avance-ejecucion.md #5 y modulo-contable-memoria-tecnica.md).
--
-- Por que manual y no en CI: esta funcion SQL SECURITY DEFINER solo se invoca desde
-- triggers/otras RPCs (contab_reglas_asiento -> crear_poliza), no tiene logica de
-- cliente que extraer a un test unitario JS. Un harness pgTAP/Supabase-local en CI
-- es la solucion correcta a largo plazo pero es infraestructura nueva grande para
-- una sola funcion; decision tomada 2026-07-22: correr esto a mano (via MCP
-- execute_sql o `supabase db query --linked --file`) despues de cualquier cambio
-- a contab_generar_poliza_evento, crear_poliza, o contab_resolver_regla.
--
-- Todo el fixture vive dentro de BEGIN/ROLLBACK -- nunca se commitea nada, seguro
-- correr contra prod. Si algun ASSERT falla, el bloque RAISE EXCEPTION aborta y
-- el error aparece en el resultado del query.
--
-- Cubre: split de 3 lineas cuando la cuenta de abono tiene iva_tratamiento =
-- 'tasa_general' (fase 9), balance debe=haber, monto total correcto, calculo
-- exacto del IVA trasladado hacia atras (monto IVA-incluido).
--
-- NO cubre (limitacion conocida): esta transaccion corre via rol postgres/service
-- (MCP execute_sql), no via 'authenticated' con auth.uid() real -- no reproduce el
-- bug ya documentado de crear_poliza() perdiendo el bypass de auth.uid() IS NULL
-- para service_role/cron (ver project_crear-poliza-perdio-bypass-service-role.md).

BEGIN;

DO $$
DECLARE
  v_clinic_id uuid;
  v_cuenta_caja_id uuid;
  v_cuenta_ingreso_id uuid;
  v_cuenta_209_id uuid;
  v_poliza_id uuid;
  v_debe bigint;
  v_haber bigint;
  v_lineas int;
BEGIN
  SELECT id INTO v_clinic_id FROM public.clinics LIMIT 1;
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'no_hay_clinicas_para_probar';
  END IF;

  SELECT id INTO v_cuenta_209_id FROM public.cuentas_contables WHERE codigo = '209';
  IF v_cuenta_209_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_209_no_existe';
  END IF;

  INSERT INTO public.cuentas_contables (codigo, nombre, tipo, es_fijo, naturaleza)
  VALUES ('TEST-CARGO-E1', 'Test caja E1', 'ingreso', false, 'deudora')
  RETURNING id INTO v_cuenta_caja_id;

  INSERT INTO public.cuentas_contables (codigo, nombre, tipo, es_fijo, naturaleza, iva_tratamiento, iva_tasa_pct)
  VALUES ('TEST-ABONO-E1', 'Test ingreso E1', 'ingreso', false, 'acreedora', 'tasa_general', 16)
  RETURNING id INTO v_cuenta_ingreso_id;

  INSERT INTO public.contab_reglas_asiento (clinic_id, evento, cuenta_cargo_id, cuenta_abono_id)
  VALUES (v_clinic_id, 'TEST_EVENTO_E1', v_cuenta_caja_id, v_cuenta_ingreso_id);

  v_poliza_id := public.contab_generar_poliza_evento(
    v_clinic_id, 'TEST_EVENTO_E1', 11600, CURRENT_DATE, 'Test E1 poliza IVA',
    'test_e1', gen_random_uuid(), 'registro', 'diario', NULL
  );

  SELECT COALESCE(SUM(debe_centavos),0), COALESCE(SUM(haber_centavos),0), COUNT(*)
  INTO v_debe, v_haber, v_lineas
  FROM public.poliza_partidas WHERE poliza_id = v_poliza_id;

  RAISE NOTICE 'RESULT poliza_id=% lineas=% debe=% haber=% balanceado=%',
    v_poliza_id, v_lineas, v_debe, v_haber, (v_debe = v_haber);

  IF v_lineas <> 3 THEN
    RAISE EXCEPTION 'assert_fallo: se esperaban 3 lineas (cargo/ingreso/IVA), hubo %', v_lineas;
  END IF;
  IF v_debe <> v_haber THEN
    RAISE EXCEPTION 'assert_fallo: poliza desbalanceada debe=% haber=%', v_debe, v_haber;
  END IF;
  IF v_debe <> 11600 THEN
    RAISE EXCEPTION 'assert_fallo: total esperado 11600, fue %', v_debe;
  END IF;

  -- IVA esperado: 11600 - 11600/1.16 = 1600 centavos exacto (monto redondo elegido a proposito)
  PERFORM 1 FROM public.poliza_partidas WHERE poliza_id = v_poliza_id AND haber_centavos = 1600;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'assert_fallo: no se encontro la linea de IVA trasladado de 1600 centavos';
  END IF;

  RAISE NOTICE 'TODOS LOS ASSERTS PASARON';
END $$;

ROLLBACK;
