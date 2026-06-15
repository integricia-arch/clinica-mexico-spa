import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronLeft, ChevronRight, Bot, CheckCircle2, XCircle, Loader2, Lock, CalendarOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import NuevaCitaDialog from "@/components/agenda/NuevaCitaDialog";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";

const HORAS = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"];

type Origen = "telegram" | "whatsapp" | "web" | "walk_in";
type Status  = "solicitada" | "tentativa" | "pendiente_formulario" | "confirmada" | "recordatorio_enviado" | "confirmada_paciente" | "confirmada_medico" | "cancelada" | "liberada";

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
  recurrencia_tipo: string | null;
  cita_padre_id: string | null;
  recurrencia_num: number;
  paciente?: { nombre: string; apellidos: string };
  doctor?: { nombre: string; apellidos: string };
  servicio?: { nombre: string } | null;
}

interface Bloqueo {
  id: string;
  doctor_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string | null;
  tipo: string;
  todo_el_dia: boolean;
}

interface Doctor { id: string; nombre: string; apellidos: string; especialidad: string }

const STATUS_LABEL: Record<Status, string> = {
  solicitada: "Pendiente de confirmar", tentativa: "Tentativa",
  pendiente_formulario: "Pendiente de formulario", confirmada: "Confirmada",
  recordatorio_enviado: "Recordatorio enviado", confirmada_paciente: "Confirmada por paciente",
  confirmada_medico: "Confirmada por médico", cancelada: "Cancelada", liberada: "Liberada",
};

const STATUS_BORDER: Record<Status, string> = {
  solicitada:            "border-l-warning bg-warning/10 border border-warning/40 border-dashed",
  tentativa:             "border-l-muted-foreground bg-muted/30",
  pendiente_formulario:  "border-l-warning bg-warning/5",
  confirmada:            "border-l-success bg-success/5",
  recordatorio_enviado:  "border-l-info bg-info/5",
  confirmada_paciente:   "border-l-success bg-success/5",
  confirmada_medico:     "border-l-success bg-success/5",
  cancelada:             "border-l-destructive bg-destructive/5",
  liberada:              "border-l-muted bg-muted/20",
};

const ORIGEN_STYLE: Record<Origen, { label: string; cls: string; emoji: string }> = {
  web:      { label: "Web",        cls: "bg-blue-100 text-blue-700 border-blue-200",      emoji: "🟦" },
  telegram: { label: "Telegram",   cls: "bg-green-100 text-green-700 border-green-200",   emoji: "🟩" },
  whatsapp: { label: "WhatsApp",   cls: "bg-emerald-100 text-emerald-700 border-emerald-200", emoji: "🟢" },
  walk_in:  { label: "Presencial", cls: "bg-muted text-foreground border-border",         emoji: "⚪" },
};

const TIPO_BLOQUEO_LABEL: Record<string, string> = {
  vacaciones: "Vacaciones", descanso: "Descanso", capacitacion: "Capacitación",
  guardia: "Guardia", otro: "Otro",
};

function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function getHoraSlot(hora: string, baseFecha: Date): { ini: Date; fin: Date } {
  const [h, m] = hora.split(":").map(Number);
  const ini = new Date(baseFecha); ini.setHours(h, m, 0, 0);
  const fin = new Date(ini.getTime() + 30 * 60 * 1000);
  return { ini, fin };
}

// ── Tarjeta de cita ──────────────────────────────────────────
function CitaCard({ cita, onClick }: { cita: Cita; onClick: () => void }) {
  const o = ORIGEN_STYLE[cita.origen];
  return (
    <button onClick={onClick}
      className={`w-full text-left rounded-md border-l-[3px] p-2 cursor-pointer hover:shadow-card transition-shadow ${STATUS_BORDER[cita.status]}`}>
      <p className="text-xs font-semibold text-card-foreground truncate">
        {cita.paciente ? `${cita.paciente.nombre} ${cita.paciente.apellidos}` : "Paciente"}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
        {cita.servicio?.nombre ?? cita.motivo_consulta ?? "Consulta"}
      </p>
      <div className="flex flex-wrap items-center gap-1 mt-1">
        <span className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[9px] font-medium ${o.cls}`}>
          {o.emoji} {o.label}
        </span>
        {cita.creada_por_bot && (
          <span className="inline-flex items-center gap-0.5 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
            <Bot className="h-2.5 w-2.5" /> Bot
          </span>
        )}
        {cita.recurrencia_tipo && (
          <span className="inline-flex items-center rounded border border-purple-300 bg-purple-50 px-1.5 py-0.5 text-[9px] font-medium text-purple-700">
            ↻ {cita.recurrencia_num}
          </span>
        )}
        {cita.status === "solicitada" && (
          <span className="inline-flex items-center rounded border border-warning/40 bg-warning/20 px-1.5 py-0.5 text-[9px] font-medium text-warning-foreground">
            Pendiente
          </span>
        )}
      </div>
    </button>
  );
}

// ── Dialog bloqueo ───────────────────────────────────────────
interface BloqueoFormProps {
  open: boolean;
  doctores: Doctor[];
  clinicId: string;
  onCreated: () => void;
  onCancel: () => void;
}

function BloqueoDialog({ open, doctores, clinicId, onCreated, onCancel }: BloqueoFormProps) {
  const { user } = { user: null } as { user: null }; // unused but kept for pattern
  const [form, setForm] = useState({
    doctor_id: "",
    fecha_inicio: new Date().toISOString().slice(0, 16),
    fecha_fin:    new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    motivo: "",
    tipo: "otro",
    todo_el_dia: false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doctor_id) { toast.error("Selecciona un doctor"); return; }
    setSaving(true);
    const payload = {
      clinic_id:    clinicId,
      doctor_id:    form.doctor_id,
      fecha_inicio: form.todo_el_dia
        ? new Date(form.fecha_inicio.slice(0, 10) + "T00:00:00").toISOString()
        : new Date(form.fecha_inicio).toISOString(),
      fecha_fin: form.todo_el_dia
        ? new Date(form.fecha_inicio.slice(0, 10) + "T23:59:59").toISOString()
        : new Date(form.fecha_fin).toISOString(),
      motivo:     form.motivo || null,
      tipo:       form.tipo,
      todo_el_dia: form.todo_el_dia,
    };
    const { error } = await (supabase.from("doctor_bloqueos" as never) as ReturnType<typeof supabase.from>)
      .insert(payload);
    setSaving(false);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Bloqueo registrado");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarOff className="h-5 w-5" /> Bloquear horario</DialogTitle>
          <DialogDescription>Bloquea un período en la agenda del doctor</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Doctor</Label>
            <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {doctores.map((d) => (
                  <SelectItem key={d.id} value={d.id}>Dr(a). {d.apellidos}, {d.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_BLOQUEO_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="todo_dia" checked={form.todo_el_dia}
              onChange={(e) => setForm({ ...form, todo_el_dia: e.target.checked })} />
            <Label htmlFor="todo_dia" className="cursor-pointer">Todo el día</Label>
          </div>
          {!form.todo_el_dia ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Inicio</Label>
                <Input type="datetime-local" value={form.fecha_inicio}
                  onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Fin</Label>
                <Input type="datetime-local" value={form.fecha_fin}
                  onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} required />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha_inicio.slice(0, 10)}
                onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value + "T00:00", fecha_fin: e.target.value + "T23:59" })} required />
            </div>
          )}
          <div className="space-y-1">
            <Label>Motivo (opcional)</Label>
            <Input placeholder="Ej. Congreso médico, descanso..." value={form.motivo}
              onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button type="submit" disabled={saving}>Guardar bloqueo</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Agenda principal ─────────────────────────────────────────
export default function Agenda() {
  const navigate = useNavigate();
  const { activeClinicId } = useActiveClinic();
  const [vista, setVista] = useState<"dia" | "semana">("dia");
  const [fecha, setFecha] = useState<Date>(new Date());
  const [citas, setCitas] = useState<Cita[]>([]);
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [doctores, setDoctores] = useState<Doctor[]>([]);
  const [filtroOrigen, setFiltroOrigen]   = useState<"todos" | Origen>("todos");
  const [filtroStatus, setFiltroStatus]   = useState<"todos" | Status>("todos");
  const [filtroDoctor, setFiltroDoctor]   = useState<string>("todos");
  const [seleccionada, setSeleccionada]   = useState<Cita | null>(null);
  const [loading, setLoading] = useState(false);
  const [accion, setAccion]   = useState(false);
  const [showNueva, setShowNueva]     = useState(false);
  const [showBloqueo, setShowBloqueo] = useState(false);

  // Semana: lunes de la semana de `fecha`
  const semanaInicio = useMemo(() => startOfWeek(fecha, { weekStartsOn: 1 }), [fecha]);
  const diasSemana   = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(semanaInicio, i)), [semanaInicio]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const ini = vista === "semana" ? diasSemana[0] : new Date(fecha);
    const fin = vista === "semana" ? addDays(diasSemana[6], 1) : new Date(fecha);
    ini.setHours(0, 0, 0, 0);
    fin.setHours(23, 59, 59, 999);

    const [{ data: cdata, error }, { data: ddata }, { data: bdata }] = await Promise.all([
      supabase.from("appointments")
        .select("id,fecha_inicio,fecha_fin,status,origen,creada_por_bot,motivo_consulta,doctor_id,patient_id,servicio_id,recurrencia_tipo,cita_padre_id,recurrencia_num,paciente:patients(nombre,apellidos),doctor:doctors(nombre,apellidos),servicio:servicios(nombre)")
        .gte("fecha_inicio", ini.toISOString())
        .lte("fecha_inicio", fin.toISOString())
        .order("fecha_inicio"),
      supabase.from("doctors").select("id,nombre,apellidos,especialidad").eq("activo", true).order("apellidos"),
      (supabase.from("doctor_bloqueos" as never) as ReturnType<typeof supabase.from>)
        .select("id,doctor_id,fecha_inicio,fecha_fin,motivo,tipo,todo_el_dia")
        .gte("fecha_fin",    ini.toISOString())
        .lte("fecha_inicio", fin.toISOString())
        .eq("activo", true),
    ]);
    if (error) toast.error("Error al cargar citas: " + friendlyError(error));
    setCitas((cdata as Cita[]) ?? []);
    setDoctores((ddata as Doctor[]) ?? []);
    setBloqueos((bdata as Bloqueo[]) ?? []);
    setLoading(false);
  }, [fecha, vista, diasSemana]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel("agenda-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "appointments" }, loadData)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "appointments" }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const citasFiltradas = useMemo(() =>
    citas.filter((c) =>
      (filtroOrigen === "todos" || c.origen === filtroOrigen) &&
      (filtroStatus === "todos" || c.status === filtroStatus) &&
      (filtroDoctor === "todos" || c.doctor_id === filtroDoctor)
    ), [citas, filtroOrigen, filtroStatus, filtroDoctor]);

  // Cita en slot hora × doctor (vista día)
  const getCitaDia = (hora: string, doctorId: string): Cita | undefined => {
    const { ini, fin } = getHoraSlot(hora, fecha);
    return citasFiltradas.find((c) => {
      const ts = new Date(c.fecha_inicio).getTime();
      return c.doctor_id === doctorId && ts >= ini.getTime() && ts < fin.getTime();
    });
  };

  // Cita en slot hora × día (vista semana) con doctor filter
  const getCitaSemana = (hora: string, dia: Date): Cita[] => {
    const { ini, fin } = getHoraSlot(hora, dia);
    return citasFiltradas.filter((c) => {
      const ts = new Date(c.fecha_inicio).getTime();
      return ts >= ini.getTime() && ts < fin.getTime();
    });
  };

  // Bloqueo activo en slot
  const tieneBloqueo = (hora: string, dia: Date, doctorId?: string): boolean => {
    const { ini, fin } = getHoraSlot(hora, dia);
    return bloqueos.some((b) => {
      if (doctorId && b.doctor_id !== doctorId) return false;
      const bs = new Date(b.fecha_inicio).getTime();
      const be = new Date(b.fecha_fin).getTime();
      return bs < fin.getTime() && be > ini.getTime();
    });
  };

  const cambiarStatus = async (id: string, status: Status) => {
    setAccion(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sin sesión");

      const res = await supabase.functions.invoke("confirmar-cita", {
        body: { appointment_id: id, nuevo_status: status },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) throw res.error;
      const data = res.data as { ok: boolean; notificado: boolean };
      toast.success(
        status === "confirmada"
          ? data.notificado ? "Cita confirmada — paciente notificado vía Telegram" : "Cita confirmada"
          : "Cita cancelada"
      );
    } catch (e) {
      // Fallback directo si edge fn falla
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) { toast.error(friendlyError(error)); setAccion(false); return; }
      toast.success(status === "confirmada" ? "Cita confirmada" : "Cita cancelada");
    }
    setAccion(false);
    setSeleccionada(null);
    loadData();
  };

  const cambiarDia = (d: number) => {
    const n = new Date(fecha);
    n.setDate(n.getDate() + (vista === "semana" ? d * 7 : d));
    setFecha(n);
  };

  const fechaLabel = vista === "dia"
    ? fecha.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : `${format(diasSemana[0], "d MMM", { locale: es })} – ${format(diasSemana[6], "d MMM yyyy", { locale: es })}`;

  const doctoresFiltrados = useMemo(() =>
    filtroDoctor === "todos" ? doctores : doctores.filter((d) => d.id === filtroDoctor),
    [doctores, filtroDoctor]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground">Agenda</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestión de citas y consultorios</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBloqueo(true)}>
            <Lock className="h-4 w-4 mr-1" /> Bloquear
          </Button>
          <button
            onClick={() => setShowNueva(true)}
            className="inline-flex items-center gap-2 rounded-lg gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" /> Nueva cita
          </button>
        </div>
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
          <select value={filtroDoctor} onChange={(e) => setFiltroDoctor(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground">
            <option value="todos">Todos los doctores</option>
            {doctores.map((d) => <option key={d.id} value={d.id}>Dr(a). {d.apellidos}</option>)}
          </select>
          <select value={filtroOrigen} onChange={(e) => setFiltroOrigen(e.target.value as "todos" | Origen)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground">
            <option value="todos">Todos los orígenes</option>
            {(["web","telegram","whatsapp","walk_in"] as Origen[]).map((o) => (
              <option key={o} value={o}>{ORIGEN_STYLE[o].label}</option>
            ))}
          </select>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as "todos" | Status)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground">
            <option value="todos">Todos los estados</option>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
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

      {/* ── VISTA DÍA ───────────────────────────────────────── */}
      {vista === "dia" && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <div className="min-w-[700px]">
            <div className="grid border-b border-border bg-muted/50" style={{ gridTemplateColumns: `80px repeat(${Math.max(doctoresFiltrados.length, 1)}, 1fr)` }}>
              <div className="px-3 py-3 text-xs font-semibold text-muted-foreground">Hora</div>
              {doctoresFiltrados.map((d) => (
                <div key={d.id} className="px-3 py-3 text-xs font-semibold text-muted-foreground border-l border-border">
                  Dr(a). {d.apellidos} — {d.especialidad}
                </div>
              ))}
              {doctoresFiltrados.length === 0 && <div className="px-3 py-3 text-xs text-muted-foreground border-l border-border">Sin doctores</div>}
            </div>

            {HORAS.map((hora) => {
              const esCompleta = hora.endsWith(":00");
              return (
                <div key={hora}
                  className={`grid ${esCompleta ? "border-t border-border" : "border-t border-border/40"}`}
                  style={{ gridTemplateColumns: `80px repeat(${Math.max(doctoresFiltrados.length, 1)}, 1fr)` }}>
                  <div className={`px-3 py-2 text-xs ${esCompleta ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{hora}</div>
                  {doctoresFiltrados.map((d) => {
                    const cita     = getCitaDia(hora, d.id);
                    const bloqueado = tieneBloqueo(hora, fecha, d.id);
                    return (
                      <div key={d.id} className={`border-l border-border px-1.5 py-1 min-h-[44px] ${bloqueado ? "bg-slate-100 dark:bg-slate-800/50" : ""}`}>
                        {bloqueado && !cita && (
                          <div className="flex items-center gap-1 rounded bg-slate-200 dark:bg-slate-700 px-2 py-1">
                            <Lock className="h-3 w-3 text-slate-500" />
                            <span className="text-[9px] text-slate-600 dark:text-slate-400">Bloqueado</span>
                          </div>
                        )}
                        {cita && <CitaCard cita={cita} onClick={() => navigate(`/cita/${cita.id}`)} />}
                      </div>
                    );
                  })}
                  {doctoresFiltrados.length === 0 && <div className="border-l border-border" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── VISTA SEMANA ────────────────────────────────────── */}
      {vista === "semana" && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <div className="min-w-[750px]">
            {/* Header días */}
            <div className="grid border-b border-border bg-muted/50" style={{ gridTemplateColumns: `80px repeat(7, 1fr)` }}>
              <div className="px-2 py-3 text-xs font-semibold text-muted-foreground">Hora</div>
              {diasSemana.map((dia) => {
                const esHoy = isSameDay(dia, new Date());
                return (
                  <div key={dia.toISOString()} className={`px-2 py-3 border-l border-border text-center ${esHoy ? "bg-primary/5" : ""}`}>
                    <p className={`text-xs font-semibold ${esHoy ? "text-primary" : "text-muted-foreground"}`}>
                      {format(dia, "EEE", { locale: es })}
                    </p>
                    <p className={`text-sm font-bold ${esHoy ? "text-primary" : "text-foreground"}`}>
                      {format(dia, "d", { locale: es })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {citasFiltradas.filter((c) => isSameDay(new Date(c.fecha_inicio), dia)).length} citas
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Slots */}
            {HORAS.map((hora) => {
              const esCompleta = hora.endsWith(":00");
              return (
                <div key={hora}
                  className={`grid ${esCompleta ? "border-t border-border" : "border-t border-border/40"}`}
                  style={{ gridTemplateColumns: `80px repeat(7, 1fr)` }}>
                  <div className={`px-2 py-2 text-xs ${esCompleta ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{hora}</div>
                  {diasSemana.map((dia) => {
                    const citasSlot = getCitaSemana(hora, dia);
                    const bloqueado  = tieneBloqueo(hora, dia);
                    const esHoy = isSameDay(dia, new Date());
                    return (
                      <div key={dia.toISOString()}
                        className={`border-l border-border px-1 py-1 min-h-[40px] ${esHoy ? "bg-primary/3" : ""} ${bloqueado ? "bg-slate-100 dark:bg-slate-800/40" : ""}`}>
                        {bloqueado && citasSlot.length === 0 && (
                          <div className="flex items-center justify-center h-full">
                            <Lock className="h-3 w-3 text-slate-400" />
                          </div>
                        )}
                        {citasSlot.map((c) => (
                          <button key={c.id} onClick={() => navigate(`/cita/${c.id}`)}
                            className={`w-full text-left rounded border-l-[3px] px-1 py-0.5 mb-0.5 text-[10px] truncate ${STATUS_BORDER[c.status]}`}>
                            {c.paciente ? `${c.paciente.nombre} ${c.paciente.apellidos[0]}.` : "Cita"}
                            {c.doctor && <span className="text-muted-foreground ml-1">— Dr. {c.doctor.apellidos}</span>}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Cargando...</p>}
      {!loading && citasFiltradas.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No hay citas para los filtros seleccionados.</p>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Confirmada</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning" /> Pendiente / Tentativa</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-info" /> Recordatorio</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Cancelada</span>
        <span className="flex items-center gap-1.5"><Lock className="h-2.5 w-2.5 text-slate-400" /> Bloqueado</span>
        <span className="flex items-center gap-1.5"><span className="text-purple-600 font-bold">↻</span> Recurrente</span>
      </div>

      {/* Detail dialog (vista día) */}
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
                <div><span className="text-muted-foreground">Servicio: </span><span className="font-medium">{seleccionada.servicio?.nombre ?? "—"}</span></div>
                {seleccionada.motivo_consulta && (
                  <div><span className="text-muted-foreground">Motivo: </span><span>{seleccionada.motivo_consulta}</span></div>
                )}
                {seleccionada.recurrencia_tipo && (
                  <div><span className="text-muted-foreground">Recurrencia: </span>
                    <span className="capitalize">{seleccionada.recurrencia_tipo} · ocurrencia {seleccionada.recurrencia_num}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={ORIGEN_STYLE[seleccionada.origen].cls}>
                    {ORIGEN_STYLE[seleccionada.origen].emoji} {ORIGEN_STYLE[seleccionada.origen].label}
                  </Badge>
                  {seleccionada.creada_por_bot && (
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                      <Bot className="h-3 w-3 mr-1" /> Bot
                    </Badge>
                  )}
                  <Badge variant="outline">{STATUS_LABEL[seleccionada.status]}</Badge>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate(`/cita/${seleccionada.id}`)}>
                  Ver detalle →
                </Button>
                {seleccionada.status === "solicitada" && (
                  <Button onClick={() => cambiarStatus(seleccionada.id, "confirmada")} disabled={accion}>
                    <CheckCircle2 className="h-4 w-4" /> Confirmar
                  </Button>
                )}
                {seleccionada.status !== "cancelada" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={accion}><XCircle className="h-4 w-4" /> Cancelar</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
                        <AlertDialogDescription>
                          El estado cambiará a "Cancelada". Si el paciente tiene Telegram, recibirá una notificación.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Volver</AlertDialogCancel>
                        <AlertDialogAction onClick={() => cambiarStatus(seleccionada.id, "cancelada")}>Sí, cancelar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Bloqueo dialog */}
      {activeClinicId && (
        <BloqueoDialog
          open={showBloqueo}
          doctores={doctores}
          clinicId={activeClinicId}
          onCreated={() => { setShowBloqueo(false); loadData(); }}
          onCancel={() => setShowBloqueo(false)}
        />
      )}

      {/* Nueva cita */}
      <NuevaCitaDialog
        open={showNueva}
        defaultDate={fecha.toISOString().slice(0, 10)}
        onSuccess={() => { setShowNueva(false); loadData(); }}
        onCancel={() => setShowNueva(false)}
      />
    </div>
  );
}
