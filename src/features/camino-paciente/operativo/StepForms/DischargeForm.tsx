import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { saveJourneyStepData, closeJourneyStep } from "@/features/camino-paciente/services/journeyEngine";
import type { StepFormProps } from "./_shared";
import { isClosed } from "./_shared";

interface DocumentosEntregados {
  receta: boolean;
  instrucciones: boolean;
  referencia: boolean;
  resultados: boolean;
}

export default function DischargeForm({
  stepId, stepStatus, existingData, onSaved,
}: StepFormProps) {
  const [indicaciones, setIndicaciones] = useState<string>(existingData.indicaciones ?? "");
  const [diagnosticoFinal, setDiagnosticoFinal] = useState<string>(existingData.diagnostico_final ?? "");
  const [documentos, setDocumentos] = useState<DocumentosEntregados>({
    receta: existingData.documentos_entregados?.receta ?? false,
    instrucciones: existingData.documentos_entregados?.instrucciones ?? false,
    referencia: existingData.documentos_entregados?.referencia ?? false,
    resultados: existingData.documentos_entregados?.resultados ?? false,
  });
  const [proximaCitaDias, setProximaCitaDias] = useState<string>(
    existingData.proxima_cita_dias !== undefined && existingData.proxima_cita_dias !== null
      ? String(existingData.proxima_cita_dias)
      : ""
  );
  const [restricciones, setRestricciones] = useState<string>(existingData.restricciones ?? "");
  const [saving, setSaving] = useState(false);
  const closed = isClosed(stepStatus);

  const toggleDoc = (key: keyof DocumentosEntregados) => {
    setDocumentos((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirm = async () => {
    setSaving(true);
    const parsedDias = proximaCitaDias === "" ? null : Number(proximaCitaDias);
    const s = await saveJourneyStepData(stepId, {
      indicaciones,
      dado_alta_en: new Date().toISOString(),
      diagnostico_final: diagnosticoFinal,
      documentos_entregados: documentos,
      proxima_cita_dias: parsedDias,
      restricciones,
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
        <Label>Diagnóstico final / Impresión clínica al alta</Label>
        <Textarea
          value={diagnosticoFinal}
          onChange={(e) => setDiagnosticoFinal(e.target.value)}
          disabled={closed}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Indicaciones al paciente</Label>
        <Textarea value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} disabled={closed} rows={4} />
      </div>

      <div className="space-y-2">
        <Label>Documentos entregados al paciente</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="doc_receta"
              checked={documentos.receta}
              onCheckedChange={() => toggleDoc("receta")}
              disabled={closed}
            />
            <Label htmlFor="doc_receta" className="font-normal">Receta médica</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="doc_instrucciones"
              checked={documentos.instrucciones}
              onCheckedChange={() => toggleDoc("instrucciones")}
              disabled={closed}
            />
            <Label htmlFor="doc_instrucciones" className="font-normal">Instrucciones de cuidado</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="doc_referencia"
              checked={documentos.referencia}
              onCheckedChange={() => toggleDoc("referencia")}
              disabled={closed}
            />
            <Label htmlFor="doc_referencia" className="font-normal">Referencia a especialista</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="doc_resultados"
              checked={documentos.resultados}
              onCheckedChange={() => toggleDoc("resultados")}
              disabled={closed}
            />
            <Label htmlFor="doc_resultados" className="font-normal">Resultados de estudios</Label>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="proxima_cita_dias">Próxima cita recomendada (días)</Label>
        <Input
          id="proxima_cita_dias"
          type="number"
          min={0}
          max={365}
          placeholder="Ej. 30"
          value={proximaCitaDias}
          onChange={(e) => setProximaCitaDias(e.target.value)}
          disabled={closed}
          className="w-40"
        />
        <p className="text-xs text-muted-foreground">0 = no requiere</p>
      </div>

      <div className="space-y-2">
        <Label>Restricciones / Recomendaciones de actividad</Label>
        <Textarea
          value={restricciones}
          onChange={(e) => setRestricciones(e.target.value)}
          disabled={closed}
          rows={2}
        />
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
