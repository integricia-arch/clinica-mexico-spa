import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useJourneyInstance } from "@/features/camino-paciente/hooks/useJourneyInstance";
import { useAuth } from "@/hooks/useAuth";
import PatientJourneyLine from "@/features/camino-paciente/components/PatientJourneyLine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft, Check, Lock, ShieldAlert, FileText,
  User, Clock, Stethoscope, MapPin, Calendar,
  ChevronRight, AlertCircle, ShieldX,
} from "lucide-react";
import { toast } from "sonner";
import {
  openJourneyStep,
  closeJourneyStep,
  saveJourneyStepData,
  blockJourneyStep,
  requestStepOverride,
  authorizeStepOverride,
} from "@/features/camino-paciente/services/journeyEngine";
import { getStepForm } from "@/features/camino-paciente/operativo/StepForms/registry";
import { format, differenceInYears, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";

// ── helpers ────────────────────────────────────────────────────────────────

function calcAge(dob: string | null): string {
  if (!dob) return "—";
  return `${differenceInYears(new Date(), new Date(dob))} años`;
}

function useElapsed(since: string | null): string {
  const [label, setLabel] = useState("—");
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!since) { setLabel("—"); return; }
    const update = () => {
      const mins = differenceInMinutes(new Date(), new Date(since));
      if (mins < 60) setLabel(`${mins} min`);
      else setLabel(`${Math.floor(mins / 60)}h ${mins % 60}m`);
    };
    update();
    ref.current = setInterval(update, 60_000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [since]);

  return label;
}

const STATUS_MAP: Record<string, { cls: string; label: string }> = {
  pending:             { cls: "bg-muted text-muted-foreground",        label: "Pendiente" },
  open:                { cls: "bg-blue-100 text-blue-700",             label: "Abierto" },
  in_progress:         { cls: "bg-blue-100 text-blue-700",             label: "En proceso" },
  completed:           { cls: "bg-green-100 text-green-700",           label: "Completado" },
  blocked:             { cls: "bg-red-100 text-red-700",               label: "Bloqueado" },
  needs_review:        { cls: "bg-yellow-100 text-yellow-700",         label: "Requiere revisión" },
  skipped:             { cls: "bg-muted text-muted-foreground",        label: "Omitido" },
  override_authorized: { cls: "bg-purple-100 text-purple-700",         label: "Override autorizado" },
};

const INSTANCE_STATUS_MAP: Record<string, { cls: string; label: string }> = {
  en_proceso:  { cls: "bg-blue-100 text-blue-700",   label: "En proceso" },
  completado:  { cls: "bg-green-100 text-green-700", label: "Completado" },
  bloqueado:   { cls: "bg-red-100 text-red-700",     label: "Bloqueado" },
};

function StepBadge({ status }: { status: string }) {
  const v = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return <Badge className={`${v.cls} border-0 text-xs`}>{v.label}</Badge>;
}

const ACTIVE_STATUSES = ["in_progress", "open", "needs_review", "blocked"];

// Roles allowed to act on each step (open / close / block)
const STEP_ROLES: Record<string, string[]> = {
  arrival:            ["admin", "manager", "receptionist", "nurse"],
  assignment:         ["admin", "manager", "receptionist"],
  attention_open:     ["admin", "manager", "nurse", "receptionist"],
  identification:     ["admin", "manager", "receptionist"],
  record:             ["admin", "manager", "doctor", "nurse"],
  triage:             ["admin", "manager", "nurse"],
  consultation_open:  ["admin", "manager", "doctor"],
  consultation_close: ["admin", "manager", "doctor"],
  consultation:       ["admin", "manager", "doctor"],
  prescription:       ["admin", "manager", "doctor"],
  pharmacy:           ["admin", "manager", "nurse", "cajero"],
  billing:            ["admin", "manager", "receptionist", "cajero"],
  discharge:          ["admin", "manager", "receptionist", "nurse"],
  followup:           ["admin", "manager", "receptionist"],
};

// ── component ──────────────────────────────────────────────────────────────

export default function CaminoPaciente() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stepKeyParam = searchParams.get("step");

  const { roles } = useAuth();
  const { loading, instance, patient, appointment, steps, stepData, pendingOverrides, audit, reload } =
    useJourneyInstance(id ?? null);

  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [userSelected, setUserSelected] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const elapsed = useElapsed(instance?.created_at ?? null);

  // Auto-select: ?step= param → active step → first step (only if user hasn't manually picked)
  useEffect(() => {
    if (!steps.length) return;

    if (stepKeyParam) {
      const target = steps.find((s) => s.step_key === stepKeyParam);
      if (target) { setActiveStepId(target.id); return; }
    }

    if (!userSelected) {
      const active = steps.find((s) => ACTIVE_STATUSES.includes(s.status));
      setActiveStepId(active?.id ?? steps[0]?.id ?? null);
    }
  }, [steps, stepKeyParam, userSelected]);

  if (!id) return <div className="p-8">ID de camino inválido</div>;
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
  if (!instance) return <div className="p-8 text-destructive">Camino no encontrado</div>;

  const activeStep = steps.find((s) => s.id === activeStepId) ?? steps[0];
  const existingData = activeStep ? (stepData[activeStep.id] ?? {}) : {};
  const instanceStatus = INSTANCE_STATUS_MAP[instance.status] ?? { cls: "bg-muted text-muted-foreground", label: instance.status };

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const pct = steps.length ? Math.round((completedCount / steps.length) * 100) : 0;

  const canActOnStep = (stepKey: string): boolean => {
    if (!stepKey) return false;
    const allowed = STEP_ROLES[stepKey];
    if (!allowed) return true; // unmapped step → allow all
    return roles.some((r) => allowed.includes(r));
  };

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleOpen = async () => {
    if (!activeStep) return;
    const r = await openJourneyStep(activeStep.id);
    if (!r.ok) toast.error(r.error ?? "Error al abrir hito");
    else { toast.success("Hito abierto"); reload(); }
  };

  const handleClose = async () => {
    if (!activeStep) return;
    const r = await closeJourneyStep(activeStep.id);
    if (!r.ok) toast.error(r.error ?? "Error al cerrar hito");
    else {
      toast.success("Hito completado");
      setUserSelected(false); // allow auto-advance to next
      reload();
    }
  };

  const handleBlock = async () => {
    if (!activeStep || !blockReason.trim()) return;
    const r = await blockJourneyStep(activeStep.id, blockReason);
    if (!r.ok) toast.error(r.error ?? "Error");
    else { toast.success("Hito bloqueado"); setBlockReason(""); reload(); }
  };

  const handleOverride = async () => {
    if (!activeStep || !overrideReason.trim()) return;
    const r = await requestStepOverride(activeStep.id, overrideReason, "Acepto el riesgo operativo");
    if (!r.ok) toast.error(r.error ?? "Error");
    else { toast.success("Override solicitado"); setOverrideReason(""); reload(); }
  };

  const handleAuthorize = async (ovId: string) => {
    const r = await authorizeStepOverride(ovId);
    if (!r.ok) toast.error(r.error ?? "Error");
    else { toast.success("Override autorizado"); reload(); }
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* ── Patient header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b bg-card shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 space-y-2">
          {/* top row */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="flex-1 min-w-0">
              {patient ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-base">
                    {patient.nombre} {patient.apellidos}
                  </span>
                  <span className="text-muted-foreground text-sm">{calcAge(patient.fecha_nacimiento)}</span>
                  {patient.sexo && (
                    <Badge variant="outline" className="text-xs">{patient.sexo}</Badge>
                  )}
                </div>
              ) : (
                <span className="font-semibold text-base text-muted-foreground">Paciente</span>
              )}
            </div>

            <Badge className={`${instanceStatus.cls} border-0 shrink-0`}>{instanceStatus.label}</Badge>
          </div>

          {/* context row */}
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground pl-9">
            {appointment?.fecha_inicio && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(appointment.fecha_inicio), "dd MMM yyyy HH:mm", { locale: es })}
              </span>
            )}
            {appointment?.motivo_consulta && (
              <span className="flex items-center gap-1">
                <Stethoscope className="h-3 w-3" />
                {appointment.motivo_consulta}
              </span>
            )}
            {appointment?.doctor_nombre && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Dr. {appointment.doctor_nombre}
              </span>
            )}
            {appointment?.sala_nombre && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {appointment.sala_nombre}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              En clínica: {elapsed}
            </span>
          </div>

          {/* progress bar */}
          <div className="pl-9 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {completedCount}/{steps.length} hitos ({pct}%)
            </span>
          </div>
        </div>
      </div>

      {/* ── Journey timeline ────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <Card>
          <CardContent className="p-3">
            <PatientJourneyLine
              journeyInstance={instance as never}
              showLabels
              showProgress
              onStepClick={(s) => {
                const match = steps.find((st) => st.step_key === s.key);
                if (match) { setActiveStepId(match.id); setUserSelected(true); }
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-4 grid md:grid-cols-3 gap-4">

        {/* Step list */}
        <Card className="md:col-span-1 h-fit md:sticky md:top-[132px]">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Hitos del camino
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2 space-y-0.5 max-h-[calc(100vh-220px)] overflow-y-auto">
            {steps.map((s) => {
              const isActive = activeStep?.id === s.id;
              const isActionable = ACTIVE_STATUSES.includes(s.status);
              const userCanAct = canActOnStep(s.step_key);
              return (
                <button
                  key={s.id}
                  onClick={() => { setActiveStepId(s.id); setUserSelected(true); }}
                  className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2 ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isActionable
                        ? "bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200"
                        : "hover:bg-muted/60 text-foreground"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-medium truncate">{s.step_name}</span>
                      {s.blocked_reason && <AlertCircle className="h-3 w-3 text-destructive shrink-0" />}
                      {isActionable && !userCanAct && (
                        <ShieldX className={`h-3 w-3 shrink-0 ${isActive ? "text-primary-foreground/70" : "text-orange-400"}`} />
                      )}
                    </div>
                    {!isActive && (
                      <div className="mt-0.5">
                        <StepBadge status={s.status} />
                      </div>
                    )}
                  </div>
                  {isActionable && !isActive && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                  )}
                  {s.status === "completed" && !isActive && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Step detail */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span className="truncate">{activeStep?.step_name ?? "Selecciona un hito"}</span>
              {activeStep && <StepBadge status={activeStep.status} />}
            </CardTitle>
            {activeStep && (
              <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
                {activeStep.opened_at && (
                  <span>Abierto {format(new Date(activeStep.opened_at), "dd MMM HH:mm", { locale: es })}</span>
                )}
                {activeStep.closed_at && (
                  <span>· Cerrado {format(new Date(activeStep.closed_at), "dd MMM HH:mm", { locale: es })}</span>
                )}
                {activeStep.blocked_reason && (
                  <span className="text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {activeStep.blocked_reason}
                  </span>
                )}
              </div>
            )}
          </CardHeader>

          <CardContent>
            {!activeStep ? (
              <p className="text-muted-foreground text-sm">Selecciona un hito de la lista.</p>
            ) : (
              <Tabs defaultValue="datos">
                <TabsList>
                  <TabsTrigger value="datos">Datos</TabsTrigger>
                  <TabsTrigger value="acciones">Acciones</TabsTrigger>
                  <TabsTrigger value="auditoria">
                    Auditoría
                    {audit.filter((a) => (a as { journey_instance_step_id?: string }).journey_instance_step_id === activeStep.id).length > 0 && (
                      <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">
                        {audit.filter((a) => (a as { journey_instance_step_id?: string }).journey_instance_step_id === activeStep.id).length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* ── Datos ───────────────────────────────────────────────── */}
                <TabsContent value="datos" className="space-y-4 pt-3">
                  {/* Existing saved data preview */}
                  {Object.keys(existingData).length > 0 && (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Datos capturados
                      </p>
                      {Object.entries(existingData).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-sm">
                          <span className="text-muted-foreground min-w-[120px] shrink-0 capitalize">
                            {k.replace(/_/g, " ")}:
                          </span>
                          <span className="font-medium break-words">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Step-specific form */}
                  {(() => {
                    const StepForm = getStepForm(activeStep.step_key);
                    if (StepForm) {
                      return (
                        <StepForm
                          stepId={activeStep.id}
                          stepKey={activeStep.step_key}
                          stepStatus={activeStep.status}
                          journeyInstanceId={instance.id}
                          patientId={instance.patient_id ?? null}
                          appointmentId={instance.appointment_id ?? null}
                          existingData={existingData as never}
                          onSaved={reload}
                        />
                      );
                    }
                    return (
                      <p className="text-sm text-muted-foreground italic">
                        Sin formulario configurado para este hito.
                      </p>
                    );
                  })()}
                </TabsContent>

                {/* ── Acciones ────────────────────────────────────────────── */}
                <TabsContent value="acciones" className="space-y-4 pt-3">
                  {/* Role restriction banner */}
                  {!canActOnStep(activeStep.step_key) && (
                    <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                      <ShieldX className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
                      <div>
                        <p className="font-medium">Sin permiso para este hito</p>
                        <p className="text-xs text-orange-700 mt-0.5">
                          Roles requeridos: {(STEP_ROLES[activeStep.step_key] ?? []).join(", ") || "—"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Primary actions */}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm" variant="outline"
                      onClick={handleOpen}
                      disabled={["in_progress", "completed"].includes(activeStep.status) || !canActOnStep(activeStep.step_key)}
                    >
                      Abrir hito
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleClose}
                      disabled={activeStep.status === "completed" || !canActOnStep(activeStep.step_key)}
                    >
                      <Check className="h-4 w-4 mr-1" /> Completar hito
                    </Button>
                  </div>

                  {/* Block */}
                  <div className="space-y-2 border-t pt-3">
                    <Label className="text-xs flex items-center gap-1 text-muted-foreground">
                      <Lock className="h-3 w-3" /> Bloquear hito
                    </Label>
                    <Textarea
                      rows={2}
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Motivo del bloqueo (requerido)"
                    />
                    <Button
                      size="sm" variant="destructive"
                      onClick={handleBlock}
                      disabled={!blockReason.trim() || !canActOnStep(activeStep.step_key)}
                    >
                      Bloquear
                    </Button>
                  </div>

                  {/* Override */}
                  <div className="space-y-2 border-t pt-3">
                    <Label className="text-xs flex items-center gap-1 text-muted-foreground">
                      <ShieldAlert className="h-3 w-3" /> Solicitar override
                    </Label>
                    <Textarea
                      rows={2}
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Justificación clínica del override"
                    />
                    <Button
                      size="sm" variant="outline"
                      onClick={handleOverride}
                      disabled={!overrideReason.trim()}
                    >
                      Solicitar override
                    </Button>
                  </div>

                  {/* Pending overrides */}
                  {pendingOverrides
                    .filter((o) => (o as { journey_instance_step_id: string }).journey_instance_step_id === activeStep.id)
                    .map((ov) => {
                      const o = ov as { id: string; reason: string };
                      return (
                        <div key={o.id} className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm space-y-2">
                          <p className="font-medium text-yellow-800">Override pendiente de autorización</p>
                          <p className="text-xs text-yellow-700">{o.reason}</p>
                          <Button size="sm" onClick={() => handleAuthorize(o.id)}>
                            Autorizar (admin)
                          </Button>
                        </div>
                      );
                    })}
                </TabsContent>

                {/* ── Auditoría ───────────────────────────────────────────── */}
                <TabsContent value="auditoria" className="pt-3 space-y-1.5 max-h-80 overflow-y-auto">
                  {audit
                    .filter((a) => {
                      const entry = a as { journey_instance_step_id?: string };
                      return !entry.journey_instance_step_id || entry.journey_instance_step_id === activeStep.id;
                    })
                    .map((a) => {
                      const entry = a as { id: string; action: string; created_at: string; actor_id?: string };
                      return (
                        <div key={entry.id} className="text-xs border-l-2 border-muted pl-3 py-1">
                          <p className="font-medium text-foreground">{entry.action}</p>
                          <p className="text-muted-foreground">
                            {format(new Date(entry.created_at), "dd MMM yyyy HH:mm:ss", { locale: es })}
                          </p>
                        </div>
                      );
                    })}
                  {audit.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">Sin movimientos registrados</p>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto px-4 pb-6">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <FileText className="h-3 w-3" />
          Todos los cambios quedan registrados en la bitácora inmodificable del camino del paciente.
        </p>
      </div>
    </div>
  );
}
