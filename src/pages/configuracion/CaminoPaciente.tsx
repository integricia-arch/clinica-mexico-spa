import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Lock, GripVertical, ShieldCheck, FlaskConical, BookOpen, ListChecks } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { useJourneyTemplates, useJourneyVersion, type JourneyTemplate } from "@/features/camino-paciente/hooks/useJourneyData";
import { STEP_TYPE_LABELS, TEMPLATE_TYPE_LABELS } from "@/features/camino-paciente/lib/stepKeys";
import { validateJourneyConfiguration, type StepLite } from "@/features/camino-paciente/lib/validateJourneyConfiguration";
import { ConfigHealthBadge } from "@/features/camino-paciente/components/ConfigHealthBadge";
import { logger } from "@/lib/logger";

import { FlujoPacientePanel } from "./caminoPaciente/FlujoPacientePanel";
import { StepEditorSheet } from "./caminoPaciente/StepEditorSheet";
import { FieldsPanel } from "./caminoPaciente/FieldsPanel";
import { CatalogsPanel } from "./caminoPaciente/CatalogsPanel";
import { RulesPanel } from "./caminoPaciente/RulesPanel";
import { VersionsPanel } from "./caminoPaciente/VersionsPanel";
import { SimulatorDialog } from "./caminoPaciente/SimulatorDialog";
import { NewTemplateDialog } from "./caminoPaciente/NewTemplateDialog";
import type { JourneyStep } from "@/features/camino-paciente/hooks/useJourneyData";

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

  const validation = useMemo(() => validateJourneyConfiguration(steps as StepLite[], []), [steps]);

  useEffect(() => {
    if (validation.status === "red" && selectedTemplate) {
      logger.warn("Journey config has errors", {
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        issues: validation.issues.filter((i) => i.level === "error").map((i) => i.message),
      });
    }
  }, [validation.status, selectedTemplate?.id]);

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
              <TabsTrigger value="flujo">Flujo completo</TabsTrigger>
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

          <TabsContent value="flujo">
            <FlujoPacientePanel />
          </TabsContent>
        </Tabs>
      )}

      <StepEditorSheet
        step={editingStep}
        onClose={() => setEditingStep(null)}
        onSaved={() => { setEditingStep(null); reloadVersion(); }}
      />

      <SimulatorDialog open={simulatorOpen} onClose={() => setSimulatorOpen(false)} steps={steps as StepLite[]} />

      <NewTemplateDialog open={newTemplateOpen} onClose={() => setNewTemplateOpen(false)} onCreated={() => { setNewTemplateOpen(false); reloadTemplates(); }} />
    </div>
  );
}
