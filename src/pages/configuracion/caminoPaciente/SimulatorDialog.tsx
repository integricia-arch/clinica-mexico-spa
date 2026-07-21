import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StepLite } from "@/features/camino-paciente/lib/validateJourneyConfiguration";
import { simulateJourney, SCENARIO_LABELS, type Scenario } from "@/features/camino-paciente/lib/simulateJourney";

/* ---------- Simulator ---------- */
export function SimulatorDialog({ open, onClose, steps }: { open: boolean; onClose: () => void; steps: StepLite[] }) {
  const [scenario, setScenario] = useState<Scenario>("normal");
  const result = useMemo(() => simulateJourney(steps, scenario), [steps, scenario]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Simulador del camino</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Escenario</Label>
            <Select value={scenario} onValueChange={(v: Scenario) => setScenario(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SCENARIO_LABELS) as Scenario[]).map((k) => (
                  <SelectItem key={k} value={k}>{SCENARIO_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border border-border bg-background p-3 max-h-[50vh] overflow-y-auto space-y-2">
            {result.steps.map((s) => {
              const cls = s.status === "bloqueada" ? "border-destructive/40 bg-destructive/5"
                : s.status === "override_requerido" ? "border-warning/40 bg-warning/5"
                : s.status === "omitida" ? "border-border bg-muted/30 text-muted-foreground"
                : "border-success/30 bg-success/5";
              return (
                <div key={s.step_key} className={`rounded-md border p-2 ${cls}`}>
                  <p className="text-sm font-medium">{s.step_name} <span className="text-xs opacity-70">— {s.status}</span></p>
                  {s.notes.map((n, i) => <p key={i} className="text-xs">• {n}</p>)}
                </div>
              );
            })}
          </div>
          <div className="text-xs">
            Resultado general:{" "}
            <strong className={result.overall === "valida" ? "text-success" : result.overall === "advertencia" ? "text-warning" : "text-destructive"}>
              {result.overall}
            </strong>
          </div>
        </div>
        <DialogFooter><Button onClick={onClose}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
