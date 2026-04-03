import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CalendarPlus } from "lucide-react";

export default function NuevaCita() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    patient_id: "",
    doctor_id: "",
    room_id: "",
    fecha: "",
    hora_inicio: "",
    hora_fin: "",
    motivo_consulta: "",
    notas: "",
  });

  useEffect(() => {
    Promise.all([
      supabase.from("doctors").select("*").eq("activo", true).order("apellidos"),
      supabase.from("patients").select("id, nombre, apellidos").eq("activo", true).order("apellidos"),
      supabase.from("rooms").select("*").eq("activo", true).order("nombre"),
    ]).then(([d, p, r]) => {
      setDoctors(d.data ?? []);
      setPatients(p.data ?? []);
      setRooms(r.data ?? []);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient_id || !form.doctor_id || !form.fecha || !form.hora_inicio || !form.hora_fin) {
      toast({ variant: "destructive", title: "Error", description: "Completa los campos requeridos" });
      return;
    }

    setLoading(true);
    const fecha_inicio = `${form.fecha}T${form.hora_inicio}:00`;
    const fecha_fin = `${form.fecha}T${form.hora_fin}:00`;

    try {
      const { data, error } = await supabase.functions.invoke("create-appointment", {
        body: {
          patient_id: form.patient_id,
          doctor_id: form.doctor_id,
          room_id: form.room_id || undefined,
          fecha_inicio,
          fecha_fin,
          motivo_consulta: form.motivo_consulta || undefined,
          notas: form.notas || undefined,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({ title: "Cita creada", description: "La cita se agendó exitosamente" });
      navigate("/agenda");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al agendar", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-display text-2xl font-bold text-foreground">Nueva cita</h1>
        <p className="mt-1 text-sm text-muted-foreground">Agendar una consulta médica</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 shadow-card space-y-5">
        {/* Paciente */}
        <div className="space-y-2">
          <Label>Paciente *</Label>
          <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
            <SelectTrigger><SelectValue placeholder="Seleccionar paciente" /></SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.apellidos}, {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Médico */}
        <div className="space-y-2">
          <Label>Médico *</Label>
          <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
            <SelectTrigger><SelectValue placeholder="Seleccionar médico" /></SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  Dr(a). {d.nombre} {d.apellidos} — {d.especialidad}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Consultorio */}
        <div className="space-y-2">
          <Label>Consultorio</Label>
          <Select value={form.room_id} onValueChange={(v) => setForm({ ...form, room_id: v })}>
            <SelectTrigger><SelectValue placeholder="Seleccionar consultorio (opcional)" /></SelectTrigger>
            <SelectContent>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.nombre} {r.piso ? `(Piso ${r.piso})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fecha y hora */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Fecha *</Label>
            <Input
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              min={new Date().toISOString().split("T")[0]}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Hora inicio *</Label>
            <Input
              type="time"
              value={form.hora_inicio}
              onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Hora fin *</Label>
            <Input
              type="time"
              value={form.hora_fin}
              onChange={(e) => setForm({ ...form, hora_fin: e.target.value })}
              required
            />
          </div>
        </div>

        {/* Motivo */}
        <div className="space-y-2">
          <Label>Motivo de consulta</Label>
          <Input
            placeholder="Ej: Revisión general, dolor de cabeza..."
            value={form.motivo_consulta}
            onChange={(e) => setForm({ ...form, motivo_consulta: e.target.value })}
          />
        </div>

        {/* Notas */}
        <div className="space-y-2">
          <Label>Notas adicionales</Label>
          <Textarea
            placeholder="Indicaciones especiales, alergias a considerar..."
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            {loading ? "Agendando..." : "Agendar cita"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/agenda")}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
