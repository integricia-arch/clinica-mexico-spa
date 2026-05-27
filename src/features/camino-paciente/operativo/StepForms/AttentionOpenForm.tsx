import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { saveJourneyStepData, closeJourneyStep } from "@/features/camino-paciente/services/journeyEngine";
import type { StepFormProps } from "./_shared";
import { isClosed } from "./_shared";

export default function AttentionOpenForm({
  stepId, stepStatus, existingData, onSaved,
}: StepFormProps) {
  const [notas, setNotas] = useState(existingData.notas ?? "");
  const [saving, setSaving] = useState(false);
  const closed = isClosed(stepStatus);

  const handleConfirm = async () => {
    setSaving(true);
    const s = await saveJourneyStepData(stepId, {
      llamado_en: new Date().toISOString(),
      notas,
    });
    if (!s.ok) { setSaving(false); toast.error(s.error ?? "Error"); return; }
    const c = await closeJourneyStep(stepId);
    setSaving(false);
    if (!c.ok) toast.error(c.error ?? "Error");
    else { toast.success("Paciente llamado a sala"); onSaved?.(); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Confirme que el paciente fue llamado y se está atendiendo en consultorio.
      </p>
      <div className="space-y-2">
        <Label>Notas de apertura</Label>
        <Textarea
          rows={3}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          disabled={closed}
          placeholder="Ej. Paciente acompañado, refiere mejoría"
          maxLength={500}
        />
      </div>
      {!closed && (
        <Button onClick={handleConfirm} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Confirmar atención abierta
        </Button>
      )}
    </div>
  );
}
