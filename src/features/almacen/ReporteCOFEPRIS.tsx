import { useState, useEffect, useCallback } from "react";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Download, Printer, ShieldAlert, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface MedControlado {
  id: string;
  nombre_generico: string;
  principio_activo: string;
  concentracion: string;
  forma_farmaceutica: string;
  laboratorio: string;
  registro_sanitario: string;
  sale_type: string;
}

interface LoteControlado {
  id: string;
  medicamento_id: string;
  medicamento_nombre: string;
  principio_activo: string;
  concentracion: string;
  forma_farmaceutica: string;
  laboratorio: string;
  registro_sanitario: string;
  sale_type: string;
  numero_lote: string;
  fecha_caducidad: string | null;
  existencia: number;
  fecha_entrada: string | null;
  costo_unitario_centavos: number;
}

interface MovimientoControlado {
  id: string;
  medicamento_id: string;
  medicamento_nombre: string;
  lote_id: string | null;
  numero_lote: string;
  tipo: string;
  cantidad: number;
  motivo: string;
  created_at: string;
}

function exportCSV(rows: LoteControlado[], movimientos: MovimientoControlado[], clinicNombre: string) {
  const fecha = format(new Date(), "yyyy-MM-dd");

  // Hoja 1: existencias
  let csv = `REPORTE COFEPRIS - LIBRO DE CONTROL DE PSICOTRÓPICOS Y ESTUPEFACIENTES\n`;
  csv += `Establecimiento: ${clinicNombre}\n`;
  csv += `Fecha de generación: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}\n\n`;

  csv += `EXISTENCIAS ACTUALES\n`;
  csv += `Medicamento,Principio activo,Concentración,Forma farmacéutica,Laboratorio,Reg. Sanitario,Tipo,Lote,Fecha caducidad,Existencia\n`;
  for (const r of rows) {
    csv += `"${r.medicamento_nombre}","${r.principio_activo}","${r.concentracion}","${r.forma_farmaceutica}","${r.laboratorio}","${r.registro_sanitario}","${r.sale_type}","${r.numero_lote}","${r.fecha_caducidad ?? ""}",${r.existencia}\n`;
  }

  csv += `\nMOVIMIENTOS (ENTRADAS Y SALIDAS)\n`;
  csv += `Fecha,Medicamento,Lote,Tipo movimiento,Cantidad,Motivo\n`;
  for (const m of movimientos) {
    csv += `"${format(new Date(m.created_at), "dd/MM/yyyy HH:mm")}","${m.medicamento_nombre}","${m.numero_lote}","${m.tipo}",${m.cantidad},"${m.motivo}"\n`;
  }

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `COFEPRIS-libro-control-${fecha}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReporteCOFEPRIS() {
  const { activeClinicId, activeClinic } = useActiveClinic();
  const [lotes, setLotes] = useState<LoteControlado[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoControlado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [periodoDesde, setPeriodoDesde] = useState(() => {
    const d = new Date();
    d.setDate(1); // primer día del mes
    return d.toISOString().split("T")[0];
  });
  const [periodoHasta, setPeriodoHasta] = useState(new Date().toISOString().split("T")[0]);

  const load = useCallback(async () => {
    if (!activeClinicId) return;
    setLoading(true);

    // Medicamentos controlados
    const { data: meds } = await supabase
      .from("medicamentos" as never)
      .select("id, nombre_generico, principio_activo, concentracion, forma_farmaceutica, laboratorio, registro_sanitario, sale_type")
      .eq("clinic_id", activeClinicId)
      .or("is_controlled.eq.true,sale_type.eq.controlado")
      .eq("activo", true);

    const medList = (meds ?? []) as MedControlado[];
    const medIds = medList.map((m) => m.id);

    if (!medIds.length) {
      setLotes([]);
      setMovimientos([]);
      setLoading(false);
      return;
    }

    const medMap = Object.fromEntries(medList.map((m) => [m.id, m]));

    // Lotes con existencia
    const { data: lotesData } = await supabase
      .from("lotes_medicamento" as never)
      .select("id, medicamento_id, numero_lote, fecha_caducidad, existencia, fecha_entrada, costo_unitario_centavos")
      .eq("clinic_id", activeClinicId)
      .in("medicamento_id", medIds)
      .order("medicamento_id");

    setLotes(
      ((lotesData ?? []) as {
        id: string; medicamento_id: string; numero_lote: string | null;
        fecha_caducidad: string | null; existencia: number;
        fecha_entrada: string | null; costo_unitario_centavos: number | null;
      }[]).map((l) => {
        const m = medMap[l.medicamento_id];
        return {
          id: l.id,
          medicamento_id: l.medicamento_id,
          medicamento_nombre: m?.nombre_generico ?? "",
          principio_activo: m?.principio_activo ?? "",
          concentracion: m?.concentracion ?? "",
          forma_farmaceutica: m?.forma_farmaceutica ?? "",
          laboratorio: m?.laboratorio ?? "",
          registro_sanitario: m?.registro_sanitario ?? "",
          sale_type: m?.sale_type ?? "controlado",
          numero_lote: l.numero_lote ?? "—",
          fecha_caducidad: l.fecha_caducidad,
          existencia: l.existencia,
          fecha_entrada: l.fecha_entrada,
          costo_unitario_centavos: l.costo_unitario_centavos ?? 0,
        };
      })
    );

    // Movimientos del período
    const { data: movsData } = await supabase
      .from("movimientos_inventario" as never)
      .select("id, medicamento_id, lote_id, tipo, cantidad, motivo, created_at")
      .eq("clinic_id", activeClinicId)
      .in("medicamento_id", medIds)
      .gte("created_at", periodoDesde + "T00:00:00")
      .lte("created_at", periodoHasta + "T23:59:59")
      .order("created_at", { ascending: false });

    const movsList = (movsData ?? []) as {
      id: string; medicamento_id: string; lote_id: string | null;
      tipo: string; cantidad: number; motivo: string | null; created_at: string;
    }[];

    // Lookup lote → numero_lote
    const loteIds = [...new Set(movsList.map((m) => m.lote_id).filter(Boolean))] as string[];
    let loteNumMap: Record<string, string> = {};
    if (loteIds.length) {
      const { data: lotesRef } = await supabase
        .from("lotes_medicamento" as never)
        .select("id, numero_lote")
        .in("id", loteIds);
      loteNumMap = Object.fromEntries(
        ((lotesRef ?? []) as { id: string; numero_lote: string | null }[])
          .map((l) => [l.id, l.numero_lote ?? "—"])
      );
    }

    setMovimientos(
      movsList.map((m) => ({
        id: m.id,
        medicamento_id: m.medicamento_id,
        medicamento_nombre: medMap[m.medicamento_id]?.nombre_generico ?? "",
        lote_id: m.lote_id,
        numero_lote: m.lote_id ? (loteNumMap[m.lote_id] ?? "—") : "—",
        tipo: m.tipo,
        cantidad: m.cantidad,
        motivo: m.motivo ?? "",
        created_at: m.created_at,
      }))
    );

    setLoading(false);
  }, [activeClinicId, periodoDesde, periodoHasta]);

  useEffect(() => { load(); }, [load]);

  const lotesFiltrados = lotes.filter((l) =>
    !busqueda ||
    l.medicamento_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    l.numero_lote.toLowerCase().includes(busqueda.toLowerCase()) ||
    l.principio_activo.toLowerCase().includes(busqueda.toLowerCase())
  );

  const totalExistencia = lotesFiltrados.reduce((a, l) => a + l.existencia, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Libro de Control COFEPRIS
          </h3>
          <p className="text-sm text-muted-foreground">
            Psicotrópicos y estupefacientes · {lotes.length} lotes · {totalExistencia} unidades totales
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
          <Button size="sm" onClick={() => exportCSV(lotes, movimientos, activeClinic?.name ?? "Clínica")}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Aviso legal */}
      <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-xs text-red-700">
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          <strong>Obligación COFEPRIS:</strong> Los establecimientos que manejan psicotrópicos y estupefacientes deben llevar libro de control por escrito o sistema electrónico, con registros de entradas, salidas y existencias. Art. 240 LGS.
        </span>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Buscar</label>
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Medicamento, lote, principio…"
            className="h-8 text-sm w-52"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Movimientos desde</label>
          <Input type="date" value={periodoDesde} onChange={(e) => setPeriodoDesde(e.target.value)} className="h-8 text-sm w-36" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">hasta</label>
          <Input type="date" value={periodoHasta} onChange={(e) => setPeriodoHasta(e.target.value)} className="h-8 text-sm w-36" />
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {!loading && lotes.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <ShieldAlert className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">Sin medicamentos controlados registrados.</p>
          <p className="text-xs mt-1">Marca medicamentos como "Controlado" en el catálogo para que aparezcan aquí.</p>
        </div>
      )}

      {/* Sección 1: Existencias */}
      {lotesFiltrados.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Existencias por lote</h4>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left px-3 py-2">Medicamento</th>
                  <th className="text-left px-3 py-2">Principio activo</th>
                  <th className="text-left px-3 py-2">Concentración</th>
                  <th className="text-left px-3 py-2">Forma farmac.</th>
                  <th className="text-left px-3 py-2">Laboratorio</th>
                  <th className="text-left px-3 py-2">Reg. Sanitario</th>
                  <th className="text-left px-3 py-2">Lote</th>
                  <th className="text-left px-3 py-2">Caducidad</th>
                  <th className="text-right px-3 py-2">Existencia</th>
                  <th className="text-center px-3 py-2">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {lotesFiltrados.map((l) => {
                  const hoy = new Date();
                  const cad = l.fecha_caducidad ? new Date(l.fecha_caducidad) : null;
                  const diasCad = cad ? Math.ceil((cad.getTime() - hoy.getTime()) / 86400000) : null;
                  return (
                    <tr key={l.id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{l.medicamento_nombre}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.principio_activo || "—"}</td>
                      <td className="px-3 py-2">{l.concentracion || "—"}</td>
                      <td className="px-3 py-2">{l.forma_farmaceutica || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.laboratorio || "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{l.registro_sanitario || "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{l.numero_lote}</td>
                      <td className="px-3 py-2">
                        {l.fecha_caducidad ? (
                          <span className={diasCad !== null && diasCad < 30 ? "text-destructive font-semibold" : diasCad !== null && diasCad < 90 ? "text-yellow-600" : ""}>
                            {format(new Date(l.fecha_caducidad), "dd/MM/yyyy")}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        <span className={l.existencia === 0 ? "text-muted-foreground" : ""}>{l.existencia}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="destructive" className="text-xs">Controlado</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/30 border-t">
                <tr>
                  <td colSpan={8} className="px-3 py-2 text-xs text-muted-foreground text-right font-semibold">Total existencia</td>
                  <td className="px-3 py-2 text-right font-bold">{totalExistencia}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Sección 2: Movimientos del período */}
      {movimientos.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Movimientos del período ({format(new Date(periodoDesde), "dd/MM/yy")} – {format(new Date(periodoHasta), "dd/MM/yy")})
          </h4>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">Medicamento</th>
                  <th className="text-left px-3 py-2">Lote</th>
                  <th className="text-left px-3 py-2">Movimiento</th>
                  <th className="text-right px-3 py-2">Cantidad</th>
                  <th className="text-left px-3 py-2">Motivo/Referencia</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {format(new Date(m.created_at), "dd/MM/yy HH:mm", { locale: es })}
                    </td>
                    <td className="px-3 py-2 font-medium">{m.medicamento_nombre}</td>
                    <td className="px-3 py-2 font-mono text-xs">{m.numero_lote}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={m.tipo === "entrada" ? "default" : "outline"}
                        className="text-xs capitalize"
                      >
                        {m.tipo}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      <span className={m.tipo === "salida" ? "text-destructive" : "text-green-600"}>
                        {m.tipo === "salida" ? "-" : "+"}{m.cantidad}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{m.motivo || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && movimientos.length === 0 && lotes.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Sin movimientos en el período seleccionado.</p>
      )}
    </div>
  );
}
