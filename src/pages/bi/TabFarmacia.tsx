import { es } from "date-fns/locale";
import { format } from "date-fns";
import { DollarSign, BarChart2, ShoppingCart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DiaVenta, Top10Producto, useBI } from "@/hooks/useBI";
import { fmtMXN, tickDia, KpiCard, ChartSkeleton } from "./shared";

export function TabFarmacia({ farmaciaTimeline, top10Farmacia, resumen, loading }: {
  farmaciaTimeline: DiaVenta[];
  top10Farmacia: Top10Producto[];
  resumen: ReturnType<typeof useBI>["resumen"];
  loading: boolean;
}) {
  if (loading) return <div className="space-y-4"><ChartSkeleton /></div>;
  if (!resumen) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          title="Ventas en período"
          value={fmtMXN(resumen.ventasMes)}
          current={resumen.ventasMes}
          prev={resumen.ventasMesAnterior}
          icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
          iconBg="bg-emerald-100"
        />
        <KpiCard
          title="Ticket promedio"
          value={fmtMXN(resumen.ticketPromedio)}
          icon={<BarChart2 className="h-4 w-4 text-blue-600" />}
          iconBg="bg-blue-100"
        />
        <KpiCard
          title="Transacciones"
          value={resumen.transaccionesMes}
          icon={<ShoppingCart className="h-4 w-4 text-violet-600" />}
          iconBg="bg-violet-100"
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Ventas diarias</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={farmaciaTimeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickFormatter={tickDia} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                labelFormatter={v => format(new Date(v + "T12:00:00"), "d 'de' MMMM yyyy", { locale: es })}
                formatter={(v: number, name: string) => [
                  name === "total" ? fmtMXN(v) : v,
                  name === "total" ? "Ventas" : "Transacciones",
                ]}
              />
              <Bar dataKey="total" name="total" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {farmaciaTimeline.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Transacciones diarias</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={farmaciaTimeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickFormatter={tickDia} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip labelFormatter={v => format(new Date(v + "T12:00:00"), "d/MM", { locale: es })} />
                <Bar dataKey="transacciones" name="Transacciones" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {top10Farmacia.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top 10 productos por ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(160, top10Farmacia.length * 32)}>
              <BarChart
                layout="vertical"
                data={top10Farmacia}
                margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  tick={{ fontSize: 10 }}
                  width={120}
                  tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 15) + "…" : v}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    name === "total" ? fmtMXN(v) : `${v} uds`,
                    name === "total" ? "Ingresos" : "Unidades",
                  ]}
                />
                <Bar dataKey="total" name="total" fill="hsl(var(--chart-1))" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
