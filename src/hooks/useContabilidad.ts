import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";

export type PeriodoContable = "mes_actual" | "3_meses" | "6_meses" | "anio";

export interface PnlMes {
  mes: string;
  ingresos_centavos: number;
  costo_ventas_centavos: number;
  utilidad_bruta_centavos: number;
  gastos_operativos_centavos: number;
  utilidad_neta_centavos: number;
  margen_bruto_pct: number | null;
  margen_neto_pct: number | null;
}

export interface FlujoMes {
  mes: string;
  cobros_centavos: number;
  pagos_centavos: number;
  flujo_neto_centavos: number;
}

export interface KpisContables {
  ingresos_totales_centavos: number;
  utilidad_bruta_centavos: number;
  margen_bruto_pct: number | null;
  utilidad_neta_centavos: number;
  margen_neto_pct: number | null;
  flujo_operativo_centavos: number;
  punto_equilibrio_centavos: number | null;
  cxp_vencidas_centavos: number;
  cxc_pendientes_centavos: number;
  costo_insumos_por_cita_centavos: number | null;
  ingreso_promedio_consulta_centavos: number | null;
}

function rangoFechas(p: PeriodoContable): { desde: Date; hasta: Date } {
  const now = new Date();
  if (p === "mes_actual") return { desde: startOfMonth(now), hasta: endOfMonth(now) };
  if (p === "3_meses") return { desde: startOfMonth(subMonths(now, 2)), hasta: endOfMonth(now) };
  if (p === "6_meses") return { desde: startOfMonth(subMonths(now, 5)), hasta: endOfMonth(now) };
  return { desde: new Date(now.getFullYear(), 0, 1), hasta: endOfMonth(now) };
}

export function useContabilidad(periodo: PeriodoContable = "3_meses") {
  const { activeClinicId } = useActiveClinic();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pnl, setPnl] = useState<PnlMes[]>([]);
  const [flujo, setFlujo] = useState<FlujoMes[]>([]);
  const [kpis, setKpis] = useState<KpisContables | null>(null);

  const load = useCallback(async () => {
    if (!activeClinicId) return;
    setLoading(true);
    setError(null);
    try {
      const { desde, hasta } = rangoFechas(periodo);
      const p_desde = format(desde, "yyyy-MM-dd");
      const p_hasta = format(hasta, "yyyy-MM-dd");

      const [pnlRes, flujoRes, kpisRes] = await Promise.all([
        (supabase as any).rpc("pnl_mensual", { p_clinic_id: activeClinicId, p_desde, p_hasta }),
        (supabase as any).rpc("flujo_efectivo", { p_clinic_id: activeClinicId, p_desde, p_hasta }),
        (supabase as any).rpc("kpis_dashboard", { p_clinic_id: activeClinicId, p_desde, p_hasta }),
      ]);

      if (pnlRes.error) throw pnlRes.error;
      if (flujoRes.error) throw flujoRes.error;
      if (kpisRes.error) throw kpisRes.error;

      setPnl((pnlRes.data ?? []) as PnlMes[]);
      setFlujo((flujoRes.data ?? []) as FlujoMes[]);
      setKpis(((kpisRes.data ?? [])[0] ?? null) as KpisContables | null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [activeClinicId, periodo]);

  useEffect(() => {
    load();
  }, [load]);

  return { loading, error, pnl, flujo, kpis, refresh: load };
}
