import { supabase } from "@/integrations/supabase/client";
import { OPERATIONAL_STEPS, getStepDef } from "./operationalSteps";

type StepRow = {
  id: string;
  journey_instance_id: string;
  step_key: string;
  step_name: string;
  step_order: number;
  status: string;
  opened_at: string | null;
  opened_by: string | null;
  assigned_to: string | null;
  closed_at: string | null;
  closed_by: string | null;
  blocked_reason: string | null;
  next_action: string | null;
  notes: string | null;
};

export interface JourneyServiceResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Audit helper */
export async function audit(
  journey_instance_id: string,
  action: string,
  opts: {
    step_id?: string | null;
    old_value?: unknown;
    new_value?: unknown;
    reason?: string;
  } = {},
) {
  const { data: userData } = await supabase.auth.getUser();
  await (supabase as any).from("journey_instance_audit").insert({
    journey_instance_id,
    journey_instance_step_id: opts.step_id ?? null,
    action,
    old_value_json: (opts.old_value ?? null) as never,
    new_value_json: (opts.new_value ?? null) as never,
    user_id: userData.user?.id ?? null,
    reason: opts.reason ?? null,
  });
}

/**
 * 1. Crea una instancia del camino a partir de una cita.
 * Idempotente: si ya existe instance para la cita, retorna ok con su id.
 */
export async function createJourneyFromAppointment(
  appointmentId: string,
): Promise<JourneyServiceResult<{ journey_instance_id: string; created: boolean }>> {
  const { data: appt, error: ae } = await (supabase as any)
    .from("appointments")
    .select("id, patient_id, doctor_id, room_id, assigned_nurse_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (ae || !appt) return { ok: false, error: "Cita no encontrada" };
  if (!appt.patient_id) return { ok: false, error: "La cita no tiene paciente asociado" };

  const { data: existing } = await (supabase as any)
    .from("journey_instances")
    .select("id")
    .eq("appointment_id", appointmentId)
    .maybeSingle();
  if (existing?.id) {
    return { ok: true, data: { journey_instance_id: existing.id, created: false } };
  }

  // Buscar plantilla activa
  const { data: tpl } = await (supabase as any)
    .from("journey_templates")
    .select("id, active_version_id")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tpl?.active_version_id) {
    return { ok: false, error: "No hay plantilla activa del camino. Configure una en Configuración → Camino del Paciente." };
  }

  const snapshot = {
    current_step_key: OPERATIONAL_STEPS[0].key,
    progress_percent: 0,
    total_steps: OPERATIONAL_STEPS.length,
    completed_steps: 0,
  };

  const { data: instance, error: ie } = await (supabase as any)
    .from("journey_instances")
    .insert({
      appointment_id: appointmentId,
      patient_id: appt.patient_id,
      template_id: tpl.id,
      template_version_id: tpl.active_version_id,
      status: "en_proceso",
      snapshot_json: snapshot,
    })
    .select("id")
    .single();
  if (ie || !instance) return { ok: false, error: ie?.message ?? "No se pudo crear el camino" };

  // Crear los 13 hitos operativos. Si la cita tiene enfermera asignada, se
  // prellena assigned_to en cada step donde enfermería puede actuar — así la
  // responsabilidad queda trazable en todo el camino, no solo en el aviso
  // inicial de Telegram (ver investigación operativa de enfermería).
  const stepsPayload = OPERATIONAL_STEPS.map((s) => ({
    journey_instance_id: instance.id,
    step_key: s.key,
    step_name: s.name,
    step_order: s.order,
    status: "pending",
    assigned_to: appt.assigned_nurse_id && s.closeRoles.includes("nurse") ? appt.assigned_nurse_id : null,
  }));
  const { error: se } = await (supabase as any).from("journey_instance_steps").insert(stepsPayload);
  if (se) return { ok: false, error: se.message };

  await audit(instance.id, "journey_created", { new_value: { appointment_id: appointmentId } });

  // Abrir automáticamente el primer paso (llegada)
  await openJourneyStepByKey(instance.id, OPERATIONAL_STEPS[0].key);

  return { ok: true, data: { journey_instance_id: instance.id, created: true } };
}

/** Helper: abrir paso por (instance, key) */
export async function openJourneyStepByKey(
  journeyInstanceId: string,
  stepKey: string,
): Promise<JourneyServiceResult<{ step_id: string }>> {
  const { data: step } = await (supabase as any)
    .from("journey_instance_steps")
    .select("id, status")
    .eq("journey_instance_id", journeyInstanceId)
    .eq("step_key", stepKey)
    .maybeSingle();
  if (!step) return { ok: false, error: "Hito no encontrado" };
  return openJourneyStep(step.id);
}

/** 2. Abrir hito */
export async function openJourneyStep(
  stepId: string,
): Promise<JourneyServiceResult<{ step_id: string }>> {
  const { data: step, error } = await (supabase as any)
    .from("journey_instance_steps")
    .select("*")
    .eq("id", stepId)
    .maybeSingle();
  if (error || !step) return { ok: false, error: "Hito no encontrado" };

  if (step.status === "completed" || step.status === "skipped") {
    return { ok: false, error: "El hito ya está cerrado" };
  }

  // Validar predecesor requerido cerrado u override
  const { data: predecessors } = await (supabase as any)
    .from("journey_instance_steps")
    .select("status, step_order")
    .eq("journey_instance_id", step.journey_instance_id)
    .lt("step_order", step.step_order)
    .order("step_order", { ascending: true });

  const blockingPrev = (predecessors ?? []).find(
    (p) => !["completed", "skipped", "override_authorized"].includes(p.status),
  );
  if (blockingPrev) {
    return {
      ok: false,
      error: "Hay hitos anteriores sin cerrar. Solicite override si es necesario.",
    };
  }

  const { data: userData } = await supabase.auth.getUser();
  const patch = {
    status: "in_progress",
    opened_at: step.opened_at ?? new Date().toISOString(),
    opened_by: step.opened_by ?? userData.user?.id ?? null,
  };
  const { error: ue } = await (supabase as any)
    .from("journey_instance_steps")
    .update(patch)
    .eq("id", stepId);
  if (ue) return { ok: false, error: ue.message };

  await (supabase as any).rpc("update_journey_progress", { _journey_instance_id: step.journey_instance_id });
  return { ok: true, data: { step_id: stepId } };
}

/** 3. Guardar datos */
export async function saveJourneyStepData(
  stepId: string,
  data: Record<string, unknown>,
): Promise<JourneyServiceResult> {
  const { data: existing } = await (supabase as any)
    .from("journey_instance_step_data")
    .select("id, data_json")
    .eq("journey_instance_step_id", stepId)
    .maybeSingle();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  if (existing) {
    const merged = { ...(existing.data_json as Record<string, unknown>), ...data };
    const { error } = await (supabase as any)
      .from("journey_instance_step_data")
      .update({ data_json: merged as never, updated_by: userId })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await (supabase as any).from("journey_instance_step_data").insert({
      journey_instance_step_id: stepId,
      data_json: data as never,
      created_by: userId,
      updated_by: userId,
    });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** 4. Cerrar hito */
export async function closeJourneyStep(
  stepId: string,
  opts: { skipValidation?: boolean; nextAction?: string } = {},
): Promise<JourneyServiceResult> {
  const { data: step } = await (supabase as any)
    .from("journey_instance_steps")
    .select("*")
    .eq("id", stepId)
    .maybeSingle();
  if (!step) return { ok: false, error: "Hito no encontrado" };

  const def = getStepDef(step.step_key);
  if (def?.required && !opts.skipValidation) {
    const { data: sd } = await (supabase as any)
      .from("journey_instance_step_data")
      .select("data_json")
      .eq("journey_instance_step_id", stepId)
      .maybeSingle();
    if (!sd || !sd.data_json || Object.keys(sd.data_json as object).length === 0) {
      return { ok: false, error: "Debe capturar datos mínimos antes de cerrar el hito." };
    }
  }

  const { data: userData } = await supabase.auth.getUser();
  const { error } = await (supabase as any)
    .from("journey_instance_steps")
    .update({
      status: "completed",
      closed_at: new Date().toISOString(),
      closed_by: userData.user?.id ?? null,
      next_action: opts.nextAction ?? null,
    })
    .eq("id", stepId);
  if (error) return { ok: false, error: error.message };

  // Abrir el siguiente paso pending
  const { data: next } = await (supabase as any)
    .from("journey_instance_steps")
    .select("id, step_order, status")
    .eq("journey_instance_id", step.journey_instance_id)
    .gt("step_order", step.step_order)
    .eq("status", "pending")
    .order("step_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (next) {
    await (supabase as any)
      .from("journey_instance_steps")
      .update({
        status: "open",
        opened_at: new Date().toISOString(),
        opened_by: userData.user?.id ?? null,
      })
      .eq("id", next.id);
  }

  await (supabase as any).rpc("update_journey_progress", { _journey_instance_id: step.journey_instance_id });
  return { ok: true };
}

/** 5. Bloquear */
export async function blockJourneyStep(
  stepId: string,
  reason: string,
): Promise<JourneyServiceResult> {
  if (!reason || reason.trim().length < 3) {
    return { ok: false, error: "Motivo del bloqueo requerido (mínimo 3 caracteres)" };
  }
  const { data: step } = await (supabase as any)
    .from("journey_instance_steps")
    .select("journey_instance_id")
    .eq("id", stepId)
    .maybeSingle();
  if (!step) return { ok: false, error: "Hito no encontrado" };

  const { error } = await (supabase as any)
    .from("journey_instance_steps")
    .update({ status: "blocked", blocked_reason: reason })
    .eq("id", stepId);
  if (error) return { ok: false, error: error.message };

  await (supabase as any).rpc("update_journey_progress", { _journey_instance_id: step.journey_instance_id });
  return { ok: true };
}

/** 6. Solicitar override */
export async function requestStepOverride(
  stepId: string,
  reason: string,
  riskAcknowledgement: string,
): Promise<JourneyServiceResult> {
  if (!reason || reason.trim().length < 5) {
    return { ok: false, error: "Motivo del override requerido (mínimo 5 caracteres)" };
  }
  const { data: step } = await (supabase as any)
    .from("journey_instance_steps")
    .select("journey_instance_id")
    .eq("id", stepId)
    .maybeSingle();
  if (!step) return { ok: false, error: "Hito no encontrado" };

  const { data: userData } = await supabase.auth.getUser();
  const { error } = await (supabase as any).from("journey_instance_overrides").insert({
    journey_instance_id: step.journey_instance_id,
    journey_instance_step_id: stepId,
    requested_by: userData.user?.id ?? null,
    reason,
    risk_acknowledgement: riskAcknowledgement,
    status: "requested",
  });
  if (error) return { ok: false, error: error.message };

  await (supabase as any)
    .from("journey_instance_steps")
    .update({ status: "needs_review", notes: `Override solicitado: ${reason}` })
    .eq("id", stepId);

  return { ok: true };
}

/** 7. Autorizar override (solo admin) */
export async function authorizeStepOverride(
  overrideId: string,
): Promise<JourneyServiceResult> {
  const { data: ov } = await (supabase as any)
    .from("journey_instance_overrides")
    .select("*")
    .eq("id", overrideId)
    .maybeSingle();
  if (!ov) return { ok: false, error: "Override no encontrado" };
  if (ov.status !== "requested") return { ok: false, error: "Override ya procesado" };

  const { data: userData } = await supabase.auth.getUser();
  const now = new Date().toISOString();

  const { error: ue1 } = await (supabase as any)
    .from("journey_instance_overrides")
    .update({ status: "authorized", authorized_by: userData.user?.id, authorized_at: now })
    .eq("id", overrideId);
  if (ue1) return { ok: false, error: ue1.message };

  await (supabase as any)
    .from("journey_instance_steps")
    .update({ status: "override_authorized", closed_at: now, closed_by: userData.user?.id })
    .eq("id", ov.journey_instance_step_id);

  await (supabase as any).rpc("update_journey_progress", { _journey_instance_id: ov.journey_instance_id });
  return { ok: true };
}

/** 8. Asignar responsable */
export async function assignStepResponsible(
  stepId: string,
  userId: string,
): Promise<JourneyServiceResult> {
  const { error } = await (supabase as any)
    .from("journey_instance_steps")
    .update({ assigned_to: userId })
    .eq("id", stepId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type { StepRow };
