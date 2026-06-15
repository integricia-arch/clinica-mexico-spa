import { useState, useEffect, useCallback } from "react";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ClaseABC {
  clase: "A" | "B" | "C";
  label: string;
  color: string;
  bgColor: string;
  descripcion: string;
}

const CLASES: Record<"A" | "B" | "C", ClaseABC> = {
  A: { clase: "A", label: "A", color: "text-green-700", bgColor: "bg-green-100", descripcion: "70% del valor — Gestión intensiva" },
  B: { clase: "B", label: "B", color: "text-blue-700", bgColor: "bg-blue-100", descripcion: "20% del valor — Revisión periódica" },
  C: { clase: "C", label: "C", color: "text-gray-600", bgColor: "bg-gray-100", descripcion: "10% del valor — Revisión esporádica" },
};

interface RotacionItem {
  medicamento_id: string;
  nombre: string;
  categoria: string;
  existencia_actual: number;
  unidades_vendidas: number;
  ingresos_centavos: number;
  dias_sin_movimiento: number;
  rotacion_anual: number;
  dias_stock: number;
  clase: "A" | "B" | "C";
  porcentaje_ingreso: number;
  porcentaje_acumulado: number;
}

function exportCSV(items: RotacionItem[], desde: string, hasta: string, clinicNombre: string) {
  const fecha = format(new Date(), "yyyy-MM-dd");
  let csv = `REPORTE DE ROTACIÓN E INVENTARIO ABC\n`;
  csv += `Establecimiento: ${clinicNombre}\n`;
  csv += `Período: ${desde} al ${hasta}\n`;
  csv += `Generado: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}\n\n`;

  csv += `Clase,Medicamento,Categoría,Existencia,Unidades vendidas,Ingresos (MXN),Rotación anual,Días stock,% ingresos,% acumulado\n`;
  for (const r of items) {
    csv += `${r.clase},"${r.nombre}","${r.categoria}",${r.existencia_actual},${r.unidades_vendidas},${(r.ingresos_centavos / 100).toFixed(2)},${r.rotacion_anual.toFixed(1)},${r.dias_stock === 9999 ? "Sin movimiento" : r.dias_stock},${r.porcentaje_ingreso.toFixed(2)}%,${r.porcentaje_acumulado.toFixed(2)}%\n`;
  }

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rotacion-ABC-${fecha}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReporteRotacionABC() {
  const { activeClinicId, activeClinic } = useActiveClinic();
  const [items, setItems] = useState<RotacionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroClase, setFiltroClase] = useState<"" | "A" | "B" | "C">("");
  const [periodoDesde, setPeriodoDesde] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [periodoHasta, setPeriodoHasta] = useState(new Date().toISOString().split("T")[0]);

  const load = useCallback(async () => {
    if (!activeClinicId) return;
    setLoading(true);

    const diasPeriodo = Math.max(1,
      (new Date(periodoHasta).getTime() - new Date(periodoDesde).getTime()) / 86400000
    );

    // Medicamentos activos con existencia
    const { data: meds } = await supabase
      .from("medicamentos" as never)
      .select("id, nombre_generico, categoria, precio_unitario")
      .eq("clinic_id", activeClinicId)
      .eq("activo", true);

    const medList = (meds ?? []) as { id: string; nombre_generico: string; categoria: string; precio_unitario: number }[];

    // Lotes actuales (existencia)
    const { data: lotes } = await supabase
      .from("lotes_medicamento" as never)
      .select("medicamento_id, existencia")
      .eq("clinic_id", activeClinicId);

    const existenciaMap: Record<string, number> = {};
    for (const l of (lotes ?? []) as { medicamento_id: string; existencia: number }[]) {
      existenciaMap[l.medicamento_id] = (existenciaMap[l.medicamento_id] ?? 0) + l.existencia;
    }

    // Movimientos de salida en el período (ventas/consumo)
    const { data: movs } = await supabase
      .from("movimientos_inventario" as never)
      .select("medicamento_id, tipo, cantidad, created_at")
      .eq("clinic_id", activeClinicId)
      .in("tipo", ["salida", "venta"])
      .gte("created_at", periodoDesde + "T00:00:00")
      .lte("created_at", periodoHasta + "T23:59:59");

    // Agregar salidas por medicamento
    const salidaMap: Record<string, { unidades: number; ultimo: string }> = {};
    for (const m of (movs ?? []) as { medicamento_id: string; tipo: string; cantidad: number; created_at: string }[]) {
      if (!salidaMap[m.medicamento_id]) {
        salidaMap[m.medicamento_id] = { unidades: 0, ultimo: m.created_at };
      }
      salidaMap[m.medicamento_id].unidades += m.cantidad;
      if (m.created_at > salidaMap[m.medicamento_id].ultimo) {
        salidaMap[m.medicamento_id].ultimo = m.created_at;
      }
    }

    // Calcular rotación y clase ABC
    const raw: (Omit<RotacionItem, "clase" | "porcentaje_ingreso" | "porcentaje_acumulado">)[] = medList.map((m) => {
      const salida = salidaMap[m.id];
      const unidades = salida?.unidades ?? 0;
      const ingresos = Math.round(unidades * (m.precio_unitario ?? 0) * 100);
      const existencia = existenciaMap[m.id] ?? 0;
      const diasSinMov = salida
        ? Math.floor((new Date().getTime() - new Date(salida.ultimo).getTime()) / 86400000)
        : 999;
      const rotacionDiaria = unidades / diasPeriodo;
      const rotacionAnual = rotacionDiaria * 365;
      const diasStock = rotacionDiaria > 0 ? Math.round(existencia / rotacionDiaria) : 9999;

      return {
        medicamento_id: m.id,
        nombre: m.nombre_generico,
        categoria: m.categoria ?? "—",
        existencia_actual: existencia,
        unidades_vendidas: unidades,
        ingresos_centavos: ingresos,
        dias_sin_movimiento: diasSinMov,
        rotacion_anual: rotacionAnual,
        dias_stock: diasStock,
      };
    });

    // Ordenar por ingresos DESC para clasificar ABC
    raw.sort((a, b) => b.ingresos_centavos - a.ingresos_centavos);
    const totalIngresos = raw.reduce((s, r) => s + r.ingresos_centavos, 0);

    let acumulado = 0;
    const result: RotacionItem[] = raw.map((r) => {
      const pct = totalIngresos > 0 ? (r.ingresos_centavos / totalIngresos) * 100 : 0;
      acumulado += pct;
      const clase: "A" | "B" | "C" = acumulado <= 70 ? "A" : acumulado <= 90 ? "B" : "C";
      return { ...r, clase, porcentaje_ingreso: pct, porcentaje_acumulado: acumulado };
    });

    setItems(result);
    setLoading(false);
  }, [activeClinicId, periodoDesde, periodoHasta]);

  useEffect(() => { load(); }, [load]);

  const filtrado = items.filter((i) =>
    (!filtroClase || i.clase === filtroClase) &&
    (!busqueda ||
      i.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      i.categoria.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const resumen = {
    A: items.filter((i) => i.clase === "A"),
    B: items.filter((i) => i.clase === "B"),
    C: items.filter((i) => i.clase === "C"),
  };
  const totalIngresos = items.reduce((s, i) => s + i.ingresos_centavos, 0);
  const sinMovimiento = items.filter((i) => i.unidades_vendidas === 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Rotación de Inventario + Clasificación ABC
          </h3>
          <p className="text-sm text-muted-foreground">
            {items.length} productos · {sinMovimiento} sin movimiento en el período
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
          <Button size="sm" onClick={() => exportCSV(items, periodoDesde, periodoHasta, activeClinic?.nombre ?? "Clínica")}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Resumen ABC */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {(["A","B","C"] as const).map((c) => {
            const cl = CLASES[c];
            const grp = resumen[c];
            const ingGrp = grp.reduce((s, i) => s + i.ingresos_centavos, 0);
            return (
              <div key={c} className={`rounded-lg border p-3 ${cl.bgColor}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-2xl font-black ${cl.color}`}>{c}</span>
                  <span className="text-xs text-muted-foreground">{grp.length} productos</span>
                </div>
                <p className="text-sm font-semibold">
                  {totalIngresos > 0 ? ((ingGrp / totalIngresos) * 100).toFixed(1) : "0"}% de ingresos
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{cl.descripcion}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Buscar</label>
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Medicamento o categoría…"
            className="h-8 text-sm w-52"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Clase</label>
          <div className="flex gap-1">
            {(["","A","B","C"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setFiltroClase(c)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${filtroClase === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
              >
                {c === "" ? "Todas" : c}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Período desde</label>
          <Input type="date" value={periodoDesde} onChange={(e) => setPeriodoDesde(e.target.value)} className="h-8 text-sm w-36" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">hasta</label>
          <Input type="date" value={periodoHasta} onChange={(e) => setPeriodoHasta(e.target.value)} className="h-8 text-sm w-36" />
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Calculando…</p>}

      {!loading && filtrado.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <BarChart3 className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">Sin datos para mostrar.</p>
        </div>
      )}

      {filtrado.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-xs text-muted-foreground">
                <th className="text-center px-3 py-2 w-10">Clase</th>
                <th className="text-left px-3 py-2">Medicamento</th>
                <th className="text-left px-3 py-2">Categoría</th>
                <th className="text-right px-3 py-2">Existencia</th>
                <th className="text-right px-3 py-2">Vendidas</th>
                <th className="text-right px-3 py-2">Rot. anual</th>
                <th className="text-right px-3 py-2">Días stock</th>
                <th className="text-right px-3 py-2">% ingreso</th>
                <th className="text-right px-3 py-2">% acum.</th>
                <th className="text-center px-3 py-2">Tendencia</th>
              </tr>
            </thead>
            <tbody>
              {filtrado.map((r) => {
                const cl = CLASES[r.clase];
                const stockCritico = r.dias_stock < 7 && r.dias_stock !== 9999;
                const sinMov = r.unidades_vendidas === 0;
                return (
                  <tr key={r.medicamento_id} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block w-6 h-6 rounded text-xs font-black flex items-center justify-center ${cl.bgColor} ${cl.color}`}>
                        {r.clase}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium max-w-[200px] truncate">{r.nombre}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{r.categoria}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${stockCritico ? "text-destructive" : ""}`}>
                      {r.existencia_actual}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={sinMov ? "text-muted-foreground italic text-xs" : ""}>
                        {sinMov ? "—" : r.unidades_vendidas}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {r.rotacion_anual > 0 ? `${r.rotacion_anual.toFixed(0)}x/año` : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right text-xs ${stockCritico ? "text-destructive font-semibold" : r.dias_stock === 9999 ? "text-muted-foreground" : ""}`}>
                      {r.dias_stock === 9999 ? "∞" : `${r.dias_stock}d`}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {r.porcentaje_ingreso > 0 ? `${r.porcentaje_ingreso.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {r.porcentaje_acumulado.toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 text-center">
                      {sinMov ? (
                        <Minus className="h-4 w-4 text-muted-foreground mx-auto" />
                      ) : r.dias_stock < 14 && r.dias_stock !== 9999 ? (
                        <TrendingDown className="h-4 w-4 text-destructive mx-auto" />
                      ) : (
                        <TrendingUp className="h-4 w-4 text-green-600 mx-auto" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Alertas de reabastecimiento */}
      {!loading && (() => {
        const criticos = items.filter((i) => i.clase === "A" && i.dias_stock < 14 && i.dias_stock !== 9999);
        return criticos.length > 0 ? (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
            <strong>⚠ {criticos.length} producto(s) Clase A con menos de 14 días de stock:</strong>
            <ul className="mt-1 space-y-0.5 text-xs">
              {criticos.map((c) => (
                <li key={c.medicamento_id}>• {c.nombre} — {c.dias_stock}d restantes ({c.existencia_actual} uds.)</li>
              ))}
            </ul>
          </div>
        ) : null;
      })()}
    </div>
  );
}
