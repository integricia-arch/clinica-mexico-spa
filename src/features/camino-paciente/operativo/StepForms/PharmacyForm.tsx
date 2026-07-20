import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Check, ExternalLink, Pill } from "lucide-react";
import { saveJourneyStepData, closeJourneyStep } from "@/features/camino-paciente/services/journeyEngine";
import { supabase } from "@/integrations/supabase/client";
import type { StepFormProps } from "./_shared";
import { isClosed, toastStepClosed } from "./_shared";

interface PrescriptionRow {
  id: string;
  prescription_number: string | null;
  status: string;
  issue_date: string | null;
  diagnosis: string | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Borrador",   cls: "bg-muted text-muted-foreground" },
  active:    { label: "Activa",     cls: "bg-blue-100 text-blue-700" },
  dispensed: { label: "Surtida",    cls: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelada",  cls: "bg-red-100 text-red-700" },
};

export default function PharmacyForm({ stepId, stepKey, stepStatus, appointmentId, onSaved }: StepFormProps) {
  const navigate = useNavigate();
  const [resultado, setResultado] = useState<string>("entregado");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [loadingRx, setLoadingRx] = useState(false);
  const closed = isClosed(stepStatus);

  useEffect(() => {
    if (!appointmentId) return;
    setLoadingRx(true);
    supabase
      .from("prescriptions")
      .select("id, prescription_number, status, issue_date, diagnosis")
      .eq("appointment_id", appointmentId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPrescriptions((data ?? []) as PrescriptionRow[]);
        setLoadingRx(false);
      });
  }, [appointmentId]);

  const handleConfirm = async () => {
    setSaving(true);
    const s = await saveJourneyStepData(stepId, {
      resultado, notas, entregado_en: new Date().toISOString(),
    });
    if (!s.ok) { setSaving(false); toast.error(s.error ?? "Error"); return; }
    const c = await closeJourneyStep(stepId);
    setSaving(false);
    if (!c.ok) toast.error(c.error ?? "Error");
    else { toastStepClosed(stepKey, "Farmacia cerrada"); onSaved?.(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Registre la entrega/surtido del medicamento. Los movimientos de inventario se capturan en el módulo de farmacia.
        </p>
        <Button
          size="sm" variant="outline" type="button"
          className="shrink-0 gap-1.5 text-xs"
          onClick={() => navigate("/farmacia")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ir a Farmacia
        </Button>
      </div>

      {/* Prescriptions for this appointment */}
      {appointmentId && (
        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Pill className="h-3.5 w-3.5" />
            Recetas de esta consulta
          </div>
          {loadingRx ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando recetas…
            </div>
          ) : prescriptions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sin recetas registradas para esta consulta.</p>
          ) : (
            <div className="space-y-1.5">
              {prescriptions.map((rx) => {
                const st = STATUS_LABEL[rx.status] ?? { label: rx.status, cls: "bg-muted text-muted-foreground" };
                return (
                  <div key={rx.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-mono font-medium">
                        {rx.prescription_number ?? rx.id.slice(0, 8)}
                      </span>
                      {rx.diagnosis && (
                        <span className="ml-2 text-xs text-muted-foreground truncate">{rx.diagnosis}</span>
                      )}
                    </div>
                    <Badge className={`${st.cls} border-0 text-xs shrink-0`}>{st.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
