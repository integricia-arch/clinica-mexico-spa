import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useJourneyInstance } from "@/features/camino-paciente/hooks/useJourneyInstance";
import PatientJourneyLine from "@/features/camino-paciente/components/PatientJourneyLine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Check, Lock, ShieldAlert, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  openJourneyStep,
  closeJourneyStep,
  saveJourneyStepData,
  blockJourneyStep,
  requestStepOverride,
  authorizeStepOverride,
} from "@/features/camino-paciente/services/journeyEngine";
import ArrivalForm from "@/features/camino-paciente/operativo/StepForms/ArrivalForm";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function CaminoPaciente() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loading, instance, steps, stepData, pendingOverrides, audit, reload } =
    useJourneyInstance(id ?? null);

  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [blockReason, setBlockReason] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  if (!id) return <div className="p-8">ID de camino inválido</div>;
  if (loading) return <div className="p-8 text-muted-foreground">Cargando camino...</div>;
  if (!instance) return <div className="p-8">Camino no encontrado</div>;

  const activeStep = steps.find((s) => s.id === activeStepId) ??
    steps.find((s) => ["in_progress","open","needs_review","blocked"].includes(s.status)) ??
    steps[0];

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      pending: { cls: "bg-muted text-muted-foreground", label: "Pendiente" },
      open: { cls: "bg-info/10 text-info", label: "Abierto" },
      in_progress: { cls: "bg-info/10 text-info", label: "En proceso" },
      completed: { cls: "bg-success/10 text-success", label: "Completado" },
      blocked: { cls: "bg-destructive/10 text-destructive", label: "Bloqueado" },
      needs_review: { cls: "bg-warning/10 text-warning", label: "Requiere revisión" },
      skipped: { cls: "bg-muted text-muted-foreground", label: "Omitido" },
      override_authorized: { cls: "bg-purple-500/10 text-purple-500", label: "Override autorizado" },
    };
    const v = map[status] ?? map.pending;
    return <Badge className={`${v.cls} border-0`}>{v.label}</Badge>;
  };

  const handleSaveData = async () => {
    if (!activeStep) return;
    const cleaned = Object.fromEntries(Object.entries(formData).filter(([, v]) => v?.length));
    if (!Object.keys(cleaned).length) {
      toast.error("Capture al menos un dato antes de guardar");
      return;
    }
    const r = await saveJourneyStepData(activeStep.id, cleaned);
    if (!r.ok) toast.error(r.error ?? "Error al guardar");
    else {
      toast.success("Datos guardados");
      setFormData({});
      reload();
    }
  };

  const handleOpen = async () => {
    if (!activeStep) return;
    const r = await openJourneyStep(activeStep.id);
    if (!r.ok) toast.error(r.error ?? "Error");
    else { toast.success("Hito abierto"); reload(); }
  };

  const handleClose = async () => {
    if (!activeStep) return;
    const r = await closeJourneyStep(activeStep.id);
    if (!r.ok) toast.error(r.error ?? "Error");
    else { toast.success("Hito cerrado. Siguiente hito abierto."); reload(); }
  };

  const handleBlock = async () => {
    if (!activeStep) return;
    const r = await blockJourneyStep(activeStep.id, blockReason);
    if (!r.ok) toast.error(r.error ?? "Error");
    else { toast.success("Hito bloqueado"); setBlockReason(""); reload(); }
  };

  const handleOverride = async () => {
    if (!activeStep) return;
    const r = await requestStepOverride(activeStep.id, overrideReason, "Acepto el riesgo operativo");
    if (!r.ok) toast.error(r.error ?? "Error");
    else { toast.success("Override solicitado"); setOverrideReason(""); reload(); }
  };

  const handleAuthorize = async (ovId: string) => {
    const r = await authorizeStepOverride(ovId);
    if (!r.ok) toast.error(r.error ?? "Error");
    else { toast.success("Override autorizado"); reload(); }
  };

  const existingData = activeStep ? stepData[activeStep.id] ?? {} : {};

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <h1 className="text-2xl font-semibold">Camino del Paciente</h1>
        <Badge variant="outline">{instance.status}</Badge>
      </div>

      <Card>
        <CardContent className="p-4">
          <PatientJourneyLine
            journeyInstance={instance as any}
            showLabels
            showProgress
            onStepClick={(s) => {
              const match = steps.find((st) => st.step_key === s.key);
              if (match) setActiveStepId(match.id);
            }}
          />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle className="text-sm">Hitos</CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
            {steps.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveStepId(s.id)}
                className={`w-full text-left rounded-md border p-2 text-sm transition ${
                  activeStep?.id === s.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{s.step_order/10}. {s.step_name}</span>
                  {statusBadge(s.status)}
                </div>
                {s.blocked_reason && <p className="text-xs text-destructive mt-1">{s.blocked_reason}</p>}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>{activeStep?.step_name ?? "Selecciona un hito"}</span>
              {activeStep && statusBadge(activeStep.status)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!activeStep ? (
              <p className="text-muted-foreground text-sm">Selecciona un hito de la lista.</p>
            ) : (
              <Tabs defaultValue="datos">
                <TabsList>
                  <TabsTrigger value="datos">Datos</TabsTrigger>
                  <TabsTrigger value="acciones">Acciones</TabsTrigger>
                  <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
                </TabsList>

                <TabsContent value="datos" className="space-y-3 pt-3">
                  <div className="text-xs text-muted-foreground space-y-1">
                    {activeStep.opened_at && (
                      <p>Abierto: {format(new Date(activeStep.opened_at), "dd MMM HH:mm", { locale: es })}</p>
                    )}
                    {activeStep.closed_at && (
                      <p>Cerrado: {format(new Date(activeStep.closed_at), "dd MMM HH:mm", { locale: es })}</p>
                    )}
                  </div>

                  {Object.keys(existingData).length > 0 && (
                    <div className="rounded-md border border-border p-3 bg-muted/30 text-sm space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Datos capturados</p>
                      {Object.entries(existingData).map(([k, v]) => (
                        <p key={k}><span className="text-muted-foreground">{k}:</span> {String(v)}</p>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs">Agregar dato (clave)</Label>
                    <Input
                      placeholder="ej. motivo_visita"
                      value={formData._key ?? ""}
                      onChange={(e) => setFormData({ ...formData, _key: e.target.value })}
                    />
                    <Label className="text-xs">Valor</Label>
                    <Textarea
                      rows={2}
                      placeholder="Capture el valor"
                      value={formData._value ?? ""}
                      onChange={(e) => setFormData({ ...formData, _value: e.target.value })}
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        const k = formData._key?.trim();
                        const v = formData._value?.trim();
                        if (!k || !v) { toast.error("Capture clave y valor"); return; }
                        const r = await saveJourneyStepData(activeStep.id, { [k]: v });
                        if (!r.ok) toast.error(r.error ?? "Error");
                        else { toast.success("Dato guardado"); setFormData({}); reload(); }
                      }}
                    >
                      Guardar dato
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="acciones" className="space-y-3 pt-3">
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={handleOpen} disabled={activeStep.status === "in_progress" || activeStep.status === "completed"}>
                      Abrir hito
                    </Button>
                    <Button size="sm" onClick={handleClose} disabled={activeStep.status === "completed"}>
                      <Check className="h-4 w-4" /> Cerrar hito
                    </Button>
                  </div>

                  <div className="space-y-2 border-t border-border pt-3">
                    <Label className="text-xs flex items-center gap-1"><Lock className="h-3 w-3" /> Bloquear hito</Label>
                    <Textarea rows={2} value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Motivo del bloqueo" />
                    <Button size="sm" variant="destructive" onClick={handleBlock} disabled={!blockReason}>Bloquear</Button>
                  </div>

                  <div className="space-y-2 border-t border-border pt-3">
                    <Label className="text-xs flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Solicitar override</Label>
                    <Textarea rows={2} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Justifique el override" />
                    <Button size="sm" variant="outline" onClick={handleOverride} disabled={!overrideReason}>Solicitar override</Button>
                  </div>

                  {pendingOverrides.filter((o) => o.journey_instance_step_id === activeStep.id).map((ov) => (
                    <div key={ov.id} className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
                      <p className="font-medium">Override pendiente</p>
                      <p className="text-xs text-muted-foreground mt-1">{ov.reason}</p>
                      <Button size="sm" className="mt-2" onClick={() => handleAuthorize(ov.id)}>
                        Autorizar (solo admin)
                      </Button>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="auditoria" className="pt-3 space-y-2 max-h-96 overflow-y-auto">
                  {audit.filter((a) => !a.journey_instance_step_id || a.journey_instance_step_id === activeStep.id).map((a) => (
                    <div key={a.id} className="text-xs border-l-2 border-border pl-2 py-1">
                      <p className="font-medium">{a.action}</p>
                      <p className="text-muted-foreground">{format(new Date(a.created_at), "dd MMM HH:mm:ss", { locale: es })}</p>
                    </div>
                  ))}
                  {audit.length === 0 && <p className="text-xs text-muted-foreground">Sin movimientos</p>}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <FileText className="h-3 w-3" /> Todos los cambios quedan registrados en la bitácora inmodificable.
      </div>
    </div>
  );
}
