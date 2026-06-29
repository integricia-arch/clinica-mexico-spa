import { useMemo } from "react";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useOrdenesCompra } from "@/hooks/useOrdenesCompra";
import { useFacturasProveedor } from "@/hooks/useFacturasProveedor";
import { useRecepcionesMercancia } from "@/hooks/useRecepcionesMercancia";
import { useProveedores } from "@/hooks/useProveedores";
import { useCicloCompras } from "@/hooks/useCicloCompras";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart, AlertTriangle, TrendingUp, Clock, CheckCircle2, XCircle,
  ArrowUpRight, Package, Building2, GitBranch, Timer, FileWarning,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, isAfter, isBefore, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

const fmt = (c: number) => (c / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const ESTATUS_COLOR: Record<string, string> = {
  borrador: "bg-muted text-muted-foreground",
  pendiente_aprobacion: "bg-yellow-100 text-yellow-800",
  confirmada: "bg-blue-100 text-blue-800",
  parcial: "bg-purple-100 text-purple-800",
  recibida: "bg-green-100 text-green-800",
  cancelada: "bg-gray-100 text-gray-500",
  rechazada: "bg-red-100 text-red-700",
};

const ESTATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  pendiente_aprobacion: "Pend. aprobación",
  confirmada: "Confirmada",
  parcial: "Parcial",
  recibida: "Recibida",
  cancelada: "Cancelada",
  rechazada: "Rechazada",
};

function KpiCard({
  icon: Icon, label, value, sub, color = "text-foreground", alert = false,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  color?: string; alert?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-card p-4 space-y-2 ${alert ? "border-destructive/40" : ""}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
        <Icon className={`h-3.5 w-3.5 ${alert ? "text-destructive" : ""}`} />
        {label}
      </div>
      <p className={`text-2xl font-bold leading-none ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function DashboardCompras() {
  const { activeClinicId } = useActiveClinic();
  const { items: ordenes, loading: loadOC } = useOrdenesCompra(activeClinicId);
  const { items: facturas, loading: loadFac } = useFacturasProveedor(activeClinicId);
  const { items: recepciones, loading: loadRec } = useRecepcionesMercancia(activeClinicId);
  const { items: proveedores } = useProveedores(activeClinicId);
  const { rows: cicloRows, stats: ciclo, loading: loadCiclo } = useCicloCompras(activeClinicId);

  const exportarCSV = () => {
    const cols = [
      "folio_solicitud","estatus_solicitud","fecha_solicitud","solicitante_nombre",
      "folio_cotizacion","folio_orden","estatus_orden","aprobada_at",
      "folio_recepcion","estatus_recepcion","fecha_recepcion",
      "folio_factura","estatus_factura","factura_total_centavos","match_status","match_diferencia_centavos","match_revisado_at",
      "fecha_pago","pago_monto_centavos","metodo_pago",
    ] as const;
    const header = cols.join(",");
    const escape = (v: unknown) => v == null ? "" : `"${String(v).replace(/"/g, '""')}"`;
    const body = cicloRows.map((r) => cols.map((c) => escape(r[c])).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-ciclo-compras-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loading = loadOC || loadFac || loadRec || loadCiclo;

  const now = new Date();
  const mesStart = startOfMonth(now);
  const mesEnd = endOfMonth(now);
  const mesLabel = format(now, "MMMM yyyy", { locale: es });

  const stats = useMemo(() => {
    // OC del mes
    const ocMes = ordenes.filter((o) => {
      const d = parseISO(o.fecha_emision);
      return !isBefore(d, mesStart) && !isAfter(d, mesEnd);
    });
    const ocMesTotal = ocMes.reduce((s, o) => s + o.total_centavos, 0);
    const ocPendAprobacion = ordenes.filter((o) => o.estatus === "pendiente_aprobacion");
    const ocConfirmadas = ordenes.filter((o) => o.estatus === "confirmada" || o.estatus === "parcial");

    // CxP vencido (facturas con fecha_vencimiento < hoy y saldo > 0)
    const vencidas = facturas.filter((f) =>
      f.saldo_pendiente_centavos > 0 && isBefore(parseISO(f.fecha_vencimiento), now)
    );
    const totalVencido = vencidas.reduce((s, f) => s + f.saldo_pendiente_centavos, 0);

    // CxP total pendiente
    const totalPendiente = facturas
      .filter((f) => f.saldo_pendiente_centavos > 0)
      .reduce((s, f) => s + f.saldo_pendiente_centavos, 0);

    // Recepciones del mes
    const recMes = recepciones.filter((r) => {
      const d = parseISO(r.fecha_recepcion);
      return !isBefore(d, mesStart) && !isAfter(d, mesEnd);
    });

    // Estatus breakdown de OC activas (no cancelada/rechazada)
    const estatusCount: Record<string, number> = {};
    ordenes
      .filter((o) => o.estatus !== "cancelada" && o.estatus !== "rechazada")
      .forEach((o) => { estatusCount[o.estatus] = (estatusCount[o.estatus] ?? 0) + 1; });

    // Proveedor top por total OC (todo el tiempo)
    const porProveedor: Record<string, { nombre: string; total: number; count: number }> = {};
    ordenes.forEach((o) => {
      if (!o.proveedor_id) return;
      const key = o.proveedor_id;
      const nombre = o.proveedor_nombre ??
        proveedores.find((p) => p.id === key)?.nombre ?? key.slice(0, 8);
      if (!porProveedor[key]) porProveedor[key] = { nombre, total: 0, count: 0 };
      porProveedor[key].total += o.total_centavos;
      porProveedor[key].count += 1;
    });
    const topProveedores = Object.values(porProveedor)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    const maxProv = topProveedores[0]?.total ?? 1;

    // Facturas próximas a vencer (1–7 días)
    const proximasVencer = facturas.filter((f) => {
      if (f.saldo_pendiente_centavos <= 0) return false;
      const dias = differenceInDays(parseISO(f.fecha_vencimiento), now);
      return dias >= 0 && dias <= 7;
    });

    // OC recientes (últimas 5)
    const ocRecientes = [...ordenes]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5);

    // Evolución OC últimas 8 semanas (montos)
    const semanas: { label: string; total: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - i * 7 - 6);
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      const total = ordenes
        .filter((o) => {
          const d = parseISO(o.fecha_emision);
          return !isBefore(d, start) && !isAfter(d, end) && o.estatus !== "cancelada";
        })
        .reduce((s, o) => s + o.total_centavos, 0);
      semanas.push({ label: format(end, "dd MMM", { locale: es }), total });
    }
    const maxSemana = Math.max(...semanas.map((s) => s.total), 1);

    return {
      ocMes, ocMesTotal, ocPendAprobacion, ocConfirmadas,
      vencidas, totalVencido, totalPendiente,
      recMes, estatusCount, topProveedores, maxProv,
      proximasVencer, ocRecientes, semanas, maxSemana,
    };
  }, [ordenes, facturas, recepciones, proveedores, now, mesStart, mesEnd]);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Dashboard de Compras</h3>
          <p className="text-sm text-muted-foreground capitalize">{mesLabel}</p>
        </div>
        <button
          onClick={exportarCSV}
          disabled={cicloRows.length === 0}
          className="shrink-0 text-xs px-3 py-1.5 rounded-lg border bg-background hover:bg-muted disabled:opacity-40 flex items-center gap-1.5"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          Exportar auditoría CSV
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={ShoppingCart}
          label={`OC emitidas — ${mesLabel}`}
          value={fmt(stats.ocMesTotal)}
          sub={`${stats.ocMes.length} orden${stats.ocMes.length !== 1 ? "es" : ""}`}
        />
        <KpiCard
          icon={Clock}
          label="Pend. aprobación"
          value={String(stats.ocPendAprobacion.length)}
          sub={stats.ocPendAprobacion.length > 0 ? "requieren autorización" : "sin pendientes"}
          color={stats.ocPendAprobacion.length > 0 ? "text-yellow-600" : "text-foreground"}
          alert={stats.ocPendAprobacion.length > 0}
        />
        <KpiCard
          icon={AlertTriangle}
          label="CxP vencido"
          value={fmt(stats.totalVencido)}
          sub={`${stats.vencidas.length} factura${stats.vencidas.length !== 1 ? "s" : ""} vencida${stats.vencidas.length !== 1 ? "s" : ""}`}
          color={stats.totalVencido > 0 ? "text-destructive" : "text-foreground"}
          alert={stats.totalVencido > 0}
        />
        <KpiCard
          icon={TrendingUp}
          label="CxP total pendiente"
          value={fmt(stats.totalPendiente)}
          sub={`${stats.recMes.length} recepciones este mes`}
        />
      </div>

      {/* Alertas */}
      {(stats.ocPendAprobacion.length > 0 || stats.proximasVencer.length > 0) && (
        <div className="space-y-2">
          {stats.ocPendAprobacion.length > 0 && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800 flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>{stats.ocPendAprobacion.length} OC</strong> pendiente{stats.ocPendAprobacion.length !== 1 ? "s" : ""} de aprobación:{" "}
                {stats.ocPendAprobacion.map((o) => o.folio).join(", ")}
              </span>
            </div>
          )}
          {stats.proximasVencer.length > 0 && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm text-orange-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>{stats.proximasVencer.length} factura{stats.proximasVencer.length !== 1 ? "s" : ""}</strong> vence{stats.proximasVencer.length === 1 ? "" : "n"} en los próximos 7 días:{" "}
                {stats.proximasVencer.map((f) => `${f.serie_folio_proveedor} (${format(parseISO(f.fecha_vencimiento), "dd MMM", { locale: es })})`).join(", ")}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolución OC 8 semanas */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h4 className="text-sm font-semibold">Compras — últimas 8 semanas</h4>
          <div className="flex items-end gap-1.5 h-28">
            {stats.semanas.map((s, i) => {
              const pct = stats.maxSemana > 0 ? (s.total / stats.maxSemana) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="relative w-full flex flex-col justify-end" style={{ height: "80px" }}>
                    <div
                      className="w-full rounded-t bg-primary/80 group-hover:bg-primary transition-colors"
                      style={{ height: `${Math.max(pct, s.total > 0 ? 4 : 0)}%` }}
                      title={fmt(s.total)}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground leading-none">{s.label}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground text-right">
            Pico: {fmt(stats.maxSemana)}
          </p>
        </div>

        {/* Top 5 proveedores */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-muted-foreground" /> Top proveedores por compras
          </h4>
          {stats.topProveedores.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sin órdenes registradas</p>
          ) : (
            <div className="space-y-2">
              {stats.topProveedores.map((p, i) => {
                const pct = (p.total / stats.maxProv) * 100;
                return (
                  <div key={i} className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium truncate max-w-[60%]">{p.nombre}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">{fmt(p.total)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{p.count} orden{p.count !== 1 ? "es" : ""}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Estatus OC activas */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Package className="h-4 w-4 text-muted-foreground" /> OC por estatus
          </h4>
          {Object.keys(stats.estatusCount).length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sin órdenes activas</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.estatusCount)
                .sort((a, b) => b[1] - a[1])
                .map(([estatus, count]) => (
                  <div key={estatus} className="flex items-center justify-between">
                    <Badge className={`text-xs ${ESTATUS_COLOR[estatus] ?? "bg-muted"}`}>
                      {ESTATUS_LABEL[estatus] ?? estatus}
                    </Badge>
                    <span className="text-sm font-semibold">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* OC recientes */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" /> Últimas órdenes de compra
          </h4>
          {stats.ocRecientes.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sin órdenes</p>
          ) : (
            <div className="space-y-2">
              {stats.ocRecientes.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold">{o.folio}</span>
                    <span className="text-muted-foreground text-xs ml-2 truncate">
                      {o.proveedor_nombre ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`text-xs ${ESTATUS_COLOR[o.estatus] ?? "bg-muted"}`}>
                      {ESTATUS_LABEL[o.estatus] ?? o.estatus}
                    </Badge>
                    <span className="text-xs font-medium">{fmt(o.total_centavos)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Facturas vencidas */}
      {stats.vencidas.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-card p-4 space-y-3">
          <h4 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
            <XCircle className="h-4 w-4" /> Facturas vencidas sin pagar
          </h4>
          <div className="space-y-1.5">
            {stats.vencidas.slice(0, 8).map((f) => {
              const diasVencido = differenceInDays(now, parseISO(f.fecha_vencimiento));
              return (
                <div key={f.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold">{f.serie_folio_proveedor}</span>
                    <span className="text-muted-foreground text-xs ml-2">{f.proveedor_nombre}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-destructive">{diasVencido}d vencida</span>
                    <span className="text-xs font-semibold text-destructive">{fmt(f.saldo_pendiente_centavos)}</span>
                  </div>
                </div>
              );
            })}
            {stats.vencidas.length > 8 && (
              <p className="text-xs text-muted-foreground">+{stats.vencidas.length - 8} más…</p>
            )}
          </div>
          <div className="pt-1 border-t flex justify-between text-sm">
            <span className="text-muted-foreground">Total vencido</span>
            <span className="font-bold text-destructive">{fmt(stats.totalVencido)}</span>
          </div>
        </div>
      )}

      {/* Trazabilidad ciclo compras — Fase 4 KPIs */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <GitBranch className="h-4 w-4 text-muted-foreground" /> Trazabilidad ciclo de compras
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Timer className="h-3 w-3" /> Lead time SC→OC</p>
            <p className="text-xl font-bold">{ciclo.leadTimeScOcDias != null ? `${ciclo.leadTimeScOcDias}d` : "—"}</p>
            <p className="text-[10px] text-muted-foreground">promedio días</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Timer className="h-3 w-3" /> Lead time OC→GR</p>
            <p className="text-xl font-bold">{ciclo.leadTimeOcGrDias != null ? `${ciclo.leadTimeOcGrDias}d` : "—"}</p>
            <p className="text-[10px] text-muted-foreground">promedio días</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className={`h-3 w-3 ${ciclo.scSinConvertir.length > 0 ? "text-yellow-500" : ""}`} /> SCs sin OC
            </p>
            <p className={`text-xl font-bold ${ciclo.scSinConvertir.length > 0 ? "text-yellow-600" : ""}`}>
              {ciclo.scSinConvertir.length}
            </p>
            <p className="text-[10px] text-muted-foreground">aprobadas sin convertir</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <FileWarning className={`h-3 w-3 ${ciclo.diferenciasParaAprobar.length > 0 ? "text-orange-500" : ""}`} /> Diferencias 4-way
            </p>
            <p className={`text-xl font-bold ${ciclo.diferenciasParaAprobar.length > 0 ? "text-orange-600" : ""}`}>
              {ciclo.diferenciasParaAprobar.length}
            </p>
            <p className="text-[10px] text-muted-foreground">pendientes de aprobación</p>
          </div>
        </div>
        {ciclo.ciclosTotales > 0 && (
          <div className="pt-2 border-t flex justify-between text-xs text-muted-foreground">
            <span>Ciclos completos (con pago)</span>
            <span className="font-semibold text-foreground">
              {ciclo.ciclosCompletos} / {ciclo.ciclosTotales}
              {" "}({Math.round((ciclo.ciclosCompletos / ciclo.ciclosTotales) * 100)}%)
            </span>
          </div>
        )}
      </div>

      {/* Recepciones mes */}
      {stats.recMes.length > 0 && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-600" /> Recepciones este mes ({stats.recMes.length})
          </h4>
          <div className="space-y-1.5">
            {stats.recMes.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <span className="font-mono text-xs font-semibold">{r.folio_recepcion}</span>
                  <span className="text-muted-foreground text-xs ml-2">
                    {format(parseISO(r.fecha_recepcion), "dd MMM", { locale: es })}
                  </span>
                </div>
                <Badge variant={r.estatus === "verificada" ? "default" : "secondary"} className="text-xs shrink-0">
                  {r.estatus === "verificada" ? "Verificada" : r.estatus === "con_diferencias" ? "Con difs." : "Pendiente"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
