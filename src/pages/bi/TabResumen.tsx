import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, ShoppingCart, Users, TrendingDown, Pill, AlertTriangle } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DiaCount, DiaVenta, OrigenCount, DoctorCount, useBI } from "@/hooks/useBI";
import { fmtMXN, tickDia, ORIGEN_LABELS, PIE_COLORS, KpiCard, ChartSkeleton } from "./shared";

export function TabResumen({
  resumen, citasTimeline, farmaciaTimeline, citasPorOrigen, citasPorDoctor, loading,
}: {
  resumen: ReturnType<typeof useBI>["resumen"];
  citasTimeline: DiaCount[];
  farmaciaTimeline: DiaVenta[];
  citasPorOrigen: OrigenCount[];
  citasPorDoctor: DoctorCount[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }
  if (!resumen) return null;

  const origenData = citasPorOrigen.map(o => ({
    name: ORIGEN_LABELS[o.origen] ?? o.origen,
    value: o.total,
  }));

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard
          title="Citas en período"
          value={resumen.citasMes}
          current={resumen.citasMes}
          prev={resumen.citasMesAnterior}
          icon={<CalendarDays className="h-4 w-4 text-blue-600" />}
          iconBg="bg-blue-100"
        />
        <KpiCard
          title="Ventas farmacia"
          value={fmtMXN(resumen.ventasMes)}
          current={resumen.ventasMes}
          prev={resumen.ventasMesAnterior}
          icon={<ShoppingCart className="h-4 w-4 text-emerald-600" />}
          iconBg="bg-emerald-100"
        />
        <KpiCard
          title="Pacientes nuevos"
          value={resumen.pacientesNuevosMes}
          icon={<Users className="h-4 w-4 text-violet-600" />}
          iconBg="bg-violet-100"
          suffix={`/ ${resumen.totalPacientes} total`}
        />
        <KpiCard
          title="% Cancelación"
          value={`${resumen.tasaCancelacion}%`}
          icon={<TrendingDown className="h-4 w-4 text-amber-600" />}
          iconBg="bg-amber-100"
          lowIsBetter
        />
        <KpiCard
          title="Stock bajo mínimo"
          value={resumen.itemsBajoMinimo}
          icon={<Pill className="h-4 w-4 text-orange-600" />}
          iconBg="bg-orange-100"
          suffix={`+ ${resumen.lotesPorVencer30d} vencen en 30d`}
          lowIsBetter
        />
        <KpiCard
          title="CxP vencido"
          value={fmtMXN(resumen.cxpVencido)}
          icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
          iconBg="bg-red-100"
          suffix={`de ${fmtMXN(resumen.cxpPendiente)} total`}
          lowIsBetter
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Citas por día</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={citasTimeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickFormatter={tickDia} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip labelFormatter={v => format(new Date(v + "T12:00:00"), "d 'de' MMMM yyyy", { locale: es })} />
                <Line dataKey="total" name="Total" stroke="hsl(var(--chart-1))" dot={false} strokeWidth={2} />
                <Line dataKey="confirmadas" name="Confirmadas" stroke="hsl(var(--chart-2))" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ventas farmacia por día</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={farmaciaTimeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickFormatter={tickDia} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  labelFormatter={v => format(new Date(v + "T12:00:00"), "d 'de' MMMM yyyy", { locale: es })}
                  formatter={(v: number) => [fmtMXN(v), "Ventas"]}
                />
                <Bar dataKey="total" name="Ventas" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Distribution row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {origenData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Citas por canal de origen</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={origenData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                    {origenData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {citasPorDoctor.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Citas por médico</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={citasPorDoctor.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="total" name="Total" fill="hsl(var(--chart-3))" radius={[0, 2, 2, 0]} />
                  <Bar dataKey="confirmadas" name="Confirmadas" fill="hsl(var(--chart-2))" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
