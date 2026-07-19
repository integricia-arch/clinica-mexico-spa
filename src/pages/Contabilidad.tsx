import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DollarSign, TrendingUp, TrendingDown, Wallet, AlertTriangle, Download, Plus, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useContabilidad, PeriodoContable } from "@/hooks/useContabilidad";
import { RegistrarEgresoModal } from "@/features/contabilidad/RegistrarEgresoModal";
import { exportContabilidadCsv } from "@/features/contabilidad/exportContabilidadCsv";
import { PolizasTab } from "@/features/contabilidad/PolizasTab";
import { CatalogosTab } from "@/features/contabilidad/CatalogosTab";
import { ReportesTab } from "@/features/contabilidad/ReportesTab";
import { CierreTab } from "@/features/contabilidad/CierreTab";
import { BancosTab } from "@/features/contabilidad/BancosTab";

function fmtMXN(centavos: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(centavos / 100);
}

function fmtMes(iso: string) {
  try { return format(new Date(iso + "T12:00:00"), "MMM yyyy", { locale: es }); } catch { return iso; }
}

const PERIODO_LABELS: Record<PeriodoContable, string> = {
  mes_actual: "Este mes",
  "3_meses": "Últimos 3 meses",
  "6_meses": "Últimos 6 meses",
  anio: "Este año",
};

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  warn?: boolean;
}

function KpiCard({ title, value, icon, iconBg, warn }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            <p className={`text-xl font-bold mt-0.5 ${warn ? "text-red-600" : ""}`}>{value}</p>
          </div>
          <div className={`shrink-0 rounded-lg p-2 ${iconBg}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Contabilidad() {
  const [periodo, setPeriodo] = useState<PeriodoContable>("3_meses");
  const [modalOpen, setModalOpen] = useState(false);
  const { loading, error, pnl, flujo, kpis, refresh } = useContabilidad(periodo);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Contabilidad</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Estado de resultados, flujo de efectivo y KPIs financieros</p>
      </div>

      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="polizas">Pólizas</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
          <TabsTrigger value="cierre">Cierre</TabsTrigger>
          <TabsTrigger value="bancos">Bancos</TabsTrigger>
          <TabsTrigger value="catalogos">Catálogos</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoContable)}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIODO_LABELS) as PeriodoContable[]).map((p) => (
                <SelectItem key={p} value={p}>{PERIODO_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading} className="h-8 gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportContabilidadCsv(pnl, flujo)}
            disabled={pnl.length === 0 && flujo.length === 0}
            className="h-8 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
          <Button size="sm" onClick={() => setModalOpen(true)} className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Registrar egreso
          </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Error cargando datos: {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : kpis ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Ingresos totales" value={fmtMXN(kpis.ingresos_totales_centavos)} icon={<DollarSign className="h-4 w-4 text-emerald-600" />} iconBg="bg-emerald-100" />
          <KpiCard title="Utilidad bruta" value={`${fmtMXN(kpis.utilidad_bruta_centavos)} (${kpis.margen_bruto_pct ?? 0}%)`} icon={<TrendingUp className="h-4 w-4 text-blue-600" />} iconBg="bg-blue-100" />
          <KpiCard title="Utilidad neta" value={`${fmtMXN(kpis.utilidad_neta_centavos)} (${kpis.margen_neto_pct ?? 0}%)`} icon={<TrendingUp className="h-4 w-4 text-violet-600" />} iconBg="bg-violet-100" />
          <KpiCard title="Flujo operativo" value={fmtMXN(kpis.flujo_operativo_centavos)} icon={<Wallet className="h-4 w-4 text-cyan-600" />} iconBg="bg-cyan-100" warn={kpis.flujo_operativo_centavos < 0} />
          <KpiCard
            title="Punto de equilibrio"
            value={kpis.punto_equilibrio_centavos != null ? fmtMXN(kpis.punto_equilibrio_centavos) : "No calculable"}
            icon={<TrendingDown className="h-4 w-4 text-amber-600" />}
            iconBg="bg-amber-100"
          />
          <KpiCard title="CxP vencidas" value={fmtMXN(kpis.cxp_vencidas_centavos)} icon={<AlertTriangle className="h-4 w-4 text-red-600" />} iconBg="bg-red-100" warn={kpis.cxp_vencidas_centavos > 0} />
          <KpiCard title="CxC pendientes" value={fmtMXN(kpis.cxc_pendientes_centavos)} icon={<AlertTriangle className="h-4 w-4 text-orange-600" />} iconBg="bg-orange-100" />
          <KpiCard
            title="Costo insumos / cita"
            value={kpis.costo_insumos_por_cita_centavos != null ? fmtMXN(kpis.costo_insumos_por_cita_centavos) : "Sin datos"}
            icon={<DollarSign className="h-4 w-4 text-slate-600" />}
            iconBg="bg-slate-100"
          />
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Estado de resultados (P&L) por mes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : pnl.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin movimientos en el período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Mes</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Ingresos</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Costo ventas</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Utilidad bruta</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Gastos oper.</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Utilidad neta</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Margen neto</th>
                  </tr>
                </thead>
                <tbody>
                  {pnl.map((m) => (
                    <tr key={m.mes} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4 font-medium capitalize">{fmtMes(m.mes)}</td>
                      <td className="py-2 pr-4 text-right">{fmtMXN(m.ingresos_centavos)}</td>
                      <td className="py-2 pr-4 text-right">{fmtMXN(m.costo_ventas_centavos)}</td>
                      <td className="py-2 pr-4 text-right">{fmtMXN(m.utilidad_bruta_centavos)}</td>
                      <td className="py-2 pr-4 text-right">{fmtMXN(m.gastos_operativos_centavos)}</td>
                      <td className={`py-2 pr-4 text-right font-medium ${m.utilidad_neta_centavos < 0 ? "text-red-600" : ""}`}>
                        {fmtMXN(m.utilidad_neta_centavos)}
                      </td>
                      <td className="py-2 text-right">{m.margen_neto_pct != null ? `${m.margen_neto_pct}%` : "—"}</td>
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
          <CardTitle className="text-sm">Flujo de efectivo por mes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : flujo.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin movimientos en el período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Mes</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Cobros</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Pagos</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Flujo neto</th>
                  </tr>
                </thead>
                <tbody>
                  {flujo.map((m) => (
                    <tr key={m.mes} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4 font-medium capitalize">{fmtMes(m.mes)}</td>
                      <td className="py-2 pr-4 text-right">{fmtMXN(m.cobros_centavos)}</td>
                      <td className="py-2 pr-4 text-right">{fmtMXN(m.pagos_centavos)}</td>
                      <td className={`py-2 text-right font-medium ${m.flujo_neto_centavos < 0 ? "text-red-600" : ""}`}>
                        {fmtMXN(m.flujo_neto_centavos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <RegistrarEgresoModal open={modalOpen} onOpenChange={setModalOpen} onSaved={refresh} />
        </TabsContent>

        <TabsContent value="polizas">
          <PolizasTab />
        </TabsContent>

        <TabsContent value="reportes">
          <ReportesTab />
        </TabsContent>

        <TabsContent value="cierre">
          <CierreTab />
        </TabsContent>

        <TabsContent value="bancos">
          <BancosTab />
        </TabsContent>

        <TabsContent value="catalogos">
          <CatalogosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
