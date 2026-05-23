// Construye una estructura uniforme de pasos para PatientJourneyLine.
import { getCurrentStepKey, type JourneyInstanceLite } from "@/features/centro-control/lib/journeyHelpers";

export type StepStatus = "completed" | "current" | "pending" | "blocked" | "review" | "override" | "skipped";

export interface JourneyLineStep {
  key: string;
  label: string;
  fullLabel: string;
  status: StepStatus;
  order: number;
  isCurrent: boolean;
  isCompleted: boolean;
  isBlocked: boolean;
  isCritical: boolean;
  isOptional: boolean;
  isSkipped: boolean;
  responsibleName?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  blockedReason?: string | null;
  nextAction?: string | null;
  targetRoute?: string | null;
}

// Flujo base (fallback) — coincide con las columnas del kanban (sin la columna virtual "bloqueado")
export const FALLBACK_STEPS: { key: string; label: string; fullLabel: string }[] = [
  { key: "arrival", label: "Recepción", fullLabel: "Llegada / Recepción" },
  { key: "identification", label: "Identidad", fullLabel: "Identificación y consentimiento" },
  { key: "record", label: "Expediente", fullLabel: "Expediente clínico" },
  { key: "triage", label: "Triage", fullLabel: "Triage / signos vitales" },
  { key: "consultation", label: "Consulta", fullLabel: "Consulta médica" },
  { key: "diagnosis", label: "Análisis", fullLabel: "Análisis / estudios" },
  { key: "valoration", label: "Valoración", fullLabel: "Valoración médica" },
  { key: "prescription", label: "Receta", fullLabel: "Receta / farmacia" },
  { key: "billing", label: "Cobro", fullLabel: "Cobro / facturación" },
  { key: "followup", label: "Seguimiento", fullLabel: "Seguimiento" },
  { key: "discharge", label: "Alta", fullLabel: "Alta / cierre" },
];

const ROUTE_BY_KEY: Record<string, string | null> = {
  arrival: null,
  identification: null,
  record: "/expedientes",
  triage: null,
  consultation: "/expedientes",
  diagnosis: null,
  valoration: null,
  prescription: "/farmacia",
  billing: "/facturacion",
  followup: "/inbox",
  discharge: null,
};

export function buildJourneyLineSteps(
  instance: JourneyInstanceLite | null | undefined,
  templateSteps?: any[] | null,
): JourneyLineStep[] {
  const snap: any = instance?.snapshot_json ?? {};
  const snapSteps: any[] = Array.isArray(snap.steps) ? snap.steps : [];
  const source = (templateSteps && templateSteps.length ? templateSteps : snapSteps).filter(Boolean);

  const base = source.length
    ? source.map((s: any, i: number) => ({
        key: s.step_key ?? s.key,
        label: shortLabel(s.step_name ?? s.label ?? s.step_key),
        fullLabel: s.step_name ?? s.label ?? s.step_key,
        order: s.step_order ?? i,
        isCritical: !!s.is_critical,
        isOptional: !s.is_required,
      }))
    : FALLBACK_STEPS.map((s, i) => ({ ...s, order: i, isCritical: true, isOptional: false }));

  const currentKey = getCurrentStepKey(instance);
  const blocked = instance?.status === "bloqueado" || instance?.status === "blocked";
  const overridden = instance?.status === "override";
  const completed = instance?.status === "completado" || instance?.status === "completed";
  const stepHistory: Record<string, any> = snap.step_history ?? snap.history ?? {};

  // index of current step (if known)
  let currentIdx = base.findIndex((s) => s.key === currentKey);
  if (currentIdx < 0 && instance && !completed) currentIdx = 0;
  if (completed) currentIdx = base.length;

  return base.map((s, i) => {
    const h = stepHistory[s.key] ?? {};
    const isSkipped = h.status === "skipped" || h.status === "no_aplica";
    const isReview = h.status === "review" || h.status === "requiere_revision";
    const isDone = i < currentIdx || h.status === "completed" || h.status === "completado";
    const isCurrent = i === currentIdx && !completed;
    const isBlocked = isCurrent && blocked;
    const isOverride = isCurrent && overridden;

    let status: StepStatus = "pending";
    if (isSkipped) status = "skipped";
    else if (isBlocked) status = "blocked";
    else if (isOverride) status = "override";
    else if (isReview) status = "review";
    else if (isCurrent) status = "current";
    else if (isDone) status = "completed";

    return {
      key: s.key,
      label: s.label,
      fullLabel: s.fullLabel,
      status,
      order: s.order,
      isCurrent,
      isCompleted: isDone,
      isBlocked,
      isCritical: s.isCritical,
      isOptional: s.isOptional,
      isSkipped,
      responsibleName: h.responsible_name ?? h.responsibleName ?? null,
      startedAt: h.started_at ?? null,
      completedAt: h.completed_at ?? null,
      blockedReason: isBlocked ? (snap.blocked_reason ?? h.blocked_reason ?? "Sin motivo registrado") : null,
      nextAction: isCurrent ? (snap.next_action ?? null) : null,
      targetRoute: ROUTE_BY_KEY[s.key] ?? null,
    };
  });
}

function shortLabel(name: string): string {
  if (!name) return "Etapa";
  const map: Record<string, string> = {
    identification: "Identidad",
    consent: "Consentimiento",
    record: "Expediente",
    consultation: "Consulta",
    diagnosis: "Diagnóstico",
    prescription: "Receta",
    billing: "Cobro",
    followup: "Seguimiento",
    discharge: "Alta",
  };
  if (map[name]) return map[name];
  // first word, max 12 chars
  const first = name.split(/\s+/)[0];
  return first.length > 12 ? first.slice(0, 12) : first;
}

export function journeyProgress(steps: JourneyLineStep[]): { done: number; total: number; label: string } {
  const done = steps.filter((s) => s.isCompleted).length;
  return { done, total: steps.length, label: `${done}/${steps.length}` };
}
