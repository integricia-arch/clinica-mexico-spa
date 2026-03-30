import { CalendarDays, Users, Receipt, Clock, TrendingUp, AlertCircle } from "lucide-react";
import StatCard from "@/components/StatCard";

const citasHoy = [
  { hora: "09:00", paciente: "María González Hernández", medico: "Dr. Carlos Mendoza", tipo: "Consulta general", estado: "Confirmada" },
  { hora: "09:30", paciente: "José Luis Pérez Vargas", medico: "Dra. Ana Ramírez", tipo: "Seguimiento", estado: "Confirmada por paciente" },
  { hora: "10:00", paciente: "Guadalupe Torres Reyes", medico: "Dr. Carlos Mendoza", tipo: "Primera vez", estado: "Pendiente de formulario" },
  { hora: "10:30", paciente: "Roberto Sánchez Díaz", medico: "Dra. Laura Ortiz", tipo: "Estudios", estado: "Recordatorio enviado" },
  { hora: "11:00", paciente: "Fernanda Castillo López", medico: "Dra. Ana Ramírez", tipo: "Consulta general", estado: "Solicitada" },
  { hora: "11:30", paciente: "Miguel Ángel Ruiz Flores", medico: "Dr. Carlos Mendoza", tipo: "Seguimiento", estado: "Confirmada" },
];

const estadoColor: Record<string, string> = {
  "Confirmada": "bg-success/10 text-success",
  "Confirmada por paciente": "bg-success/10 text-success",
  "Confirmada por médico": "bg-success/10 text-success",
  "Pendiente de formulario": "bg-warning/10 text-warning",
  "Recordatorio enviado": "bg-info/10 text-info",
  "Solicitada": "bg-muted text-muted-foreground",
  "Cancelada": "bg-destructive/10 text-destructive",
};

const actividadReciente = [
  { texto: "Factura generada para María González — $2,450.00 MXN", tiempo: "Hace 12 min" },
  { texto: "Cita confirmada por José Luis Pérez", tiempo: "Hace 25 min" },
  { texto: "Receta emitida para Roberto Sánchez por Dra. Ortiz", tiempo: "Hace 40 min" },
  { texto: "Nuevo paciente registrado: Fernanda Castillo López", tiempo: "Hace 1 h" },
  { texto: "Recordatorio enviado a Guadalupe Torres", tiempo: "Hace 1 h 30 min" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-display text-2xl font-bold text-foreground">Panel principal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen de operaciones — Lunes 30 de marzo, 2026
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} title="Citas hoy" value="24" change="+3 vs. lunes pasado" changeType="positive" />
        <StatCard icon={Users} title="Pacientes activos" value="1,847" change="+12 este mes" changeType="positive" />
        <StatCard icon={Receipt} title="Ingresos del día" value="$38,420 MXN" change="+8.2% vs. promedio" changeType="positive" />
        <StatCard icon={Clock} title="Espera promedio" value="14 min" change="-2 min vs. ayer" changeType="positive" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Citas del día */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-display font-semibold text-card-foreground">Agenda de hoy</h2>
            <span className="text-xs font-medium text-muted-foreground">6 citas programadas</span>
          </div>
          <div className="divide-y divide-border">
            {citasHoy.map((cita, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors">
                <span className="w-12 shrink-0 text-sm font-semibold text-foreground">{cita.hora}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-card-foreground">{cita.paciente}</p>
                  <p className="truncate text-xs text-muted-foreground">{cita.medico} · {cita.tipo}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${estadoColor[cita.estado] || "bg-muted text-muted-foreground"}`}>
                  {cita.estado}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actividad reciente */}
        <div className="rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-display font-semibold text-card-foreground">Actividad reciente</h2>
          </div>
          <div className="divide-y divide-border">
            {actividadReciente.map((item, i) => (
              <div key={i} className="px-5 py-3.5">
                <p className="text-sm text-card-foreground leading-snug">{item.texto}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.tiempo}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alertas */}
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Recordatorios pendientes</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            3 pacientes no han confirmado su cita de mañana. Se recomienda contactarlos por teléfono.
          </p>
        </div>
      </div>
    </div>
  );
}
