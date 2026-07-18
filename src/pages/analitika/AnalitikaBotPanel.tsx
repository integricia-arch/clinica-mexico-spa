import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TrendingUp, MessageCircle, AlertTriangle, Users, CheckCircle, Gift, Bell } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useBotAnalitika, SentimentoTrend, KPI } from "@/hooks/useBotAnalitika";

function KpiCard({ title, value, icon, iconBg, suffix }: {
  title: string; value: string | number; icon: React.ReactNode; iconBg: string; suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-0.5">
              {value}
              {suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
            </p>
          </div>
          <div className={`shrink-0 rounded-lg p-2 ${iconBg}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return <Skeleton className="h-64 w-full rounded-xl" />;
}

export default function AnalitikaBotPanel() {
  const { user } = useAuth();
  const { clinic } = useActiveClinic();
  const { loading, sentimentoTrend, kpi } = useBotAnalitika(clinic?.id ?? null);

  if (!user || !clinic) return <div className="p-6">Sin acceso</div>;

  const chartColors = {
    positivo: "hsl(var(--chart-1))",
    neutral: "hsl(var(--chart-3))",
    negativo: "hsl(var(--chart-2))",
    enojado: "hsl(var(--chart-5))",
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Analítica Bot Telegram</h1>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </div>
      ) : kpi ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              title="Conversaciones"
              value={kpi.totalConversaciones}
              icon={<MessageCircle className="h-4 w-4 text-blue-600" />}
              iconBg="bg-blue-100"
            />
            <KpiCard
              title="Sentimiento positivo"
              value={`${kpi.sentimientoPositivo}%`}
              icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
              iconBg="bg-emerald-100"
            />
            <KpiCard
              title="Contención (sin escalada)"
              value={`${kpi.contencionPct}%`}
              icon={<CheckCircle className="h-4 w-4 text-violet-600" />}
              iconBg="bg-violet-100"
            />
            <KpiCard
              title="Citas creadas"
              value={`${kpi.citasCreadasPct}%`}
              icon={<Users className="h-4 w-4 text-amber-600" />}
              iconBg="bg-amber-100"
            />
          </div>

          {/* Charts */}
          <Tabs defaultValue="sentimiento" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="sentimiento">Sentimiento</TabsTrigger>
              <TabsTrigger value="fricciones">Fricciones</TabsTrigger>
              <TabsTrigger value="features">Feature Requests</TabsTrigger>
              <TabsTrigger value="efectividad">Efectividad</TabsTrigger>
            </TabsList>

            <TabsContent value="sentimiento" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Sentimiento por semana</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={sentimentoTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        labelFormatter={(v) => `Semana de ${v}`}
                        formatter={(value: number) => [value, ""]}
                      />
                      <Legend />
                      <Line dataKey="positivo" name="Positivo" stroke={chartColors.positivo} dot={false} strokeWidth={2} />
                      <Line dataKey="neutral" name="Neutral" stroke={chartColors.neutral} dot={false} strokeWidth={2} />
                      <Line dataKey="negativo" name="Negativo" stroke={chartColors.negativo} dot={false} strokeWidth={2} />
                      <Line dataKey="enojado" name="Enojado" stroke={chartColors.enojado} dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fricciones" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Top 5 fricciones reportadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={kpi.friccionesTop5}
                      margin={{ top: 4, right: 4, left: 0, bottom: 40 }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="friccion" type="category" tick={{ fontSize: 10 }} width={200} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="features" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Top 5 mejoras solicitadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={kpi.quiereTop5}
                      margin={{ top: 4, right: 4, left: 0, bottom: 40 }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="friccion" type="category" tick={{ fontSize: 10 }} width={200} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="efectividad" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" /> Aceptación promociones
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-3xl font-bold">
                    {kpi.promocionesAceptadasPct}%
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Bell className="h-4 w-4" /> Citas confirmadas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-3xl font-bold">
                    {kpi.citasCreadasPct}%
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Sin datos de análisis</p>
        </div>
      )}
    </div>
  );
}
