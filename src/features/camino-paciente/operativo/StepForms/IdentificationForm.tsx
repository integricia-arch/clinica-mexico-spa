import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { saveJourneyStepData, closeJourneyStep } from "@/features/camino-paciente/services/journeyEngine";
import type { StepFormProps } from "./_shared";
import { isClosed, toastStepClosed } from "./_shared";

// Validación tolerante: 18 caracteres alfanuméricos en mayúsculas.
// El formato estricto NOM (AAAA######HoMXXXXX##) se valida en backend si se requiere.
const CURP_RE = /^[A-Z0-9]{18}$/;

export default function IdentificationForm({
  stepId, stepKey, stepStatus, patientId, existingData, onSaved,
}: StepFormProps) {
  const [curp, setCurp] = useState(existingData.curp ?? "");
  const [ineFolio, setIneFolio] = useState(existingData.ine_folio ?? "");
  const [verificada, setVerificada] = useState<boolean>(existingData.identidad_verificada ?? false);
  const [consentimiento, setConsentimiento] = useState<boolean>(existingData.consentimiento ?? false);
  const [saving, setSaving] = useState(false);
  const closed = isClosed(stepStatus);

  useEffect(() => {
    if (!patientId || curp) return;
    (supabase as any).from("patients").select("curp").eq("id", patientId).maybeSingle().then(({ data }) => {
      if (data?.curp) setCurp(data.curp);
    });
  }, [patientId, curp]);

  const handleConfirm = async () => {
    const curpUpper = curp.trim().toUpperCase();
    if (!CURP_RE.test(curpUpper)) {
      toast.error("CURP inválido (18 caracteres, formato oficial)");
      return;
    }
    if (!verificada) { toast.error("Debe verificar la identidad con INE"); return; }
    if (!consentimiento) { toast.error("Debe registrarse el consentimiento informado"); return; }

    setSaving(true);
    if (patientId) {
      await (supabase as any).from("patients").update({ curp: curpUpper }).eq("id", patientId);
      await (supabase as any).from("consentimientos").insert({
        patient_id: patientId,
        tipo: "atencion_medica",
        otorgado: true,
        version_texto: "v1.0",
      });
    }
    const s = await saveJourneyStepData(stepId, {
      curp: curpUpper,
      ine_folio: ineFolio || null,
      identidad_verificada: true,
      consentimiento: true,
      verificado_en: new Date().toISOString(),
    });
    if (!s.ok) { setSaving(false); toast.error(s.error ?? "Error"); return; }
    const c = await closeJourneyStep(stepId);
    setSaving(false);
    if (!c.ok) toast.error(c.error ?? "Error");
    else { toastStepClosed(stepKey, "Identidad y consentimiento registrados"); onSaved?.(); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Verifique INE/INE digital, CURP y registre el consentimiento informado del paciente.
      </p>

      <div className="space-y-2">
        <Label>CURP <span className="text-destructive">*</span></Label>
        <Input
          value={curp}
          onChange={(e) => setCurp(e.target.value.toUpperCase())}
          disabled={closed}
          placeholder="AAAA######HDFNNN##"
          maxLength={18}
        />
      </div>

      <div className="space-y-2">
        <Label>Folio INE</Label>
        <Input
          value={ineFolio}
          onChange={(e) => setIneFolio(e.target.value)}
          disabled={closed}
          placeholder="Opcional"
          maxLength={50}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox id="ver" checked={verificada} onCheckedChange={(v) => setVerificada(!!v)} disabled={closed} />
          <Label htmlFor="ver" className="cursor-pointer">Identidad verificada contra INE</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="cons" checked={consentimiento} onCheckedChange={(v) => setConsentimiento(!!v)} disabled={closed} />
          <Label htmlFor="cons" className="cursor-pointer">Consentimiento informado otorgado</Label>
        </div>
      </div>

      {!closed && (
        <Button onClick={handleConfirm} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Confirmar identificación
        </Button>
      )}
    </div>
  );
}
