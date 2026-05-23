import { supabase } from "@/integrations/supabase/client";

export interface FollowupInput {
  journey_instance_id: string;
  patient_id: string;
  prescription_id?: string;
  responsible_user_id?: string;
  followup_date: string;
  channel: "llamada" | "whatsapp" | "correo" | "presencial";
  notes?: string;
}

export async function createFollowup(input: FollowupInput) {
  const { error, data } = await supabase
    .from("post_consultation_followups")
    .insert({
      journey_instance_id: input.journey_instance_id,
      patient_id: input.patient_id,
      prescription_id: input.prescription_id ?? null,
      responsible_user_id: input.responsible_user_id ?? null,
      followup_date: input.followup_date,
      channel: input.channel,
      notes: input.notes ?? null,
      status: "pendiente",
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, data };
}

export async function completeFollowup(
  id: string,
  result: {
    medication_adherence?: string;
    symptoms_reported?: string;
    adverse_effects?: string;
    requires_new_appointment?: boolean;
    notes?: string;
  },
) {
  const { error } = await supabase
    .from("post_consultation_followups")
    .update({ ...result, status: "completado" })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
