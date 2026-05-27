import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { saveJourneyStepData, closeJourneyStep } from "@/features/camino-paciente/services/journeyEngine";
import type { StepFormProps } from "./_shared";
import { isClosed } from "./_shared";

export default function RecordForm({
  stepId, stepStatus, patientId, existingData, onSaved,
}: StepFormProps) {
  const [alergias, setAlergias] = useState(existingData.alergias ?? "");
  const [tipoSangre, setTipoSangre] = useState(existingData.tipo_sangre ?? "");
  const [antecedentes, setAntecedentes] = useState(existingData.antecedentes ?? "");
  const [medicacionActual, setMedicacionActual] = useState(existingData.medicacion_actual ?? "");
  const [saving, setSaving] = useState(false);
  const closed = isClosed(stepStatus);

  useEffect(() => {
    if (!patientId) return;
    supabase.from("patients").select("alergias,tipo_sangre,notas").eq("id", patientId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (!alergias && data.alergias) setAlergias(data.alergias);
          if (!tipoSangre && data.tipo_sangre) setTipoSangre(data.tipo_sangre);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const handleConfirm = async () => {
    setSaving(true);
    if (patientId) {
      await supabase.from("patients").update({
        alergias: alergias || null,
        tipo_sangre: tipoSangre || null,
      }).eq("id", patientId);
    }
    const s = await saveJourneyStepData(stepId, {
      alergias, tipo_sangre: tipoSangre, antecedentes, medicacion_actual: medicacionActual,
      revisado_en: new Date().toISOString(),
    });
    if (!s.ok) { setSaving(false); toast.error(s.error ?? "Error"); return; }
    const c = await closeJourneyStep(stepId);
    setSaving(false);
    if (!c.ok) toast.error(c.error ?? "Error");
    else { toast.success("Expediente actualizado"); onSaved?.(); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Revise y actualice antecedentes clínicos del paciente (NOM-004).
      </p>
      <div className="space-y-2">
        <Label>Tipo de sangre</Label>
        <Input value={tipoSangre} onChange={(e) => setTipoSangre(e.target.value)} disabled={closed} placeholder="A+, O-, etc." maxLength={20} />
      </div>
      <div className="space-y-2">
        <Label>Alergias conocidas</Label>
        <Textarea value={alergias} onChange={(e) => setAlergias(e.target.value)} disabled={closed} rows={2} />
      </div>
      <div className="space-y-2">
        <Label>Antecedentes personales / familiares</Label>
        <Textarea value={antecedentes} onChange={(e) => setAntecedentes(e.target.value)} disabled={closed} rows={3} />
      </div>
      <div className="space-y-2">
        <Label>Medicación actual</Label>
        <Textarea value={medicacionActual} onChange={(e) => setMedicacionActual(e.target.value)} disabled={closed} rows={2} />
      </div>
      {!closed && (
        <Button onClick={handleConfirm} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Confirmar expediente
        </Button>
      )}
    </div>
  );
}
