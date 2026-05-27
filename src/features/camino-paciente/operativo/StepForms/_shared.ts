// Shared types for step forms
import type { ComponentType } from "react";

export interface StepFormProps {
  stepId: string;
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
