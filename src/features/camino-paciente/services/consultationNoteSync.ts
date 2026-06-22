import { supabase } from "@/integrations/supabase/client";

interface SoapPayload {
  anamnesis: string;
  subjetivo: string;
  objetivo: string;
  analisis: string;
  plan: string;
  diagnostico_principal: string;
}

/**
 * Persists the SOAP note from a camino step into notas_consulta (patient expediente).
 * Finds or creates the expediente for the patient+doctor pair, then upserts the note
 * keyed on appointment_id so closing the same step twice doesn't create duplicates.
 */
export async function syncConsultationNote(
  appointmentId: string,
  patientId: string,
  soap: SoapPayload,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // 1. Get doctor_id + clinic_id from appointment
    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .select("doctor_id, clinic_id")
      .eq("id", appointmentId)
      .maybeSingle();
    if (apptErr || !appt?.doctor_id) {
      return { ok: false, error: "No se encontró la cita o el médico asignado" };
    }
    const { doctor_id, clinic_id } = appt as { doctor_id: string; clinic_id: string | null };

    // 2. Find or create expediente for patient + doctor
    let expedienteId: string;
    const { data: existing } = await supabase
      .from("expedientes")
      .select("id")
      .eq("patient_id", patientId)
      .eq("doctor_id", doctor_id)
      .eq("activo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      expedienteId = existing.id;
    } else {
      const { data: created, error: createErr } = await supabase
        .from("expedientes")
        .insert({ patient_id: patientId, doctor_id, clinic_id, activo: true, tipo: "primera_vez" })
        .select("id")
        .single();
      if (createErr || !created) {
        return { ok: false, error: "No se pudo crear el expediente: " + (createErr?.message ?? "error desconocido") };
      }
      expedienteId = created.id;
    }

    // 3. Upsert notas_consulta keyed on appointment_id (avoid duplicate notes)
    const subjetivoCompleto = [soap.anamnesis, soap.subjetivo].filter(Boolean).join("\n\n— Detalle SOAP-S —\n");
    const notePayload = {
      expediente_id: expedienteId,
      doctor_id,
      appointment_id: appointmentId,
      clinic_id,
      fecha_consulta: new Date().toISOString(),
      subjetivo: subjetivoCompleto || null,
      objetivo: soap.objetivo || null,
      analisis: soap.analisis || null,
      plan: soap.plan || null,
      diagnostico_principal: soap.diagnostico_principal || null,
    };

    // Try update first (if note already exists for this appointment)
    const { data: existingNote } = await supabase
      .from("notas_consulta")
      .select("id")
      .eq("appointment_id", appointmentId)
      .maybeSingle();

    if (existingNote?.id) {
      const { error: updErr } = await supabase
        .from("notas_consulta")
        .update(notePayload)
        .eq("id", existingNote.id);
      if (updErr) return { ok: false, error: updErr.message };
    } else {
      const { error: insErr } = await supabase
        .from("notas_consulta")
        .insert(notePayload);
      if (insErr) return { ok: false, error: insErr.message };
    }

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Error en sync de nota" };
  }
}

/**
 * Creates a follow-up record in post_consultation_followups from the
 * followup step data.
 */
export async function syncFollowup(params: {
  journeyInstanceId: string;
  patientId: string;
  clinicId: string | null;
  channel: string;
  followupDate: string;
  notes: string;
  requiresNewAppointment: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("post_consultation_followups").insert({
      journey_instance_id: params.journeyInstanceId,
      patient_id: params.patientId,
      clinic_id: params.clinicId,
      channel: params.channel,
      followup_date: params.followupDate,
      notes: params.notes || null,
      requires_new_appointment: params.requiresNewAppointment,
      status: "pending",
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Error en sync de seguimiento" };
  }
}
