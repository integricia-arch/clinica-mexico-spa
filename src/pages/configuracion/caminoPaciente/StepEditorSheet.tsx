import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { JourneyStep } from "@/features/camino-paciente/hooks/useJourneyData";
import { APP_ROLES } from "@/features/camino-paciente/lib/stepKeys";
import { friendlyError } from "@/lib/errors";

/* ---------- Step editor (panel lateral) ---------- */
export function StepEditorSheet({ step, onClose, onSaved }: { step: JourneyStep | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [allowNa, setAllowNa] = useState(false);
  const [requiresResp, setRequiresResp] = useState(false);
  const [blocks, setBlocks] = useState(true);
  const [requiresDoc, setRequiresDoc] = useState(false);
  const [completeRoles, setCompleteRoles] = useState<string[]>([]);
  const [overrideRoles, setOverrideRoles] = useState<string[]>([]);
  const [maxMin, setMaxMin] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (step) {
      setName(step.step_name);
      setDesc(step.step_description ?? "");
      setIsRequired(step.is_required);
      setAllowNa(step.allow_not_applicable);
      setRequiresResp(step.requires_responsible);
      setBlocks(step.blocks_progress);
      setRequiresDoc(step.requires_document);
      setCompleteRoles(step.allowed_complete_roles ?? []);
      setOverrideRoles(step.allowed_override_roles ?? []);
      setMaxMin(step.max_recommended_minutes?.toString() ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id]);

  if (!step) return null;
  const isCritical = step.is_critical;

  const toggleRole = (list: string[], role: string, setter: (v: string[]) => void) => {
    setter(list.includes(role) ? list.filter((r) => r !== role) : [...list, role]);
  };

  const save = async () => {
    if (!name.trim()) { toast.error("El nombre visible es obligatorio"); return; }
    if (isCritical && completeRoles.length === 0) {
      toast.error("Una etapa crítica debe tener al menos un rol autorizado a completarla");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("journey_step_definitions")
      .update({
        step_name: name.trim(),
        step_description: desc.trim() || null,
        is_required: isCritical ? true : isRequired,
        allow_not_applicable: allowNa,
        requires_responsible: requiresResp,
        blocks_progress: blocks,
        requires_document: requiresDoc,
        allowed_complete_roles: completeRoles,
        allowed_override_roles: overrideRoles,
        max_recommended_minutes: maxMin ? parseInt(maxMin) : null,
      })
      .eq("id", step.id);
    setSaving(false);
    if (error) { toast.error("No se pudo guardar: " + friendlyError(error)); return; }
    toast.success("Etapa actualizada");
    onSaved();
  };

  return (
    <Sheet open={!!step} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Editar etapa
            {isCritical && <Badge variant="secondary" className="text-[10px]"><Lock className="h-3 w-3 mr-1" />Crítica</Badge>}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
            Clave interna fija: <code className="font-mono">{step.step_key}</code>
          </div>
          <div>
            <Label>Nombre visible *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Toggle label="Obligatoria" value={isRequired} onChange={setIsRequired} disabled={isCritical} hint={isCritical ? "Crítica: siempre obligatoria" : undefined} />
            <Toggle label='Permite "No aplica"' value={allowNa} onChange={setAllowNa} />
            <Toggle label="Requiere responsable" value={requiresResp} onChange={setRequiresResp} />
            <Toggle label="Bloquea avance" value={blocks} onChange={setBlocks} />
            <Toggle label="Requiere documento" value={requiresDoc} onChange={setRequiresDoc} />
          </div>
          <div>
            <Label>Tiempo máximo recomendado (min)</Label>
            <Input type="number" min={0} value={maxMin} onChange={(e) => setMaxMin(e.target.value)} placeholder="Opcional" />
          </div>
          <RoleSelector label="Roles que pueden completar" selected={completeRoles} onToggle={(r) => toggleRole(completeRoles, r, setCompleteRoles)} />
          <RoleSelector label="Roles que pueden autorizar override" selected={overrideRoles} onToggle={(r) => toggleRole(overrideRoles, r, setOverrideRoles)} />
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Toggle({ label, value, onChange, disabled, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
      <div>
        <p className="text-xs font-medium">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function RoleSelector({ label, selected, onToggle }: { label: string; selected: string[]; onToggle: (role: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        {APP_ROLES.map((role) => {
          const active = selected.includes(role);
          return (
            <button
              key={role}
              type="button"
              onClick={() => onToggle(role)}
              className={`rounded-md border px-3 py-1 text-xs transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}`}
            >
              {role}
            </button>
          );
        })}
      </div>
    </div>
  );
}
