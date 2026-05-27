import { supabase } from "@/integrations/supabase/client";

export async function ensureExpediente(patientId: string, doctorId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("expedientes")
    .select("id")
    .eq("patient_id", patientId)
    .eq("doctor_id", doctorId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await supabase
    .from("expedientes")
    .insert({ patient_id: patientId, doctor_id: doctorId, tipo: "primera_vez" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
