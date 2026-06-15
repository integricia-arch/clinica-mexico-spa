import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { untypedTable } from "@/lib/untypedTable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { RefreshCw, Star, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";

const fmtPct = (n: number) => `${Math.round(n)}%`;
const clamp = (n: number) => Math.max(0, Math.min(100, n));

// Weights for overall score
const W = { entrega: 0.35, cantidad: 0.30, devolucion: 0.20, precio: 0.15 };

interface ProvKPI {
  proveedor_id: string;
  proveedor_nombre: string;
  // Delivery compliance: avg days delta (recepcion - oc.fecha_entrega_est), score 100 - penalty
  oc_total: number;
  oc_a_tiempo: number;         // received within fecha_entrega_est
  oc_dias_tardanza_avg: number; // avg days late (positive = late)
  score_entrega: number;       // 0-100

  // Quantity accuracy: sum(recibida) / sum(pedida) * 100
  unidades_pedidas: number;
  unidades_recibidas: number;
  score_cantidad: number;      // 0-100

  // Return rate: sum(devuelta) / sum(recibida) — inverted (lower = better)
  unidades_devueltas: number;
  tasa_devolucion_pct: number;
  score_devolucion: number;    // 0-100

  // Price accuracy: OC with 3-way match 'ok' / total OC with match
  facturas_match_ok: number;
  facturas_con_match: number;
  score_precio: number;        // 0-100

  // Overall
  score_total: number;         // 0-100
  rating: "A" | "B" | "C" | "D" | "N/A";

  // Meta
  ultima_compra: string | null;
  oc_pendientes: number;
}

const rating = (score: number): ProvKPI["rating"] => {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
};

const RATING_UI: Record<string, { cls: string; label: string }> = {
  A:   { cls: "bg-green-100 text-green-800 border-green-200",  label: "A — Excelente" },
  B:   { cls: "bg-blue-100 text-blue-800 border-blue-200",     label: "B — Bueno" },
  C:   { cls: "bg-yellow-100 text-yellow-800 border-yellow-200",label: "C — Regular" },
  D:   { cls: "bg-red-100 text-red-800 border-red-200",        label: "D — Deficiente" },
  "N/A":{ cls: "bg-muted text-muted-foreground border-muted",  label: "Sin datos" },
};

const ScoreBar = ({ score, cls }: { score: number; cls?: string }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${cls ?? (score >= 85 ? "bg-green-500" : score >= 70 ? "bg-blue-500" : score >= 55 ? "bg-yellow-500" : "bg-red-500")}`}
        style={{ width: `${clamp(score)}%` }}
      />
    </div>
    <span className="text-xs font-medium w-8 text-right">{fmtPct(score)}</span>
  </div>
);

const Trend = ({ val }: { val: number }) =>
  val > 0 ? <TrendingUp className="h-3 w-3 text-green-600" /> :
  val < 0 ? <TrendingDown className="h-3 w-3 text-red-500" /> :
  <Minus className="h-3 w-3 text-muted-foreground" />;

export default function EvaluacionProveedores() {
  const { activeClinicId } = useActiveClinic();
  const [data, setData] = useState<ProvKPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [period, setPeriod] = useState<"90" | "180" | "365">("90");

  const compute = useCallback(async () => {
    if (!activeClinicId) return;
    setLoading(true);
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(period));
      const cutoffStr = cutoff.toISOString();

      // 1. Proveedores activos
      const { data: provs } = await untypedTable("proveedores")
        .select("id, nombre")
        .eq("activo", true);

      // 2. OC en período
      const { data: ocs } = await untypedTable("ordenes_compra")
        .select("id, proveedor_id, estatus, fecha_entrega_est, created_at")
        .eq("clinic_id", activeClinicId)
        .gte("created_at", cutoffStr);

      // 3. Recepciones con fecha
      const { data: recs } = await untypedTable("recepciones_mercancia")
        .select("id, proveedor_id, orden_id, fecha_recepcion, estatus")
        .eq("clinic_id", activeClinicId)
        .gte("created_at", cutoffStr);

      // 4. OC items (totales pedidos por OC)
      const ocIds = ((ocs ?? []) as { id: string }[]).map((o) => o.id);
      let ocItems: { orden_id: string; cantidad_pedida: number }[] = [];
      if (ocIds.length > 0) {
        const { data } = await untypedTable("ordenes_compra_items")
          .select("orden_id, cantidad_pedida")
          .in("orden_id", ocIds);
        ocItems = (data ?? []) as typeof ocItems;
      }

      // 5. Recepción items (totales recibidos por recepcion)
      const recIds = ((recs ?? []) as { id: string }[]).map((r) => r.id);
      let recItems: { recepcion_id: string; cantidad_recibida: number; medicamento_id: string }[] = [];
      if (recIds.length > 0) {
        const { data } = await untypedTable("recepciones_items")
          .select("recepcion_id, cantidad_recibida, medicamento_id")
          .in("recepcion_id", recIds);
        recItems = (data ?? []) as typeof recItems;
      }

      // 6. Devoluciones items en período
      const { data: devs } = await untypedTable("devoluciones_proveedor")
        .select("id, proveedor_id")
        .eq("clinic_id", activeClinicId)
        .neq("estatus", "rechazada")
        .gte("created_at", cutoffStr);

      const devIds = ((devs ?? []) as { id: string }[]).map((d) => d.id);
      let devItems: { devolucion_id: string; cantidad_devuelta: number }[] = [];
      if (devIds.length > 0) {
        const { data } = await untypedTable("devoluciones_items")
          .select("devolucion_id, cantidad_devuelta")
          .in("devolucion_id", devIds);
        devItems = (data ?? []) as typeof devItems;
      }

      // 7. Facturas con 3-way match en período
      const { data: facts } = await untypedTable("facturas_proveedor")
        .select("proveedor_id, match_status")
        .eq("clinic_id", activeClinicId)
        .neq("match_status", "sin_oc")
        .gte("created_at", cutoffStr);

      type OcRow = { id: string; proveedor_id: string; estatus: string; fecha_entrega_est: string | null; created_at: string };
      type RecRow = { id: string; proveedor_id: string; orden_id: string | null; fecha_recepcion: string; estatus: string };
      type DevRow = { id: string; proveedor_id: string };
      type FactRow = { proveedor_id: string; match_status: string };

      const ocsTyped = (ocs ?? []) as OcRow[];
      const recsTyped = (recs ?? []) as RecRow[];
      const devsTyped = (devs ?? []) as DevRow[];
      const factsTyped = (facts ?? []) as FactRow[];

      const kpis: ProvKPI[] = ((provs ?? []) as { id: string; nombre: string }[]).map((prov) => {
        const provOcs = ocsTyped.filter((o) => o.proveedor_id === prov.id);
        const provRecs = recsTyped.filter((r) => r.proveedor_id === prov.id);
        const provDevIds = devsTyped.filter((d) => d.proveedor_id === prov.id).map((d) => d.id);

        // Delivery KPI
        let diasLate: number[] = [];
        let aATiempo = 0;
        provRecs.forEach((rec) => {
          if (!rec.orden_id) return;
          const oc = provOcs.find((o) => o.id === rec.orden_id);
          if (!oc?.fecha_entrega_est) return;
          const expected = new Date(oc.fecha_entrega_est);
          const received = new Date(rec.fecha_recepcion);
          const delta = Math.ceil((received.getTime() - expected.getTime()) / 86400000);
          diasLate.push(delta);
          if (delta <= 0) aATiempo++;
        });
        const avgLate = diasLate.length > 0 ? diasLate.reduce((a, b) => a + b, 0) / diasLate.length : 0;
        const scoreEntrega = diasLate.length > 0
          ? clamp(100 - Math.max(0, avgLate) * 5)
          : 100;

        // Quantity KPI
        const provOcIds = provOcs.map((o) => o.id);
        const provRecIds = provRecs.map((r) => r.id);
        const pedidas = ocItems.filter((i) => provOcIds.includes(i.orden_id)).reduce((s, i) => s + i.cantidad_pedida, 0);
        const recibidas = recItems.filter((i) => provRecIds.includes(i.recepcion_id)).reduce((s, i) => s + i.cantidad_recibida, 0);
        const scoreCantidad = pedidas > 0 ? clamp((recibidas / pedidas) * 100) : 100;

        // Return rate KPI
        const devueltas = devItems.filter((i) => provDevIds.includes(i.devolucion_id)).reduce((s, i) => s + i.cantidad_devuelta, 0);
        const tasaDev = recibidas > 0 ? (devueltas / recibidas) * 100 : 0;
        const scoreDevolucion = clamp(100 - tasaDev * 5);

        // Price accuracy KPI (from 3-way match)
        const provFacts = factsTyped.filter((f) => f.proveedor_id === prov.id);
        const factsOk = provFacts.filter((f) => f.match_status === "ok" || f.match_status === "aprobado_gerente").length;
        const scorePrecio = provFacts.length > 0 ? clamp((factsOk / provFacts.length) * 100) : 100;

        const scoreTotal = clamp(
          scoreEntrega * W.entrega +
          scoreCantidad * W.cantidad +
          scoreDevolucion * W.devolucion +
          scorePrecio * W.precio
        );

        const ultimaRec = provRecs.sort((a, b) => b.fecha_recepcion.localeCompare(a.fecha_recepcion))[0];

        return {
          proveedor_id: prov.id,
          proveedor_nombre: prov.nombre,
          oc_total: provOcs.length,
          oc_a_tiempo: aATiempo,
          oc_dias_tardanza_avg: Math.round(avgLate * 10) / 10,
          score_entrega: scoreEntrega,
          unidades_pedidas: pedidas,
          unidades_recibidas: recibidas,
          score_cantidad: scoreCantidad,
          unidades_devueltas: devueltas,
          tasa_devolucion_pct: Math.round(tasaDev * 10) / 10,
          score_devolucion: scoreDevolucion,
          facturas_match_ok: factsOk,
          facturas_con_match: provFacts.length,
          score_precio: scorePrecio,
          score_total: scoreTotal,
          rating: provOcs.length === 0 && provRecs.length === 0 ? "N/A" : rating(scoreTotal),
          ultima_compra: ultimaRec?.fecha_recepcion ?? null,
          oc_pendientes: provOcs.filter((o) => ["confirmada", "parcial"].includes(o.estatus)).length,
        };
      }).filter((k) => k.oc_total > 0 || k.unidades_recibidas > 0);

      kpis.sort((a, b) => {
        if (a.rating === "N/A") return 1;
        if (b.rating === "N/A") return -1;
        return b.score_total - a.score_total;
      });

      setData(kpis);
    } finally {
      setLoading(false);
    }
  }, [activeClinicId, period]);

  useEffect(() => { compute(); }, [compute]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-14 text-muted-foreground">
        <Star className="mx-auto h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm font-medium">Sin datos de evaluación</p>
        <p className="text-xs mt-1">Registra órdenes de compra y recepciones para generar scores</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">Evaluación de Proveedores</h3>
          <p className="text-sm text-muted-foreground">Score: entrega 35% · cantidad 30% · devolución 20% · precio 15%</p>
        </div>
        <div className="flex items-center gap-2">
          {(["90", "180", "365"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${period === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
            >
              {p === "90" ? "90d" : p === "180" ? "6m" : "1a"}
            </button>
          ))}
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={compute}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Summary rating pills */}
      <div className="flex flex-wrap gap-2">
        {(["A","B","C","D"] as const).map((r) => {
          const count = data.filter((d) => d.rating === r).length;
          return count > 0 ? (
            <span key={r} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${RATING_UI[r].cls}`}>
              {r} — {count} proveedor{count > 1 ? "es" : ""}
            </span>
          ) : null;
        })}
      </div>

      {/* Provider cards */}
      <div className="space-y-2">
        {data.map((k) => {
          const ui = RATING_UI[k.rating];
          const isOpen = expanded === k.proveedor_id;
          return (
            <div key={k.proveedor_id} className="rounded-lg border bg-card">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => setExpanded(isOpen ? null : k.proveedor_id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{k.proveedor_nombre}</span>
                    <Badge className={`${ui.cls} border text-xs font-bold`}>{k.rating}</Badge>
                    {k.oc_pendientes > 0 && (
                      <Badge variant="outline" className="text-xs">{k.oc_pendientes} OC activa{k.oc_pendientes > 1 ? "s" : ""}</Badge>
                    )}
                  </div>
                  <div className="mt-1.5 max-w-xs">
                    <ScoreBar score={k.score_total} />
                  </div>
                </div>
                <div className="text-right shrink-0 text-xs text-muted-foreground space-y-0.5">
                  <p>{k.oc_total} OC · {k.unidades_recibidas} uds recibidas</p>
                  {k.ultima_compra && (
                    <p>Última: {format(new Date(k.ultima_compra), "dd MMM yyyy", { locale: es })}</p>
                  )}
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>

              {isOpen && (
                <div className="border-t px-3 pb-3 pt-2 space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {/* Entrega */}
                    <div className="space-y-1.5 rounded-md bg-muted/30 p-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Entrega puntual</p>
                        <Trend val={-k.oc_dias_tardanza_avg} />
                      </div>
                      <ScoreBar score={k.score_entrega} />
                      <p className="text-xs text-muted-foreground">
                        {k.oc_a_tiempo}/{k.oc_total > 0 ? k.oc_total : "—"} a tiempo
                        {k.oc_dias_tardanza_avg > 0 && ` · +${k.oc_dias_tardanza_avg}d avg`}
                      </p>
                    </div>

                    {/* Cantidad */}
                    <div className="space-y-1.5 rounded-md bg-muted/30 p-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Exactitud qty</p>
                        <Trend val={k.score_cantidad - 95} />
                      </div>
                      <ScoreBar score={k.score_cantidad} />
                      <p className="text-xs text-muted-foreground">
                        {k.unidades_recibidas}/{k.unidades_pedidas} uds
                        {k.unidades_pedidas > 0 && ` (${fmtPct((k.unidades_recibidas / k.unidades_pedidas) * 100)})`}
                      </p>
                    </div>

                    {/* Devoluciones */}
                    <div className="space-y-1.5 rounded-md bg-muted/30 p-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Calidad / devolución</p>
                        <Trend val={-k.tasa_devolucion_pct} />
                      </div>
                      <ScoreBar score={k.score_devolucion} />
                      <p className="text-xs text-muted-foreground">
                        {k.unidades_devueltas} devueltas · {k.tasa_devolucion_pct}% tasa
                      </p>
                    </div>

                    {/* Precio */}
                    <div className="space-y-1.5 rounded-md bg-muted/30 p-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Exactitud precio</p>
                        <Trend val={k.score_precio - 95} />
                      </div>
                      <ScoreBar score={k.score_precio} />
                      <p className="text-xs text-muted-foreground">
                        {k.facturas_match_ok}/{k.facturas_con_match} facturas match OK
                        {k.facturas_con_match === 0 && " · sin datos 3WM"}
                      </p>
                    </div>
                  </div>

                  {/* Score breakdown table */}
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    <div className="grid grid-cols-5 gap-1 font-medium mb-1">
                      <span>Componente</span>
                      <span className="text-right">Score</span>
                      <span className="text-right">Peso</span>
                      <span className="text-right">Ponderado</span>
                      <span className="text-right">Rating</span>
                    </div>
                    {[
                      { label: "Entrega puntual", score: k.score_entrega, w: W.entrega },
                      { label: "Exactitud cantidad", score: k.score_cantidad, w: W.cantidad },
                      { label: "Calidad (devolución)", score: k.score_devolucion, w: W.devolucion },
                      { label: "Exactitud precio", score: k.score_precio, w: W.precio },
                    ].map((row) => (
                      <div key={row.label} className="grid grid-cols-5 gap-1 py-0.5 border-b border-border/40 last:border-0">
                        <span>{row.label}</span>
                        <span className="text-right">{fmtPct(row.score)}</span>
                        <span className="text-right">{fmtPct(row.w * 100)}</span>
                        <span className="text-right font-medium">{fmtPct(row.score * row.w)}</span>
                        <span className={`text-right font-semibold ${row.score >= 85 ? "text-green-600" : row.score >= 70 ? "text-blue-600" : row.score >= 55 ? "text-yellow-600" : "text-red-600"}`}>
                          {rating(row.score)}
                        </span>
                      </div>
                    ))}
                    <div className="grid grid-cols-5 gap-1 pt-1 font-semibold">
                      <span className="col-span-3">Score Total</span>
                      <span className="text-right">{fmtPct(k.score_total)}</span>
                      <span className={`text-right ${RATING_UI[k.rating].cls.split(" ").find(c => c.startsWith("text-"))}`}>{k.rating}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Score A ≥85% · B 70–84% · C 55–69% · D &lt;55%. Período: últimos {period} días.
        Datos insuficientes si proveedor sin OC/recepciones en el período.
      </p>
    </div>
  );
}
