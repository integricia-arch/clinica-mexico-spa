-- Fase 10 (cierre módulo contable): el candado de período de fase 7 solo
-- protegía crear_poliza(). Un INSERT manual directo en movimientos_contables
-- (RegistrarEgresoModal) con fecha en un mes ya cerrado pasaba la policy RLS
-- sin problema; el trigger AFTER INSERT que intenta generar la póliza
-- correspondiente sí fallaba por el candado, pero traga la excepción
-- (queda en contab_asientos_pendientes) sin abortar el INSERT ni avisar al
-- usuario. Resultado: fila viva en movimientos_contables con fecha "cerrada",
-- P&L/KPIs de ese mes cambian en silencio. Bloquear síncrono aquí también.

CREATE OR REPLACE FUNCTION public.contab_valida_periodo_movimiento_manual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.origen = 'manual' AND EXISTS (
    SELECT 1 FROM public.contab_cierres
    WHERE clinic_id = NEW.clinic_id AND cerrado_at IS NOT NULL
      AND periodo = date_trunc('month', NEW.fecha_devengo)::date
  ) THEN
    RAISE EXCEPTION 'periodo_cerrado: % está cerrado, usa una fecha del período abierto', to_char(NEW.fecha_devengo, 'YYYY-MM');
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_valida_periodo_movimiento_manual() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_contab_valida_periodo_movimiento_manual ON public.movimientos_contables;
CREATE TRIGGER trg_contab_valida_periodo_movimiento_manual
  BEFORE INSERT ON public.movimientos_contables
  FOR EACH ROW EXECUTE FUNCTION public.contab_valida_periodo_movimiento_manual();
