import { AlertTriangle, Pill } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { useBI } from "@/hooks/useBI";
import { ChartSkeleton } from "./shared";

export function TabInventario({ stockAlertas, lotesPorVencer, loading }: {
  stockAlertas: ReturnType<typeof useBI>["stockAlertas"];
  lotesPorVencer: ReturnType<typeof useBI>["lotesPorVencer"];
  loading: boolean;
}) {
  if (loading) return <div className="space-y-4"><ChartSkeleton /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Stock bajo mínimo ({stockAlertas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stockAlertas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin alertas de stock</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Medicamento</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Categoría</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Stock actual</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Stock mín.</th>
                  </tr>
                </thead>
                <tbody>
                  {stockAlertas.map(s => (
                    <tr key={s.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4 font-medium">{s.nombre}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-xs">{s.categoria}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <span className={s.stock_actual === 0 ? "text-red-600 font-bold" : "text-amber-600 font-medium"}>
                          {s.stock_actual}
                        </span>
                      </td>
                      <td className="py-2 text-right text-muted-foreground">{s.stock_minimo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Pill className="h-4 w-4 text-red-500" />
            Lotes por vencer en 30 días ({lotesPorVencer.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lotesPorVencer.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin lotes próximos a vencer</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Medicamento</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Lote</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Caducidad</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Existencia</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Días</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesPorVencer.map(l => (
                    <tr key={l.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4 font-medium">{l.medicamento}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{l.lote}</td>
                      <td className="py-2 pr-4 text-right">{l.fecha_caducidad}</td>
                      <td className="py-2 pr-4 text-right">{l.existencia}</td>
                      <td className="py-2 text-right">
                        <Badge variant={l.dias_restantes <= 7 ? "destructive" : l.dias_restantes <= 15 ? "secondary" : "outline"} className="text-xs">
                          {l.dias_restantes <= 0 ? "Vencido" : `${l.dias_restantes}d`}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
