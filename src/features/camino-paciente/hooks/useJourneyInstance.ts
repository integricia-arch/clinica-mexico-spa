import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface JourneyStep {
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
}

export interface JourneyInstanceFull {
  id: string;
  appointment_id: string | null;
  patient_id: string | null;
  status: string;
  snapshot_json: Record<string, unknown> | null;
  template_id: string;
  template_version_id: string;
  updated_at: string;
  created_at: string;
}

export interface PatientContext {
  id: string;
  nombre: string;
  apellidos: string;
  fecha_nacimiento: string | null;
  sexo: string | null;
}

export interface AppointmentContext {
  id: string;
  fecha_inicio: string;
  motivo_consulta: string | null;
  doctor_nombre: string | null;
  sala_nombre: string | null;
}

export interface UseJourneyInstanceState {
  loading: boolean;
  error: string | null;
  instance: JourneyInstanceFull | null;
  patient: PatientContext | null;
  appointment: AppointmentContext | null;
  steps: JourneyStep[];
  stepData: Record<string, Record<string, unknown>>;
  pendingOverrides: Record<string, unknown>[];
  audit: Record<string, unknown>[];
  reload: () => Promise<void>;
}

export function useJourneyInstance(journeyId: string | null): UseJourneyInstanceState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [instance, setInstance] = useState<JourneyInstanceFull | null>(null);
  const [patient, setPatient] = useState<PatientContext | null>(null);
  const [appointment, setAppointment] = useState<AppointmentContext | null>(null);
  const [steps, setSteps] = useState<JourneyStep[]>([]);
  const [stepData, setStepData] = useState<Record<string, Record<string, unknown>>>({});
  const [pendingOverrides, setPendingOverrides] = useState<Record<string, unknown>[]>([]);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(async () => {
    if (!journeyId) return;
    setLoading(true);
    setError(null);
    try {
      const [inst, st, ovr, au] = await Promise.allSettled([
        supabase.from("journey_instances").select("*").eq("id", journeyId).maybeSingle(),
        supabase
          .from("journey_instance_steps")
          .select("*")
          .eq("journey_instance_id", journeyId)
          .order("step_order", { ascending: true }),
        supabase
          .from("journey_instance_overrides")
          .select("*")
          .eq("journey_instance_id", journeyId)
          .eq("status", "requested"),
        supabase
          .from("journey_instance_audit")
          .select("*")
          .eq("journey_instance_id", journeyId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const instData = inst.status === "fulfilled" ? (inst.value.data as unknown as JourneyInstanceFull | null) : null;
      if (instData) {
        setInstance(instData);

        // Fetch patient context
        if (instData.patient_id) {
          const { data: p } = await supabase
            .from("patients")
            .select("id, nombre, apellidos, fecha_nacimiento, sexo")
            .eq("id", instData.patient_id)
            .maybeSingle();
          setPatient(p as PatientContext | null);
        }

        // Fetch appointment context (with doctor join)
        if (instData.appointment_id) {
          const { data: a } = await supabase
            .from("appointments")
            .select("id, fecha_inicio, motivo_consulta, doctors(nombre, apellidos), salas(nombre)")
            .eq("id", instData.appointment_id)
            .maybeSingle();
          if (a) {
            const doc = (a as unknown as { doctors: { nombre: string; apellidos: string } | null }).doctors;
            const sala = (a as unknown as { salas: { nombre: string } | null }).salas;
            setAppointment({
              id: a.id,
              fecha_inicio: (a as unknown as { fecha_inicio: string }).fecha_inicio,
              motivo_consulta: (a as unknown as { motivo_consulta: string | null }).motivo_consulta,
              doctor_nombre: doc ? `${doc.nombre} ${doc.apellidos}`.trim() : null,
              sala_nombre: sala?.nombre ?? null,
            });
          }
        }
      }

      const stepsArr = st.status === "fulfilled" ? (st.value.data ?? []) : [];
      setSteps(stepsArr as unknown as JourneyStep[]);

      if (stepsArr.length) {
        const ids = (stepsArr as Array<{ id: string }>).map((s) => s.id);
        const { data: sd } = await supabase
          .from("journey_instance_step_data")
          .select("journey_instance_step_id, data_json")
          .in("journey_instance_step_id", ids);
        const map: Record<string, Record<string, unknown>> = {};
        (sd ?? []).forEach((r) => {
          map[r.journey_instance_step_id] = (r.data_json as Record<string, unknown> | null) ?? {};
        });
        setStepData(map);
      }

      if (ovr.status === "fulfilled") setPendingOverrides(ovr.value.data ?? []);
      if (au.status === "fulfilled") setAudit(au.value.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando camino");
    } finally {
      setLoading(false);
    }
  }, [journeyId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime
  useEffect(() => {
    if (!journeyId) return;
    const ch = supabase
      .channel(`journey-${journeyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "journey_instance_steps", filter: `journey_instance_id=eq.${journeyId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "journey_instances", filter: `id=eq.${journeyId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "journey_instance_overrides", filter: `journey_instance_id=eq.${journeyId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [journeyId, load]);

  return { loading, error, instance, patient, appointment, steps, stepData, pendingOverrides, audit, reload: load };
}
