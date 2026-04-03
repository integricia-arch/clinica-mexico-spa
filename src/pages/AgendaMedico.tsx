import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfWeek, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8:00 - 18:00

const statusLabel: Record<string, string> = {
  solicitada: "Solicitada",
  tentativa: "Tentativa",
  pendiente_formulario: "Pend. form.",
  confirmada: "Confirmada",
  recordatorio_enviado: "Rec. enviado",
  confirmada_paciente: "Conf. paciente",
  confirmada_medico: "Conf. médico",
  cancelada: "Cancelada",
  liberada: "Liberada",
};

const statusColors: Record<string, string> = {
  solicitada: "bg-warning/20 border-warning/40 text-warning",
  confirmada: "bg-success/20 border-success/40 text-success",
  confirmada_paciente: "bg-success/15 border-success/30 text-success",
  confirmada_medico: "bg-success/25 border-success/50 text-success",
  cancelada: "bg-destructive/10 border-destructive/30 text-destructive",
  pendiente_formulario: "bg-info/15 border-info/30 text-info",
  tentativa: "bg-muted border-border text-muted-foreground",
  recordatorio_enviado: "bg-info/10 border-info/20 text-info",
  liberada: "bg-muted border-border text-muted-foreground",
};

export default function AgendaMedico() {
  const { user, hasRole } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const weekDays = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)); // Lun-Sáb

  useEffect(() => {
    supabase.from("doctors").select("*").eq("activo", true).then(({ data }) => {
      setDoctors(data ?? []);
      // If user is a doctor, select themselves
      if (user && data) {
        const me = data.find((d) => d.user_id === user.id);
        if (me) setSelectedDoctor(me.id);
      }
    });
  }, [user]);

  useEffect(() => {
    async function loadAppointments() {
      setLoading(true);
      const from = weekDays[0].toISOString();
      const to = addDays(weekDays[weekDays.length - 1], 1).toISOString();

      let query = supabase
        .from("appointments")
        .select("*, patients(nombre, apellidos), doctors(nombre, apellidos)")
        .gte("fecha_inicio", from)
        .lt("fecha_inicio", to)
        .not("status", "in", '("cancelada","liberada")');

      if (selectedDoctor !== "all") {
        query = query.eq("doctor_id", selectedDoctor);
      }

      const { data } = await query;
      setAppointments(data ?? []);
      setLoading(false);
    }
    loadAppointments();
  }, [weekStart, selectedDoctor]);

  const getAppointmentsForSlot = (day: Date, hour: number) => {
    return appointments.filter((a) => {
      const d = new Date(a.fecha_inicio);
      return d.getDate() === day.getDate() && d.getMonth() === day.getMonth() && d.getHours() === hour;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground">Agenda médica</h1>
          <p className="mt-1 text-sm text-muted-foreground">Vista semanal de citas</p>
        </div>

        <div className="flex items-center gap-3">
          {(hasRole("admin") || hasRole("receptionist")) && (
            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos los médicos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los médicos</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    Dr(a). {d.nombre} {d.apellidos}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addDays(w, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[180px] text-center">
              {format(weekDays[0], "d MMM", { locale: es })} – {format(weekDays[5], "d MMM yyyy", { locale: es })}
            </span>
            <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addDays(w, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card overflow-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border">
              <th className="w-16 px-3 py-3 text-xs text-muted-foreground font-medium text-left">Hora</th>
              {weekDays.map((d) => (
                <th key={d.toISOString()} className="px-2 py-3 text-xs text-center">
                  <span className="text-muted-foreground font-medium">
                    {format(d, "EEE", { locale: es })}
                  </span>
                  <br />
                  <span className={`font-semibold ${d.toDateString() === new Date().toDateString() ? "text-primary" : "text-foreground"}`}>
                    {format(d, "d")}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((h) => (
              <tr key={h} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-xs text-muted-foreground font-medium align-top">
                  {String(h).padStart(2, "0")}:00
                </td>
                {weekDays.map((d) => {
                  const slots = getAppointmentsForSlot(d, h);
                  return (
                    <td key={d.toISOString()} className="px-1 py-1 align-top min-h-[48px]">
                      {slots.map((a) => (
                        <div
                          key={a.id}
                          className={`rounded-md border px-2 py-1 mb-1 text-xs cursor-pointer ${statusColors[a.status] || "bg-muted"}`}
                        >
                          <p className="font-medium truncate">
                            {a.patients?.nombre} {a.patients?.apellidos}
                          </p>
                          <p className="text-[10px] opacity-80">
                            {format(new Date(a.fecha_inicio), "HH:mm")}–{format(new Date(a.fecha_fin), "HH:mm")}
                            {" · "}{statusLabel[a.status]}
                          </p>
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
