import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import { saveJourneyStepData, closeJourneyStep } from "@/features/camino-paciente/services/journeyEngine";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { StepFormProps } from "./_shared";
import { isClosed } from "./_shared";

// Catálogo corto de diagnósticos de enfermería (PAE/PLACE) — solo los más
// frecuentes en consulta externa, no el catálogo NANDA completo.
const DIAGNOSTICOS_ENFERMERIA = [
  "Sin hallazgos relevantes",
  "Riesgo de caída",
  "Dolor agudo",
  "Ansiedad",
  "Riesgo de infección",
  "Déficit de autocuidado",
  "Hipertermia",
  "Patrón respiratorio ineficaz",
] as const;

export default function TriageForm({ stepId, stepStatus, existingData, onSaved }: StepFormProps) {
  const { user } = useAuth();
  const [peso, setPeso] = useState(existingData.peso_kg ?? "");
  const [talla, setTalla] = useState(existingData.talla_cm ?? "");
  const [pas, setPas] = useState(existingData.ta_sistolica ?? "");
  const [pad, setPad] = useState(existingData.ta_diastolica ?? "");
  const [fc, setFc] = useState(existingData.frecuencia_cardiaca ?? "");
  const [temp, setTemp] = useState(existingData.temperatura ?? "");
  const [spo2, setSpo2] = useState(existingData.spo2 ?? "");
  const [notas, setNotas] = useState(existingData.notas ?? "");
  const [diagnosticoEnfermeria, setDiagnosticoEnfermeria] = useState(
    existingData.diagnostico_enfermeria ?? DIAGNOSTICOS_ENFERMERIA[0],
  );
  const [intervencion, setIntervencion] = useState(existingData.intervencion ?? "");
  const [respuestaPaciente, setRespuestaPaciente] = useState(existingData.respuesta_paciente ?? "");
  const [registradoPor, setRegistradoPor] = useState<{ nombre: string; cedula: string | null } | null>(
    existingData.registrado_por ?? null,
  );
  const [saving, setSaving] = useState(false);
  const closed = isClosed(stepStatus);

  useEffect(() => {
    if (!user || registradoPor) return;
    (supabase as any)
      .from("nurses")
      .select("nombre, apellidos, cedula_profesional")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setRegistradoPor({
          nombre: data ? `${data.nombre} ${data.apellidos}` : (user.email ?? "—"),
          cedula: data?.cedula_profesional ?? null,
        });
      });
  }, [user, registradoPor]);

  const imc = useMemo(() => {
    const p = parseFloat(peso); const t = parseFloat(talla);
    if (!p || !t) return null;
    return (p / Math.pow(t / 100, 2)).toFixed(1);
  }, [peso, talla]);

  const alertas: string[] = [];
  if (parseFloat(pas) >= 140 || parseFloat(pad) >= 90) alertas.push("Hipertensión");
  if (parseFloat(spo2) && parseFloat(spo2) < 92) alertas.push("SpO₂ baja");
  if (parseFloat(temp) >= 38) alertas.push("Fiebre");
  if (parseFloat(fc) && (parseFloat(fc) > 100 || parseFloat(fc) < 50)) alertas.push("FC anómala");

  const handleConfirm = async () => {
    setSaving(true);
    const s = await saveJourneyStepData(stepId, {
      peso_kg: peso, talla_cm: talla, imc,
      ta_sistolica: pas, ta_diastolica: pad,
      frecuencia_cardiaca: fc, temperatura: temp, spo2,
      notas, alertas,
      diagnostico_enfermeria: diagnosticoEnfermeria,
      intervencion, respuesta_paciente: respuestaPaciente,
      registrado_por: registradoPor,
      registrado_en: new Date().toISOString(),
    });
    if (!s.ok) { setSaving(false); toast.error(s.error ?? "Error"); return; }
    const c = await closeJourneyStep(stepId);
    setSaving(false);
    if (!c.ok) toast.error(c.error ?? "Error");
    else { toast.success("Triage registrado"); onSaved?.(); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Peso (kg)</Label><Input value={peso} onChange={(e) => setPeso(e.target.value)} disabled={closed} /></div>
        <div><Label>Talla (cm)</Label><Input value={talla} onChange={(e) => setTalla(e.target.value)} disabled={closed} /></div>
        <div><Label>TA sistólica</Label><Input value={pas} onChange={(e) => setPas(e.target.value)} disabled={closed} /></div>
        <div><Label>TA diastólica</Label><Input value={pad} onChange={(e) => setPad(e.target.value)} disabled={closed} /></div>
        <div><Label>FC (lpm)</Label><Input value={fc} onChange={(e) => setFc(e.target.value)} disabled={closed} /></div>
        <div><Label>Temperatura (°C)</Label><Input value={temp} onChange={(e) => setTemp(e.target.value)} disabled={closed} /></div>
        <div><Label>SpO₂ (%)</Label><Input value={spo2} onChange={(e) => setSpo2(e.target.value)} disabled={closed} /></div>
        <div><Label>IMC</Label><Input value={imc ?? ""} disabled /></div>
      </div>
      <div className="space-y-2">
        <Label>Diagnóstico de enfermería</Label>
        <Select value={diagnosticoEnfermeria} onValueChange={setDiagnosticoEnfermeria} disabled={closed}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {DIAGNOSTICOS_ENFERMERIA.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Intervención realizada</Label>
        <Textarea value={intervencion} onChange={(e) => setIntervencion(e.target.value)} disabled={closed} rows={2}
          placeholder="Ej. Se canalizó vía periférica, se administró analgésico…" />
      </div>
      <div className="space-y-2">
        <Label>Respuesta del paciente</Label>
        <Textarea value={respuestaPaciente} onChange={(e) => setRespuestaPaciente(e.target.value)} disabled={closed} rows={2}
          placeholder="Ej. Tolera bien el procedimiento, sin datos de alarma…" />
      </div>
      <div className="space-y-2">
        <Label>Notas adicionales</Label>
        <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} disabled={closed} rows={2} />
      </div>
      {registradoPor && (
        <p className="text-xs text-muted-foreground">
          Registrado por: {registradoPor.nombre}{registradoPor.cedula ? ` · Céd. ${registradoPor.cedula}` : ""}
        </p>
      )}
      {alertas.length > 0 && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <span>Alertas: {alertas.join(", ")}</span>
        </div>
      )}
      {!closed && (
        <Button onClick={handleConfirm} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Registrar signos vitales
        </Button>
      )}
    </div>
  );
}
