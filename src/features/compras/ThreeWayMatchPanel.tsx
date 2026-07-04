import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { untypedTable } from "@/lib/untypedTable";
import { useAuth } from "@/hooks/useAuth";
import {
  CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  ShieldCheck, Loader2,
} from "lucide-react";

const fmt = (c: number) => (c / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const pct = (a: number, b: number) => b === 0 ? 0 : Math.abs((a - b) / b) * 100;

/** Tolerance: 1% or $50 MXN, whichever is greater */
const TOLERANCE_PCT = 1;
const TOLERANCE_MIN = 5000; // $50.00 MXN in centavos

function classifyDiff(diff: number, base: number): "ok" | "diferencia" | "disputa" {
  const absDiff = Math.abs(diff);
  const pctDiff = pct(absDiff + base, base);
  if (absDiff <= Math.max(TOLERANCE_MIN, base * (TOLERANCE_PCT / 100))) return "ok";
  if (pctDiff <= 10) return "diferencia";
  return "disputa";
}

interface MatchLine {
  descripcion: string;
  oc_qty: number;
  oc_precio: number;
  rec_qty: number;
  rec_precio: number;
}

interface Props {
  facturaId: string;
  facturaTotal: number;
  ordenId: string | null;
  recepcionId: string | null;
  matchStatus: string;
  matchOcTotal: number | null;
  matchRecTotal: number | null;
  matchDif: number | null;
  matchNotas: string | null;
  onUpdated: () => void;
}

const STATUS_UI: Record<string, { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  sin_oc:           { label: "Sin OC",            cls: "bg-muted text-muted-foreground",    Icon: RefreshCw },
  pendiente:        { label: "Pendiente verificar",cls: "bg-yellow-100 text-yellow-700",     Icon: AlertTriangle },
  ok:               { label: "Match ✓",            cls: "bg-green-100 text-green-700",       Icon: CheckCircle2 },
  diferencia:       { label: "Diferencia",         cls: "bg-orange-100 text-orange-700",     Icon: AlertTriangle },
  disputa:          { label: "En disputa",         cls: "bg-red-100 text-red-700",           Icon: XCircle },
  aprobado_gerente: { label: "Aprobado gerente",   cls: "bg-purple-100 text-purple-700",     Icon: ShieldCheck },
};

export default function ThreeWayMatchPanel({
  facturaId, facturaTotal, ordenId, recepcionId,
  matchStatus, matchOcTotal, matchRecTotal, matchDif, matchNotas,
  onUpdated,
}: Props) {
  const { user, hasRole } = useAuth();
  const isManager = hasRole("admin") || hasRole("manager");

  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<MatchLine[] | null>(null);
  const [computed, setComputed] = useState<{
    ocTotal: number; recTotal: number; diff: number;
    result: "ok" | "diferencia" | "disputa";
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notas, setNotas] = useState(matchNotas ?? "");
  const [showNotas, setShowNotas] = useState(false);

  const runMatch = useCallback(async () => {
    if (!ordenId) return;
    setLoading(true);
    try {
      // Fetch OC items
      const { data: ocItems } = await untypedTable("ordenes_compra_items")
        .select("*, medicamentos(nombre)")
        .eq("orden_id", ordenId);

      // Fetch recepción items (use recepcion_id if set, else find by orden_id)
      let recItems: Record<string, unknown>[] = [];
      if (recepcionId) {
        const { data } = await untypedTable("recepciones_items")
          .select("*, medicamentos(nombre)")
          .eq("recepcion_id", recepcionId);
        recItems = (data ?? []) as Record<string, unknown>[];
      } else {
        // Find most recent recepcion for this orden
        const { data: recs } = await untypedTable("recepciones_mercancia")
          .select("id")
          .eq("orden_id", ordenId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (recs && recs.length > 0) {
          const { data } = await untypedTable("recepciones_items")
            .select("*, medicamentos(nombre)")
            .eq("recepcion_id", (recs[0] as { id: string }).id);
          recItems = (data ?? []) as Record<string, unknown>[];
        }
      }

      type OcItem = { medicamento_id: string; cantidad_pedida: number; precio_unitario_centavos: number; subtotal_centavos: number; medicamentos?: { nombre: string } | null };
      type RecItem = { medicamento_id: string; cantidad_recibida: number; precio_unitario_centavos: number; medicamentos?: { nombre: string } | null };

      const oci = (ocItems ?? []) as OcItem[];
      const reci = recItems as RecItem[];

      const ocTotal = oci.reduce((s, i) => s + (i.subtotal_centavos ?? i.cantidad_pedida * i.precio_unitario_centavos), 0);
      const recTotal = reci.reduce((s, i) => s + (i.cantidad_recibida * i.precio_unitario_centavos), 0);

      // Build comparison lines by medicamento_id
      const allMedIds = [...new Set([...oci.map((i) => i.medicamento_id), ...reci.map((i) => i.medicamento_id)])];
      const matchLines: MatchLine[] = allMedIds.map((medId) => {
        const oc = oci.find((i) => i.medicamento_id === medId);
        const rec = reci.find((i) => i.medicamento_id === medId);
        return {
          descripcion: oc?.medicamentos?.nombre ?? rec?.medicamentos?.nombre ?? medId.slice(0, 8),
          oc_qty: oc?.cantidad_pedida ?? 0,
          oc_precio: oc?.precio_unitario_centavos ?? 0,
          rec_qty: rec?.cantidad_recibida ?? 0,
          rec_precio: rec?.precio_unitario_centavos ?? 0,
        };
      });

      setLines(matchLines);

      // Classify based on OC vs Factura (primary match)
      const diff = facturaTotal - ocTotal;
      const result = classifyDiff(diff, ocTotal);

      setComputed({ ocTotal, recTotal, diff, result });

      // Persist match result
      setSaving(true);
      await untypedTable("facturas_proveedor").update({
        match_status: result,
        match_oc_total_centavos: ocTotal,
        match_recepcion_total_centavos: recTotal > 0 ? recTotal : null,
        match_diferencia_centavos: diff,
        match_revisado_by: user?.id ?? null,
        match_revisado_at: new Date().toISOString(),
        match_notas: notas || null,
      }).eq("id", facturaId);
      setSaving(false);
      onUpdated();
    } finally {
      setLoading(false);
    }
  }, [ordenId, recepcionId, facturaId, facturaTotal, user, notas, onUpdated]);

  const handleApprove = async () => {
    setSaving(true);
    await untypedTable("facturas_proveedor").update({
      match_status: "aprobado_gerente",
      match_revisado_by: user?.id ?? null,
      match_revisado_at: new Date().toISOString(),
      match_notas: notas || null,
    }).eq("id", facturaId);
    setSaving(false);
    onUpdated();
  };

  const ui = STATUS_UI[matchStatus] ?? STATUS_UI.pendiente;

  if (!ordenId) {
    return (
      <div className="text-xs text-muted-foreground italic">
        Sin OC vinculada — 3-way match no aplica.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-3 bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">3-Way Match</span>
          <Badge className={`${ui.cls} border-0 text-xs gap-1`}>
            <ui.Icon className="h-3 w-3" />
            {ui.label}
          </Badge>
          {matchDif !== null && (
            <span className={`text-xs font-medium ${Math.abs(matchDif) > TOLERANCE_MIN ? "text-orange-600" : "text-muted-foreground"}`}>
              {matchDif >= 0 ? "+" : ""}{fmt(matchDif)} vs OC
            </span>
          )}
        </div>
        <Button
          size="sm" variant="outline"
          className="h-7 text-xs gap-1"
          onClick={runMatch}
          disabled={loading || saving}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Verificar
        </Button>
      </div>

      {/* Saved totals summary */}
      {!computed && matchOcTotal !== null && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="space-y-0.5">
            <p className="text-muted-foreground">OC</p>
            <p className="font-medium">{fmt(matchOcTotal)}</p>
          </div>
          {matchRecTotal !== null && (
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Recepción</p>
              <p className="font-medium">{fmt(matchRecTotal)}</p>
            </div>
          )}
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Factura</p>
            <p className="font-medium">{fmt(facturaTotal)}</p>
          </div>
        </div>
      )}

      {/* Live computed result */}
      {computed && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="space-y-0.5">
              <p className="text-muted-foreground">OC total</p>
              <p className="font-medium">{fmt(computed.ocTotal)}</p>
            </div>
            {computed.recTotal > 0 && (
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Recepción</p>
                <p className="font-medium">{fmt(computed.recTotal)}</p>
              </div>
            )}
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Factura</p>
              <p className="font-medium">{fmt(facturaTotal)}</p>
            </div>
          </div>

          {/* Diff alert */}
          {computed.result !== "ok" && (
            <div className={`rounded-md p-2 text-xs flex items-start gap-1.5 ${
              computed.result === "disputa"
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-orange-50 border border-orange-200 text-orange-700"
            }`}>
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Diferencia de <strong>{fmt(Math.abs(computed.diff))}</strong> ({pct(Math.abs(computed.diff) + computed.ocTotal, computed.ocTotal).toFixed(1)}%) entre OC y factura.
                {computed.result === "disputa" && " Requiere aprobación de gerente."}
              </span>
            </div>
          )}

          {/* Line items table */}
          {lines && lines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1 pr-2">Producto</th>
                    <th className="text-right py-1 px-2">OC qty</th>
                    <th className="text-right py-1 px-2">OC precio</th>
                    <th className="text-right py-1 px-2">Rec qty</th>
                    <th className="text-right py-1 px-2">Rec precio</th>
                    <th className="text-right py-1 pl-2">Dif qty</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const qtyDiff = l.rec_qty - l.oc_qty;
                    const qtyOk = Math.abs(qtyDiff) < 0.01;
                    return (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1 pr-2 truncate max-w-[120px]">{l.descripcion}</td>
                        <td className="text-right py-1 px-2">{l.oc_qty}</td>
                        <td className="text-right py-1 px-2 font-mono">{fmt(l.oc_precio)}</td>
                        <td className="text-right py-1 px-2">{l.rec_qty || "—"}</td>
                        <td className="text-right py-1 px-2 font-mono">{l.rec_precio ? fmt(l.rec_precio) : "—"}</td>
                        <td className={`text-right py-1 pl-2 font-medium ${qtyOk ? "text-green-600" : "text-orange-600"}`}>
                          {l.rec_qty ? (qtyOk ? "✓" : `${qtyDiff > 0 ? "+" : ""}${qtyDiff.toFixed(0)}`) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Approval for disputa */}
      {(matchStatus === "disputa" || computed?.result === "disputa") && isManager && (
        <div className="space-y-2 border-t pt-2">
          <button
            className="text-xs text-muted-foreground underline"
            onClick={() => setShowNotas((v) => !v)}
          >
            {showNotas ? "Ocultar notas" : "Agregar notas de aprobación"}
          </button>
          {showNotas && (
            <div className="space-y-1">
              <Label className="text-xs">Notas de aprobación</Label>
              <Textarea rows={2} className="text-xs" value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-purple-700 border-purple-200" onClick={handleApprove} disabled={saving}>
            <ShieldCheck className="h-3.5 w-3.5" />
            Aprobar diferencia (gerente)
          </Button>
        </div>
      )}

      {matchNotas && !showNotas && (
        <p className="text-xs text-muted-foreground italic">Nota: {matchNotas}</p>
      )}
    </div>
  );
}
