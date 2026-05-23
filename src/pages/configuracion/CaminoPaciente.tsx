import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Lock, GripVertical, ShieldCheck, FlaskConical, History, BookOpen, ListChecks, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useJourneyTemplates, useJourneyVersion, type JourneyStep, type JourneyTemplate } from "@/features/camino-paciente/hooks/useJourneyData";
import { STEP_TYPE_LABELS, TEMPLATE_TYPE_LABELS, APP_ROLES, CRITICAL_STEP_KEYS } from "@/features/camino-paciente/lib/stepKeys";
import { validateJourneyConfiguration } from "@/features/camino-paciente/lib/validateJourneyConfiguration";
import { simulateJourney, SCENARIO_LABELS, type Scenario } from "@/features/camino-paciente/lib/simulateJourney";
import { getAvailableOptionsForStep } from "@/features/camino-paciente/lib/getAvailableOptionsForStep";
import { ConfigHealthBadge } from "@/features/camino-paciente/components/ConfigHealthBadge";

export default function CaminoPacienteConfig() {
  const nav = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const { templates, loading: loadingTemplates, reload: reloadTemplates } = useJourneyTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const selectedTemplate: JourneyTemplate | null = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? templates.find((t) => t.is_default) ?? templates[0] ?? null,
    [templates, selectedTemplateId],
  );
  const { version, steps, reload: reloadVersion } = useJourneyVersion(selectedTemplate?.active_version_id ?? null);

  const [editingStep, setEditingStep] = useState<JourneyStep | null>(null);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);

  const validation = useMemo(() => validateJourneyConfiguration(steps as any, []), [steps]);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Solo administradores pueden configurar el Camino del Paciente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => nav("/configuracion")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Volver a Configuración
          </button>
          <h1 className="mt-1 text-display text-2xl font-bold text-foreground">Configuración del Camino del Paciente</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define plantillas, etapas, campos y reglas del flujo del paciente. Los cambios se guardan como borradores y deben publicarse en una nueva versión.
          </p>
        </div>
        <ConfigHealthBadge result={validation} />
      </div>

      {/* Plantillas */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-display font-semibold">Plantillas de camino</h2>
            <span className="text-xs text-muted-foreground">({templates.length})</span>
          </div>
          <Button size="sm" onClick={() => setNewTemplateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nueva plantilla
          </Button>
        </div>
        {loadingTemplates ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplateId(t.id)}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  selectedTemplate?.id === t.id ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  {t.is_default && <Badge variant="secondary" className="text-[10px]">Base</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {TEMPLATE_TYPE_LABELS[t.type as keyof typeof TEMPLATE_TYPE_LABELS] ?? t.type}
                </p>
                {t.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{t.description}</p>}
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedTemplate && (
        <Tabs defaultValue="etapas" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="etapas">Etapas</TabsTrigger>
              <TabsTrigger value="campos">Campos</TabsTrigger>
              <TabsTrigger value="catalogos">Catálogos</TabsTrigger>
              <TabsTrigger value="reglas">Reglas</TabsTrigger>
              <TabsTrigger value="versiones">Versiones</TabsTrigger>
              <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" onClick={() => setSimulatorOpen(true)}>
              <FlaskConical className="h-4 w-4 mr-1" /> Simular camino
            </Button>
          </div>

          <TabsContent value="etapas" className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-display font-semibold">Etapas del flujo</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Versión {version?.version_number ?? "—"} ({version?.status ?? "—"}). Las etapas críticas tienen candado y no pueden eliminarse.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {steps.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-semibold">
                        {s.step_order}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{s.step_name}</p>
                          {s.is_critical && <Lock className="h-3 w-3 text-warning" aria-label="Crítica" />}
                          <Badge variant="secondary" className="text-[10px]">
                            {STEP_TYPE_LABELS[s.step_type as keyof typeof STEP_TYPE_LABELS] ?? s.step_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          clave: <code className="font-mono">{s.step_key}</code>
                          {s.is_required && " · obligatoria"}
                          {s.blocks_progress && " · bloquea avance"}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setEditingStep(s)}>Editar</Button>
                  </div>
                ))}
                {steps.length === 0 && <p className="text-sm text-muted-foreground">Esta versión aún no tiene etapas.</p>}
              </div>
            </div>

            {validation.issues.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h3 className="text-display font-semibold">Validación de configuración</h3>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {validation.issues.map((i, idx) => (
                    <li key={idx} className={`flex gap-2 ${i.level === "error" ? "text-destructive" : i.level === "warning" ? "text-warning" : "text-muted-foreground"}`}>
                      <span>•</span>
                      <span>{i.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="campos" className="space-y-3">
            <FieldsPanel steps={steps} />
          </TabsContent>

          <TabsContent value="catalogos">
            <CatalogsPanel />
          </TabsContent>

          <TabsContent value="reglas">
            <RulesPanel steps={steps} versionId={version?.id ?? null} />
          </TabsContent>

          <TabsContent value="versiones">
            <VersionsPanel templateId={selectedTemplate.id} canPublish={validation.canPublish} onChange={() => { reloadTemplates(); reloadVersion(); }} />
          </TabsContent>

          <TabsContent value="diagnostico">
            <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary" />
                <h3 className="text-display font-semibold">Diagnóstico de la configuración</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Estado general:{" "}
                <strong className={
                  validation.status === "green" ? "text-success"
                  : validation.status === "yellow" ? "text-warning"
                  : "text-destructive"
                }>
                  {validation.status === "green" ? "Segura" : validation.status === "yellow" ? "Con advertencias" : "Inválida"}
                </strong>
              </p>
              {validation.issues.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin observaciones. Todas las etapas críticas están presentes y validadas.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {validation.issues.map((i, idx) => (
                    <li key={idx} className={i.level === "error" ? "text-destructive" : i.level === "warning" ? "text-warning" : "text-muted-foreground"}>
                      • {i.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <StepEditorSheet
        step={editingStep}
        onClose={() => setEditingStep(null)}
        onSaved={() => { setEditingStep(null); reloadVersion(); }}
      />

      <SimulatorDialog open={simulatorOpen} onClose={() => setSimulatorOpen(false)} steps={steps as any} />

      <NewTemplateDialog open={newTemplateOpen} onClose={() => setNewTemplateOpen(false)} onCreated={() => { setNewTemplateOpen(false); reloadTemplates(); }} />
    </div>
  );
}

/* ---------- Step editor (panel lateral) ---------- */
function StepEditorSheet({ step, onClose, onSaved }: { step: JourneyStep | null; onClose: () => void; onSaved: () => void }) {
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

  useState(() => {
    /* effect-like init */
  });
  // sync when step changes
  if (step && name === "" && step.step_name) {
    // lightweight init
  }
  // proper init via useEffect-equivalent
  useMemo(() => {
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
    const { error } = await supabase
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
    if (error) { toast.error("No se pudo guardar: " + error.message); return; }
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

/* ---------- Fields panel ---------- */
function FieldsPanel({ steps }: { steps: JourneyStep[] }) {
  const [stepId, setStepId] = useState<string>(steps[0]?.id ?? "");
  const currentStep = steps.find((s) => s.id === stepId) ?? steps[0];
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    if (!currentStep) return;
    setLoading(true);
    const { data } = await supabase.from("journey_step_fields").select("*").eq("step_definition_id", currentStep.id).order("sort_order");
    setFields((data as any) ?? []);
    setLoading(false);
  };

  useMemo(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [currentStep?.id]);

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
                  const { error } = await supabase.from("journey_step_fields").delete().eq("id", f.id);
                  if (error) toast.error(error.message);
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
                  const { error } = await supabase.from("journey_step_fields").insert({
                    step_definition_id: currentStep.id,
                    field_key: opt.key,
                    field_label: opt.label,
                    field_type: opt.fieldType as any,
                    is_required: false,
                  });
                  if (error) toast.error(error.message);
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

/* ---------- Catalogs panel ---------- */
function CatalogsPanel() {
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [items, setItems] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: cats } = await supabase.from("journey_option_catalogs").select("*").order("catalog_name");
    const { data: its } = await supabase.from("journey_option_items").select("*").order("sort_order");
    const map: Record<string, any[]> = {};
    (its ?? []).forEach((i: any) => { (map[i.catalog_id] ??= []).push(i); });
    setCatalogs((cats as any) ?? []);
    setItems(map);
    setLoading(false);
  };
  useMemo(() => { load(); }, []);

  const toggleItem = async (it: any) => {
    const { error } = await supabase.from("journey_option_items").update({ is_active: !it.is_active }).eq("id", it.id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="text-display font-semibold mb-3">Catálogos protegidos</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Los elementos ya usados no se eliminan; solo se desactivan para preservar la trazabilidad.
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="space-y-4">
          {catalogs.map((c) => (
            <div key={c.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold">{c.catalog_name}</p>
                  <p className="text-xs text-muted-foreground">
                    <code className="font-mono">{c.catalog_key}</code>
                    {c.applies_to_step_type && ` · aplica a etapas de tipo ${c.applies_to_step_type}`}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                {(items[c.id] ?? []).map((it) => (
                  <div key={it.id} className="flex items-center justify-between rounded border border-border/60 px-2 py-1.5">
                    <span className={`text-xs ${it.is_active ? "" : "text-muted-foreground line-through"}`}>{it.option_label}</span>
                    <Button size="sm" variant="ghost" onClick={() => toggleItem(it)}>
                      {it.is_active ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Rules panel ---------- */
function RulesPanel({ steps, versionId }: { steps: JourneyStep[]; versionId: string | null }) {
  const [rules, setRules] = useState<any[]>([]);
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
    const { data } = await supabase.from("journey_validation_rules").select("*").eq("template_version_id", versionId).order("created_at");
    setRules((data as any) ?? []);
    setLoading(false);
  };
  useMemo(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [versionId]);

  const stepKeys = new Set(steps.map((s) => s.step_key));

  const save = async () => {
    if (!versionId) return;
    if (!ruleName.trim() || !sourceStep || !condition.trim() || !action.trim()) {
      toast.error("Completa todos los campos"); return;
    }
    if (!stepKeys.has(sourceStep)) { toast.error("La etapa origen no existe"); return; }
    const { error } = await supabase.from("journey_validation_rules").insert({
      template_version_id: versionId,
      rule_name: ruleName.trim(),
      source_step_key: sourceStep,
      condition_json: { description: condition.trim() },
      action_json: { description: action.trim() },
      severity,
      is_active: true,
    });
    if (error) { toast.error(error.message); return; }
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
              <Select value={severity} onValueChange={(v: any) => setSeverity(v)}>
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

/* ---------- Versions panel ---------- */
function VersionsPanel({ templateId, canPublish, onChange }: { templateId: string; canPublish: boolean; onChange: () => void }) {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("journey_template_versions")
      .select("*")
      .eq("template_id", templateId)
      .order("version_number", { ascending: false });
    setVersions((data as any) ?? []);
    setLoading(false);
  };
  useMemo(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [templateId]);

  const createDraftFromActive = async () => {
    const active = versions.find((v) => v.status === "active");
    if (!active) { toast.error("No hay versión activa para clonar"); return; }
    const nextNumber = Math.max(...versions.map((v) => v.version_number)) + 1;

    const { data: newVersion, error } = await supabase
      .from("journey_template_versions")
      .insert({ template_id: templateId, version_number: nextNumber, status: "draft", config_json: active.config_json })
      .select()
      .single();
    if (error || !newVersion) { toast.error(error?.message ?? "Error"); return; }

    // clone steps
    const { data: srcSteps } = await supabase.from("journey_step_definitions").select("*").eq("template_version_id", active.id);
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
      await supabase.from("journey_step_definitions").insert(rows);
    }
    toast.success(`Borrador v${nextNumber} creado`);
    load(); onChange();
  };

  const publish = async (v: any) => {
    if (!canPublish) { toast.error("La configuración tiene errores; corrígelos antes de publicar."); return; }
    if (!reason.trim()) { toast.error("Indica el motivo del cambio"); return; }

    // archive current active
    await supabase.from("journey_template_versions").update({ status: "archived" }).eq("template_id", templateId).eq("status", "active");
    // publish this one
    await supabase.from("journey_template_versions").update({ status: "active", publish_reason: reason, published_at: new Date().toISOString() }).eq("id", v.id);
    await supabase.from("journey_templates").update({ active_version_id: v.id }).eq("id", templateId);
    toast.success(`v${v.version_number} publicada`);
    setReason("");
    load(); onChange();
  };

  const restore = async (v: any) => {
    if (!confirm(`¿Restaurar v${v.version_number} como activa? La actual será archivada.`)) return;
    await supabase.from("journey_template_versions").update({ status: "archived" }).eq("template_id", templateId).eq("status", "active");
    await supabase.from("journey_template_versions").update({ status: "active" }).eq("id", v.id);
    await supabase.from("journey_templates").update({ active_version_id: v.id }).eq("id", templateId);
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

/* ---------- Simulator ---------- */
function SimulatorDialog({ open, onClose, steps }: { open: boolean; onClose: () => void; steps: any[] }) {
  const [scenario, setScenario] = useState<Scenario>("normal");
  const result = useMemo(() => simulateJourney(steps, scenario), [steps, scenario]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Simulador del camino</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Escenario</Label>
            <Select value={scenario} onValueChange={(v: any) => setScenario(v)}>
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

/* ---------- New template (clones base) ---------- */
function NewTemplateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<keyof typeof TEMPLATE_TYPE_LABELS>("consulta_general");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim()) { toast.error("El nombre es obligatorio"); return; }
    setSaving(true);

    // find base template
    const { data: base } = await supabase
      .from("journey_templates")
      .select("*, journey_template_versions!journey_template_versions_template_id_fkey(*)")
      .eq("is_default", true)
      .maybeSingle();

    // create template
    const { data: tpl, error: e1 } = await supabase
      .from("journey_templates")
      .insert({ name: name.trim(), description: desc.trim() || null, type })
      .select()
      .single();
    if (e1 || !tpl) { setSaving(false); toast.error(e1?.message ?? "Error"); return; }

    // create v1 active
    const { data: ver, error: e2 } = await supabase
      .from("journey_template_versions")
      .insert({ template_id: tpl.id, version_number: 1, status: "active", publish_reason: "Plantilla nueva basada en base segura", published_at: new Date().toISOString() })
      .select()
      .single();
    if (e2 || !ver) { setSaving(false); toast.error(e2?.message ?? "Error"); return; }

    // copy steps from base active version
    if (base?.active_version_id) {
      const { data: srcSteps } = await supabase.from("journey_step_definitions").select("*").eq("template_version_id", base.active_version_id);
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
        await supabase.from("journey_step_definitions").insert(rows);
      }
    } else {
      // fallback: create critical steps
      const rows = CRITICAL_STEP_KEYS.map((k, i) => ({
        template_version_id: ver.id,
        step_key: k,
        step_name: k,
        step_type: "clinica" as any,
        step_order: i + 1,
        is_required: true,
        is_critical: true,
        allowed_complete_roles: ["admin"],
      }));
      await supabase.from("journey_step_definitions").insert(rows);
    }

    await supabase.from("journey_templates").update({ active_version_id: ver.id }).eq("id", tpl.id);

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
            <Select value={type} onValueChange={(v: any) => setType(v)}>
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
