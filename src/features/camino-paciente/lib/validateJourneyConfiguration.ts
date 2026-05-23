import { CRITICAL_STEP_KEYS } from "./stepKeys";

export interface StepLite {
  step_key: string;
  step_name: string;
  step_type: string;
  step_order: number;
  is_required: boolean;
  is_critical: boolean;
  blocks_progress: boolean;
  requires_responsible: boolean;
  allowed_complete_roles: string[];
}

export interface RuleLite {
  rule_name: string;
  source_step_key: string;
  severity: "info" | "warning" | "blocking";
  is_active: boolean;
  condition_json: any;
  action_json: any;
}

export interface ValidationIssue {
  level: "info" | "warning" | "error";
  message: string;
}

export interface ValidationResult {
  status: "green" | "yellow" | "red";
  issues: ValidationIssue[];
  canPublish: boolean;
}

export function validateJourneyConfiguration(steps: StepLite[], rules: RuleLite[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const present = new Set(steps.map((s) => s.step_key));

  // 1. Etapa inicial y final
  if (steps.length === 0) issues.push({ level: "error", message: "No hay etapas definidas." });
  else {
    const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
    if (ordered[0].step_key !== "identification")
      issues.push({ level: "warning", message: "La primera etapa debería ser 'Identificación del paciente'." });
    if (ordered[ordered.length - 1].step_key !== "audit")
      issues.push({ level: "warning", message: "La última etapa debería ser 'Auditoría'." });
  }

  // 2. Todas las etapas críticas presentes
  for (const key of CRITICAL_STEP_KEYS) {
    if (!present.has(key))
      issues.push({ level: "error", message: `Falta la etapa crítica: ${key}.` });
  }

  // 3. Validaciones mínimas en críticas
  for (const s of steps.filter((x) => x.is_critical)) {
    if (!s.blocks_progress && s.step_key !== "followup" && s.step_key !== "billing" && s.step_key !== "prescription")
      issues.push({ level: "warning", message: `La etapa crítica "${s.step_name}" no bloquea el avance.` });
    if (s.requires_responsible === false && ["consultation", "prescription", "discharge"].includes(s.step_key))
      issues.push({ level: "error", message: `"${s.step_name}" debe exigir un responsable.` });
    if (!s.allowed_complete_roles || s.allowed_complete_roles.length === 0)
      issues.push({ level: "error", message: `"${s.step_name}" no tiene roles autorizados para completarla.` });
  }

  // 4. Reglas inválidas
  const stepKeys = new Set(steps.map((s) => s.step_key));
  for (const r of rules) {
    if (!stepKeys.has(r.source_step_key))
      issues.push({ level: "error", message: `Regla "${r.rule_name}" apunta a una etapa inexistente.` });
    if (!r.action_json || Object.keys(r.action_json).length === 0)
      issues.push({ level: "error", message: `Regla "${r.rule_name}" no tiene acción definida.` });
  }

  // 5. Receta requiere médico
  const presc = steps.find((s) => s.step_key === "prescription");
  if (presc && !presc.allowed_complete_roles?.includes("doctor"))
    issues.push({ level: "error", message: "La etapa 'Receta' debe permitirla únicamente al médico." });

  // 6. Alta sin nota
  const discharge = steps.find((s) => s.step_key === "discharge");
  if (discharge && !discharge.is_required)
    issues.push({ level: "error", message: "La etapa 'Alta' debe ser obligatoria." });

  const hasError = issues.some((i) => i.level === "error");
  const hasWarn = issues.some((i) => i.level === "warning");
  const status: "green" | "yellow" | "red" = hasError ? "red" : hasWarn ? "yellow" : "green";
  return { status, issues, canPublish: !hasError };
}
