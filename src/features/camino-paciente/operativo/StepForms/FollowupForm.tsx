import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { saveJourneyStepData, closeJourneyStep } from "@/features/camino-paciente/services/journeyEngine";
import type { StepFormProps } from "./_shared";
import { isClosed } from "./_shared";

export default function FollowupForm({ stepId, stepStatus, existingData, onSaved }: StepFormProps) {
  const [tipo, setTipo] = useState(existingData.tipo ?? "llamada");
  const [fecha, setFecha] = useState(existingData.fecha ?? "");
  const [enviarRecordatorio, setEnviarRecordatorio] = useState<boolean>(existingData.enviar_recordatorio ?? true);
  const [notas, setNotas] = useState(existingData.notas ?? "");
  const [saving, setSaving] = useState(false);
  const closed = isClosed(stepStatus);

  const handleConfirm = async () => {
    setSaving(true);
    const s = await saveJourneyStepData(stepId, {
      tipo, fecha, enviar_recordatorio: enviarRecordatorio, notas,
      programado_en: new Date().toISOString(),
    });
    if (!s.ok) { setSaving(false); toast.error(s.error ?? "Error"); return; }
    const c = await closeJourneyStep(stepId);
    setSaving(false);
    if (!c.ok) toast.error(c.error ?? "Error");
    else { toast.success("Seguimiento programado"); onSaved?.(); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Programe el seguimiento post-consulta (llamada, mensaje o cita de revisión).</p>
      <div className="space-y-2">
        <Label>Tipo de seguimiento</Label>
        <Select value={tipo} onValueChange={setTipo} disabled={closed}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="llamada">Llamada telefónica</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="email">Correo electrónico</SelectItem>
            <SelectItem value="cita_revision">Cita de revisión</SelectItem>
            <SelectItem value="ninguno">Sin seguimiento</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Fecha objetivo</Label>
        <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={closed} />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="er" checked={enviarRecordatorio} onCheckedChange={(v) => setEnviarRecordatorio(!!v)} disabled={closed} />
        <Label htmlFor="er" className="cursor-pointer">Enviar recordatorio automático</Label>
      </div>
      <div className="space-y-2">
        <Label>Notas</Label>
        <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} disabled={closed} rows={2} />
      </div>
      {!closed && (
        <Button onClick={handleConfirm} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Programar seguimiento
        </Button>
      )}
    </div>
  );
}
