import type { StepLite } from "./validateJourneyConfiguration";

export type Scenario =
  | "normal"
  | "urgencia"
  | "sin_consentimiento"
  | "analisis_pendiente"
  | "con_receta"
  | "medicamento_no_disponible"
  | "pago_pendiente"
  | "seguimiento_obligatorio";

export const SCENARIO_LABELS: Record<Scenario, string> = {
  normal: "Flujo normal",
  urgencia: "Urgencia",
  sin_consentimiento: "Sin consentimiento",
  analisis_pendiente: "Con análisis pendiente",
  con_receta: "Con receta",
  medicamento_no_disponible: "Con medicamento no disponible",
  pago_pendiente: "Con pago pendiente",
  seguimiento_obligatorio: "Con seguimiento obligatorio",
};

export interface SimulationStep {
  step_key: string;
  step_name: string;
  status: "activa" | "bloqueada" | "omitida" | "override_requerido";
  notes: string[];
}

export interface SimulationResult {
  steps: SimulationStep[];
  overall: "valida" | "advertencia" | "peligrosa";
  warnings: string[];
}

export function simulateJourney(steps: StepLite[], scenario: Scenario): SimulationResult {
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
  const warnings: string[] = [];
  const out: SimulationStep[] = [];

  for (const s of ordered) {
    const notes: string[] = [];
    let status: SimulationStep["status"] = "activa";

    if (s.step_key === "consent" && scenario === "sin_consentimiento") {
      status = "override_requerido";
      notes.push("Consentimiento no firmado: requiere override autorizado.");
      warnings.push("Flujo sin consentimiento — solo permitido en urgencia con override.");
    }
    if (s.step_key === "consent" && scenario === "urgencia") {
      status = "override_requerido";
      notes.push("Urgencia: override por motivo médico.");
    }
    if (s.step_key === "discharge" && scenario === "analisis_pendiente") {
      status = "bloqueada";
      notes.push("No se puede dar alta con análisis pendiente sin justificación.");
    }
    if (s.step_key === "discharge" && scenario === "pago_pendiente") {
      notes.push("Alta clínica permitida; cobro queda pendiente.");
    }
    if (s.step_key === "prescription" && scenario === "medicamento_no_disponible") {
      notes.push("Receta emitida; surtido bloqueado por inventario.");
    }
    if (s.step_key === "billing" && scenario === "pago_pendiente") {
      status = "bloqueada";
      notes.push("Pago pendiente — no se ha cobrado.");
    }
    if (s.step_key === "followup" && scenario === "seguimiento_obligatorio") {
      notes.push("Seguimiento obligatorio activo.");
    }
    if (s.step_key === "prescription" && scenario !== "con_receta" && scenario !== "normal") {
      if (scenario === "sin_consentimiento") status = "omitida";
    }

    out.push({ step_key: s.step_key, step_name: s.step_name, status, notes });
  }

  const overall: SimulationResult["overall"] = warnings.length > 0 ? "advertencia" : "valida";
  return { steps: out, overall, warnings };
}
