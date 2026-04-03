import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, UserCheck, CalendarPlus, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const statusLabel: Record<string, string> = {
  solicitada: "Solicitada",
  tentativa: "Tentativa",
  pendiente_formulario: "Pend. formulario",
  confirmada: "Confirmada",
  recordatorio_enviado: "Rec. enviado",
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

export default function RecepcionDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ citasHoy: 0, pendientes: 0, confirmadas: 0 });
  const [citas, setCitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const [todayRes, pendingRes, confirmedRes, listRes] = await Promise.all([
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .gte("fecha_inicio", startOfDay).lt("fecha_inicio", endOfDay),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .in("status", ["solicitada", "tentativa", "pendiente_formulario"]),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .in("status", ["confirmada", "confirmada_paciente", "confirmada_medico"])
          .gte("fecha_inicio", startOfDay).lt("fecha_inicio", endOfDay),
        supabase.from("appointments")
          .select("*, doctors(nombre, apellidos), patients(nombre, apellidos, telefono)")
          .gte("fecha_inicio", startOfDay)
          .order("fecha_inicio", { ascending: true })
          .limit(20),
      ]);

      setStats({
        citasHoy: todayRes.count ?? 0,
        pendientes: pendingRes.count ?? 0,
        confirmadas: confirmedRes.count ?? 0,
      });
      setCitas(listRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground">Recepción</h1>
          <p className="mt-1 text-sm text-muted-foreground">Panel de atención al paciente</p>
        </div>
        <Button onClick={() => navigate("/nueva-cita")}>
          <CalendarPlus className="mr-2 h-4 w-4" />
          Nueva cita
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Citas hoy" value={stats.citasHoy} icon={CalendarDays} />
        <StatCard title="Pendientes de confirmar" value={stats.pendientes} icon={Clock} variant="warning" />
        <StatCard title="Confirmadas hoy" value={stats.confirmadas} icon={UserCheck} variant="success" />
      </div>

      {/* Lista de citas */}
      <div className="rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-display font-semibold text-card-foreground">Citas del día</h2>
        </div>
        {citas.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No hay citas para hoy</p>
        ) : (
          <div className="divide-y divide-border">
            {citas.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(`/cita/${c.id}`)}
                className="flex items-center gap-4 px-5 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="text-center min-w-[50px]">
                  <p className="text-sm font-bold text-foreground">
                    {format(new Date(c.fecha_inicio), "HH:mm")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(c.fecha_fin), "HH:mm")}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground truncate">
                    {c.patients?.nombre} {c.patients?.apellidos}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dr(a). {c.doctors?.nombre} {c.doctors?.apellidos}
                    {c.patients?.telefono && ` · ${c.patients.telefono}`}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[c.status] || "bg-muted text-muted-foreground"}`}>
                  {statusLabel[c.status] || c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
