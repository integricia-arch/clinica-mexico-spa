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
import { CalendarPlus, UserPlus } from "lucide-react";
import { friendlyError } from "@/lib/errors";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import PacienteModal from "@/components/PacienteModal";

export default function NuevaCita() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const { markErrors, clearError, errorClass } = useFieldErrors();
  const [pacienteModalOpen, setPacienteModalOpen] = useState(false);

  const DRAFT_KEY = "nueva-cita-draft";

  const [form, setForm] = useState(() => {
    try {
      const saved = sessionStorage.getItem("nueva-cita-draft");
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return { patient_id: "", doctor_id: "", room_id: "", fecha: "", hora_inicio: "", hora_fin: "", motivo_consulta: "", notas: "" };
  });

  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch { /* ignore */ }
  }, [form]);

  useEffect(() => {
    Promise.all([
      (supabase as any).from("doctors").select("*").eq("activo", true).order("apellidos"),
      (supabase as any).from("patients").select("id, nombre, apellidos").eq("activo", true).order("apellidos"),
      (supabase as any).from("rooms").select("*").eq("activo", true).order("nombre"),
    ]).then(([d, p, r]) => {
      setDoctors(d.data ?? []);
      setPatients(p.data ?? []);
      setRooms(r.data ?? []);
      setDataLoaded(true);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!form.patient_id) missing.push("patient_id");
    if (!form.doctor_id) missing.push("doctor_id");
    if (!form.fecha) missing.push("fecha");
    if (!form.hora_inicio) missing.push("hora_inicio");
    if (!form.hora_fin) missing.push("hora_fin");
    if (missing.length) {
      markErrors(missing);
      toast({ variant: "destructive", title: "Campos requeridos", description: "Completa los campos marcados en rojo" });
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

      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      toast({ title: "Cita creada", description: "La cita se agendó exitosamente" });
      navigate("/agenda");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al agendar", description: friendlyError(err) });
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
          <div className="flex items-center justify-between">
            <Label>Paciente *</Label>
            <Button type="button" size="sm" variant="ghost" className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-foreground" onClick={() => setPacienteModalOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Nuevo paciente
            </Button>
          </div>
          {dataLoaded ? (
            <Select value={form.patient_id || undefined} onValueChange={(v) => { clearError("patient_id"); setForm({ ...form, patient_id: v }); }}>
              <SelectTrigger id="field-patient_id" className={errorClass("patient_id")}><SelectValue placeholder="Seleccionar paciente" /></SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.apellidos}, {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-10 rounded-md border border-input bg-muted animate-pulse" />
          )}
        </div>

        <PacienteModal
          open={pacienteModalOpen}
          onClose={() => setPacienteModalOpen(false)}
          onSaved={(p) => {
            setPacienteModalOpen(false);
            setPatients((prev) => [...prev, { id: p.id, nombre: p.nombre, apellidos: p.apellidos }]);
            setForm((f) => ({ ...f, patient_id: p.id }));
            clearError("patient_id");
          }}
        />

        {/* Médico */}
        <div className="space-y-2">
          <Label>Médico *</Label>
          {dataLoaded ? (
            <Select value={form.doctor_id || undefined} onValueChange={(v) => { clearError("doctor_id"); setForm({ ...form, doctor_id: v }); }}>
              <SelectTrigger id="field-doctor_id" className={errorClass("doctor_id")}><SelectValue placeholder="Seleccionar médico" /></SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    Dr(a). {d.nombre} {d.apellidos} — {d.especialidad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-10 rounded-md border border-input bg-muted animate-pulse" />
          )}
        </div>

        {/* Consultorio */}
        <div className="space-y-2">
          <Label>Consultorio</Label>
          {dataLoaded ? (
            <Select value={form.room_id || undefined} onValueChange={(v) => setForm({ ...form, room_id: v })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar consultorio (opcional)" /></SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre} {r.piso ? `(Piso ${r.piso})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-10 rounded-md border border-input bg-muted animate-pulse" />
          )}
        </div>

        {/* Fecha y hora */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Fecha *</Label>
            <Input
              id="field-fecha"
              type="date"
              value={form.fecha}
              onChange={(e) => { clearError("fecha"); setForm({ ...form, fecha: e.target.value }); }}
              min={new Date().toISOString().split("T")[0]}
              className={errorClass("fecha")}
            />
          </div>
          <div className="space-y-2">
            <Label>Hora inicio *</Label>
            <Input
              id="field-hora_inicio"
              type="time"
              value={form.hora_inicio}
              onChange={(e) => { clearError("hora_inicio"); setForm({ ...form, hora_inicio: e.target.value }); }}
              className={errorClass("hora_inicio")}
            />
          </div>
          <div className="space-y-2">
            <Label>Hora fin *</Label>
            <Input
              id="field-hora_fin"
              type="time"
              value={form.hora_fin}
              onChange={(e) => { clearError("hora_fin"); setForm({ ...form, hora_fin: e.target.value }); }}
              className={errorClass("hora_fin")}
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
          <Button type="button" variant="outline" onClick={() => { try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } navigate("/agenda"); }}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
