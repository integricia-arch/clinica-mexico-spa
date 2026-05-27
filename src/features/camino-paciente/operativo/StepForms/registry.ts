import type { StepFormComponent } from "./_shared";
import ArrivalForm from "./ArrivalForm";
import AssignmentForm from "./AssignmentForm";
import AttentionOpenForm from "./AttentionOpenForm";
import IdentificationForm from "./IdentificationForm";
import RecordForm from "./RecordForm";
import TriageForm from "./TriageForm";
import ConsultationOpenForm from "./ConsultationOpenForm";
import ConsultationForm from "./ConsultationForm";
import PrescriptionStepForm from "./PrescriptionStepForm";
import PharmacyForm from "./PharmacyForm";
import BillingForm from "./BillingForm";
import DischargeForm from "./DischargeForm";
import FollowupForm from "./FollowupForm";

// Map step_key → form component. Steps without a custom form fall back to the
// generic key/value editor in CaminoPaciente.tsx.
export const STEP_FORM_REGISTRY: Record<string, StepFormComponent> = {
  arrival: ArrivalForm as unknown as StepFormComponent,
  assignment: AssignmentForm,
  attention_open: AttentionOpenForm,
  identification: IdentificationForm,
  record: RecordForm,
  triage: TriageForm,
  consultation_open: ConsultationOpenForm,
  consultation_close: ConsultationForm as unknown as StepFormComponent,
  prescription: PrescriptionStepForm,
  pharmacy: PharmacyForm,
  billing: BillingForm,
  discharge: DischargeForm,
  followup: FollowupForm,
};

export function getStepForm(stepKey: string): StepFormComponent | null {
  return STEP_FORM_REGISTRY[stepKey] ?? null;
}
