import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { TEMPLATE_TYPE_LABELS, CRITICAL_STEP_KEYS, STEP_KEY_LABELS } from "@/features/camino-paciente/lib/stepKeys";

/* ---------- New template (clones base) ---------- */
export function NewTemplateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<keyof typeof TEMPLATE_TYPE_LABELS>("consulta_general");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim()) { toast.error("El nombre es obligatorio"); return; }
    setSaving(true);

    // find base template
    const { data: base } = await (supabase as any)
      .from("journey_templates")
      .select("*, journey_template_versions!journey_template_versions_template_id_fkey(*)")
      .eq("is_default", true)
      .maybeSingle();

    // create template
    const { data: tpl, error: e1 } = await (supabase as any)
      .from("journey_templates")
      .insert({ name: name.trim(), description: desc.trim() || null, type })
      .select()
      .single();
    if (e1 || !tpl) { setSaving(false); toast.error(e1?.message ?? "Error"); return; }

    // create v1 active
    const { data: ver, error: e2 } = await (supabase as any)
      .from("journey_template_versions")
      .insert({ template_id: tpl.id, version_number: 1, status: "active", publish_reason: "Plantilla nueva basada en base segura", published_at: new Date().toISOString() })
      .select()
      .single();
    if (e2 || !ver) { setSaving(false); toast.error(e2?.message ?? "Error"); return; }

    // copy steps from base active version
    if (base?.active_version_id) {
      const { data: srcSteps } = await (supabase as any).from("journey_step_definitions").select("*").eq("template_version_id", base.active_version_id);
      if (srcSteps && srcSteps.length > 0) {
        const rows = srcSteps.map((s: any) => ({
          template_version_id: ver.id,
          step_key: s.step_key,
          step_name: s.step_name,
          step_description: s.step_description,
          step_type: s.step_type,
          step_order: s.step_order,
          is_required: s.is_required,
          is_critical: s.is_critical,
          allow_not_applicable: s.allow_not_applicable,
          requires_responsible: s.requires_responsible,
          blocks_progress: s.blocks_progress,
          requires_document: s.requires_document,
          max_recommended_minutes: s.max_recommended_minutes,
          allowed_edit_roles: s.allowed_edit_roles,
          allowed_complete_roles: s.allowed_complete_roles,
          allowed_override_roles: s.allowed_override_roles,
        }));
        await (supabase as any).from("journey_step_definitions").insert(rows);
      }
    } else {
      // fallback: create critical steps with valid defaults per step
      const rows = CRITICAL_STEP_KEYS.map((k, i) => ({
        template_version_id: ver.id,
        step_key: k,
        step_name: STEP_KEY_LABELS[k] ?? k,
        step_type: "clinica" as string,
        step_order: i + 1,
        is_required: true,
        is_critical: true,
        blocks_progress: !["followup", "billing", "prescription"].includes(k),
        requires_responsible: (["consultation", "prescription", "discharge"] as string[]).includes(k),
        allowed_complete_roles: k === "prescription" ? ["doctor", "admin"] : ["admin"],
      }));
      await (supabase as any).from("journey_step_definitions").insert(rows);
    }

    await (supabase as any).from("journey_templates").update({ active_version_id: ver.id }).eq("id", tpl.id);

    setSaving(false);
    setName(""); setDesc("");
    toast.success("Plantilla creada con base segura");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva plantilla</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nombre *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v: keyof typeof TEMPLATE_TYPE_LABELS) => setType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TEMPLATE_TYPE_LABELS) as Array<keyof typeof TEMPLATE_TYPE_LABELS>).map((k) => (
                  <SelectItem key={k} value={k}>{TEMPLATE_TYPE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Descripción</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} /></div>
          <p className="text-xs text-muted-foreground">La nueva plantilla se crea con las 10 etapas críticas obligatorias.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={create} disabled={saving}>{saving ? "Creando…" : "Crear"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
