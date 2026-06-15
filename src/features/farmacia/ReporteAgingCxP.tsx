import { useEffect, useMemo, useState } from "react";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useFacturasProveedor } from "@/hooks/useFacturasProveedor";
import { untypedTable } from "@/lib/untypedTable";
import { differenceInDays } from "date-fns";
import { AlertTriangle, Clock, CheckCircle, TrendingDown } from "lucide-react";

const fmt = (c: number) => (c / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const pct = (n: number, total: number) => total === 0 ? 0 : Math.round((n / total) * 100);

interface AgingBucket {
  corriente: number;   // saldo — not yet due
  dias1_30: number;    // 1–30 days overdue
  dias31_60: number;
  dias61_90: number;
  mas90: number;       // >90 days overdue
  total: number;
  diasPlazo: number;   // avg credit days (vencimiento - factura)
  diasPagoReal: number | null; // avg actual days to pay (from pagos)
  facturas: number;
}

interface ProveedorRow {
  id: string;
  nombre: string;
  bucket: AgingBucket;
}

interface PagoRow {
  fecha_pago: string;
  facturas_proveedor: { proveedor_id: string; fecha_factura: string } | null;
}

const emptyBucket = (): AgingBucket => ({
  corriente: 0, dias1_30: 0, dias31_60: 0, dias61_90: 0, mas90: 0,
  total: 0, diasPlazo: 0, diasPagoReal: null, facturas: 0,
});

export default function ReporteAgingCxP() {
  const { activeClinicId } = useActiveClinic();
  const { items, loading } = useFacturasProveedor(activeClinicId);
  const [pagosData, setPagosData] = useState<PagoRow[]>([]);

  useEffect(() => {
    if (!activeClinicId) return;
    untypedTable("pagos_proveedor")
      .select("fecha_pago, facturas_proveedor!inner(proveedor_id, fecha_factura, clinic_id)")
      .eq("facturas_proveedor.clinic_id" as never, activeClinicId)
      .then(({ data }) => setPagosData((data ?? []) as PagoRow[]));
  }, [activeClinicId]);

  // Avg días pago real por proveedor from pagos
  const avgDiasPagoReal = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const p of pagosData) {
      const fp = p.facturas_proveedor;
      if (!fp) continue;
      const dias = differenceInDays(new Date(p.fecha_pago), new Date(fp.fecha_factura));
      if (!map[fp.proveedor_id]) map[fp.proveedor_id] = [];
      map[fp.proveedor_id].push(dias);
    }
    return Object.fromEntries(
      Object.entries(map).map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length)])
    );
  }, [pagosData]);

  // Build aging buckets per proveedor — only pending/partial
  const proveedores = useMemo<ProveedorRow[]>(() => {
    const today = new Date();
    const map: Record<string, { nombre: string; bucket: AgingBucket }> = {};

    for (const f of items) {
      if (f.estatus === "pagada" || f.estatus === "cancelada") continue;
      if (!map[f.proveedor_id]) {
        map[f.proveedor_id] = { nombre: f.proveedor_nombre ?? f.proveedor_id, bucket: emptyBucket() };
      }
      const b = map[f.proveedor_id].bucket;
      const saldo = f.saldo_pendiente_centavos;
      const diasVenc = differenceInDays(today, new Date(f.fecha_vencimiento));
      const plazo = differenceInDays(new Date(f.fecha_vencimiento), new Date(f.fecha_factura));

      b.total += saldo;
      b.facturas += 1;
      b.diasPlazo = Math.round((b.diasPlazo * (b.facturas - 1) + Math.max(0, plazo)) / b.facturas);

      if (diasVenc <= 0)      b.corriente += saldo;
      else if (diasVenc <= 30) b.dias1_30 += saldo;
      else if (diasVenc <= 60) b.dias31_60 += saldo;
      else if (diasVenc <= 90) b.dias61_90 += saldo;
      else                    b.mas90 += saldo;
    }

    return Object.entries(map)
      .map(([id, { nombre, bucket }]) => ({
        id,
        nombre,
        bucket: { ...bucket, diasPagoReal: avgDiasPagoReal[id] ?? null },
      }))
      .sort((a, b) => b.bucket.total - a.bucket.total);
  }, [items, avgDiasPagoReal]);

  // Totals
  const totals = useMemo(() => proveedores.reduce((acc, p) => ({
    corriente:  acc.corriente  + p.bucket.corriente,
    dias1_30:   acc.dias1_30   + p.bucket.dias1_30,
    dias31_60:  acc.dias31_60  + p.bucket.dias31_60,
    dias61_90:  acc.dias61_90  + p.bucket.dias61_90,
    mas90:      acc.mas90      + p.bucket.mas90,
    total:      acc.total      + p.bucket.total,
  }), { corriente: 0, dias1_30: 0, dias31_60: 0, dias61_90: 0, mas90: 0, total: 0 }), [proveedores]);

  const vencidoTotal = totals.dias1_30 + totals.dias31_60 + totals.dias61_90 + totals.mas90;
  const allPaid = items.filter(f => f.estatus === "pagada");
  const totalPagado = allPaid.reduce((a, f) => a + f.total_centavos, 0);

  if (loading) return <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Análisis de Vencimientos — Aging CxP</h3>
        <p className="text-sm text-muted-foreground">Saldos pendientes por proveedor clasificados por antigüedad de vencimiento</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Por vencer
          </div>
          <p className="text-xl font-bold">{fmt(totals.corriente)}</p>
          <p className="text-xs text-muted-foreground">{pct(totals.corriente, totals.total)}% del saldo</p>
        </div>
        <div className={`rounded-lg border bg-card p-4 space-y-1 ${vencidoTotal > 0 ? "border-destructive/30 bg-destructive/5" : ""}`}>
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> Vencido
          </div>
          <p className="text-xl font-bold text-destructive">{fmt(vencidoTotal)}</p>
          <p className="text-xs text-muted-foreground">{pct(vencidoTotal, totals.total)}% del saldo</p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5" /> Total CxP
          </div>
          <p className="text-xl font-bold">{fmt(totals.total)}</p>
          <p className="text-xs text-muted-foreground">{proveedores.length} proveedor(es)</p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-green-600">
            <CheckCircle className="h-3.5 w-3.5" /> Pagado (período)
          </div>
          <p className="text-xl font-bold text-green-700">{fmt(totalPagado)}</p>
          <p className="text-xs text-muted-foreground">{allPaid.length} facturas</p>
        </div>
      </div>

      {/* Aging bar (stacked visual) */}
      {totals.total > 0 && (
        <div className="space-y-1">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {[
              { val: totals.corriente, cls: "bg-green-500" },
              { val: totals.dias1_30,  cls: "bg-yellow-400" },
              { val: totals.dias31_60, cls: "bg-orange-500" },
              { val: totals.dias61_90, cls: "bg-red-500" },
              { val: totals.mas90,     cls: "bg-red-900" },
            ].filter(s => s.val > 0).map((s, i) => (
              <div key={i} className={`${s.cls} h-full transition-all`} style={{ width: `${pct(s.val, totals.total)}%` }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {[
              { label: "Corriente", val: totals.corriente, cls: "bg-green-500" },
              { label: "1–30d",     val: totals.dias1_30,  cls: "bg-yellow-400" },
              { label: "31–60d",    val: totals.dias31_60, cls: "bg-orange-500" },
              { label: "61–90d",    val: totals.dias61_90, cls: "bg-red-500" },
              { label: ">90d",      val: totals.mas90,     cls: "bg-red-900" },
            ].map(s => (
              <span key={s.label} className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-sm ${s.cls}`} />
                {s.label}: {fmt(s.val)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Aging table */}
      {proveedores.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <CheckCircle className="mx-auto mb-2 h-8 w-8 opacity-40 text-green-600" />
          <p className="text-sm">Sin cuentas por pagar pendientes.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Proveedor</th>
                <th className="px-3 py-2 text-right font-medium text-green-700">Corriente</th>
                <th className="px-3 py-2 text-right font-medium text-yellow-600">1–30d</th>
                <th className="px-3 py-2 text-right font-medium text-orange-500">31–60d</th>
                <th className="px-3 py-2 text-right font-medium text-red-500">61–90d</th>
                <th className="px-3 py-2 text-right font-medium text-red-900">&gt;90d</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-center font-medium">Plazo pact.</th>
                <th className="px-3 py-2 text-center font-medium">Días pago real</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 font-medium">{p.nombre}</td>
                  <td className="px-3 py-2 text-right text-green-700">
                    {p.bucket.corriente > 0 ? fmt(p.bucket.corriente) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-yellow-600">
                    {p.bucket.dias1_30 > 0 ? fmt(p.bucket.dias1_30) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-orange-500">
                    {p.bucket.dias31_60 > 0 ? fmt(p.bucket.dias31_60) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-red-500">
                    {p.bucket.dias61_90 > 0 ? fmt(p.bucket.dias61_90) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-red-900 font-semibold">
                    {p.bucket.mas90 > 0 ? fmt(p.bucket.mas90) : <span className="text-muted-foreground font-normal">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(p.bucket.total)}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {p.bucket.diasPlazo > 0 ? `${p.bucket.diasPlazo}d` : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {p.bucket.diasPagoReal !== null ? (
                      <span className={p.bucket.diasPagoReal > (p.bucket.diasPlazo || 30) ? "text-destructive font-medium" : "text-green-700"}>
                        {p.bucket.diasPagoReal}d
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">sin historial</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/20 font-semibold text-sm">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right text-green-700">{fmt(totals.corriente)}</td>
                <td className="px-3 py-2 text-right text-yellow-600">{fmt(totals.dias1_30)}</td>
                <td className="px-3 py-2 text-right text-orange-500">{fmt(totals.dias31_60)}</td>
                <td className="px-3 py-2 text-right text-red-500">{fmt(totals.dias61_90)}</td>
                <td className="px-3 py-2 text-right text-red-900">{fmt(totals.mas90)}</td>
                <td className="px-3 py-2 text-right">{fmt(totals.total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        "Plazo pact." = promedio días entre fecha factura y vencimiento. "Días pago real" = promedio días entre factura y fecha de pago registrada. Facturas pagadas o canceladas excluidas del aging.
      </p>
    </div>
  );
}
