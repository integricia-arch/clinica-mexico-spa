import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  TrendingUp, TrendingDown, RefreshCw, CalendarDays,
  ShoppingCart, Users, AlertTriangle, Pill, DollarSign,
  Activity, BarChart2,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useBI, Periodo, DiaCount, DiaVenta, OrigenCount, DoctorCount, Top10Producto, HeatmapCell } from "@/hooks/useBI";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

function pctDelta(current: number, prev: number): number {
  if (prev === 0) return 0;
  return Math.round(((current - prev) / prev) * 100);
}

function tickDia(v: string): string {
  try { return format(new Date(v + "T12:00:00"), "d/M"); } catch { return v; }
}

const ORIGEN_LABELS: Record<string, string> = {
  web: "Web",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  bot: "Bot",
  walk_in: "Presencial",
  directo: "Directo",
  desconocido: "Desconocido",
};

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string | number;
  prev?: number;
  current?: number;
  icon: React.ReactNode;
  iconBg: string;
  suffix?: string;
  lowIsBetter?: boolean;
}

function KpiCard({ title, value, prev, current, icon, iconBg, suffix, lowIsBetter }: KpiCardProps) {
  const delta = prev !== undefined && current !== undefined ? pctDelta(current, prev) : null;
  const isPositive = delta === null ? true : lowIsBetter ? delta <= 0 : delta >= 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold mt-0.5">
              {value}
              {suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
            </p>
            {delta !== null && (
              <p className={`flex items-center gap-1 text-xs mt-1 ${isPositive ? "text-green-600" : "text-red-600"}`}>
                {isPositive
                  ? <TrendingUp className="h-3 w-3" />
                  : <TrendingDown className="h-3 w-3" />}
                {Math.abs(delta)}% vs período ant.
              </p>
            )}
          </div>
          <div className={`shrink-0 rounded-lg p-2 ${iconBg}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section skeleton ─────────────────────────────────────────────────────────

function ChartSkeleton() {
  return <Skeleton className="h-64 w-full rounded-xl" />;
}

// ─── Heatmap citas hora × día ─────────────────────────────────────────────────

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HORAS_INICIO = 7;
const HORAS_FIN = 21;

function CitasHeatmap({ heatmap }: { heatmap: HeatmapCell[] }) {
  const maxCount = Math.max(1, ...heatmap.map(c => c.count));
  const cellMap = new Map<string, number>();
  heatmap.forEach(c => cellMap.set(`${c.hora}-${c.dia}`, c.count));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Citas por hora y día</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `40px repeat(7, 1fr)` }}>
            <div />
            {DIAS.map(d => (
              <div key={d} className="text-center text-[10px] text-muted-foreground font-medium pb-1">{d}</div>
            ))}
            {Array.from({ length: HORAS_FIN - HORAS_INICIO }, (_, i) => {
              const hora = HORAS_INICIO + i;
              const label = hora < 12 ? `${hora}am` : hora === 12 ? "12pm" : `${hora - 12}pm`;
              return [
                <div key={`h-${hora}`} className="text-[10px] text-muted-foreground text-right pr-1.5 leading-5">{label}</div>,
                ...Array.from({ length: 7 }, (_, dia) => {
                  const count = cellMap.get(`${hora}-${dia}`) ?? 0;
                  const intensity = count / maxCount;
                  const bg = count === 0
                    ? "bg-muted"
                    : intensity < 0.25
                    ? "bg-blue-100"
                    : intensity < 0.5
                    ? "bg-blue-300"
                    : intensity < 0.75
                    ? "bg-blue-500"
                    : "bg-blue-700";
                  return (
                    <div
                      key={`${hora}-${dia}`}
                      className={`h-5 rounded-sm ${bg} cursor-default`}
                      title={count > 0 ? `${DIAS[dia]} ${label}: ${count} citas` : undefined}
                    />
                  );
                }),
              ];
            })}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[10px] text-muted-foreground">Menos</span>
            {["bg-muted", "bg-blue-100", "bg-blue-300", "bg-blue-500", "bg-blue-700"].map(c => (
              <div key={c} className={`h-3 w-5 rounded-sm ${c}`} />
            ))}
            <span className="text-[10px] text-muted-foreground">Más</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tab: Resumen ─────────────────────────────────────────────────────────────

function TabResumen({
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

// ─── Tab: Agenda ──────────────────────────────────────────────────────────────

function TabAgenda({ citasTimeline, citasPorDoctor, resumen, heatmap, loading }: {
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
        <KpiCard title="Retención ≤90d" value={`${resumen.tasaRetencion}%`} icon={<Users className="h-4 w-4 text-violet-600" />} iconBg="bg-violet-100" />
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

// ─── Tab: Farmacia ────────────────────────────────────────────────────────────

function TabFarmacia({ farmaciaTimeline, top10Farmacia, resumen, loading }: {
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

// ─── Tab: Inventario ──────────────────────────────────────────────────────────

function TabInventario({ stockAlertas, lotesPorVencer, loading }: {
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

// ─── Tab: Finanzas ────────────────────────────────────────────────────────────

function TabFinanzas({ resumen, loading }: {
  resumen: ReturnType<typeof useBI>["resumen"];
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
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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
            loading={bi.loading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
