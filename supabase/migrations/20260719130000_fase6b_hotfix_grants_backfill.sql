-- ---------------------------------------------------------------------------
-- Hotfix Fase 6B (gate de seguridad, 2026-07-19)
--
-- Corrige DOS hallazgos del gate sobre 20260719120000_fase6b_motor_asientos.sql:
--
-- [CRITICAL] En Supabase, `REVOKE EXECUTE ... FROM PUBLIC` NO revoca el EXECUTE
--   de `anon`/`authenticated`: el proyecto tiene ALTER DEFAULT PRIVILEGES que
--   otorga EXECUTE DIRECTO (no vía PUBLIC) a esos roles al crear cada función.
--   Verificado en prod: crear_poliza.proacl = {...anon=X/postgres...},
--   has_function_privilege('anon','crear_poliza','EXECUTE') = true.
--   Como `auth.uid()` es NULL también para `anon` (no solo service_role), el
--   bypass de membership `IF auth.uid() IS NOT NULL AND NOT EXISTS(...)` en
--   crear_poliza/cancelar_poliza/contab_generar_poliza_evento se salta entero:
--   un atacante sin login puede crear/cancelar pólizas de cualquier clinic_id
--   vía /rest/v1/rpc con la anon key pública.
--   Fix: REVOKE EXECUTE explícito de `anon` (y de `authenticated` en las
--   funciones service_role-only) en TODAS las funciones contables de 6A/6B.
--   Lección de proyecto: en Supabase el checklist SECURITY DEFINER debe usar
--   `REVOKE ... FROM PUBLIC, anon, authenticated` — nunca FROM PUBLIC a secas.
--
-- [HIGH] contab_backfill_polizas llamaba crear_poliza fuera de BEGIN/EXCEPTION:
--   una sola fila histórica con monto_centavos = 0/NULL disparaba excepción,
--   revertía TODA la corrida (una sola transacción PL/pgSQL) y bloqueaba
--   reintentos indefinidamente. Fix: capturar por fila y encolar el pendiente.
-- ---------------------------------------------------------------------------

-- === Parte 1: revocar EXECUTE de anon/authenticated ========================

-- Funciones para usuarios logueados + cron (mantienen authenticated + service_role):
REVOKE EXECUTE ON FUNCTION public.crear_poliza(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_poliza(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_insumos_cita(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revertir_insumos_cita(uuid) FROM anon;

-- Funciones service_role-only (cron/edge/triggers internos): quitar anon Y authenticated.
REVOKE EXECUTE ON FUNCTION public.contab_resolver_regla(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contab_encolar_pendiente(uuid, text, text, uuid, bigint, date, text, text, text, jsonb, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contab_generar_poliza_evento(uuid, text, bigint, date, text, text, uuid, text, text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contab_devengar_honorarios() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contab_egreso_manual_poliza() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contab_backfill_polizas() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contab_reprocesar_pendientes() FROM anon, authenticated;

-- Trigger functions (RETURNS trigger, no invocables directamente, pero limpiamos
-- el grant por higiene y para acallar el advisor):
REVOKE EXECUTE ON FUNCTION public.contab_movimiento_caja() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contab_pharmacy_sale() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contab_factura_proveedor() FROM anon, authenticated;

-- === Parte 2: backfill robusto por fila ====================================
CREATE OR REPLACE FUNCTION public.contab_backfill_polizas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_row record;
  v_count integer := 0;
  v_puente_id uuid;
  v_cuenta_tipo text;
  v_es_ingreso boolean;
  v_monto bigint;
  v_partidas jsonb;
  v_poliza_evento text;
  v_tipo text;
BEGIN
  SELECT id INTO v_puente_id FROM public.cuentas_contables WHERE codigo = '399';
  IF v_puente_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_puente_399_no_encontrada';
  END IF;

  FOR v_row IN
    SELECT m.* FROM public.movimientos_contables m
    WHERE m.reference_type IS NOT NULL AND m.reference_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.polizas p
        WHERE p.reference_type = m.reference_type AND p.reference_id = m.reference_id
          AND p.evento = (CASE WHEN m.evento = 'cancelacion' THEN 'cancelacion' ELSE 'registro' END)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.contab_asientos_pendientes pend
        WHERE pend.reference_type = m.reference_type AND pend.reference_id = m.reference_id
          AND pend.resuelto_at IS NULL
      )
  LOOP
    -- Cada fila en su propio bloque: una fila corrupta se encola y el backfill
    -- sigue, en vez de abortar (y revertir) toda la corrida.
    BEGIN
      SELECT tipo INTO v_cuenta_tipo FROM public.cuentas_contables WHERE id = v_row.cuenta_id;
      v_es_ingreso := (v_cuenta_tipo = 'ingreso');
      v_monto := ABS(v_row.monto_centavos);
      v_poliza_evento := CASE WHEN v_row.evento = 'cancelacion' THEN 'cancelacion' ELSE 'registro' END;
      v_tipo := CASE WHEN v_es_ingreso THEN 'ingreso' ELSE 'egreso' END;

      IF v_monto IS NULL OR v_monto = 0 THEN
        RAISE EXCEPTION 'monto_backfill_invalido: %', v_row.monto_centavos;
      END IF;

      IF v_row.monto_centavos > 0 THEN
        IF v_es_ingreso THEN
          v_partidas := jsonb_build_array(
            jsonb_build_object('cuenta_id', v_puente_id, 'debe_centavos', v_monto, 'haber_centavos', 0, 'descripcion', 'Backfill histórico'),
            jsonb_build_object('cuenta_id', v_row.cuenta_id, 'debe_centavos', 0, 'haber_centavos', v_monto, 'descripcion', 'Backfill histórico')
          );
        ELSE
          v_partidas := jsonb_build_array(
            jsonb_build_object('cuenta_id', v_row.cuenta_id, 'debe_centavos', v_monto, 'haber_centavos', 0, 'descripcion', 'Backfill histórico'),
            jsonb_build_object('cuenta_id', v_puente_id, 'debe_centavos', 0, 'haber_centavos', v_monto, 'descripcion', 'Backfill histórico')
          );
        END IF;
      ELSE
        IF v_es_ingreso THEN
          v_partidas := jsonb_build_array(
            jsonb_build_object('cuenta_id', v_row.cuenta_id, 'debe_centavos', v_monto, 'haber_centavos', 0, 'descripcion', 'Backfill histórico (reversa)'),
            jsonb_build_object('cuenta_id', v_puente_id, 'debe_centavos', 0, 'haber_centavos', v_monto, 'descripcion', 'Backfill histórico (reversa)')
          );
        ELSE
          v_partidas := jsonb_build_array(
            jsonb_build_object('cuenta_id', v_puente_id, 'debe_centavos', v_monto, 'haber_centavos', 0, 'descripcion', 'Backfill histórico (reversa)'),
            jsonb_build_object('cuenta_id', v_row.cuenta_id, 'debe_centavos', 0, 'haber_centavos', v_monto, 'descripcion', 'Backfill histórico (reversa)')
          );
        END IF;
      END IF;

      PERFORM public.crear_poliza(jsonb_build_object(
        'clinic_id', v_row.clinic_id, 'tipo', v_tipo, 'fecha', v_row.fecha_devengo,
        'concepto', COALESCE(v_row.descripcion, 'Backfill ' || v_row.reference_type),
        'reference_type', v_row.reference_type, 'reference_id', v_row.reference_id, 'evento', v_poliza_evento,
        'partidas', v_partidas
      ));
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Encolar el pendiente para reproceso manual; nunca abortar el backfill.
      PERFORM public.contab_encolar_pendiente(
        v_row.clinic_id,
        COALESCE(v_row.origen, 'backfill'),
        v_row.reference_type,
        v_row.reference_id,
        v_row.monto_centavos,
        v_row.fecha_devengo,
        COALESCE(v_row.descripcion, 'Backfill ' || v_row.reference_type),
        CASE WHEN v_row.evento = 'cancelacion' THEN 'cancelacion' ELSE 'registro' END,
        NULL,
        NULL,
        SQLERRM
      );
    END;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_backfill_polizas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contab_backfill_polizas() TO service_role;
