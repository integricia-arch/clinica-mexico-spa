// Shared types for step forms
import type { ComponentType } from "react";
import { toast } from "sonner";
import { OPERATIONAL_STEPS } from "@/features/camino-paciente/services/operationalSteps";

export interface StepFormProps {
  stepId: string;
  stepKey?: string;
  stepStatus: string;
  journeyInstanceId: string;
  patientId?: string | null;
  appointmentId?: string | null;
  existingData: Record<string, any>;
  onSaved?: () => void;
}

export type StepFormComponent = ComponentType<StepFormProps>;

export function isClosed(status: string) {
  return status === "completed" || status === "skipped" || status === "override_authorized";
}

// Nombre del siguiente hito operativo, o null si es el último. El paciente
// avanza automáticamente de columna en el Kanban al cerrar un hito -- el
// toast debe decir a dónde, no solo "listo" (mismo principio que el fix de
// DoctorConfirmationPanel: ninguna acción desaparece sin decir a dónde fue).
export function nextStepName(stepKey?: string): string | null {
  if (!stepKey) return null;
  const ordered = [...OPERATIONAL_STEPS].sort((a, b) => a.order - b.order);
  const idx = ordered.findIndex((s) => s.key === stepKey);
  if (idx === -1 || idx === ordered.length - 1) return null;
  return ordered[idx + 1].name;
}

// Toast estándar al cerrar un hito: dice qué se hizo y a qué hito avanzó.
export function toastStepClosed(stepKey: string | undefined, doneMessage: string) {
  const next = nextStepName(stepKey);
  toast.success(next ? `${doneMessage} → avanzó a "${next}"` : doneMessage);
}
