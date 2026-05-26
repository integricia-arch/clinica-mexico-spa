import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Check, Stethoscope } from "lucide-react";
import { z } from "zod";
import {
  saveJourneyStepData,
  closeJourneyStep,
} from "@/features/camino-paciente/services/journeyEngine";

const consultationSchema = z.object({
  anamnesis: z.string().trim().min(10, "La anamnesis debe tener al menos 10 caracteres").max(3000, "Máximo 3000 caracteres"),
  subjetivo: z.string().trim().max(2000, "Máximo 2000 caracteres").optional().or(z.literal("")),
  objetivo: z.string().trim().max(2000, "Máximo 2000 caracteres").optional().or(z.literal("")),
  analisis: z.string().trim().max(2000, "Máximo 2000 caracteres").optional().or(z.literal("")),
  plan: z.string().trim().max(2000, "Máximo 2000 caracteres").optional().or(z.literal("")),
  diagnostico_principal: z.string().trim().min(3, "Capture el diagnóstico principal").max(500, "Máximo 500 caracteres"),
});

export type ConsultationData = {
  anamnesis?: string;
  subjetivo?: string;
  objetivo?: string;
  analisis?: string;
  plan?: string;
  diagnostico_principal?: string;
  cerrada_en?: string;
};

interface Props {
  stepId: string;
  stepStatus: string;
  existingData: ConsultationData;
  onSaved?: () => void;
}

export default function ConsultationForm({ stepId, stepStatus, existingData, onSaved }: Props) {
  const [anamnesis, setAnamnesis] = useState(existingData.anamnesis ?? "");
  const [subjetivo, setSubjetivo] = useState(existingData.subjetivo ?? "");
  const [objetivo, setObjetivo] = useState(existingData.objetivo ?? "");
  const [analisis, setAnalisis] = useState(existingData.analisis ?? "");
  const [plan, setPlan] = useState(existingData.plan ?? "");
  const [diagnostico, setDiagnostico] = useState(existingData.diagnostico_principal ?? "");
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [autoStatus, setAutoStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const isClosed = stepStatus === "completed" || stepStatus === "skipped";

  useEffect(() => {
    setAnamnesis(existingData.anamnesis ?? "");
    setSubjetivo(existingData.subjetivo ?? "");
    setObjetivo(existingData.objetivo ?? "");
    setAnalisis(existingData.analisis ?? "");
    setPlan(existingData.plan ?? "");
    setDiagnostico(existingData.diagnostico_principal ?? "");
  }, [
    existingData.anamnesis,
    existingData.subjetivo,
    existingData.objetivo,
    existingData.analisis,
    existingData.plan,
    existingData.diagnostico_principal,
  ]);

  // Autosave debounced
  useEffect(() => {
    if (isClosed) return;
    const initial =
      anamnesis === (existingData.anamnesis ?? "") &&
      subjetivo === (existingData.subjetivo ?? "") &&
      objetivo === (existingData.objetivo ?? "") &&
      analisis === (existingData.analisis ?? "") &&
      plan === (existingData.plan ?? "") &&
      diagnostico === (existingData.diagnostico_principal ?? "");
    if (initial) return;
    // Sólo autoguardar si hay contenido mínimo para evitar ruido
    if (anamnesis.trim().length < 10) return;

    setAutoStatus("saving");
    const t = setTimeout(async () => {
      const r = await saveJourneyStepData(stepId, {
        anamnesis,
        subjetivo,
        objetivo,
        analisis,
        plan,
        diagnostico_principal: diagnostico,
      });
      if (r.ok) {
        setAutoStatus("saved");
        onSaved?.();
        setTimeout(() => setAutoStatus("idle"), 1200);
      } else {
        setAutoStatus("error");
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [anamnesis, subjetivo, objetivo, analisis, plan, diagnostico, stepId, isClosed, existingData, onSaved]);

  const buildPayload = () => ({
    anamnesis,
    subjetivo,
    objetivo,
    analisis,
    plan,
    diagnostico_principal: diagnostico,
  });

  const handleSave = async () => {
    const parsed = consultationSchema.safeParse(buildPayload());
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSaving(true);
    const r = await saveJourneyStepData(stepId, parsed.data);
    setSaving(false);
    if (!r.ok) toast.error(r.error ?? "Error al guardar");
    else {
      toast.success("Nota clínica guardada");
      onSaved?.();
    }
  };

  const handleCloseConsultation = async () => {
    const parsed = consultationSchema.safeParse(buildPayload());
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setClosing(true);
    const s = await saveJourneyStepData(stepId, {
      ...parsed.data,
      cerrada_en: new Date().toISOString(),
    });
    if (!s.ok) {
      setClosing(false);
      toast.error(s.error ?? "Error al guardar");
      return;
    }
    const c = await closeJourneyStep(stepId);
    setClosing(false);
    if (!c.ok) toast.error(c.error ?? "Error al cerrar");
    else {
      toast.success("Consulta cerrada. Siguiente hito abierto.");
      onSaved?.();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Stethoscope className="h-3 w-3" /> Capture anamnesis y nota clínica (SOAP). Al cerrar se habilita el siguiente hito.
        </p>
        {autoStatus === "saving" && (
          <Badge variant="outline" className="gap-1 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
          </Badge>
        )}
        {autoStatus === "saved" && (
          <Badge variant="outline" className="gap-1 text-xs bg-success/10 text-success border-success/30">
            <Check className="h-3 w-3" /> Guardado
          </Badge>
        )}
        {autoStatus === "error" && (
          <Badge variant="outline" className="gap-1 text-xs bg-destructive/10 text-destructive border-destructive/30">
            Error al guardar
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="anamnesis">
          Anamnesis <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="anamnesis"
          rows={4}
          value={anamnesis}
          onChange={(e) => setAnamnesis(e.target.value)}
          placeholder="Padecimiento actual, antecedentes relevantes, evolución…"
          disabled={isClosed}
          maxLength={3000}
        />
        <p className="text-[10px] text-muted-foreground text-right">{anamnesis.length}/3000</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="subjetivo">S — Subjetivo</Label>
          <Textarea id="subjetivo" rows={3} value={subjetivo} onChange={(e) => setSubjetivo(e.target.value)} placeholder="Lo que refiere el paciente" disabled={isClosed} maxLength={2000} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="objetivo">O — Objetivo</Label>
          <Textarea id="objetivo" rows={3} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Exploración física, signos, hallazgos" disabled={isClosed} maxLength={2000} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="analisis">A — Análisis</Label>
          <Textarea id="analisis" rows={3} value={analisis} onChange={(e) => setAnalisis(e.target.value)} placeholder="Interpretación clínica, diagnósticos diferenciales" disabled={isClosed} maxLength={2000} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan">P — Plan</Label>
          <Textarea id="plan" rows={3} value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Indicaciones, estudios, tratamiento, seguimiento" disabled={isClosed} maxLength={2000} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dx">
          Diagnóstico principal <span className="text-destructive">*</span>
        </Label>
        <Input
          id="dx"
          value={diagnostico}
          onChange={(e) => setDiagnostico(e.target.value)}
          placeholder="Ej. Gastritis aguda no especificada (CIE-10: K29.7)"
          disabled={isClosed}
          maxLength={500}
        />
      </div>

      {!isClosed && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <Button size="sm" variant="outline" onClick={handleSave} disabled={saving || closing}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar nota
          </Button>
          <Button size="sm" onClick={handleCloseConsultation} disabled={saving || closing}>
            {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Cerrar consulta y continuar
          </Button>
        </div>
      )}

      {isClosed && existingData.cerrada_en && (
        <p className="text-xs text-muted-foreground">
          Consulta cerrada el {new Date(existingData.cerrada_en).toLocaleString("es-MX")}.
        </p>
      )}
    </div>
  );
}
