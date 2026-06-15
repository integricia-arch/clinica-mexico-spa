import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Globe, Send, MessageCircle, Phone, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import NuevaCitaDialog from "@/components/agenda/NuevaCitaDialog";

type Status = "solicitada" | "confirmada" | "cancelada" | "recordatorio_enviado";
const STATUSES: Status[] = ["solicitada", "confirmada", "recordatorio_enviado", "cancelada"];

interface Doctor { id: string; nombre: string; apellidos: string; activo: boolean; }
interface Cita {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  status: Status;
  origen: string;
  motivo_consulta: string | null;
  notas: string | null;
  creada_por_bot: boolean;
  patient_id: string;
  doctor_id: string;
  servicio_id: string | null;
  patients: { id: string; nombre: string; apellidos: string; telefono: string | null } | null;
  doctors: { id: string; nombre: string; apellidos: string } | null;
  servicios: { id: string; nombre: string } | null;
}

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  solicitada: { label: "Solicitada", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  confirmada: { label: "Confirmada", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  recordatorio_enviado: { label: "Recordada", cls: "bg-primary/15 text-primary" },
  cancelada: { label: "Cancelada", cls: "bg-destructive/15 text-destructive" },
};

function statusMeta(s: string): { label: string; cls: string } {
  return STATUS_META[s as Status] ?? { label: s, cls: "bg-muted text-muted-foreground" };
}

const ORIGEN_META: Record<string, { Icon: any; cls: string }> = {
  telegram: { Icon: Send, cls: "text-sky-500" },
  whatsapp: { Icon: Phone, cls: "text-emerald-500" },
  web: { Icon: Globe, cls: "text-primary" },
};

function toMX(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
    timeStyle: "short",
    ...opts,
  });
}

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

export default function Citas() {
  const navigate = useNavigate();
  const today = new Date();
  const in7 = new Date(); in7.setDate(in7.getDate() + 7);

  const [from, setFrom] = useState(ymd(today));
  const [to, setTo] = useState(ymd(in7));
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<Set<Status>>(new Set(STATUSES));
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Cita | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showNueva, setShowNueva] = useState(false);

  useEffect(() => {
    supabase.from("doctors").select("id,nombre,apellidos,activo").eq("activo", true)
      .order("nombre").then(({ data }) => setDoctors((data ?? []) as Doctor[]));
  }, []);

  const fetchCitas = async () => {
    setLoading(true);
    // Explicit Mexico City offset (-06:00) so range is always correct regardless of browser timezone
    const start = new Date(from + "T00:00:00-06:00").toISOString();
    const end = new Date(to + "T23:59:59-06:00").toISOString();
    let q = supabase
      .from("appointments")
      .select("*, patients(id,nombre,apellidos,telefono), doctors(id,nombre,apellidos), servicios(id,nombre)")
      .gte("fecha_inicio", start)
      .lte("fecha_inicio", end)
      .order("fecha_inicio", { ascending: true });
    if (doctorFilter !== "all") q = q.eq("doctor_id", doctorFilter);
    const { data, error } = await q;
    if (error) { toast.error("Error cargando citas"); setLoading(false); return; }
    setCitas((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { fetchCitas();   }, [from, to, doctorFilter]);

  const filtered = useMemo(
    () => citas.filter((c) => statusFilter.has(c.status)),
    [citas, statusFilter],
  );

  const toggleStatus = (s: Status) => {
    const n = new Set(statusFilter);
    n.has(s) ? n.delete(s) : n.add(s);
    setStatusFilter(n);
  };

  const cambiarStatus = async (nuevo: Status) => {
    if (!selected) return;
    setUpdating(true);
    const { error } = await supabase.from("appointments").update({ status: nuevo }).eq("id", selected.id);
    setUpdating(false);
    if (error) { toast.error("No se pudo actualizar"); return; }
    toast.success("Status actualizado");
    setSelected({ ...selected, status: nuevo });
    fetchCitas();
  };

  const verConversacion = async () => {
    if (!selected?.patient_id) return;
    const { data: ident } = await supabase
      .from("identidades_canal").select("id").eq("patient_id", selected.patient_id).limit(1).maybeSingle();
    if (!ident) { toast.info("Paciente sin canal asociado"); return; }
    const { data: conv } = await supabase
      .from("conversaciones").select("id").eq("identidad_canal_id", ident.id)
      .order("last_message_at", { ascending: false }).limit(1).maybeSingle();
    if (!conv) { toast.info("Sin conversación previa"); return; }
    navigate(`/conversaciones?id=${conv.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-2xl font-bold">Citas</h1>
          <p className="text-sm text-muted-foreground">Gestión de citas programadas</p>
        </div>
        <Button onClick={() => setShowNueva(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nueva cita
        </Button>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-card p-4 grid gap-3 md:grid-cols-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Desde</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Hasta</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Médico</label>
          <Select value={doctorFilter} onValueChange={setDoctorFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.nombre} {d.apellidos}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <div className="flex flex-wrap gap-1 pt-1">
            {STATUSES.map((s) => {
              const active = statusFilter.has(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded-full border transition-colors",
                    active ? STATUS_META[s].cls + " border-transparent" : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {STATUS_META[s].label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-3">Paciente</th>
                <th className="text-left px-4 py-3">Servicio</th>
                <th className="text-left px-4 py-3">Médico</th>
                <th className="text-left px-4 py-3">Fecha y hora</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Origen</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Sin citas en el rango seleccionado</td></tr>
              )}
              {filtered.map((c) => {
                const O = ORIGEN_META[c.origen] ?? { Icon: Globe, cls: "text-muted-foreground" };
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className="border-t border-border hover:bg-muted/40 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium">
                      {c.patients ? `${c.patients.nombre} ${c.patients.apellidos}` : "—"}
                    </td>
                    <td className="px-4 py-3">{c.servicios?.nombre ?? "—"}</td>
                    <td className="px-4 py-3">{c.doctors ? `${c.doctors.nombre} ${c.doctors.apellidos}` : "—"}</td>
                    <td className="px-4 py-3">{toMX(c.fecha_inicio)}</td>
                    <td className="px-4 py-3">
                      <Badge className={cn("border-transparent", statusMeta(c.status).cls)}>
                        {statusMeta(c.status).label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <O.Icon className={cn("h-3.5 w-3.5", O.cls)} />
                        <span className="capitalize">{c.origen}</span>
                        {c.creada_por_bot && <span className="text-[10px] text-muted-foreground">(bot)</span>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal detalle */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selected.patients ? `${selected.patients.nombre} ${selected.patients.apellidos}` : "Cita"}
                </DialogTitle>
                <DialogDescription>
                  {toMX(selected.fecha_inicio)} — {toMX(selected.fecha_fin, { dateStyle: undefined, timeStyle: "short" })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Servicio" value={selected.servicios?.nombre} />
                  <Info label="Médico" value={selected.doctors ? `${selected.doctors.nombre} ${selected.doctors.apellidos}` : "—"} />
                  <Info label="Teléfono" value={selected.patients?.telefono ?? "—"} />
                  <Info label="Origen" value={`${selected.origen}${selected.creada_por_bot ? " (bot)" : ""}`} />
                </div>
                {selected.motivo_consulta && <Info label="Motivo" value={selected.motivo_consulta} />}
                {selected.notas && <Info label="Notas" value={selected.notas} />}

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Cambiar status</label>
                  <Select value={selected.status} onValueChange={(v) => cambiarStatus(v as Status)} disabled={updating}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => navigate(`/cita/${selected.id}`)}>Ver detalle</Button>
                  <Button variant="outline" onClick={verConversacion}>
                    <MessageCircle className="h-4 w-4 mr-1.5" /> Ver conversación
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <NuevaCitaDialog
        open={showNueva}
        onSuccess={() => { setShowNueva(false); fetchCitas(); }}
        onCancel={() => setShowNueva(false)}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase font-semibold text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}
