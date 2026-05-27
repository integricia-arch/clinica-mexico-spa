import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Check, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { saveJourneyStepData, closeJourneyStep } from "@/features/camino-paciente/services/journeyEngine";
import type { StepFormProps } from "./_shared";
import { isClosed } from "./_shared";

export default function PrescriptionStepForm({
  stepId, stepStatus, patientId, existingData, onSaved,
}: StepFormProps) {
  const [sinReceta, setSinReceta] = useState<boolean>(existingData.sin_receta ?? false);
  const [notas, setNotas] = useState(existingData.notas ?? "");
  const [recetas, setRecetas] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const closed = isClosed(stepStatus);

  useEffect(() => {
    if (!patientId) return;
    supabase.from("prescriptions")
      .select("id, prescription_number, status, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setRecetas(data ?? []));
  }, [patientId]);

  const handleConfirm = async () => {
    setSaving(true);
    const s = await saveJourneyStepData(stepId, {
      sin_receta: sinReceta,
      notas,
      recetas_ids: recetas.map((r) => r.id),
      cerrado_en: new Date().toISOString(),
    });
    if (!s.ok) { setSaving(false); toast.error(s.error ?? "Error"); return; }
    const c = await closeJourneyStep(stepId);
    setSaving(false);
    if (!c.ok) toast.error(c.error ?? "Error");
    else { toast.success("Etapa de receta cerrada"); onSaved?.(); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Genere la receta en el módulo de recetas y confirme el cierre. Si no aplica, marque "Sin receta".
      </p>
      <div className="flex items-center gap-2">
        <Checkbox id="sr" checked={sinReceta} onCheckedChange={(v) => setSinReceta(!!v)} disabled={closed} />
        <Label htmlFor="sr" className="cursor-pointer">No se requiere receta para esta consulta</Label>
      </div>
      <div className="space-y-2">
        <Label>Recetas recientes del paciente</Label>
        {recetas.length === 0 && <p className="text-xs text-muted-foreground">Sin recetas previas.</p>}
        <ul className="space-y-1 text-sm">
          {recetas.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded border p-2">
              <span className="flex items-center gap-2"><FileText className="h-3 w-3" />{r.prescription_number}</span>
              <span className="text-xs text-muted-foreground">{r.status}</span>
            </li>
          ))}
        </ul>
        <Link to="/recetas" className="text-xs text-primary underline">Abrir módulo de recetas</Link>
      </div>
      <div className="space-y-2">
        <Label>Notas</Label>
        <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} disabled={closed} rows={2} />
      </div>
      {!closed && (
        <Button onClick={handleConfirm} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Cerrar etapa de receta
        </Button>
      )}
    </div>
  );
}
