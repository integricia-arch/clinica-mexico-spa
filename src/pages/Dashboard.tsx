import { CalendarDays, Users, Receipt, AlertCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import StatCard from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardHoy } from "@/hooks/useDashboardHoy";

// ─── Status color map ─────────────────────────────────────────────────────────

const estadoColor: Record<string, string> = {
  "Confirmada": "bg-success/10 text-success",
  "Confirmada por paciente": "bg-success/10 text-success",
  "Confirmada por médico": "bg-success/10 text-success",
  "Pendiente de formulario": "bg-warning/10 text-warning",
  "Recordatorio enviado": "bg-info/10 text-info",
  "Solicitada": "bg-muted text-muted-foreground",
  "Cancelada": "bg-destructive/10 text-destructive",
  "Tentativa": "bg-muted text-muted-foreground",
  "Liberada": "bg-muted text-muted-foreground",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="lg:col-span-2 h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatIngresosHoy(centavos: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(centavos / 100);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const data = useDashboardHoy();

  const fechaHoy = format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es });
  const fechaCapital = fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1);

  if (data.loading) return <DashboardSkeleton />;

  if (data.error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{data.error}</p>
        <button
          onClick={data.refresh}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-display text-2xl font-bold text-foreground">Panel principal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen de operaciones — {fechaCapital}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          title="Citas hoy"
          value={String(data.totalCitasHoy)}
          change={data.totalCitasHoy === 0 ? "Sin citas programadas" : `${data.citasSinConfirmar} sin confirmar`}
          changeType={data.citasSinConfirmar > 0 ? "negative" : "positive"}
        />
        <StatCard
          icon={Users}
          title="Pacientes activos"
          value={data.totalPacientes.toLocaleString("es-MX")}
          change="Total registrados activos"
          changeType="positive"
        />
        <StatCard
          icon={Receipt}
          title="Ingresos del día"
          value={formatIngresosHoy(data.ingresosHoy)}
          change="Ventas farmacia completadas hoy"
          changeType="positive"
        />
        <StatCard
          icon={AlertCircle}
          title="Alertas de stock"
          value={String(data.alertasPendientes)}
          change={data.alertasPendientes === 0 ? "Sin alertas pendientes" : "Requieren atención"}
          changeType={data.alertasPendientes > 0 ? "negative" : "positive"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Agenda del día */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-display font-semibold text-card-foreground">Agenda de hoy</h2>
            <span className="text-xs font-medium text-muted-foreground">
              {data.totalCitasHoy} {data.totalCitasHoy === 1 ? "cita programada" : "citas programadas"}
            </span>
          </div>
          {data.citasHoy.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Sin citas programadas para hoy
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.citasHoy.map((cita) => (
                <div
                  key={cita.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors"
                >
                  <span className="w-12 shrink-0 text-sm font-semibold text-foreground">
                    {cita.hora}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-card-foreground">
                      {cita.paciente}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {cita.medico} · {cita.tipo}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      estadoColor[cita.estado] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {cita.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actividad reciente */}
        <div className="rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-display font-semibold text-card-foreground">Actividad reciente</h2>
          </div>
          {data.actividadReciente.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Sin actividad registrada hoy
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.actividadReciente.map((item) => (
                <div key={item.id} className="px-5 py-3.5">
                  <p className="text-sm text-card-foreground leading-snug">{item.texto}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.tiempo}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Banner alertas pendientes */}
      {data.citasSinConfirmar > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Recordatorios pendientes</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.citasSinConfirmar}{" "}
              {data.citasSinConfirmar === 1 ? "cita no ha" : "citas no han"} sido{" "}
              {data.citasSinConfirmar === 1 ? "confirmada" : "confirmadas"} para hoy.
              Se recomienda contactar a {data.citasSinConfirmar === 1 ? "al paciente" : "los pacientes"} por teléfono.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
