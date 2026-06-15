import { useState, useEffect, useCallback } from "react";
import { addDays, format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";

export type Periodo = "mes_actual" | "mes_anterior" | "3_meses" | "anio";

export interface DiaCount {
  dia: string;
  total: number;
  confirmadas: number;
  canceladas: number;
}

export interface OrigenCount {
  origen: string;
  total: number;
}

export interface DoctorCount {
  doctor_id: string;
  nombre: string;
  total: number;
  confirmadas: number;
}

export interface DiaVenta {
  dia: string;
  total: number;
  transacciones: number;
}

export interface StockAlerta {
  id: string;
  nombre: string;
  categoria: string;
  stock_actual: number;
  stock_minimo: number;
}

export interface LotePorVencer {
  id: string;
  medicamento: string;
  lote: string;
  fecha_caducidad: string;
  existencia: number;
  dias_restantes: number;
}

export interface CxpFactura {
  saldo_pendiente_centavos: number;
  fecha_vencimiento: string;
  vencida: boolean;
}

export interface BIResumen {
  citasMes: number;
  citasMesAnterior: number;
  citasConfirmadas: number;
  tasaCancelacion: number;
  tasaNoShow: number;
  ventasMes: number;
  ventasMesAnterior: number;
  ticketPromedio: number;
  transaccionesMes: number;
  pacientesNuevosMes: number;
  totalPacientes: number;
  itemsBajoMinimo: number;
  lotesPorVencer30d: number;
  cxpPendiente: number;
  cxpVencido: number;
}

export interface BIData {
  loading: boolean;
  error: string | null;
  resumen: BIResumen | null;
  citasTimeline: DiaCount[];
  citasPorOrigen: OrigenCount[];
  citasPorDoctor: DoctorCount[];
  farmaciaTimeline: DiaVenta[];
  stockAlertas: StockAlerta[];
  lotesPorVencer: LotePorVencer[];
  refresh: () => void;
}

const CONFIRMED = new Set([
  "confirmada",
  "confirmada_paciente",
  "confirmada_medico",
  "recordatorio_enviado",
]);

function rangoFechas(p: Periodo): { desde: Date; hasta: Date } {
  const now = new Date();
  if (p === "mes_actual") return { desde: startOfMonth(now), hasta: now };
  if (p === "mes_anterior") {
    const prev = subMonths(now, 1);
    return { desde: startOfMonth(prev), hasta: endOfMonth(prev) };
  }
  if (p === "3_meses") return { desde: subMonths(now, 3), hasta: now };
  return { desde: new Date(now.getFullYear(), 0, 1), hasta: now };
}

function buildCitasTimeline(
  citas: Array<{ fecha_inicio: string; status: string }>,
  desde: Date,
  hasta: Date,
): DiaCount[] {
  const map = new Map<string, DiaCount>();
  const cur = new Date(desde);
  while (cur <= hasta) {
    const k = format(cur, "yyyy-MM-dd");
    map.set(k, { dia: k, total: 0, confirmadas: 0, canceladas: 0 });
    cur.setDate(cur.getDate() + 1);
  }
  citas.forEach(c => {
    const k = c.fecha_inicio.slice(0, 10);
    const entry = map.get(k);
    if (!entry) return;
    entry.total++;
    if (CONFIRMED.has(c.status)) entry.confirmadas++;
    if (c.status === "cancelada") entry.canceladas++;
  });
  return [...map.values()];
}

function buildFarmaciaTimeline(
  ventas: Array<{ created_at: string; total: number | string }>,
  desde: Date,
  hasta: Date,
): DiaVenta[] {
  const map = new Map<string, DiaVenta>();
  const cur = new Date(desde);
  while (cur <= hasta) {
    const k = format(cur, "yyyy-MM-dd");
    map.set(k, { dia: k, total: 0, transacciones: 0 });
    cur.setDate(cur.getDate() + 1);
  }
  ventas.forEach(v => {
    const k = v.created_at.slice(0, 10);
    const entry = map.get(k);
    if (!entry) return;
    entry.total += Number(v.total);
    entry.transacciones++;
  });
  return [...map.values()];
}

export function useBI(periodo: Periodo = "mes_actual"): BIData {
  const { activeClinicId } = useActiveClinic();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<BIResumen | null>(null);
  const [citasTimeline, setCitasTimeline] = useState<DiaCount[]>([]);
  const [citasPorOrigen, setCitasPorOrigen] = useState<OrigenCount[]>([]);
  const [citasPorDoctor, setCitasPorDoctor] = useState<DoctorCount[]>([]);
  const [farmaciaTimeline, setFarmaciaTimeline] = useState<DiaVenta[]>([]);
  const [stockAlertas, setStockAlertas] = useState<StockAlerta[]>([]);
  const [lotesPorVencer, setLotesPorVencer] = useState<LotePorVencer[]>([]);

  const load = useCallback(async () => {
    if (!activeClinicId) return;
    setLoading(true);
    setError(null);

    try {
      const { desde, hasta } = rangoFechas(periodo);
      const prevDesde = startOfMonth(subMonths(desde, 1));
      const prevHasta = endOfMonth(subMonths(desde, 1));
      const today = format(new Date(), "yyyy-MM-dd");
      const in30d = format(addDays(new Date(), 30), "yyyy-MM-dd");

      const [
        citasRes,
        citasPrevRes,
        farmaciaRes,
        farmaciaPrevRes,
        pacientesTotalRes,
        pacientesNuevosRes,
        doctoresRes,
        medicamentosRes,
        lotesRes,
        cxpRes,
      ] = await Promise.all([
        supabase
          .from("appointments")
          .select("id,fecha_inicio,status,origen,doctor_id")
          .eq("clinic_id", activeClinicId)
          .gte("fecha_inicio", desde.toISOString())
          .lte("fecha_inicio", hasta.toISOString()),

        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", activeClinicId)
          .gte("fecha_inicio", prevDesde.toISOString())
          .lte("fecha_inicio", prevHasta.toISOString()),

        supabase
          .from("pharmacy_sales")
          .select("id,created_at,total,payment_method")
          .eq("clinic_id", activeClinicId)
          .eq("status", "completed")
          .gte("created_at", desde.toISOString())
          .lte("created_at", hasta.toISOString()),

        supabase
          .from("pharmacy_sales")
          .select("total")
          .eq("clinic_id", activeClinicId)
          .eq("status", "completed")
          .gte("created_at", prevDesde.toISOString())
          .lte("created_at", prevHasta.toISOString()),

        supabase
          .from("patients")
          .select("id", { count: "exact", head: true })
          .eq("activo", true),

        supabase
          .from("patients")
          .select("id", { count: "exact", head: true })
          .eq("activo", true)
          .gte("created_at", desde.toISOString()),

        supabase
          .from("doctors")
          .select("id,nombre,apellidos")
          .eq("activo", true),

        supabase
          .from("medicamentos")
          .select("id,nombre,categoria,stock_minimo")
          .eq("activo", true),

        supabase
          .from("lotes_medicamento")
          .select("id,medicamento_id,numero_lote,fecha_caducidad,existencia")
          .eq("clinic_id", activeClinicId)
          .gt("existencia", 0),

        supabase
          .from("facturas_proveedor")
          .select("saldo_pendiente_centavos,fecha_vencimiento")
          .eq("clinic_id", activeClinicId)
          .in("estatus", ["pendiente", "parcial"]),
      ]);

      const citas = citasRes.data ?? [];
      const farmacia = farmaciaRes.data ?? [];
      const doctores = doctoresRes.data ?? [];
      const meds = medicamentosRes.data ?? [];
      const lotes = lotesRes.data ?? [];
      const cxp = cxpRes.data ?? [];

      // ─── Resumen computes ───────────────────────────────────────────────
      const citasMes = citas.length;
      const citasMesAnterior = citasPrevRes.count ?? 0;
      const citasConfirmadas = citas.filter(c => CONFIRMED.has(c.status)).length;
      const citasCanceladas = citas.filter(c => c.status === "cancelada").length;
      const citasNoShow = citas.filter(c => c.status === "no_show").length;
      const tasaCancelacion = citasMes > 0 ? Math.round((citasCanceladas / citasMes) * 100) : 0;
      const tasaNoShow = citasMes > 0 ? Math.round((citasNoShow / citasMes) * 100) : 0;

      const ventasMes = farmacia.reduce((s, v) => s + Number(v.total), 0);
      const ventasMesAnterior = (farmaciaPrevRes.data ?? []).reduce(
        (s: number, v: { total: number | string }) => s + Number(v.total),
        0,
      );
      const transaccionesMes = farmacia.length;
      const ticketPromedio = transaccionesMes > 0 ? ventasMes / transaccionesMes : 0;

      const cxpPendiente =
        cxp.reduce((s, f) => s + Number(f.saldo_pendiente_centavos), 0) / 100;
      const cxpVencido =
        cxp
          .filter(f => f.fecha_vencimiento < today)
          .reduce((s, f) => s + Number(f.saldo_pendiente_centavos), 0) / 100;

      // Stock per medicamento from lotes
      const stockMap = new Map<string, number>();
      lotes.forEach(l => {
        stockMap.set(l.medicamento_id, (stockMap.get(l.medicamento_id) ?? 0) + l.existencia);
      });

      const medMap = new Map(meds.map(m => [m.id, m]));

      const computedStockAlertas: StockAlerta[] = meds
        .filter(m => (stockMap.get(m.id) ?? 0) <= m.stock_minimo)
        .slice(0, 20)
        .map(m => ({
          id: m.id,
          nombre: m.nombre,
          categoria: m.categoria,
          stock_actual: stockMap.get(m.id) ?? 0,
          stock_minimo: m.stock_minimo,
        }));

      const computedLotesPorVencer: LotePorVencer[] = lotes
        .filter(l => l.fecha_caducidad <= in30d)
        .map(l => {
          const dias = Math.ceil(
            (new Date(l.fecha_caducidad).getTime() - Date.now()) / 86_400_000,
          );
          return {
            id: l.id,
            medicamento: medMap.get(l.medicamento_id)?.nombre ?? "Desconocido",
            lote: l.numero_lote,
            fecha_caducidad: l.fecha_caducidad,
            existencia: l.existencia,
            dias_restantes: dias,
          };
        })
        .sort((a, b) => a.dias_restantes - b.dias_restantes)
        .slice(0, 20);

      const lotesPorVencer30d = lotes.filter(l => l.fecha_caducidad <= in30d).length;

      // ─── Timelines ──────────────────────────────────────────────────────
      const doctorMap = new Map(doctores.map(d => [d.id, `${d.nombre} ${d.apellidos}`]));

      const doctorCountMap = new Map<string, DoctorCount>();
      citas.forEach(c => {
        const nombre = doctorMap.get(c.doctor_id) ?? "Sin asignar";
        const prev = doctorCountMap.get(c.doctor_id) ?? {
          doctor_id: c.doctor_id,
          nombre,
          total: 0,
          confirmadas: 0,
        };
        doctorCountMap.set(c.doctor_id, {
          ...prev,
          total: prev.total + 1,
          confirmadas: prev.confirmadas + (CONFIRMED.has(c.status) ? 1 : 0),
        });
      });

      const origenMap = new Map<string, number>();
      citas.forEach(c => {
        const o = c.origen ?? "directo";
        origenMap.set(o, (origenMap.get(o) ?? 0) + 1);
      });

      // ─── Commit state ──────────────────────────────────────────────────
      setResumen({
        citasMes,
        citasMesAnterior,
        citasConfirmadas,
        tasaCancelacion,
        tasaNoShow,
        ventasMes,
        ventasMesAnterior,
        ticketPromedio,
        transaccionesMes,
        pacientesNuevosMes: pacientesNuevosRes.count ?? 0,
        totalPacientes: pacientesTotalRes.count ?? 0,
        itemsBajoMinimo: computedStockAlertas.length,
        lotesPorVencer30d,
        cxpPendiente,
        cxpVencido,
      });
      setCitasTimeline(buildCitasTimeline(citas, desde, hasta));
      setCitasPorOrigen(
        [...origenMap.entries()]
          .map(([origen, total]) => ({ origen, total }))
          .sort((a, b) => b.total - a.total),
      );
      setCitasPorDoctor(
        [...doctorCountMap.values()].sort((a, b) => b.total - a.total),
      );
      setFarmaciaTimeline(buildFarmaciaTimeline(farmacia, desde, hasta));
      setStockAlertas(computedStockAlertas);
      setLotesPorVencer(computedLotesPorVencer);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [activeClinicId, periodo]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    loading,
    error,
    resumen,
    citasTimeline,
    citasPorOrigen,
    citasPorDoctor,
    farmaciaTimeline,
    stockAlertas,
    lotesPorVencer,
    refresh: load,
  };
}
