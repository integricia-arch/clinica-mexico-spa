-- Hueco encontrado al validar el ciclo completo cita→insumos→honorarios: la
-- regla 'consumo_insumo' (501 Costo de insumos / 115.01 Almacén insumos) ya
-- existía en contab_reglas_asiento desde fase 6B, pero registrar_insumos_cita()
-- solo inserta appointment_insumos y descuenta stock — nunca generaba la
-- póliza. El costo del material usado en consulta nunca llegaba a la
-- contabilidad. Trigger simétrico a contab_movimiento_caja/contab_pharmacy_sale.
CREATE OR REPLACE FUNCTION public.contab_consumo_insumo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_monto bigint;
BEGIN
  IF NEW.tipo = 'consumo' AND NEW.cantidad > 0 AND COALESCE(NEW.costo_unitario_centavos, 0) > 0 THEN
    v_monto := NEW.costo_unitario_centavos * NEW.cantidad;
    BEGIN
      PERFORM public.contab_generar_poliza_evento(
        NEW.clinic_id, 'consumo_insumo', v_monto,
        (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date,
        'Consumo de insumo en cita', 'appointment_insumo', NEW.id, 'registro', 'diario'
      );
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.contab_encolar_pendiente(
        NEW.clinic_id, 'consumo_insumo', 'appointment_insumo', NEW.id, v_monto,
        (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date, 'Consumo de insumo en cita',
        'registro', 'diario', NULL, SQLERRM
      );
    END;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_contab_consumo_insumo ON public.appointment_insumos;
CREATE TRIGGER trg_contab_consumo_insumo
  AFTER INSERT ON public.appointment_insumos
  FOR EACH ROW EXECUTE FUNCTION public.contab_consumo_insumo();

REVOKE EXECUTE ON FUNCTION public.contab_consumo_insumo() FROM PUBLIC, anon, authenticated;
