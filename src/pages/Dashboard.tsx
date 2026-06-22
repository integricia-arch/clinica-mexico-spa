import { CalendarDays, Users, Receipt, AlertCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import StatCard from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardHoy } from "@/hooks/useDashboardHoy";

// ─── Status color map ─────────────────────────────────────────────────────────

const estadoColor: Record<string, string> = {
  "Confirmada":              "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  "Confirmada por paciente": "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  "Confirmada por médico":   "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  "Pendiente de formulario": "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  "Recordatorio enviado":    "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20",
  "Solicitada":              "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-500/20",
  "Cancelada":               "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  "Tentativa":               "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-500/20",
  "Liberada":                "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-500/20",
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
        <p className="text-sm text-muted-foreground">No se pudo cargar el panel. Por favor intenta de nuevo.</p>
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground/60">
          {fechaCapital}
        </p>
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
          Panel principal
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          index={0}
          icon={CalendarDays}
          title="Citas hoy"
          value={String(data.totalCitasHoy)}
          change={data.totalCitasHoy === 0 ? "Sin citas programadas" : `${data.citasSinConfirmar} sin confirmar`}
          changeType={data.citasSinConfirmar > 0 ? "negative" : "positive"}
        />
        <StatCard
          index={1}
          icon={Users}
          title="Pacientes activos"
          value={data.totalPacientes.toLocaleString("es-MX")}
          change="Total registrados activos"
          changeType="neutral"
        />
        <StatCard
          index={2}
          icon={Receipt}
          title="Ingresos del día"
          value={formatIngresosHoy(data.ingresosHoy)}
          change="Ventas farmacia completadas hoy"
          changeType={data.ingresosHoy > 0 ? "positive" : "neutral"}
        />
        <StatCard
          index={3}
          icon={AlertCircle}
          title="Alertas de stock"
          value={String(data.alertasPendientes)}
          change={data.alertasPendientes === 0 ? "Sin alertas pendientes" : "Requieren atención"}
          changeType={data.alertasPendientes > 0 ? "negative" : "positive"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Agenda del día */}
        <div className="lg:col-span-2 rounded-xl bg-card shadow-[0_1px_2px_hsl(222_47%_7%/0.05),0_4px_16px_hsl(222_47%_7%/0.04),inset_0_0.5px_0_hsl(0_0%_100%/0.85),inset_0_0_0_1px_hsl(228_20%_91%)]">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display font-semibold text-card-foreground">Agenda de hoy</h2>
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
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-indigo-50/40 transition-colors duration-100"
                >
                  <span className="w-12 shrink-0 text-xs font-semibold text-indigo-500/60 [font-variant-numeric:tabular-nums]">
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
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium [font-variant-numeric:tabular-nums] ${
                      estadoColor[cita.estado] ?? "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-500/20"
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
        <div className="rounded-xl bg-card shadow-[0_1px_2px_hsl(222_47%_7%/0.05),0_4px_16px_hsl(222_47%_7%/0.04),inset_0_0.5px_0_hsl(0_0%_100%/0.85),inset_0_0_0_1px_hsl(228_20%_91%)]">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display font-semibold text-card-foreground">Actividad reciente</h2>
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
                  <p className="mt-1 text-xs text-muted-foreground [font-variant-numeric:tabular-nums]">{item.tiempo}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Banner alertas pendientes */}
      {data.citasSinConfirmar > 0 && (
        <div className="rounded-xl ring-1 ring-inset ring-amber-400/25 bg-amber-50/60 p-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
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
