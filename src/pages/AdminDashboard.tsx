import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import StatCard from "@/components/StatCard";
import { Users, CalendarDays, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ pacientes: 0, citasHoy: 0, pendientes: 0, canceladas: 0 });
  const [citasRecientes, setCitasRecientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const [patientsRes, todayRes, pendingRes, cancelledRes, recentRes] = await Promise.all([
        supabase.from("patients").select("id", { count: "exact", head: true }),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .gte("fecha_inicio", startOfDay).lt("fecha_inicio", endOfDay),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .in("status", ["solicitada", "tentativa", "pendiente_formulario"]),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .eq("status", "cancelada"),
        supabase.from("appointments").select("*, doctors(nombre, apellidos, especialidad), patients(nombre, apellidos)")
          .gte("fecha_inicio", startOfDay).order("fecha_inicio", { ascending: true }).limit(10),
      ]);

      setStats({
        pacientes: patientsRes.count ?? 0,
        citasHoy: todayRes.count ?? 0,
        pendientes: pendingRes.count ?? 0,
        canceladas: cancelledRes.count ?? 0,
      });
      setCitasRecientes(recentRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const statusLabel: Record<string, string> = {
    solicitada: "Solicitada",
    tentativa: "Tentativa",
    pendiente_formulario: "Pend. formulario",
    confirmada: "Confirmada",
    recordatorio_enviado: "Recordatorio enviado",
    confirmada_paciente: "Conf. paciente",
    confirmada_medico: "Conf. médico",
    cancelada: "Cancelada",
    liberada: "Liberada",
  };

  const statusColor: Record<string, string> = {
    solicitada: "bg-warning/10 text-warning",
    confirmada: "bg-success/10 text-success",
    confirmada_paciente: "bg-success/10 text-success",
    confirmada_medico: "bg-success/10 text-success",
    cancelada: "bg-destructive/10 text-destructive",
    pendiente_formulario: "bg-info/10 text-info",
    tentativa: "bg-muted text-muted-foreground",
    recordatorio_enviado: "bg-info/10 text-info",
    liberada: "bg-muted text-muted-foreground",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-2xl font-bold text-foreground">Panel de administración</h1>
        <p className="mt-1 text-sm text-muted-foreground">Resumen operativo del día</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Pacientes registrados" value={stats.pacientes} icon={Users} />
        <StatCard title="Citas hoy" value={stats.citasHoy} icon={CalendarDays} />
        <StatCard title="Pendientes" value={stats.pendientes} icon={Clock} variant="warning" />
        <StatCard title="Canceladas" value={stats.canceladas} icon={AlertTriangle} variant="destructive" />
      </div>

      {/* Citas del día */}
      <div className="rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-display font-semibold text-card-foreground">Citas del día</h2>
        </div>
        {citasRecientes.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No hay citas programadas para hoy</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Hora</th>
                  <th className="px-5 py-3 font-medium">Paciente</th>
                  <th className="px-5 py-3 font-medium">Médico</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {citasRecientes.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-5 py-3 font-medium">
                      {format(new Date(c.fecha_inicio), "HH:mm", { locale: es })}
                    </td>
                    <td className="px-5 py-3">
                      {c.patients?.nombre} {c.patients?.apellidos}
                    </td>
                    <td className="px-5 py-3">
                      Dr(a). {c.doctors?.nombre} {c.doctors?.apellidos}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[c.status] || "bg-muted text-muted-foreground"}`}>
                        {statusLabel[c.status] || c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{c.motivo_consulta || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
