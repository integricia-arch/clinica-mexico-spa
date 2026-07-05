import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DoctorQueueItem {
  appointment_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  status: string;
  motivo_consulta: string | null;
  patient: {
    id: string;
    nombre: string;
    apellidos: string;
    fecha_nacimiento: string | null;
    sexo: string | null;
    telefono: string | null;
    alergias: string | null;
  } | null;
  servicio_nombre: string | null;
  room_nombre: string | null;
  journey_instance_id: string | null;
  journey_current_step: string | null;
  journey_progress: number;
  has_consentimiento: boolean;
}

interface PatientRow {
  id: string;
  nombre: string;
  apellidos: string;
  fecha_nacimiento: string | null;
  sexo: string | null;
  telefono: string | null;
  alergias: string | null;
}

interface NameRow {
  id: string;
  nombre: string;
}

interface JourneyRow {
  id: string;
  appointment_id: string | null;
  snapshot_json: import("@/integrations/supabase/types").Json | null;
}

interface ConsentRow {
  patient_id: string;
}

interface SnapshotJson {
  current_step_key?: string;
  progress_percent?: number;
}

function startEndOfDay(iso = new Date()) {
  const d = new Date(iso);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).toISOString();
  return { start, end };
}

export function useDoctorQueue(doctorId: string | null) {
  const [items, setItems] = useState<DoctorQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!doctorId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { start, end } = startEndOfDay();
      const { data: appts, error: e1 } = await (supabase as any)
        .from("appointments")
        .select(
          "id, fecha_inicio, fecha_fin, status, motivo_consulta, patient_id, servicio_id, room_id",
        )
        .eq("doctor_id", doctorId)
        .gte("fecha_inicio", start)
        .lt("fecha_inicio", end)
        .order("fecha_inicio", { ascending: true });
      if (e1) throw e1;

      const apptList = appts ?? [];
      if (apptList.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const patientIds = [...new Set(apptList.map((a) => a.patient_id).filter(Boolean))] as string[];
      const servicioIds = [...new Set(apptList.map((a) => a.servicio_id).filter(Boolean))] as string[];
      const roomIds = [...new Set(apptList.map((a) => a.room_id).filter(Boolean))] as string[];
      const apptIds = apptList.map((a) => a.id);

      const [pat, srv, rms, jrn, cons] = await Promise.all([
        patientIds.length
          ? (supabase as any)
              .from("patients")
              .select("id, nombre, apellidos, fecha_nacimiento, sexo, telefono, alergias")
              .in("id", patientIds)
          : Promise.resolve({ data: [] as PatientRow[], error: null }),
        servicioIds.length
          ? (supabase as any).from("servicios").select("id, nombre").in("id", servicioIds)
          : Promise.resolve({ data: [] as NameRow[], error: null }),
        roomIds.length
          ? (supabase as any).from("rooms").select("id, nombre").in("id", roomIds)
          : Promise.resolve({ data: [] as NameRow[], error: null }),
        (supabase as any)
          .from("journey_instances")
          .select("id, appointment_id, snapshot_json")
          .in("appointment_id", apptIds),
        patientIds.length
          ? (supabase as any)
              .from("consentimientos")
              .select("patient_id")
              .in("patient_id", patientIds)
              .eq("otorgado", true)
          : Promise.resolve({ data: [] as ConsentRow[], error: null }),
      ]);

      const patientMap = new Map((pat.data ?? []).map((p: PatientRow) => [p.id, p]));
      const srvMap = new Map((srv.data ?? []).map((s: NameRow) => [s.id, s.nombre]));
      const roomMap = new Map((rms.data ?? []).map((r: NameRow) => [r.id, r.nombre]));
      const journeyMap = new Map((jrn.data ?? []).map((j: any) => [j.appointment_id, j as JourneyRow] as [string, JourneyRow]));
      const consentSet = new Set((cons.data ?? []).map((c: ConsentRow) => c.patient_id));

      const result: DoctorQueueItem[] = apptList.map((a) => {
        const j = journeyMap.get(a.id);
        const snap = (j?.snapshot_json ?? {}) as SnapshotJson;
        return {
          appointment_id: a.id,
          fecha_inicio: a.fecha_inicio,
          fecha_fin: a.fecha_fin,
          status: a.status,
          motivo_consulta: a.motivo_consulta,
          patient: a.patient_id ? (patientMap.get(a.patient_id) as PatientRow) ?? null : null,
          servicio_nombre: a.servicio_id ? srvMap.get(a.servicio_id) ?? null : null,
          room_nombre: a.room_id ? roomMap.get(a.room_id) ?? null : null,
          journey_instance_id: j?.id ?? null,
          journey_current_step: snap?.current_step_key ?? null,
          journey_progress: Number(snap?.progress_percent ?? 0),
          has_consentimiento: a.patient_id ? consentSet.has(a.patient_id) : false,
        };
      });
      setItems(result);
      setError(null);
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Error cargando agenda");
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!doctorId) return;
    const ch = supabase
      .channel(`doctor-queue-${doctorId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "journey_instances" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [doctorId, load]);

  return { items, loading, error, reload: load };
}
