import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { JourneyStep } from "@/features/camino-paciente/hooks/useJourneyData";
import { friendlyError } from "@/lib/errors";

interface RuleRow {
  id: string;
  rule_name: string;
  source_step_key: string;
  severity: "info" | "warning" | "blocking";
  condition_json: { description?: string } | null;
  action_json: { description?: string } | null;
  is_active: boolean;
}

/* ---------- Rules panel ---------- */
export function RulesPanel({ steps, versionId }: { steps: JourneyStep[]; versionId: string | null }) {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [sourceStep, setSourceStep] = useState("");
  const [severity, setSeverity] = useState<"info" | "warning" | "blocking">("warning");
  const [condition, setCondition] = useState("");
  const [action, setAction] = useState("");

  const load = async () => {
    if (!versionId) return;
    setLoading(true);
    const { data } = await (supabase as any).from("journey_validation_rules").select("*").eq("template_version_id", versionId).order("created_at");
    setRules((data ?? []) as RuleRow[]);
    setLoading(false);
  };
  useEffect(() => { load();   }, [versionId]);

  const stepKeys = new Set(steps.map((s) => s.step_key));

  const save = async () => {
    if (!versionId) return;
    if (!ruleName.trim() || !sourceStep || !condition.trim() || !action.trim()) {
      toast.error("Completa todos los campos"); return;
    }
    if (!stepKeys.has(sourceStep)) { toast.error("La etapa origen no existe"); return; }
    const { error } = await (supabase as any).from("journey_validation_rules").insert({
      template_version_id: versionId,
      rule_name: ruleName.trim(),
      source_step_key: sourceStep,
      condition_json: { description: condition.trim() },
      action_json: { description: action.trim() },
      severity,
      is_active: true,
    });
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Regla guardada");
    setOpen(false);
    setRuleName(""); setSourceStep(""); setCondition(""); setAction("");
    load();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-display font-semibold">Reglas de validación</h3>
          <p className="text-xs text-muted-foreground">Describe condiciones y acciones en lenguaje natural.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} disabled={!versionId}>
          <Plus className="h-4 w-4 mr-1" /> Nueva regla
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay reglas configuradas.</p>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{r.rule_name}</p>
                <Badge variant={r.severity === "blocking" ? "destructive" : "secondary"} className="text-[10px]">{r.severity}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Sobre <code>{r.source_step_key}</code>: si {r.condition_json?.description ?? "—"}, entonces {r.action_json?.description ?? "—"}.
              </p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva regla</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="Ej. Bloquear alta si análisis pendiente" /></div>
            <div>
              <Label>Etapa origen</Label>
              <Select value={sourceStep} onValueChange={setSourceStep}>
                <SelectTrigger><SelectValue placeholder="Selecciona etapa" /></SelectTrigger>
                <SelectContent>
                  {steps.map((s) => <SelectItem key={s.step_key} value={s.step_key}>{s.step_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Condición (en palabras)</Label><Input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="Ej. requiere análisis = sí y resultado vacío" /></div>
            <div><Label>Acción (en palabras)</Label><Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Ej. bloquear avance hasta cargar resultado" /></div>
            <div>
              <Label>Severidad</Label>
              <Select value={severity} onValueChange={(v: "info" | "warning" | "blocking") => setSeverity(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Informativa</SelectItem>
                  <SelectItem value="warning">Advertencia</SelectItem>
                  <SelectItem value="blocking">Bloqueante</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
