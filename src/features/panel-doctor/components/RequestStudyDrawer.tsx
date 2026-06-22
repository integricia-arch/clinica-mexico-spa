import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/errors";
import { requestStudy } from "../services/studiesService";
import { advancePatientJourneyFromClinicalEvent } from "@/features/camino-paciente/services/clinicalEvents";

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  doctorId: string;
  clinicId: string;
  appointmentId?: string | null;
  journeyInstanceId?: string | null;
  expedienteId?: string | null;
  onCreated?: () => void;
}

export default function RequestStudyDrawer({
  open, onClose, patientId, doctorId, clinicId, appointmentId, journeyInstanceId, expedienteId, onCreated,
}: Props) {
  const { toast } = useToast();
  const [tipo, setTipo] = useState<"lab" | "imagen" | "otro">("lab");
  const [nombre, setNombre] = useState("");
  const [motivo, setMotivo] = useState("");
  const [prioridad, setPrioridad] = useState<"rutina" | "urgente" | "stat">("rutina");
  const [ayuno, setAyuno] = useState(false);
  const [indicaciones, setIndicaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTipo("lab"); setNombre(""); setMotivo(""); setPrioridad("rutina");
    setAyuno(false); setIndicaciones("");
  };

  const submit = async () => {
    if (!nombre.trim()) {
      toast({ variant: "destructive", title: "Falta nombre del estudio" });
      return;
    }
    setSaving(true);
    try {
      const study = await requestStudy({
        patient_id: patientId,
        doctor_id: doctorId,
        clinic_id: clinicId,
        appointment_id: appointmentId ?? null,
        journey_instance_id: journeyInstanceId ?? null,
        expediente_id: expedienteId ?? null,
        tipo, nombre, motivo: motivo || null, prioridad,
        requiere_ayuno: ayuno,
        indicaciones_paciente: indicaciones || null,
      });
      if (journeyInstanceId) {
        await advancePatientJourneyFromClinicalEvent("study_requested", {
          journey_instance_id: journeyInstanceId,
          study_id: study.id,
        });
      }
      toast({ title: "Estudio solicitado" });
      reset();
      onCreated?.();
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: friendlyError(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Solicitar análisis o estudio</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lab">Laboratorio</SelectItem>
                  <SelectItem value="imagen">Imagen</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioridad</Label>
              <Select value={prioridad} onValueChange={(v: any) => setPrioridad(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rutina">Rutina</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                  <SelectItem value="stat">STAT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Nombre del estudio</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Biometría hemática" />
          </div>
          <div>
            <Label className="text-xs">Motivo clínico</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label className="text-sm">Requiere ayuno</Label>
            <Switch checked={ayuno} onCheckedChange={setAyuno} />
          </div>
          <div>
            <Label className="text-xs">Indicaciones al paciente</Label>
            <Textarea value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} rows={2} />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Solicitar"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
