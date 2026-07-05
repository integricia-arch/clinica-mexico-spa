import { supabase } from "@/integrations/supabase/client";

export type CheckoutType =
  | "alta_medica"
  | "alta_administrativa"
  | "referencia"
  | "alta_voluntaria"
  | "abandono"
  | "seguimiento_pendiente";

export interface CheckoutInput {
  journey_instance_id: string;
  patient_id: string;
  appointment_id?: string;
  checkout_type: CheckoutType;
  discharge_summary: string;
  followup_required: boolean;
  followup_date?: string;
  notes?: string;
}

export interface CheckoutResult {
  ok: boolean;
  error?: string;
  warnings?: string[];
}

export async function checkoutPatient(input: CheckoutInput): Promise<CheckoutResult> {
  const warnings: string[] = [];
  if (!input.discharge_summary || input.discharge_summary.trim().length < 5) {
    return { ok: false, error: "Debe capturar un resumen de atención" };
  }

  // Validar consulta cerrada
  const { data: consult } = await (supabase as any)
    .from("journey_instance_steps")
    .select("status")
    .eq("journey_instance_id", input.journey_instance_id)
    .eq("step_key", "consultation_close")
    .maybeSingle();
  if (input.checkout_type === "alta_medica" && consult?.status !== "completed" && consult?.status !== "override_authorized") {
    return { ok: false, error: "No se puede dar alta médica sin cerrar la consulta" };
  }

  // Validar receta si existe en plan
  const { data: rx } = await (supabase as any)
    .from("prescriptions")
    .select("status")
    .eq("journey_instance_id", input.journey_instance_id);
  const pendingRx = (rx ?? []).find((r) => r.status === "draft");
  if (pendingRx) warnings.push("Hay una receta en borrador sin emitir");

  const { data: userData } = await supabase.auth.getUser();
  const { error } = await (supabase as any).from("patient_checkout_events").insert({
    journey_instance_id: input.journey_instance_id,
    patient_id: input.patient_id,
    appointment_id: input.appointment_id ?? null,
    checkout_type: input.checkout_type,
    checkout_status: "completado",
    checked_out_by: userData.user?.id ?? null,
    discharge_summary: input.discharge_summary,
    followup_required: input.followup_required,
    followup_date: input.followup_date ?? null,
    notes: input.notes ?? null,
  });
  if (error) return { ok: false, error: error.message };

  // Cerrar hito discharge
  await (supabase as any)
    .from("journey_instance_steps")
    .update({
      status: "completed",
      closed_at: new Date().toISOString(),
      closed_by: userData.user?.id ?? null,
    })
    .eq("journey_instance_id", input.journey_instance_id)
    .eq("step_key", "discharge");

  await (supabase as any).rpc("update_journey_progress", {
    _journey_instance_id: input.journey_instance_id,
  });

  return { ok: true, warnings };
}
