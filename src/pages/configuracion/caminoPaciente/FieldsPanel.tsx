import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { JourneyStep } from "@/features/camino-paciente/hooks/useJourneyData";
import { getAvailableOptionsForStep } from "@/features/camino-paciente/lib/getAvailableOptionsForStep";
import { friendlyError } from "@/lib/errors";

interface StepFieldRow {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  step_definition_id: string;
  sort_order: number;
}

/* ---------- Fields panel ---------- */
export function FieldsPanel({ steps }: { steps: JourneyStep[] }) {
  const [stepId, setStepId] = useState<string>(steps[0]?.id ?? "");
  const currentStep = steps.find((s) => s.id === stepId) ?? steps[0];
  const [fields, setFields] = useState<StepFieldRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    if (!currentStep) return;
    setLoading(true);
    const { data } = await (supabase as any).from("journey_step_fields").select("*").eq("step_definition_id", currentStep.id).order("sort_order");
    setFields((data ?? []) as StepFieldRow[]);
    setLoading(false);
  };

  useEffect(() => { load();   }, [currentStep?.id]);

  const available = currentStep ? getAvailableOptionsForStep(currentStep.step_key) : [];
  const existingKeys = new Set(fields.map((f) => f.field_key));

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-display font-semibold">Campos por etapa</h3>
          <p className="text-xs text-muted-foreground">Solo se permiten campos coherentes con el tipo de etapa.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={stepId} onValueChange={setStepId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Selecciona etapa" /></SelectTrigger>
            <SelectContent>
              {steps.map((s) => <SelectItem key={s.id} value={s.id}>{s.step_order}. {s.step_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setAddOpen(true)} disabled={!currentStep}>
            <Plus className="h-4 w-4 mr-1" /> Agregar campo
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta etapa aún no tiene campos configurados.</p>
      ) : (
        <div className="space-y-2">
          {fields.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
              <div>
                <p className="text-sm font-medium">{f.field_label} {f.is_required && <span className="text-destructive">*</span>}</p>
                <p className="text-xs text-muted-foreground"><code className="font-mono">{f.field_key}</code> · {f.field_type}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const { error } = await (supabase as any).from("journey_step_fields").delete().eq("id", f.id);
                  if (error) toast.error(friendlyError(error));
                  else { toast.success("Campo eliminado"); load(); }
                }}
              >Quitar</Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar campo a "{currentStep?.step_name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {available.filter((o) => !existingKeys.has(o.key)).map((opt) => (
              <button
                key={opt.key}
                className="w-full text-left rounded-md border border-border bg-background p-3 hover:border-primary"
                onClick={async () => {
                  if (!currentStep) return;
                  const { error } = await (supabase as any).from("journey_step_fields").insert({
                    step_definition_id: currentStep.id,
                    field_key: opt.key,
                    field_label: opt.label,
                    field_type: opt.fieldType as string,
                    is_required: false,
                  });
                  if (error) toast.error(friendlyError(error));
                  else { toast.success("Campo agregado"); setAddOpen(false); load(); }
                }}
              >
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground"><code>{opt.key}</code> · {opt.fieldType}</p>
              </button>
            ))}
            {available.filter((o) => !existingKeys.has(o.key)).length === 0 && (
              <p className="text-sm text-muted-foreground">No hay más opciones disponibles para esta etapa.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
