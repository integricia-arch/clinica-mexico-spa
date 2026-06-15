import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";

export interface TurnoActivo {
  id: string;
  caja_id: string;
  caja_nombre: string;
  estado: string;
  monto_apertura: number;
  abierto_at: string;
  pharmacy_shift_id: string | null;
  ventas_turno_centavos: number;
}

export interface FinancialDashboardData {
  turnos: TurnoActivo[];
  actasPendientes: number;
  ocPendientes: number;
  cxpVencidas: number;
  faltantesFarmacia: number;
}

const EMPTY: FinancialDashboardData = {
  turnos: [],
  actasPendientes: 0,
  ocPendientes: 0,
  cxpVencidas: 0,
  faltantesFarmacia: 0,
};

export function useFinancialDashboardData() {
  const { activeClinic } = useActiveClinic();
  const [data, setData] = useState<FinancialDashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeClinic) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      const [turnosRes, actasRes, ocRes, cxpRes, faltantesRes] = await Promise.allSettled([
        supabase
          .from("turnos")
          .select("id, caja_id, estado, monto_apertura, abierto_at, pharmacy_shift_id, cajas(nombre)")
          .eq("clinic_id", activeClinic)
          .eq("estado", "abierto"),
        supabase
          .from("actas_merma")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", activeClinic)
          .eq("estatus", "pendiente_firma"),
        supabase
          .from("ordenes_compra")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", activeClinic)
          .eq("estatus", "pendiente_aprobacion"),
        supabase
          .from("facturas_proveedor")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", activeClinic)
          .lte("fecha_vencimiento", today)
          .gt("saldo_pendiente_centavos", 0),
        supabase
          .from("almacen_alertas")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", activeClinic)
          .eq("status", "pending"),
      ]);

      const rawTurnos = turnosRes.status === "fulfilled" ? (turnosRes.value.data ?? []) : [];

      // For each turno with pharmacy_shift_id, fetch sales total
      const turnosWithSales: TurnoActivo[] = await Promise.all(
        rawTurnos.map(async (t: Record<string, unknown>) => {
          let ventas = 0;
          if (t.pharmacy_shift_id) {
            const { data: sales } = await supabase
              .from("pharmacy_sales")
              .select("total")
              .eq("shift_id", t.pharmacy_shift_id as string)
              .eq("payment_status", "pagado");
            ventas = (sales ?? []).reduce((s: number, r: { total: number }) => s + (r.total ?? 0), 0);
          }
          const cajas = t.cajas as { nombre: string } | null;
          return {
            id: t.id as string,
            caja_id: t.caja_id as string,
            caja_nombre: cajas?.nombre ?? "Caja",
            estado: t.estado as string,
            monto_apertura: (t.monto_apertura as number) ?? 0,
            abierto_at: t.abierto_at as string,
            pharmacy_shift_id: t.pharmacy_shift_id as string | null,
            ventas_turno_centavos: Math.round(ventas * 100),
          };
        }),
      );

      setData({
        turnos: turnosWithSales,
        actasPendientes: actasRes.status === "fulfilled" ? (actasRes.value.count ?? 0) : 0,
        ocPendientes: ocRes.status === "fulfilled" ? (ocRes.value.count ?? 0) : 0,
        cxpVencidas: cxpRes.status === "fulfilled" ? (cxpRes.value.count ?? 0) : 0,
        faltantesFarmacia: faltantesRes.status === "fulfilled" ? (faltantesRes.value.count ?? 0) : 0,
      });
    } finally {
      setLoading(false);
    }
  }, [activeClinic]);

  useEffect(() => { load(); }, [load]);

  // Refresh every 2 minutes
  useEffect(() => {
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, [load]);

  return { data, loading, reload: load };
}
