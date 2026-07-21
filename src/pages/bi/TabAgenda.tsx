import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Activity, TrendingDown, Users } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DiaCount, DoctorCount, HeatmapCell, useBI } from "@/hooks/useBI";
import { tickDia, KpiCard, ChartSkeleton } from "./shared";
import { CitasHeatmap } from "./CitasHeatmap";

export function TabAgenda({ citasTimeline, citasPorDoctor, resumen, heatmap, loading }: {
  citasTimeline: DiaCount[];
  citasPorDoctor: DoctorCount[];
  resumen: ReturnType<typeof useBI>["resumen"];
  heatmap: HeatmapCell[];
  loading: boolean;
}) {
  if (loading) return <div className="space-y-4"><ChartSkeleton /><ChartSkeleton /></div>;
  if (!resumen) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total citas" value={resumen.citasMes} icon={<CalendarDays className="h-4 w-4 text-blue-600" />} iconBg="bg-blue-100" />
        <KpiCard title="Confirmadas" value={resumen.citasConfirmadas} icon={<Activity className="h-4 w-4 text-green-600" />} iconBg="bg-green-100" />
        <KpiCard title="Tasa cancelación" value={`${resumen.tasaCancelacion}%`} icon={<TrendingDown className="h-4 w-4 text-amber-600" />} iconBg="bg-amber-100" lowIsBetter />
        <KpiCard title="Tasa no-show" value={`${resumen.tasaNoShow}%`} icon={<TrendingDown className="h-4 w-4 text-red-600" />} iconBg="bg-red-100" lowIsBetter />
        <KpiCard title="Pac. frecuentes" value={`${resumen.tasaRetencion}%`} icon={<Users className="h-4 w-4 text-violet-600" />} iconBg="bg-violet-100" suffix="≥2 citas/período" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Evolución de citas</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={citasTimeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickFormatter={tickDia} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip labelFormatter={v => format(new Date(v + "T12:00:00"), "d 'de' MMMM yyyy", { locale: es })} />
              <Legend />
              <Line dataKey="total" name="Total" stroke="hsl(var(--chart-1))" dot={false} strokeWidth={2} />
              <Line dataKey="confirmadas" name="Confirmadas" stroke="hsl(var(--chart-2))" dot={false} strokeWidth={1.5} />
              <Line dataKey="canceladas" name="Canceladas" stroke="hsl(var(--chart-4))" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {citasPorDoctor.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rendimiento por médico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Médico</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Total</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Confirmadas</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">% Confirm.</th>
                  </tr>
                </thead>
                <tbody>
                  {citasPorDoctor.map(d => (
                    <tr key={d.doctor_id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4">{d.nombre}</td>
                      <td className="py-2 pr-4 text-right font-medium">{d.total}</td>
                      <td className="py-2 pr-4 text-right">{d.confirmadas}</td>
                      <td className="py-2 text-right">
                        <Badge variant={d.total > 0 && (d.confirmadas / d.total) >= 0.7 ? "default" : "secondary"}>
                          {d.total > 0 ? Math.round((d.confirmadas / d.total) * 100) : 0}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {heatmap.length > 0 && <CitasHeatmap heatmap={heatmap} />}
    </div>
  );
}
