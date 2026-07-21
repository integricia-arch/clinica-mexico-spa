import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useBI, Periodo } from "@/hooks/useBI";

import { TabResumen } from "./bi/TabResumen";
import { TabAgenda } from "./bi/TabAgenda";
import { TabFarmacia } from "./bi/TabFarmacia";
import { TabInventario } from "./bi/TabInventario";
import { TabFinanzas } from "./bi/TabFinanzas";
import { TabCompras } from "./bi/TabCompras";

const PERIODO_LABELS: Record<Periodo, string> = {
  mes_actual: "Este mes",
  mes_anterior: "Mes anterior",
  "3_meses": "Últimos 3 meses",
  anio: "Este año",
};

export default function BI() {
  const { hasRole } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("mes_actual");
  const bi = useBI(periodo);

  if (!hasRole("admin") && !hasRole("manager")) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm text-muted-foreground">Acceso restringido a administradores</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Inteligencia de Negocio</h1>
          <p className="text-xs text-muted-foreground mt-0.5">KPIs operativos y análisis de la clínica</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodo} onValueChange={v => setPeriodo(v as Periodo)}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIODO_LABELS) as Periodo[]).map(p => (
                <SelectItem key={p} value={p}>{PERIODO_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={bi.refresh}
            disabled={bi.loading}
            className="h-8 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${bi.loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {bi.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Error cargando datos: {bi.error}
        </div>
      )}

      <Tabs defaultValue="resumen">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="farmacia">Farmacia</TabsTrigger>
          <TabsTrigger value="inventario">
            Inventario
            {(bi.resumen?.itemsBajoMinimo ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 text-[10px] font-bold rounded-full bg-orange-500 text-white px-1">
                {bi.resumen!.itemsBajoMinimo}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="finanzas">
            Finanzas
            {(bi.resumen?.cxpVencido ?? 0) > 0 && (
              <span className="ml-1.5 h-2 w-2 rounded-full bg-red-500 inline-block" />
            )}
          </TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4">
          <TabResumen
            resumen={bi.resumen}
            citasTimeline={bi.citasTimeline}
            farmaciaTimeline={bi.farmaciaTimeline}
            citasPorOrigen={bi.citasPorOrigen}
            citasPorDoctor={bi.citasPorDoctor}
            loading={bi.loading}
          />
        </TabsContent>

        <TabsContent value="agenda" className="mt-4">
          <TabAgenda
            citasTimeline={bi.citasTimeline}
            citasPorDoctor={bi.citasPorDoctor}
            resumen={bi.resumen}
            heatmap={bi.heatmap}
            loading={bi.loading}
          />
        </TabsContent>

        <TabsContent value="farmacia" className="mt-4">
          <TabFarmacia
            farmaciaTimeline={bi.farmaciaTimeline}
            top10Farmacia={bi.top10Farmacia}
            resumen={bi.resumen}
            loading={bi.loading}
          />
        </TabsContent>

        <TabsContent value="inventario" className="mt-4">
          <TabInventario
            stockAlertas={bi.stockAlertas}
            lotesPorVencer={bi.lotesPorVencer}
            loading={bi.loading}
          />
        </TabsContent>

        <TabsContent value="finanzas" className="mt-4">
          <TabFinanzas
            resumen={bi.resumen}
            botCanalCostos={bi.botCanalCostos}
            loading={bi.loading}
          />
        </TabsContent>

        <TabsContent value="compras" className="mt-4">
          <TabCompras />
        </TabsContent>
      </Tabs>
    </div>
  );
}
