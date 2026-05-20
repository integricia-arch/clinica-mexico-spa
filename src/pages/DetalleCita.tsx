import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Clock, User, Stethoscope, MapPin, FileText, Bot, CheckCircle, XCircle, Pill, Bell, Plus, CalendarClock } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ReminderChannel = Database["public"]["Enums"]["reminder_channel"];

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
  const [servicio, setServicio] = useState<any>(null);
  const [recordatorios, setRecordatorios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal recordatorio manual
  const [reminderOpen, setReminderOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<any | null>(null);
  const [reminderCanal, setReminderCanal] = useState<ReminderChannel>("whatsapp");
  const [reminderFecha, setReminderFecha] = useState("");
  const [reminderMensaje, setReminderMensaje] = useState("");
  const [savingReminder, setSavingReminder] = useState(false);

  const puedeGestionarRecordatorios = hasRole("admin") || hasRole("receptionist");

  const reloadRecordatorios = async () => {
    const { data } = await supabase
      .from("reminders")
      .select("*")
      .eq("appointment_id", id!)
      .order("programado_para", { ascending: true });
    setRecordatorios(data ?? []);
  };

  const abrirNuevoRecordatorio = () => {
    setEditingReminder(null);
    setReminderCanal("whatsapp");
    const defaultDate = new Date(Math.max(Date.now() + 60 * 60 * 1000, new Date(appointment.fecha_inicio).getTime() - 2 * 60 * 60 * 1000));
    setReminderFecha(format(defaultDate, "yyyy-MM-dd'T'HH:mm"));
    setReminderMensaje(
      `Recordatorio: tiene una cita el ${format(new Date(appointment.fecha_inicio), "dd/MM/yyyy 'a las' HH:mm", { locale: es })} hrs.`
    );
    setReminderOpen(true);
  };

  const abrirReprogramar = (r: any) => {
    setEditingReminder(r);
    setReminderCanal(r.canal);
    setReminderFecha(format(new Date(r.programado_para), "yyyy-MM-dd'T'HH:mm"));
    setReminderMensaje(r.mensaje ?? "");
    setReminderOpen(true);
  };

  const guardarRecordatorio = async () => {
    if (!reminderFecha) {
      toast({ variant: "destructive", title: "Falta fecha", description: "Selecciona fecha y hora del recordatorio." });
      return;
    }
    setSavingReminder(true);
    const programado = new Date(reminderFecha).toISOString();

    if (editingReminder) {
      const { error } = await supabase
        .from("reminders")
        .update({
          canal: reminderCanal,
          programado_para: programado,
          mensaje: reminderMensaje,
          estado: "pendiente",
          enviado_en: null,
          intentos: 0,
        })
        .eq("id", editingReminder.id);
      if (error) {
        setSavingReminder(false);
        toast({ variant: "destructive", title: "Error", description: error.message });
        return;
      }
      await supabase.rpc("log_audit", {
        _accion: "actualizar",
        _tabla: "reminders",
        _registro_id: editingReminder.id,
        _datos_anteriores: editingReminder as any,
        _datos_nuevos: { canal: reminderCanal, programado_para: programado, mensaje: reminderMensaje } as any,
      });
      toast({ title: "Recordatorio reprogramado" });
    } else {
      const { data, error } = await supabase
        .from("reminders")
        .insert({
          appointment_id: id!,
          canal: reminderCanal,
          programado_para: programado,
          mensaje: reminderMensaje,
          estado: "pendiente",
        })
        .select()
        .single();
      if (error) {
        setSavingReminder(false);
        toast({ variant: "destructive", title: "Error", description: error.message });
        return;
      }
      await supabase.rpc("log_audit", {
        _accion: "crear",
        _tabla: "reminders",
        _registro_id: data.id,
        _datos_nuevos: data as any,
      });
      toast({ title: "Recordatorio creado", description: "Se programó el recordatorio manual." });
    }

    setSavingReminder(false);
    setReminderOpen(false);
    await reloadRecordatorios();
  };

  const enviarAhora = async (r: any) => {
    const { error } = await supabase
      .from("reminders")
      .update({ estado: "enviado", enviado_en: new Date().toISOString(), intentos: (r.intentos ?? 0) + 1 })
      .eq("id", r.id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    await supabase.rpc("log_audit", {
      _accion: "actualizar",
      _tabla: "reminders",
      _registro_id: r.id,
      _datos_anteriores: r as any,
      _datos_nuevos: { estado: "enviado" } as any,
    });
    toast({ title: "Recordatorio enviado" });
    await reloadRecordatorios();
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [aRes, rRes, remRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("*, patients(*), doctors(nombre, apellidos, especialidad), rooms(nombre, piso)")
          .eq("id", id)
          .single(),
        supabase.from("appointment_resources").select("*").eq("appointment_id", id),
        supabase.from("reminders").select("*").eq("appointment_id", id).order("programado_para", { ascending: true }),
      ]);
      setAppointment(aRes.data);
      setResources(rRes.data ?? []);
      setRecordatorios(remRes.data ?? []);
      if (aRes.data?.servicio_id) {
        const { data: sData } = await supabase
          .from("servicios")
          .select("nombre, precio_centavos, duracion_minutos")
          .eq("id", aRes.data.servicio_id)
          .single();
        setServicio(sData);
      }
      setLoading(false);
    })();
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

        {a.creada_por_bot && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
            <Bot className="h-4 w-4" />
            Cita agendada vía Telegram por el bot
          </div>
        )}

        {(hasRole("admin") || hasRole("receptionist")) &&
          (a.status === "solicitada" || a.status === "tentativa") && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" className="flex-1" onClick={() => updateStatus("confirmada")}>
                <CheckCircle className="mr-2 h-4 w-4" /> Confirmar cita
              </Button>
              <Button size="lg" variant="destructive" className="flex-1" onClick={() => updateStatus("cancelada")}>
                <XCircle className="mr-2 h-4 w-4" /> Cancelar cita
              </Button>
            </div>
          )}

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

          {servicio && (
            <div className="flex gap-3">
              <Pill className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">Servicio</p>
                <p className="text-sm text-muted-foreground">{servicio.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  ${(servicio.precio_centavos / 100).toLocaleString("es-MX")} · {servicio.duracion_minutos} min
                </p>
              </div>
            </div>
          )}
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

        <div className="border-t border-border pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Recordatorios automáticos</p>
          </div>
          {recordatorios.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay recordatorios programados para esta cita.</p>
          ) : (
            <div className="space-y-2">
              {recordatorios.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{r.canal}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      {format(new Date(r.programado_para), "d MMM, HH:mm", { locale: es })}
                    </span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    r.estado === "enviado" ? "bg-success/10 text-success"
                    : r.estado === "fallido" ? "bg-destructive/10 text-destructive"
                    : "bg-warning/10 text-warning"
                  }`}>
                    {r.estado === "enviado" ? "Enviado" : r.estado === "fallido" ? "Fallido" : "Pendiente"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
