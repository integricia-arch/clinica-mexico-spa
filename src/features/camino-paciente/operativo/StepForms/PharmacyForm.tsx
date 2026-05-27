import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { saveJourneyStepData, closeJourneyStep } from "@/features/camino-paciente/services/journeyEngine";
import type { StepFormProps } from "./_shared";
import { isClosed } from "./_shared";

export default function PharmacyForm({ stepId, stepStatus, existingData, onSaved }: StepFormProps) {
  const [resultado, setResultado] = useState<string>(existingData.resultado ?? "entregado");
  const [notas, setNotas] = useState(existingData.notas ?? "");
  const [saving, setSaving] = useState(false);
  const closed = isClosed(stepStatus);

  const handleConfirm = async () => {
    setSaving(true);
    const s = await saveJourneyStepData(stepId, {
      resultado, notas, entregado_en: new Date().toISOString(),
    });
    if (!s.ok) { setSaving(false); toast.error(s.error ?? "Error"); return; }
    const c = await closeJourneyStep(stepId);
    setSaving(false);
    if (!c.ok) toast.error(c.error ?? "Error");
    else { toast.success("Farmacia cerrada"); onSaved?.(); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Registre la entrega/surtido del medicamento. Los movimientos de inventario se capturan en el módulo de farmacia.
      </p>
      <RadioGroup value={resultado} onValueChange={setResultado} disabled={closed}>
        <div className="flex items-center gap-2"><RadioGroupItem value="entregado" id="r-ent" /><Label htmlFor="r-ent">Entregado completo</Label></div>
        <div className="flex items-center gap-2"><RadioGroupItem value="parcial" id="r-par" /><Label htmlFor="r-par">Entrega parcial</Label></div>
        <div className="flex items-center gap-2"><RadioGroupItem value="surtir_externo" id="r-ext" /><Label htmlFor="r-ext">Paciente surtirá externamente</Label></div>
        <div className="flex items-center gap-2"><RadioGroupItem value="no_aplica" id="r-na" /><Label htmlFor="r-na">No aplica</Label></div>
      </RadioGroup>
      <div className="space-y-2">
        <Label>Notas</Label>
        <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} disabled={closed} rows={2} />
      </div>
      {!closed && (
        <Button onClick={handleConfirm} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Confirmar entrega
        </Button>
      )}
    </div>
  );
}
