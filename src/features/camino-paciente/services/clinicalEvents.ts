import { supabase } from "@/integrations/supabase/client";
import {
  closeJourneyStep,
  openJourneyStepByKey,
  saveJourneyStepData,
} from "./journeyEngine";

export type ClinicalEvent =
  | "consultation_opened"
  | "consultation_note_saved"
  | "study_requested"
  | "study_received"
  | "study_reviewed"
  | "prescription_drafted"
  | "prescription_issued"
  | "consultation_closed"
  | "patient_sent_to_billing"
  | "patient_discharged"
  | "followup_created"
  | "followup_completed";

interface EventPayload {
  journey_instance_id: string;
  // Datos opcionales útiles para los hitos
  consultation_note_id?: string;
  prescription_id?: string;
  study_id?: string;
  data?: Record<string, unknown>;
}

/**
 * Helper unificado: traduce eventos clínicos a movimientos del Camino
 * del Paciente. Reusa journeyEngine para validar predecesores y auditar.
 */
export async function advancePatientJourneyFromClinicalEvent(
  event: ClinicalEvent,
  payload: EventPayload,
): Promise<{ ok: boolean; error?: string }> {
  const { journey_instance_id: jid } = payload;
  if (!jid) return { ok: false, error: "Falta journey_instance_id" };

  const findStep = async (stepKey: string) => {
    const { data } = await supabase
      .from("journey_instance_steps")
      .select("id, status")
      .eq("journey_instance_id", jid)
      .eq("step_key", stepKey)
      .maybeSingle();
    return data;
  };

  switch (event) {
    case "consultation_opened": {
      const r = await openJourneyStepByKey(jid, "consultation_open");
      if (!r.ok) return { ok: false, error: r.error };
      if (payload.consultation_note_id && r.data?.step_id) {
        await saveJourneyStepData(r.data.step_id, {
          consultation_note_id: payload.consultation_note_id,
          opened_at: new Date().toISOString(),
        });
      }
      return { ok: true };
    }

    case "consultation_note_saved": {
      const s = await findStep("consultation_open");
      if (!s) return { ok: true };
      await saveJourneyStepData(s.id, {
        consultation_note_id: payload.consultation_note_id,
        nota_guardada_at: new Date().toISOString(),
        ...(payload.data ?? {}),
      });
      return { ok: true };
    }

    case "study_requested": {
      // Marcar la consulta como "esperando análisis" sin cerrarla
      const s = await findStep("consultation_open");
      if (s) {
        await saveJourneyStepData(s.id, {
          esperando_analisis: true,
          ultima_solicitud_estudio_id: payload.study_id,
          ultima_solicitud_at: new Date().toISOString(),
        });
      }
      return { ok: true };
    }

    case "study_received": {
      const s = await findStep("consultation_open");
      if (s) {
        await saveJourneyStepData(s.id, {
          resultado_recibido: true,
          ultimo_estudio_id: payload.study_id,
          ultima_recepcion_at: new Date().toISOString(),
        });
      }
      return { ok: true };
    }

    case "study_reviewed": {
      const s = await findStep("consultation_open");
      if (s) {
        await saveJourneyStepData(s.id, {
          esperando_analisis: false,
          resultado_revisado: true,
          ultima_revision_at: new Date().toISOString(),
        });
      }
      return { ok: true };
    }

    case "prescription_drafted": {
      const r = await openJourneyStepByKey(jid, "prescription");
      if (!r.ok) return { ok: false, error: r.error };
      if (r.data?.step_id) {
        await saveJourneyStepData(r.data.step_id, {
          prescription_id: payload.prescription_id,
          status: "borrador",
        });
      }
      return { ok: true };
    }

    case "prescription_issued": {
      const r = await openJourneyStepByKey(jid, "prescription");
      if (r.data?.step_id) {
        await saveJourneyStepData(r.data.step_id, {
          prescription_id: payload.prescription_id,
          status: "emitida",
          emitida_at: new Date().toISOString(),
        });
        await closeJourneyStep(r.data.step_id, {
          skipValidation: true,
          nextAction: "Pasar a pago/alta",
        });
      }
      return { ok: true };
    }

    case "consultation_closed": {
      // Cierra apertura y cierre de consulta
      const open = await findStep("consultation_open");
      if (open && open.status !== "completed") {
        await closeJourneyStep(open.id, { skipValidation: true });
      }
      const close = await findStep("consultation_close");
      if (close) {
        await saveJourneyStepData(close.id, {
          ...(payload.data ?? {}),
          cerrada_at: new Date().toISOString(),
        });
        await closeJourneyStep(close.id, {
          skipValidation: true,
          nextAction: "Pago/Alta",
        });
      }
      return { ok: true };
    }

    case "patient_sent_to_billing": {
      const r = await openJourneyStepByKey(jid, "billing");
      return { ok: r.ok, error: r.error };
    }

    case "patient_discharged": {
      const r = await openJourneyStepByKey(jid, "discharge");
      if (r.data?.step_id) {
        await saveJourneyStepData(r.data.step_id, {
          ...(payload.data ?? {}),
          alta_at: new Date().toISOString(),
        });
        await closeJourneyStep(r.data.step_id, { skipValidation: true });
      }
      return { ok: true };
    }

    case "followup_created": {
      const r = await openJourneyStepByKey(jid, "followup");
      if (r.data?.step_id) {
        await saveJourneyStepData(r.data.step_id, {
          ...(payload.data ?? {}),
          creado_at: new Date().toISOString(),
        });
      }
      return { ok: true };
    }

    case "followup_completed": {
      const s = await findStep("followup");
      if (s) {
        await closeJourneyStep(s.id, { skipValidation: true });
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: "Evento clínico desconocido" };
  }
}
