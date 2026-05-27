import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { saveJourneyStepData, closeJourneyStep } from "@/features/camino-paciente/services/journeyEngine";
import type { StepFormProps } from "./_shared";
import { isClosed } from "./_shared";

export default function DischargeForm({
  stepId, stepStatus, existingData, onSaved,
}: StepFormProps) {
  const [indicaciones, setIndicaciones] = useState(existingData.indicaciones ?? "");
  const [saving, setSaving] = useState(false);
  const closed = isClosed(stepStatus);

  const handleConfirm = async () => {
    setSaving(true);
    const s = await saveJourneyStepData(stepId, {
      indicaciones, dado_alta_en: new Date().toISOString(),
    });
    if (!s.ok) { setSaving(false); toast.error(s.error ?? "Error"); return; }
    const c = await closeJourneyStep(stepId);
    setSaving(false);
    if (!c.ok) toast.error(c.error ?? "Error");
    else { toast.success("Paciente dado de alta"); onSaved?.(); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Registre las indicaciones de salida y marque la cita como completada.</p>
      <div className="space-y-2">
        <Label>Indicaciones al paciente</Label>
        <Textarea value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} disabled={closed} rows={4} />
      </div>
      {!closed && (
        <Button onClick={handleConfirm} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Dar de alta
        </Button>
      )}
    </div>
  );
}
