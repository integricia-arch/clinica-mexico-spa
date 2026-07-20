import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { saveJourneyStepData, closeJourneyStep } from "@/features/camino-paciente/services/journeyEngine";
import type { StepFormProps } from "./_shared";
import { isClosed, toastStepClosed } from "./_shared";

export default function ConsultationOpenForm({ stepId, stepKey, stepStatus, existingData, onSaved }: StepFormProps) {
  const [motivo, setMotivo] = useState(existingData.motivo ?? "");
  const [saving, setSaving] = useState(false);
  const closed = isClosed(stepStatus);

  const handleConfirm = async () => {
    if (!motivo.trim()) { toast.error("Indique el motivo de consulta"); return; }
    setSaving(true);
    const s = await saveJourneyStepData(stepId, {
      motivo, iniciada_en: new Date().toISOString(),
    });
    if (!s.ok) { setSaving(false); toast.error(s.error ?? "Error"); return; }
    const c = await closeJourneyStep(stepId);
    setSaving(false);
    if (!c.ok) toast.error(c.error ?? "Error");
    else { toastStepClosed(stepKey, "Consulta iniciada"); onSaved?.(); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">El médico inicia la consulta y registra el motivo principal.</p>
      <div className="space-y-2">
        <Label>Motivo de consulta <span className="text-destructive">*</span></Label>
        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={closed} rows={3} />
      </div>
      {!closed && (
        <Button onClick={handleConfirm} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Iniciar consulta
        </Button>
      )}
    </div>
  );
}
