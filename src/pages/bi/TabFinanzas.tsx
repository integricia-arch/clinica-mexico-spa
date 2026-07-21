import { DollarSign, AlertTriangle, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BotCanalCosto, useBI } from "@/hooks/useBI";
import { fmtMXN, KpiCard, ChartSkeleton } from "./shared";

export function TabFinanzas({ resumen, botCanalCostos, loading }: {
  resumen: ReturnType<typeof useBI>["resumen"];
  botCanalCostos: BotCanalCosto[];
  loading: boolean;
}) {
  if (loading) return <ChartSkeleton />;
  if (!resumen) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KpiCard
          title="CxP pendiente total"
          value={fmtMXN(resumen.cxpPendiente)}
          icon={<DollarSign className="h-4 w-4 text-amber-600" />}
          iconBg="bg-amber-100"
        />
        <KpiCard
          title="CxP vencido"
          value={fmtMXN(resumen.cxpVencido)}
          icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
          iconBg="bg-red-100"
          lowIsBetter
        />
      </div>

      {resumen.cxpPendiente > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vencido</span>
                <span className="font-medium text-red-600">{fmtMXN(resumen.cxpVencido)}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: resumen.cxpPendiente > 0 ? `${Math.min(100, (resumen.cxpVencido / resumen.cxpPendiente) * 100)}%` : "0%" }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>
                  {resumen.cxpPendiente > 0
                    ? `${Math.round((resumen.cxpVencido / resumen.cxpPendiente) * 100)}% del total está vencido`
                    : "Sin saldo pendiente"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {resumen.cxpPendiente === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Sin cuentas por pagar pendientes</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-600" />
            Costo Bot IA en período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold">
              {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(resumen.botCostoMes)}
            </span>
            {resumen.botCostoMesAnterior > 0 && (
              <span className="text-xs text-muted-foreground">
                vs {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(resumen.botCostoMesAnterior)} período ant.
              </span>
            )}
          </div>
          {botCanalCostos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin uso registrado en el período</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Canal</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Tokens</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Costo MXN</th>
                </tr>
              </thead>
              <tbody>
                {botCanalCostos.map(r => (
                  <tr key={r.canal} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-4 capitalize">{r.canal}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs">{r.tokens.toLocaleString("es-MX")}</td>
                    <td className="py-2 text-right font-medium">
                      {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(r.costo_mxn)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
