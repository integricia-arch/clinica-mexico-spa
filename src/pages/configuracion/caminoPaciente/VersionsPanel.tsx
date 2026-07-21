import { useEffect, useState } from "react";
import { History, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface VersionRow {
  id: string;
  version_number: number;
  status: "draft" | "active" | "archived";
  publish_reason: string | null;
  config_json: Record<string, unknown> | null;
}

/* ---------- Versions panel ---------- */
export function VersionsPanel({ templateId, canPublish, onChange }: { templateId: string; canPublish: boolean; onChange: () => void }) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("journey_template_versions")
      .select("*")
      .eq("template_id", templateId)
      .order("version_number", { ascending: false });
    setVersions((data ?? []) as VersionRow[]);
    setLoading(false);
  };
  useEffect(() => { load();   }, [templateId]);

  const createDraftFromActive = async () => {
    const active = versions.find((v) => v.status === "active");
    if (!active) { toast.error("No hay versión activa para clonar"); return; }
    const nextNumber = Math.max(...versions.map((v) => v.version_number)) + 1;

    const { data: newVersion, error } = await (supabase as any)
      .from("journey_template_versions")
      .insert({ template_id: templateId, version_number: nextNumber, status: "draft", config_json: active.config_json as unknown as import("@/integrations/supabase/types").Json })
      .select()
      .single();
    if (error || !newVersion) { toast.error(error?.message ?? "Error"); return; }

    // clone steps
    const { data: srcSteps } = await (supabase as any).from("journey_step_definitions").select("*").eq("template_version_id", active.id);
    if (srcSteps && srcSteps.length > 0) {
      const rows = srcSteps.map((s: any) => ({
        template_version_id: newVersion.id,
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
    toast.success(`Borrador v${nextNumber} creado`);
    load(); onChange();
  };

  const publish = async (v: VersionRow) => {
    if (!canPublish) { toast.error("La configuración tiene errores; corrígelos antes de publicar."); return; }
    if (!reason.trim()) { toast.error("Indica el motivo del cambio"); return; }

    // archive current active
    await (supabase as any).from("journey_template_versions").update({ status: "archived" }).eq("template_id", templateId).eq("status", "active");
    // publish this one
    await (supabase as any).from("journey_template_versions").update({ status: "active", publish_reason: reason, published_at: new Date().toISOString() }).eq("id", v.id);
    await (supabase as any).from("journey_templates").update({ active_version_id: v.id }).eq("id", templateId);
    toast.success(`v${v.version_number} publicada`);
    setReason("");
    load(); onChange();
  };

  const restore = async (v: VersionRow) => {
    if (!confirm(`¿Restaurar v${v.version_number} como activa? La actual será archivada.`)) return;
    await (supabase as any).from("journey_template_versions").update({ status: "archived" }).eq("template_id", templateId).eq("status", "active");
    await (supabase as any).from("journey_template_versions").update({ status: "active" }).eq("id", v.id);
    await (supabase as any).from("journey_templates").update({ active_version_id: v.id }).eq("id", templateId);
    toast.success("Versión restaurada");
    load(); onChange();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h3 className="text-display font-semibold">Versiones</h3>
        </div>
        <Button size="sm" onClick={createDraftFromActive}>
          <Sparkles className="h-4 w-4 mr-1" /> Nuevo borrador
        </Button>
      </div>

      <div className="mb-4">
        <Label>Motivo del próximo cambio</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Ajuste de campos para CFDI 4.0" />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="space-y-2">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
              <div>
                <p className="text-sm font-medium">v{v.version_number} — <Badge variant={v.status === "active" ? "default" : "secondary"} className="text-[10px] ml-1">{v.status}</Badge></p>
                <p className="text-xs text-muted-foreground">{v.publish_reason ?? "—"}</p>
              </div>
              <div className="flex gap-2">
                {v.status === "draft" && <Button size="sm" onClick={() => publish(v)} disabled={!canPublish}>Publicar</Button>}
                {v.status === "archived" && <Button size="sm" variant="outline" onClick={() => restore(v)}>Restaurar</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {!canPublish && (
        <p className="mt-3 text-xs text-destructive">
          La configuración actual tiene errores. Resuélvelos en la pestaña Diagnóstico antes de publicar.
        </p>
      )}
    </div>
  );
}
