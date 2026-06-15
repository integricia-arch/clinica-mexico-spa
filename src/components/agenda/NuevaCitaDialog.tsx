import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import PacienteModal from "@/components/PacienteModal";

interface Doctor  { id: string; nombre: string; apellidos: string; especialidad: string | null }
interface Servicio { id: string; nombre: string }
interface Patient { id: string; nombre: string; apellidos: string; telefono: string | null }

interface Props {
  open: boolean;
  defaultDate?: string;   // YYYY-MM-DD
  onSuccess: () => void;
  onCancel: () => void;
}

const DURACIONES = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "1 hora" },
  { value: "90", label: "1 h 30 min" },
];

function toDatetimeLocal(iso: string) {
  return iso.slice(0, 16);
}

function addMinutes(datetime: string, mins: number): string {
  const d = new Date(datetime);
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString().slice(0, 16);
}

export default function NuevaCitaDialog({ open, defaultDate, onSuccess, onCancel }: Props) {
  const { user } = useAuth();

  const [doctores,  setDoctores]  = useState<Doctor[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [pacientes, setPacientes] = useState<Patient[]>([]);
  const [busqueda,  setBusqueda]  = useState("");
  const [searching, setSearching] = useState(false);

  const computeDefaultDatetime = () => {
    const base = defaultDate ? new Date(defaultDate + "T09:00:00") : new Date();
    base.setMinutes(0, 0, 0);
    if (!defaultDate) base.setHours(base.getHours() + 1);
    return toDatetimeLocal(base.toISOString());
  };

  const [doctorId,  setDoctorId]  = useState("");
  const [pacienteId, setPacienteId] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [fechaInicio, setFechaInicio] = useState(() => computeDefaultDatetime());
  const [duracion, setDuracion]   = useState("30");
  const [servicioId, setServicioId] = useState("__none__");
  const [motivo,    setMotivo]    = useState("");
  const [saving,    setSaving]    = useState(false);
  const [pacienteModalOpen, setPacienteModalOpen] = useState(false);
  const [recurrente, setRecurrente]         = useState(false);
  const [recurrenciaTipo, setRecurrenciaTipo] = useState<"semanal" | "quincenal" | "mensual">("semanal");
  const [recurrenciaHasta, setRecurrenciaHasta] = useState("");

  function generarOcurrencias(inicio: string, tipo: string, hasta: string): string[] {
    const dates: string[] = [];
    const fin = new Date(hasta + "T23:59:59");
    const cur = new Date(inicio);
    let n = 0;
    while (true) {
      if (n > 0) {
        if (tipo === "semanal")    cur.setDate(cur.getDate() + 7);
        else if (tipo === "quincenal") cur.setDate(cur.getDate() + 14);
        else if (tipo === "mensual") cur.setMonth(cur.getMonth() + 1);
      }
      if (cur > fin || n > 52) break;
      dates.push(cur.toISOString());
      n++;
    }
    return dates;
  }

  useEffect(() => {
    if (!open) return;
    setDoctorId(""); setPacienteId(""); setSelectedPatient(null); setBusqueda(""); setPacientes([]);
    setFechaInicio(computeDefaultDatetime()); setDuracion("30");
    setServicioId("__none__"); setMotivo(""); setSaving(false);

    Promise.all([
      supabase.from("doctors").select("id,nombre,apellidos,especialidad").eq("activo", true).order("apellidos"),
      supabase.from("servicios").select("id,nombre").order("nombre"),
    ]).then(([{ data: d }, { data: s }]) => {
      setDoctores((d ?? []) as Doctor[]);
      setServicios((s ?? []) as Servicio[]);
    });
  }, [open]);

  useEffect(() => {
    const q = busqueda.trim();
    if (q.length < 2) { setPacientes([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("patients")
        .select("id,nombre,apellidos,telefono")
        .or(`nombre.ilike.%${q}%,apellidos.ilike.%${q}%`)
        .order("apellidos")
        .limit(10);
      setPacientes((data ?? []) as Patient[]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const fechaFin = addMinutes(fechaInicio, Number(duracion));

  async function handleSubmit() {
    if (!doctorId)   { toast.error("Selecciona un médico");   return; }
    if (!pacienteId) { toast.error("Selecciona un paciente"); return; }
    if (!fechaInicio) { toast.error("Fecha/hora requerida");  return; }
    if (recurrente && !recurrenciaHasta) { toast.error("Indica la fecha hasta cuándo se repite"); return; }

    setSaving(true);
    const toUTC = (iso: string) => new Date(iso.includes("T") ? iso : iso + "T00:00:00").toISOString();
    const durMin = Number(duracion);

    const basePayload = {
      doctor_id:       doctorId,
      patient_id:      pacienteId,
      servicio_id:     servicioId !== "__none__" ? servicioId : null,
      motivo_consulta: motivo.trim() || null,
      origen:          "web" as const,
      creada_por_bot:  false,
      status:          "confirmada",
      created_by:      user?.id ?? null,
      recurrencia_tipo: recurrente ? recurrenciaTipo : null,
    };

    if (!recurrente) {
      const { error } = await supabase.from("appointments").insert({
        ...basePayload,
        fecha_inicio: toUTC(fechaInicio),
        fecha_fin:    toUTC(fechaFin),
        recurrencia_num: 1,
      });
      setSaving(false);
      if (error) { toast.error("No se pudo crear la cita: " + error.message); return; }
      toast.success("Cita creada");
      onSuccess();
      return;
    }

    // Recurrente: insertar primera, luego las siguientes con cita_padre_id
    const fechas = generarOcurrencias(toUTC(fechaInicio), recurrenciaTipo, recurrenciaHasta);
    if (fechas.length === 0) { toast.error("No hay ocurrencias en ese rango"); setSaving(false); return; }

    const { data: primera, error: e1 } = await supabase.from("appointments")
      .insert({
        ...basePayload,
        fecha_inicio:    fechas[0],
        fecha_fin:       new Date(new Date(fechas[0]).getTime() + durMin * 60000).toISOString(),
        recurrencia_num: 1,
        recurrencia_hasta: recurrenciaHasta,
      })
      .select("id").single();

    if (e1 || !primera) { toast.error("Error al crear primera cita: " + e1?.message); setSaving(false); return; }

    if (fechas.length > 1) {
      const siguientes = fechas.slice(1).map((f, i) => ({
        ...basePayload,
        fecha_inicio:      f,
        fecha_fin:         new Date(new Date(f).getTime() + durMin * 60000).toISOString(),
        cita_padre_id:     primera.id,
        recurrencia_num:   i + 2,
        recurrencia_hasta: recurrenciaHasta,
      }));
      const { error: e2 } = await supabase.from("appointments").insert(siguientes);
      if (e2) { toast.error("Citas recurrentes creadas con errores: " + e2.message); setSaving(false); return; }
    }

    setSaving(false);
    toast.success(`Serie de ${fechas.length} citas creada (${recurrenciaTipo})`);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva cita</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Paciente */}
          <div className="space-y-1.5">
            <Label>Paciente</Label>
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{selectedPatient.nombre} {selectedPatient.apellidos}</span>
                <button
                  onClick={() => { setPacienteId(""); setSelectedPatient(null); setBusqueda(""); }}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <Input
                  placeholder="Buscar por nombre o apellido…"
                  value={busqueda}
                  onChange={(e) => { setBusqueda(e.target.value); setPacienteId(""); }}
                  autoFocus
                />
                {busqueda.length >= 2 && (
                  <div className="rounded-lg border border-border bg-popover shadow-md">
                    {searching && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Buscando…</p>
                    )}
                    {!searching && pacientes.length === 0 && (
                      <div className="px-3 py-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">Sin resultados</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs h-7"
                          onClick={() => setPacienteModalOpen(true)}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Registrar paciente
                        </Button>
                      </div>
                    )}
                    {pacientes.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setPacienteId(p.id); setSelectedPatient(p); setBusqueda(p.nombre + " " + p.apellidos); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                      >
                        <span className="font-medium">{p.nombre} {p.apellidos}</span>
                        {p.telefono && <span className="ml-2 text-xs text-muted-foreground">{p.telefono}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Médico */}
          <div className="space-y-1.5">
            <Label>Médico</Label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un médico…" />
              </SelectTrigger>
              <SelectContent>
                {doctores.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    Dr. {d.nombre} {d.apellidos}
                    {d.especialidad && <span className="ml-1 text-xs text-muted-foreground">· {d.especialidad}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fecha y duración */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha y hora</Label>
              <Input
                type="datetime-local"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duración</Label>
              <Select value={duracion} onValueChange={setDuracion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURACIONES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Servicio (opcional) */}
          <div className="space-y-1.5">
            <Label>Servicio <span className="text-xs text-muted-foreground">(opcional)</span></Label>
            <Select value={servicioId} onValueChange={setServicioId}>
              <SelectTrigger>
                <SelectValue placeholder="Sin especificar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin especificar</SelectItem>
                {servicios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motivo (opcional) */}
          <div className="space-y-1.5">
            <Label>Motivo de consulta <span className="text-xs text-muted-foreground">(opcional)</span></Label>
            <Textarea
              rows={2}
              placeholder="Descripción breve del motivo…"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>

          {/* Recurrencia */}
          <div className="rounded-lg border border-border/60 px-3 py-3 space-y-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="recurrente" checked={recurrente}
                onChange={(e) => setRecurrente(e.target.checked)} />
              <Label htmlFor="recurrente" className="cursor-pointer text-sm">Cita recurrente</Label>
            </div>
            {recurrente && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Frecuencia</Label>
                  <Select value={recurrenciaTipo} onValueChange={(v) => setRecurrenciaTipo(v as typeof recurrenciaTipo)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semanal">Semanal (cada 7 días)</SelectItem>
                      <SelectItem value="quincenal">Quincenal (cada 14 días)</SelectItem>
                      <SelectItem value="mensual">Mensual (mismo día)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Repetir hasta</Label>
                  <Input type="date" value={recurrenciaHasta}
                    min={fechaInicio.slice(0, 10)}
                    onChange={(e) => setRecurrenciaHasta(e.target.value)} required={recurrente} />
                </div>
                {recurrenciaHasta && (
                  <p className="col-span-2 text-xs text-muted-foreground">
                    Se crearán {generarOcurrencias(
                      new Date(fechaInicio).toISOString(), recurrenciaTipo, recurrenciaHasta
                    ).length} citas en la serie.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !doctorId || !pacienteId}>
            {saving ? "Guardando…" : "Crear cita"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <PacienteModal
        open={pacienteModalOpen}
        onClose={() => setPacienteModalOpen(false)}
        onSaved={(p) => {
          const pat: Patient = { id: p.id, nombre: p.nombre, apellidos: p.apellidos, telefono: p.telefono ?? null };
          setSelectedPatient(pat);
          setPacienteId(p.id);
          setPacienteModalOpen(false);
        }}
      />
    </Dialog>
  );
}
