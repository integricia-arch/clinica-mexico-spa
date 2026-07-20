import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Check } from "lucide-react";
import { z } from "zod";
import {
  saveJourneyStepData,
  closeJourneyStep,
} from "@/features/camino-paciente/services/journeyEngine";
import { toastStepClosed } from "./_shared";

const arrivalSchema = z.object({
  motivo_consulta: z
    .string()
    .trim()
    .min(3, "El motivo debe tener al menos 3 caracteres")
    .max(500, "Máximo 500 caracteres"),
  sintomas_iniciales: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
  notas_recepcion: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
});

export type ArrivalData = {
  motivo_consulta?: string;
  sintomas_iniciales?: string;
  notas_recepcion?: string;
  registrado_en?: string;
};

interface ArrivalFormProps {
  stepId: string;
  stepKey?: string;
  stepStatus: string;
  existingData: ArrivalData;
  onSaved?: () => void;
}

export default function ArrivalForm({
  stepId,
  stepKey,
  stepStatus,
  existingData,
  onSaved,
}: ArrivalFormProps) {
  const [motivo, setMotivo] = useState(existingData.motivo_consulta ?? "");
  const [sintomas, setSintomas] = useState(existingData.sintomas_iniciales ?? "");
  const [notas, setNotas] = useState(existingData.notas_recepcion ?? "");
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [autoStatus, setAutoStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Re-sync when external data changes (realtime updates)
  useEffect(() => {
    setMotivo(existingData.motivo_consulta ?? "");
    setSintomas(existingData.sintomas_iniciales ?? "");
    setNotas(existingData.notas_recepcion ?? "");
  }, [existingData.motivo_consulta, existingData.sintomas_iniciales, existingData.notas_recepcion]);

  const isClosed = stepStatus === "completed" || stepStatus === "skipped";

  // Autosave (debounced) — only when motivo válido y hito abierto
  useEffect(() => {
    if (isClosed) return;
    const parsed = arrivalSchema.safeParse({
      motivo_consulta: motivo,
      sintomas_iniciales: sintomas,
      notas_recepcion: notas,
    });
    if (!parsed.success) return;
    const initial =
      motivo === (existingData.motivo_consulta ?? "") &&
      sintomas === (existingData.sintomas_iniciales ?? "") &&
      notas === (existingData.notas_recepcion ?? "");
    if (initial) return;

    setAutoStatus("saving");
    const t = setTimeout(async () => {
      const r = await saveJourneyStepData(stepId, {
        motivo_consulta: parsed.data.motivo_consulta,
        sintomas_iniciales: parsed.data.sintomas_iniciales || "",
        notas_recepcion: parsed.data.notas_recepcion || "",
        registrado_en: new Date().toISOString(),
      });
      if (r.ok) {
        setAutoStatus("saved");
        onSaved?.();
        setTimeout(() => setAutoStatus("idle"), 1500);
      } else {
        setAutoStatus("error");
      }
    }, 900);
    return () => clearTimeout(t);
  }, [motivo, sintomas, notas, stepId, isClosed, existingData.motivo_consulta, existingData.sintomas_iniciales, existingData.notas_recepcion, onSaved]);

  const handleSave = async () => {
    const parsed = arrivalSchema.safeParse({
      motivo_consulta: motivo,
      sintomas_iniciales: sintomas,
      notas_recepcion: notas,
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSaving(true);
    const r = await saveJourneyStepData(stepId, {
      motivo_consulta: parsed.data.motivo_consulta,
      sintomas_iniciales: parsed.data.sintomas_iniciales || "",
      notas_recepcion: parsed.data.notas_recepcion || "",
      registrado_en: new Date().toISOString(),
    });
    setSaving(false);
    if (!r.ok) toast.error(r.error ?? "Error al guardar");
    else {
      toast.success("Llegada registrada");
      onSaved?.();
    }
  };

  const handleSaveAndClose = async () => {
    const parsed = arrivalSchema.safeParse({
      motivo_consulta: motivo,
      sintomas_iniciales: sintomas,
      notas_recepcion: notas,
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setClosing(true);
    const s = await saveJourneyStepData(stepId, {
      motivo_consulta: parsed.data.motivo_consulta,
      sintomas_iniciales: parsed.data.sintomas_iniciales || "",
      notas_recepcion: parsed.data.notas_recepcion || "",
      registrado_en: new Date().toISOString(),
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
      toastStepClosed(stepKey, "Llegada confirmada");
      onSaved?.();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Capture el motivo de la visita y los datos iniciales del paciente al llegar a recepción.
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
        <Label htmlFor="motivo">
          Motivo de la consulta <span className="text-destructive">*</span>
        </Label>
        <Input
          id="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej. Dolor abdominal recurrente"
          disabled={isClosed}
          maxLength={500}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sintomas">Síntomas iniciales</Label>
        <Textarea
          id="sintomas"
          rows={3}
          value={sintomas}
          onChange={(e) => setSintomas(e.target.value)}
          placeholder="Describa los síntomas que reporta el paciente al llegar"
          disabled={isClosed}
          maxLength={1000}
        />
        <p className="text-[10px] text-muted-foreground text-right">{sintomas.length}/1000</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notas">Notas de recepción</Label>
        <Textarea
          id="notas"
          rows={3}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Observaciones administrativas (acompañante, urgencia percibida, etc.)"
          disabled={isClosed}
          maxLength={1000}
        />
        <p className="text-[10px] text-muted-foreground text-right">{notas.length}/1000</p>
      </div>

      {!isClosed && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <Button size="sm" variant="outline" onClick={handleSave} disabled={saving || closing}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
          <Button size="sm" onClick={handleSaveAndClose} disabled={saving || closing}>
            {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Confirmar llegada y continuar
          </Button>
        </div>
      )}

      {isClosed && existingData.registrado_en && (
        <p className="text-xs text-muted-foreground">
          Hito cerrado. Registro: {new Date(existingData.registrado_en).toLocaleString("es-MX")}
        </p>
      )}
    </div>
  );
}
