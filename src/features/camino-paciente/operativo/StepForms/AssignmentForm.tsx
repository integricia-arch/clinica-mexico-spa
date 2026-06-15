import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { saveJourneyStepData, closeJourneyStep } from "@/features/camino-paciente/services/journeyEngine";
import type { StepFormProps } from "./_shared";
import { isClosed } from "./_shared";

interface DoctorRow { id: string; nombre: string; apellidos: string; }
interface RoomRow { id: string; nombre: string; }
interface ServicioRow { id: string; nombre: string; }
interface ApptIds { doctor_id: string | null; room_id: string | null; servicio_id: string | null; }

export default function AssignmentForm({
  stepId, stepStatus, appointmentId, existingData, onSaved,
}: StepFormProps) {
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [servicios, setServicios] = useState<ServicioRow[]>([]);
  const [doctorId, setDoctorId] = useState<string>(existingData.doctor_id ?? "");
  const [roomId, setRoomId] = useState<string>(existingData.room_id ?? "");
  const [servicioId, setServicioId] = useState<string>(existingData.servicio_id ?? "");
  const [saving, setSaving] = useState(false);
  const closed = isClosed(stepStatus);

  useEffect(() => {
    (async () => {
      const [d, r, s, appt] = await Promise.all([
        supabase.from("doctors").select("id,nombre,apellidos").eq("activo", true).order("apellidos"),
        supabase.from("rooms").select("id,nombre").eq("activo", true).order("nombre"),
        supabase.from("servicios").select("id,nombre").eq("activo", true).order("nombre"),
        appointmentId
          ? supabase.from("appointments").select("doctor_id,room_id,servicio_id").eq("id", appointmentId).maybeSingle()
          : Promise.resolve({ data: null as ApptIds | null }),
      ]);
      setDoctors(d.data ?? []);
      setRooms(r.data ?? []);
      setServicios(s.data ?? []);
      if (appt.data) {
        const d2 = appt.data;
        if (!doctorId && d2.doctor_id) setDoctorId(d2.doctor_id);
        if (!roomId && d2.room_id) setRoomId(d2.room_id);
        if (!servicioId && d2.servicio_id) setServicioId(d2.servicio_id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  const handleConfirm = async () => {
    if (!doctorId || !roomId) {
      toast.error("Doctor y consultorio son obligatorios");
      return;
    }
    setSaving(true);
    if (appointmentId) {
      await supabase
        .from("appointments")
        .update({ doctor_id: doctorId, room_id: roomId, servicio_id: servicioId || null })
        .eq("id", appointmentId);
    }
    const s = await saveJourneyStepData(stepId, {
      doctor_id: doctorId, room_id: roomId, servicio_id: servicioId || null,
      asignado_en: new Date().toISOString(),
    });
    if (!s.ok) { setSaving(false); toast.error(s.error ?? "Error al guardar"); return; }
    const c = await closeJourneyStep(stepId);
    setSaving(false);
    if (!c.ok) toast.error(c.error ?? "Error al cerrar");
    else { toast.success("Asignación confirmada"); onSaved?.(); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Confirme el médico tratante y el consultorio asignado para esta cita.
      </p>

      <div className="space-y-2">
        <Label>Médico tratante <span className="text-destructive">*</span></Label>
        <Select value={doctorId} onValueChange={setDoctorId} disabled={closed}>
          <SelectTrigger><SelectValue placeholder="Seleccionar médico" /></SelectTrigger>
          <SelectContent>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>Dr(a). {d.nombre} {d.apellidos}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Consultorio <span className="text-destructive">*</span></Label>
        <Select value={roomId} onValueChange={setRoomId} disabled={closed}>
          <SelectTrigger><SelectValue placeholder="Seleccionar consultorio" /></SelectTrigger>
          <SelectContent>
            {rooms.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Servicio</Label>
        <Select value={servicioId} onValueChange={setServicioId} disabled={closed}>
          <SelectTrigger><SelectValue placeholder="Seleccionar servicio" /></SelectTrigger>
          <SelectContent>
            {servicios.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!closed && (
        <Button onClick={handleConfirm} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Confirmar asignación
        </Button>
      )}
    </div>
  );
}
