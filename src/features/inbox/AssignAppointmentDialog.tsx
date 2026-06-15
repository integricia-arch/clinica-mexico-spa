import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateDaySlots, formatMx, type BusyRange } from "./availability";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversacionId: string;
  patientId: string | null;
  clinicId: string;
  notasPrecargadas?: string;
  onAssigned?: (appointmentId: string) => void;
}

interface Servicio { id: string; nombre: string; duracion_minutos: number }
interface Doctor   { id: string; nombre: string; apellidos: string; horario_inicio: string; horario_fin: string; operational_status: string; operational_status_until: string | null; operational_status_reason: string | null }
interface Room     { id: string; nombre: string }

function todayMx(): string {
  const now = new Date();
  // Pasar a fecha MX (offset -06:00)
  const mx = new Date(now.getTime() - 6 * 3600000);
  return mx.toISOString().slice(0, 10);
}

export function AssignAppointmentDialog({ open, onOpenChange, conversacionId, patientId, clinicId, notasPrecargadas, onAssigned }: Props) {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [doctores, setDoctores] = useState<Doctor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [servicioId, setServicioId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [fecha, setFecha] = useState(todayMx());
  const [slotIso, setSlotIso] = useState<string>("");
  const [busy, setBusy] = useState<BusyRange[]>([]);
  const [notas, setNotas] = useState(notasPrecargadas ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setNotas(notasPrecargadas ?? ""); }, [open, notasPrecargadas]);

  // Cargar catálogos al abrir
  useEffect(() => {
    if (!open) return;
    (async () => {
      const [s, r] = await Promise.all([
        supabase.from("servicios").select("id, nombre, duracion_minutos").eq("activo", true).order("nombre"),
        supabase.from("rooms").select("id, nombre").eq("activo", true).order("nombre"),
      ]);
      setServicios((s.data ?? []) as Servicio[]);
      setRooms((r.data ?? []) as Room[]);
    })();
  }, [open]);

  // Doctores que dan el servicio elegido
  useEffect(() => {
    if (!servicioId) { setDoctores([]); setDoctorId(""); return; }
    (async () => {
      const { data } = await supabase
        .from("doctor_servicios")
        .select("doctor:doctors(id, nombre, apellidos, horario_inicio, horario_fin, activo, operational_status, operational_status_until, operational_status_reason)")
        .eq("servicio_id", servicioId);
      const fechaIso = new Date(`${fecha}T12:00:00-06:00`);
      const lista = (data ?? [])
        .map((r) => (r as unknown as { doctor: Doctor & { activo: boolean } }).doctor)
        .filter((d) => {
          if (!d?.activo) return false;
          // suspendido nunca aparece
          if (d.operational_status === "suspended") return false;
          // si tiene status hasta una fecha y la cita cae dentro, descartar
          if (d.operational_status !== "active" && d.operational_status_until) {
            if (fechaIso <= new Date(d.operational_status_until)) return false;
          }
          // vacation/sick_leave sin until siempre descartar
          if (["vacation","sick_leave"].includes(d.operational_status) && !d.operational_status_until) return false;
          return true;
        });
      setDoctores(lista);
      setDoctorId("");
    })();
  }, [servicioId, fecha]);

  // Cargar ocupación del día (citas del doctor y del consultorio)
  useEffect(() => {
    if (!doctorId || !fecha) { setBusy([]); return; }
    (async () => {
      const startIso = `${fecha}T00:00:00-06:00`;
      const endIso   = `${fecha}T23:59:59-06:00`;
      const filters = [`doctor_id.eq.${doctorId}`];
      if (roomId) filters.push(`room_id.eq.${roomId}`);
      const { data } = await supabase
        .from("appointments")
        .select("fecha_inicio, fecha_fin, status, doctor_id, room_id")
        .gte("fecha_inicio", startIso)
        .lte("fecha_inicio", endIso)
        .or(filters.join(","));
      const activas = (data ?? []).filter((a) =>
        !["cancelada","cancelado","no_show","no_asistio"].includes(String(a.status).toLowerCase())
      );
      setBusy(activas.map((a) => ({ fecha_inicio: a.fecha_inicio, fecha_fin: a.fecha_fin })));
      setSlotIso("");
    })();
  }, [doctorId, roomId, fecha]);

  const servicio = useMemo(() => servicios.find((s) => s.id === servicioId), [servicios, servicioId]);
  const doctor = useMemo(() => doctores.find((d) => d.id === doctorId), [doctores, doctorId]);

  const slots = useMemo(() => {
    if (!servicio || !doctor) return [];
    return generateDaySlots({
      dateYmd: fecha,
      durationMin: servicio.duracion_minutos,
      doctor,
      busy,
      stepMin: 15,
    }).slice(0, 16);
  }, [servicio, doctor, fecha, busy]);

  const submit = async () => {
    if (!patientId) { toast.error("La conversación no tiene paciente asociado. Crea/asigna paciente primero."); return; }
    if (!servicioId || !doctorId || !roomId || !slotIso) { toast.error("Faltan datos"); return; }
    setSaving(true);
    const fin = new Date(new Date(slotIso).getTime() + (servicio?.duracion_minutos ?? 30) * 60000).toISOString();

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        patient_id: patientId,
        doctor_id: doctorId,
        room_id: roomId,
        servicio_id: servicioId,
        fecha_inicio: slotIso,
        fecha_fin: fin,
        status: "solicitada",
        doctor_confirmation_status: "pending",
        origen: "inbox",
        clinic_id: clinicId,
        conversacion_id: conversacionId,
        notas: notas || null,
      })
      .select("id")
      .single();

    if (error) {
      setSaving(false);
      if ((error as { code?: string }).code === "23P01" || /exclude/i.test(error.message)) {
        toast.error("Ese horario ya fue tomado");
      } else {
        toast.error("No se pudo crear la cita: " + error.message);
      }
      return;
    }

    // Audit
    await supabase.from("audit_logs").insert({
      tabla: "appointments",
      registro_id: data.id,
      accion: "cita_desde_inbox",
      datos_nuevos: { conversacion_id: conversacionId, doctor_id: doctorId, room_id: roomId, servicio_id: servicioId },
      clinic_id: clinicId,
    });

    // Notificar (no bloquea el éxito de la cita)
    supabase.functions.invoke("notify-appointment-assigned", {
      body: { appointment_id: data.id },
    }).then(({ error: ne }) => {
      if (ne) toast.message("Cita creada, pero la notificación falló: " + ne.message);
    });

    toast.success("Cita asignada y notificación enviada");
    setSaving(false);
    onAssigned?.(data.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asignar cita desde Inbox</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Servicio</Label>
            <Select value={servicioId} onValueChange={setServicioId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar servicio" /></SelectTrigger>
              <SelectContent>
                {servicios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nombre} ({s.duracion_minutos} min)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Doctor</Label>
            <Select value={doctorId} onValueChange={setDoctorId} disabled={!servicioId}>
              <SelectTrigger><SelectValue placeholder={servicioId ? "Seleccionar doctor" : "Elige servicio primero"} /></SelectTrigger>
              <SelectContent>
                {doctores.map((d) => (
                  <SelectItem key={d.id} value={d.id}>Dr(a). {d.nombre} {d.apellidos}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Consultorio</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar consultorio" /></SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} min={todayMx()} />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Horarios disponibles</Label>
            {!doctorId && <p className="text-xs text-muted-foreground">Elige servicio y doctor para ver disponibilidad.</p>}
            {doctorId && slots.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin disponibilidad ese día para ese doctor.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button
                  key={s.iso}
                  type="button"
                  onClick={() => setSlotIso(s.iso)}
                  className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                    slotIso === s.iso ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {slotIso && <p className="text-xs text-muted-foreground mt-1">Seleccionado: <strong>{formatMx(slotIso)}</strong></p>}
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Motivo, observaciones..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !patientId || !servicioId || !doctorId || !roomId || !slotIso}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Asignar y notificar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
