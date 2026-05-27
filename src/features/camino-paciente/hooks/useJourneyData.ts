import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

export interface JourneyTemplate {
  id: string;
  name: string;
  description: string | null;
  type: string;
  is_active: boolean;
  is_default: boolean;
  active_version_id: string | null;
}

export interface JourneyVersion {
  id: string;
  template_id: string;
  version_number: number;
  status: "draft" | "active" | "archived";
  publish_reason: string | null;
  created_at: string;
  published_at: string | null;
}

export interface JourneyStep {
  id: string;
  template_version_id: string;
  step_key: string;
  step_name: string;
  step_description: string | null;
  step_type: string;
  step_order: number;
  is_required: boolean;
  is_critical: boolean;
  allow_not_applicable: boolean;
  requires_responsible: boolean;
  blocks_progress: boolean;
  requires_document: boolean;
  max_recommended_minutes: number | null;
  allowed_edit_roles: string[];
  allowed_complete_roles: string[];
  allowed_override_roles: string[];
}

export function useJourneyTemplates() {
  const [templates, setTemplates] = useState<JourneyTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("journey_templates")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) toast.error("No se pudieron cargar las plantillas: " + friendlyError(error));
    setTemplates((data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { templates, loading, reload: load };
}

export function useJourneyVersion(versionId: string | null) {
  const [version, setVersion] = useState<JourneyVersion | null>(null);
  const [steps, setSteps] = useState<JourneyStep[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!versionId) { setVersion(null); setSteps([]); return; }
    setLoading(true);
    const [{ data: v }, { data: s }] = await Promise.all([
      supabase.from("journey_template_versions").select("*").eq("id", versionId).maybeSingle(),
      supabase.from("journey_step_definitions").select("*").eq("template_version_id", versionId).order("step_order"),
    ]);
    setVersion((v as any) ?? null);
    setSteps(((s as any) ?? []).map((x: any) => ({
      ...x,
      allowed_edit_roles: Array.isArray(x.allowed_edit_roles) ? x.allowed_edit_roles : [],
      allowed_complete_roles: Array.isArray(x.allowed_complete_roles) ? x.allowed_complete_roles : [],
      allowed_override_roles: Array.isArray(x.allowed_override_roles) ? x.allowed_override_roles : [],
    })));
    setLoading(false);
  }, [versionId]);

  useEffect(() => { load(); }, [load]);
  return { version, steps, loading, reload: load };
}
