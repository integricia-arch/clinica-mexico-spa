// Helpers defensivos del Camino del Paciente para el Centro de Control.

export type KanbanColumnKey =
  | "arrival"
  | "identification"
  | "record"
  | "triage"
  | "consultation"
  | "diagnosis"
  | "prescription"
  | "billing"
  | "followup"
  | "discharge"
  | "bloqueado";

export const KANBAN_COLUMNS: { key: KanbanColumnKey; label: string }[] = [
  { key: "arrival", label: "Llegada / Recepción" },
  { key: "identification", label: "Identificación / consentimiento" },
  { key: "record", label: "Expediente" },
  { key: "triage", label: "Triage / signos vitales" },
  { key: "consultation", label: "Consulta médica" },
  { key: "diagnosis", label: "Análisis / valoración" },
  { key: "prescription", label: "Receta / farmacia" },
  { key: "billing", label: "Cobro / facturación" },
  { key: "followup", label: "Seguimiento" },
  { key: "discharge", label: "Alta / cierre" },
  { key: "bloqueado", label: "Bloqueados" },
];

const STEP_TO_COLUMN: Record<string, KanbanColumnKey> = {
  arrival: "arrival",
  reception: "arrival",
  identification: "identification",
  consent: "identification",
  record: "record",
  expediente: "record",
  triage: "triage",
  vital_signs: "triage",
  consultation: "consultation",
  diagnosis: "diagnosis",
  valoration: "diagnosis",
  prescription: "prescription",
  pharmacy: "prescription",
  billing: "billing",
  followup: "followup",
  discharge: "discharge",
  audit: "discharge",
};

export function getJourneyStageLabel(stepKey: string | null | undefined): string {
  if (!stepKey) return "Sin etapa";
  const labels: Record<string, string> = {
    arrival: "Llegada",
    identification: "Identificación",
    consent: "Consentimiento",
    record: "Expediente",
    triage: "Triage",
    consultation: "Consulta",
    diagnosis: "Diagnóstico",
    prescription: "Receta",
    billing: "Cobro",
    followup: "Seguimiento",
    discharge: "Alta",
    audit: "Auditoría",
  };
  return labels[stepKey] ?? stepKey;
}

export function getJourneyStageColor(
  status: string | null | undefined,
): { bg: string; text: string; label: string } {
  switch (status) {
    case "completado":
    case "completed":
      return { bg: "bg-success/10", text: "text-success", label: "Completado" };
    case "en_proceso":
    case "in_progress":
      return { bg: "bg-info/10", text: "text-info", label: "En proceso" };
    case "requiere_revision":
    case "warning":
      return { bg: "bg-warning/10", text: "text-warning", label: "Requiere revisión" };
    case "bloqueado":
    case "blocked":
      return { bg: "bg-destructive/10", text: "text-destructive", label: "Bloqueado" };
    case "override":
      return { bg: "bg-purple-500/10", text: "text-purple-500", label: "Override" };
    default:
      return { bg: "bg-muted", text: "text-muted-foreground", label: "Pendiente" };
  }
}

export interface JourneyInstanceLite {
  id: string;
  appointment_id: string | null;
  patient_id: string | null;
  status: string | null;
  snapshot_json: any;
  updated_at?: string;
  created_at?: string;
}

export function getCurrentStepKey(instance: JourneyInstanceLite | null | undefined): string | null {
  if (!instance) return null;
  const snap = instance.snapshot_json;
  if (!snap || typeof snap !== "object") return null;
  return snap.current_step_key ?? snap.currentStepKey ?? snap.step_key ?? null;
}

export function getKanbanColumnFor(
  instance: JourneyInstanceLite | null | undefined,
): KanbanColumnKey {
  if (!instance) return "arrival";
  if (instance.status === "bloqueado" || instance.status === "blocked") return "bloqueado";
  const stepKey = getCurrentStepKey(instance);
  if (!stepKey) return "arrival";
  return STEP_TO_COLUMN[stepKey] ?? "arrival";
}

export interface OperationalRowInput {
  appointment: any;
  instance: JourneyInstanceLite | null;
  hasExpediente: boolean;
  hasConsentimiento: boolean;
  hasAlergias: boolean;
}

export function getPatientNextAction(row: OperationalRowInput): string {
  const { appointment, instance, hasExpediente, hasConsentimiento } = row;
  if (!instance) return "Iniciar camino del paciente";
  if (instance.status === "bloqueado") return "Resolver bloqueo";
  if (!hasConsentimiento) return "Registrar consentimiento";
  if (!hasExpediente) return "Crear expediente";
  const col = getKanbanColumnFor(instance);
  const next: Record<KanbanColumnKey, string> = {
    arrival: "Registrar llegada",
    identification: "Verificar identidad",
    record: "Abrir expediente",
    triage: "Tomar signos vitales",
    consultation: "Iniciar consulta",
    diagnosis: "Registrar diagnóstico",
    prescription: "Generar receta",
    billing: "Generar cobro",
    followup: "Programar seguimiento",
    discharge: "Dar de alta",
    bloqueado: "Revisar caso",
  };
  return next[col] ?? "Continuar atención";
}

export type RiskLevel = "bajo" | "medio" | "alto";

export function getPatientOperationalRisk(row: OperationalRowInput): RiskLevel {
  const { instance, hasExpediente, hasConsentimiento, hasAlergias, appointment } = row;
  if (instance?.status === "bloqueado") return "alto";
  if (!hasConsentimiento) return "alto";
  if (!hasExpediente) return "medio";
  if (!hasAlergias) return "medio";
  if (appointment?.status === "cancelada") return "medio";
  return "bajo";
}

export function riskBadgeClass(risk: RiskLevel): string {
  if (risk === "alto") return "bg-destructive/10 text-destructive";
  if (risk === "medio") return "bg-warning/10 text-warning";
  return "bg-success/10 text-success";
}

export function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}
