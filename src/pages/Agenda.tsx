import { useEffect, useMemo, useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Bot, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const horas = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"];

type Origen = "telegram" | "whatsapp" | "web" | "walk_in";
type Status = "solicitada" | "tentativa" | "pendiente_formulario" | "confirmada" | "recordatorio_enviado" | "confirmada_paciente" | "confirmada_medico" | "cancelada" | "liberada";

interface Cita {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  status: Status;
  origen: Origen;
  creada_por_bot: boolean;
  motivo_consulta: string | null;
  doctor_id: string;
  patient_id: string;
  servicio_id: string | null;
  paciente?: { nombre: string; apellidos: string };
  doctor?: { nombre: string; apellidos: string };
  servicio?: { nombre: string } | null;
}

const statusLabel: Record<Status, string> = {
  solicitada: "Pendiente de confirmar",
  tentativa: "Tentativa",
  pendiente_formulario: "Pendiente de formulario",
  confirmada: "Confirmada",
  recordatorio_enviado: "Recordatorio enviado",
  confirmada_paciente: "Confirmada por paciente",
  confirmada_medico: "Confirmada por médico",
  cancelada: "Cancelada",
  liberada: "Liberada",
};

const statusBorder: Record<Status, string> = {
  solicitada: "border-l-warning bg-warning/10 border-dashed border border-warning/40",
  tentativa: "border-l-muted-foreground bg-muted/30",
  pendiente_formulario: "border-l-warning bg-warning/5",
  confirmada: "border-l-success bg-success/5",
  recordatorio_enviado: "border-l-info bg-info/5",
  confirmada_paciente: "border-l-success bg-success/5",
  confirmada_medico: "border-l-success bg-success/5",
  cancelada: "border-l-destructive bg-destructive/5",
  liberada: "border-l-muted bg-muted/20",
};

const origenStyle: Record<Origen, { label: string; cls: string; emoji: string }> = {
  web: { label: "Web", cls: "bg-blue-100 text-blue-700 border-blue-200", emoji: "🟦" },
  telegram: { label: "Telegram", cls: "bg-green-100 text-green-700 border-green-200", emoji: "🟩" },
  whatsapp: { label: "WhatsApp", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", emoji: "🟢" },
  walk_in: { label: "Presencial", cls: "bg-muted text-foreground border-border", emoji: "⚪" },
};

function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function Agenda() {
  const [vista, setVista] = useState<"dia" | "semana">("dia");
  const [fecha, setFecha] = useState<Date>(new Date());
  const [citas, setCitas] = useState<Cita[]>([]);
  const [doctores, setDoctores] = useState<{ id: string; nombre: string; apellidos: string; especialidad: string }[]>([]);
  const [filtroOrigen, setFiltroOrigen] = useState<"todos" | Origen>("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | Status>("todos");
  const [seleccionada, setSeleccionada] = useState<Cita | null>(null);
  const [loading, setLoading] = useState(false);
  const [accion, setAccion] = useState(false);

  const cargar = async () => {
    setLoading(true);
    const ini = new Date(fecha); ini.setHours(0, 0, 0, 0);
    const fin = new Date(fecha); fin.setHours(23, 59, 59, 999);
    const [{ data: cdata, error }, { data: ddata }] = await Promise.all([
      supabase.from("appointments")
        .select("id,fecha_inicio,fecha_fin,status,origen,creada_por_bot,motivo_consulta,doctor_id,patient_id,servicio_id,paciente:patients(nombre,apellidos),doctor:doctors(nombre,apellidos),servicio:servicios(nombre)")
        .gte("fecha_inicio", ini.toISOString())
        .lte("fecha_inicio", fin.toISOString())
        .order("fecha_inicio"),
      supabase.from("doctors").select("id,nombre,apellidos,especialidad").eq("activo", true).order("apellidos").limit(3),
    ]);
    if (error) toast.error("Error al cargar citas: " + error.message);
    setCitas((cdata as any) ?? []);
    setDoctores((ddata as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [fecha]);

  const citasFiltradas = useMemo(() =>
    citas.filter((c) =>
      (filtroOrigen === "todos" || c.origen === filtroOrigen) &&
      (filtroStatus === "todos" || c.status === filtroStatus),
    ), [citas, filtroOrigen, filtroStatus]);

  const getCita = (hora: string, doctorId: string) =>
    citasFiltradas.find((c) => fmtHora(c.fecha_inicio) === hora && c.doctor_id === doctorId);

  const cambiarStatus = async (id: string, status: Status) => {
    setAccion(true);
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    setAccion(false);
    if (error) { toast.error("No se pudo actualizar: " + error.message); return; }
    toast.success(status === "confirmada" ? "Cita confirmada" : "Cita cancelada");
    setSeleccionada(null);
    cargar();
  };

  const cambiarDia = (d: number) => { const n = new Date(fecha); n.setDate(n.getDate() + d); setFecha(n); };
  const fechaLabel = fecha.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground">Agenda</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestión de citas y consultorios</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" /> Nueva cita
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => cambiarDia(-1)} className="rounded-lg border border-border bg-card p-2 hover:bg-muted transition-colors"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-semibold text-foreground px-2 capitalize">{fechaLabel}</span>
          <button onClick={() => cambiarDia(1)} className="rounded-lg border border-border bg-card p-2 hover:bg-muted transition-colors"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => setFecha(new Date())} className="ml-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">Hoy</button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={filtroOrigen} onChange={(e) => setFiltroOrigen(e.target.value as any)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground">
            <option value="todos">Todos los orígenes</option>
            <option value="web">Web</option>
            <option value="telegram">Telegram</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="walk_in">Presencial</option>
          </select>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as any)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground">
            <option value="todos">Todos los estados</option>
            <option value="solicitada">Pendiente de confirmar</option>
            <option value="confirmada">Confirmada</option>
            <option value="confirmada_paciente">Confirmada por paciente</option>
            <option value="confirmada_medico">Confirmada por médico</option>
            <option value="recordatorio_enviado">Recordatorio enviado</option>
            <option value="pendiente_formulario">Pendiente de formulario</option>
            <option value="tentativa">Tentativa</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <div className="flex rounded-lg border border-border bg-card overflow-hidden">
            {(["dia", "semana"] as const).map((v) => (
              <button key={v} onClick={() => setVista(v)}
                className={`px-4 py-2 text-xs font-medium transition-colors ${vista === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                {v === "dia" ? "Día" : "Semana"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <div className="min-w-[700px]">
          <div className="grid border-b border-border bg-muted/50" style={{ gridTemplateColumns: `80px repeat(${Math.max(doctores.length, 1)}, 1fr)` }}>
            <div className="px-3 py-3 text-xs font-semibold text-muted-foreground">Hora</div>
            {doctores.map((d) => (
              <div key={d.id} className="px-3 py-3 text-xs font-semibold text-muted-foreground border-l border-border">
                Dr(a). {d.apellidos} — {d.especialidad}
              </div>
            ))}
            {doctores.length === 0 && <div className="px-3 py-3 text-xs text-muted-foreground border-l border-border">Sin doctores activos</div>}
          </div>

          {horas.map((hora) => {
            const esHoraCompleta = hora.endsWith(":00");
            return (
              <div key={hora} className={`grid ${esHoraCompleta ? "border-t border-border" : "border-t border-border/40"}`}
                style={{ gridTemplateColumns: `80px repeat(${Math.max(doctores.length, 1)}, 1fr)` }}>
                <div className={`px-3 py-2 text-xs ${esHoraCompleta ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{hora}</div>
                {doctores.map((d) => {
                  const cita = getCita(hora, d.id);
                  const o = cita ? origenStyle[cita.origen] : null;
                  return (
                    <div key={d.id} className="border-l border-border px-1.5 py-1 min-h-[44px]">
                      {cita && (
                        <button onClick={() => setSeleccionada(cita)}
                          className={`w-full text-left rounded-md border-l-[3px] p-2 cursor-pointer hover:shadow-card transition-shadow ${statusBorder[cita.status]}`}>
                          <p className="text-xs font-semibold text-card-foreground truncate">
                            {cita.paciente ? `${cita.paciente.nombre} ${cita.paciente.apellidos}` : "Paciente"}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {cita.servicio?.nombre ?? cita.motivo_consulta ?? "Consulta"}
                          </p>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {o && (
                              <span className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[9px] font-medium ${o.cls}`}>
                                {o.emoji} {o.label}
                              </span>
                            )}
                            {cita.creada_por_bot && (
                              <span className="inline-flex items-center gap-0.5 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                                <Bot className="h-2.5 w-2.5" /> Bot
                              </span>
                            )}
                            {cita.status === "solicitada" && (
                              <span className="inline-flex items-center rounded border border-warning/40 bg-warning/20 px-1.5 py-0.5 text-[9px] font-medium text-warning-foreground">
                                Pendiente de confirmar
                              </span>
                            )}
                          </div>
                        </button>
                      )}
                    </div>
                  );
                })}
                {doctores.length === 0 && <div className="border-l border-border" />}
              </div>
            );
          })}
        </div>
      </div>

      {loading && <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Cargando citas...</p>}
      {!loading && citasFiltradas.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No hay citas para los filtros seleccionados.</p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Confirmada</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning" /> Pendiente</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-info" /> Recordatorio</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" /> Solicitada / Tentativa</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Cancelada</span>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!seleccionada} onOpenChange={(o) => !o && setSeleccionada(null)}>
        <DialogContent>
          {seleccionada && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {seleccionada.paciente ? `${seleccionada.paciente.nombre} ${seleccionada.paciente.apellidos}` : "Cita"}
                </DialogTitle>
                <DialogDescription>
                  {fmtHora(seleccionada.fecha_inicio)} – {fmtHora(seleccionada.fecha_fin)}
                  {seleccionada.doctor && ` · Dr(a). ${seleccionada.doctor.apellidos}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Servicio: </span>
                  <span className="font-medium">{seleccionada.servicio?.nombre ?? "—"}</span>
                </div>
                {seleccionada.motivo_consulta && (
                  <div>
                    <span className="text-muted-foreground">Motivo: </span>
                    <span>{seleccionada.motivo_consulta}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={origenStyle[seleccionada.origen].cls}>
                    {origenStyle[seleccionada.origen].emoji} {origenStyle[seleccionada.origen].label}
                  </Badge>
                  {seleccionada.creada_por_bot && (
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                      <Bot className="h-3 w-3 mr-1" /> Bot
                    </Badge>
                  )}
                  <Badge variant="outline">{statusLabel[seleccionada.status]}</Badge>
                </div>
              </div>
              <DialogFooter className="gap-2">
                {seleccionada.status === "solicitada" && (
                  <Button onClick={() => cambiarStatus(seleccionada.id, "confirmada")} disabled={accion}>
                    <CheckCircle2 className="h-4 w-4" /> Confirmar cita
                  </Button>
                )}
                {seleccionada.status !== "cancelada" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={accion}>
                        <XCircle className="h-4 w-4" /> Cancelar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción cambiará el estado de la cita a "Cancelada". Se puede revertir manualmente si es necesario.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Volver</AlertDialogCancel>
                        <AlertDialogAction onClick={() => cambiarStatus(seleccionada.id, "cancelada")}>
                          Sí, cancelar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
