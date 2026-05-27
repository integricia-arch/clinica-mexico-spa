import type { StepFormComponent } from "./_shared";
import ArrivalForm from "./ArrivalForm";
import AssignmentForm from "./AssignmentForm";
import AttentionOpenForm from "./AttentionOpenForm";
import IdentificationForm from "./IdentificationForm";
import ConsultationForm from "./ConsultationForm";

// Map step_key → form component. Steps without a custom form fall back to the
// generic key/value editor in CaminoPaciente.tsx.
export const STEP_FORM_REGISTRY: Record<string, StepFormComponent> = {
  arrival: ArrivalForm as unknown as StepFormComponent,
  assignment: AssignmentForm,
  attention_open: AttentionOpenForm,
  identification: IdentificationForm,
  consultation_close: ConsultationForm as unknown as StepFormComponent,
};

export function getStepForm(stepKey: string): StepFormComponent | null {
  return STEP_FORM_REGISTRY[stepKey] ?? null;
}
