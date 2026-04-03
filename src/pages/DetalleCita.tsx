import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Clock, User, Stethoscope, MapPin, FileText } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

const statusLabel: Record<string, string> = {
  solicitada: "Solicitada",
  tentativa: "Tentativa",
  pendiente_formulario: "Pendiente de formulario",
  confirmada: "Confirmada",
  recordatorio_enviado: "Recordatorio enviado",
  confirmada_paciente: "Confirmada por paciente",
  confirmada_medico: "Confirmada por médico",
  cancelada: "Cancelada",
  liberada: "Liberada",
};

const allStatuses: AppointmentStatus[] = [
  "solicitada", "tentativa", "pendiente_formulario", "confirmada",
  "recordatorio_enviado", "confirmada_paciente", "confirmada_medico",
  "cancelada", "liberada",
];

export default function DetalleCita() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const [appointment, setAppointment] = useState<any>(null);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase
        .from("appointments")
        .select("*, patients(*), doctors(nombre, apellidos, especialidad), rooms(nombre, piso)")
        .eq("id", id)
        .single(),
      supabase.from("appointment_resources").select("*").eq("appointment_id", id),
    ]).then(([aRes, rRes]) => {
      setAppointment(aRes.data);
      setResources(rRes.data ?? []);
      setLoading(false);
    });
  }, [id]);

  const updateStatus = async (newStatus: AppointmentStatus) => {
    const oldStatus = appointment.status;
    const { error } = await supabase
      .from("appointments")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }

    // Audit log
    await supabase.rpc("log_audit", {
      _accion: newStatus === "cancelada" ? "cancelar" : "actualizar",
      _tabla: "appointments",
      _registro_id: id!,
      _datos_anteriores: { status: oldStatus } as any,
      _datos_nuevos: { status: newStatus } as any,
    });

    setAppointment({ ...appointment, status: newStatus });
    toast({ title: "Estado actualizado", description: `Cita marcada como: ${statusLabel[newStatus]}` });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!appointment) {
    return <p className="text-center py-20 text-muted-foreground">Cita no encontrada</p>;
  }

  const a = appointment;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver
      </Button>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-display text-xl font-bold text-card-foreground">Detalle de cita</h1>
          {(hasRole("admin") || hasRole("receptionist")) && (
            <Select value={a.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allStatuses.map((s) => (
                  <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Fecha y hora */}
          <div className="flex gap-3">
            <Clock className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Fecha y hora</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(a.fecha_inicio), "EEEE d 'de' MMMM, yyyy", { locale: es })}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(a.fecha_inicio), "HH:mm")} – {format(new Date(a.fecha_fin), "HH:mm")}
              </p>
            </div>
          </div>

          {/* Paciente */}
          <div className="flex gap-3">
            <User className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Paciente</p>
              <p className="text-sm text-muted-foreground">
                {a.patients?.nombre} {a.patients?.apellidos}
              </p>
              {a.patients?.telefono && (
                <p className="text-xs text-muted-foreground">{a.patients.telefono}</p>
              )}
            </div>
          </div>

          {/* Médico */}
          <div className="flex gap-3">
            <Stethoscope className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Médico</p>
              <p className="text-sm text-muted-foreground">
                Dr(a). {a.doctors?.nombre} {a.doctors?.apellidos}
              </p>
              <p className="text-xs text-muted-foreground">{a.doctors?.especialidad}</p>
            </div>
          </div>

          {/* Consultorio */}
          <div className="flex gap-3">
            <MapPin className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Consultorio</p>
              <p className="text-sm text-muted-foreground">
                {a.rooms ? `${a.rooms.nombre}${a.rooms.piso ? ` (Piso ${a.rooms.piso})` : ""}` : "Sin asignar"}
              </p>
            </div>
          </div>
        </div>

        {/* Motivo */}
        {a.motivo_consulta && (
          <div className="flex gap-3">
            <FileText className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Motivo de consulta</p>
              <p className="text-sm text-muted-foreground">{a.motivo_consulta}</p>
            </div>
          </div>
        )}

        {a.notas && (
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm font-medium mb-1">Notas</p>
            <p className="text-sm text-muted-foreground">{a.notas}</p>
          </div>
        )}

        {/* Recursos */}
        {resources.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Recursos asignados</p>
            <div className="space-y-1">
              {resources.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="font-medium">{r.tipo_recurso}</span>
                  {r.descripcion && <span>— {r.descripcion}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
