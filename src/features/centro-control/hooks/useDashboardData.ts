import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { JourneyInstanceLite } from "../lib/journeyHelpers";

export interface DashboardData {
  appointments: Record<string, unknown>[];
  patients: Record<string, Record<string, unknown>>;
  doctors: Record<string, Record<string, unknown>>;
  rooms: Record<string, Record<string, unknown>>;
  servicios: Record<string, Record<string, unknown>>;
  instancesByAppointment: Record<string, JourneyInstanceLite>;
  expedientesActivosByPatient: Record<string, Record<string, unknown>>;
  consentimientosByPatient: Record<string, Record<string, unknown>>;
  recordatorios: Record<string, unknown>[];
  conversacionesEscaladas: Record<string, unknown>[];
  doctorsList: Record<string, unknown>[];
  roomsList: Record<string, unknown>[];
}

const EMPTY: DashboardData = {
  appointments: [], patients: {}, doctors: {}, rooms: {}, servicios: {},
  instancesByAppointment: {}, expedientesActivosByPatient: {}, consentimientosByPatient: {},
  recordatorios: [], conversacionesEscaladas: [],
  doctorsList: [], roomsList: [],
};

export function useDashboardData(date: Date) {
  const { user, hasRole } = useAuth();
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();

      let myDoctorIds: string[] = [];
      if (hasRole("doctor") && user) {
        const { data: docs } = await supabase.from("doctors").select("id").eq("user_id", user.id);
        myDoctorIds = (docs ?? []).map((d: { id: string }) => d.id);
      }

      let aptQuery = supabase
        .from("appointments")
        .select("*")
        .gte("fecha_inicio", start)
        .lt("fecha_inicio", end)
        .order("fecha_inicio", { ascending: true });
      if (hasRole("doctor") && !hasRole("admin") && myDoctorIds.length) {
        aptQuery = aptQuery.in("doctor_id", myDoctorIds);
      }
      const { data: appointments, error: apErr } = await aptQuery;
      if (apErr) throw apErr;
      const apList = (appointments ?? []) as Record<string, unknown>[];

      const patientIds = [...new Set(apList.map((a) => a.patient_id as string).filter(Boolean))];
      const doctorIds = [...new Set(apList.map((a) => a.doctor_id as string).filter(Boolean))];
      const roomIds = [...new Set(apList.map((a) => a.room_id as string).filter(Boolean))];
      const servicioIds = [...new Set(apList.map((a) => a.servicio_id as string).filter(Boolean))];
      const apIds = apList.map((a) => a.id as string);

      const [
        patientsRes, doctorsRes, roomsRes, serviciosRes, instancesRes,
        expRes, conRes, recRes, convRes, allDoctorsRes, allRoomsRes,
      ] = await Promise.allSettled([
        patientIds.length ? supabase.from("patients").select("id,nombre,apellidos,telefono,email,alergias,activo").in("id", patientIds) : Promise.resolve({ data: [] }),
        doctorIds.length ? supabase.from("doctors").select("id,nombre,apellidos,especialidad").in("id", doctorIds) : Promise.resolve({ data: [] }),
        roomIds.length ? supabase.from("rooms").select("id,nombre,piso").in("id", roomIds) : Promise.resolve({ data: [] }),
        servicioIds.length ? supabase.from("servicios").select("id,nombre,duracion_minutos").in("id", servicioIds) : Promise.resolve({ data: [] }),
        apIds.length ? supabase.from("journey_instances").select("*").in("appointment_id", apIds) : Promise.resolve({ data: [] }),
        patientIds.length ? supabase.from("expedientes").select("id,patient_id,activo,tipo").in("patient_id", patientIds).eq("activo", true) : Promise.resolve({ data: [] }),
        patientIds.length ? supabase.from("consentimientos").select("id,patient_id,tipo,otorgado,otorgado_at").in("patient_id", patientIds).eq("otorgado", true) : Promise.resolve({ data: [] }),
        supabase.from("recordatorios_cita").select("*").gte("programado_para", start).lt("programado_para", new Date(date.getTime() + 7 * 86400000).toISOString()).order("programado_para").limit(50),
        supabase.from("conversaciones").select("*").eq("status", "escalada").order("last_message_at", { ascending: false }).limit(20),
        supabase.from("doctors").select("id,nombre,apellidos,especialidad,activo").eq("activo", true).order("apellidos"),
        supabase.from("rooms").select("id,nombre,piso,activo").eq("activo", true).order("nombre"),
      ]);

      const safe = (r: PromiseSettledResult<{ data: unknown[] | null }>) =>
        (r.status === "fulfilled" ? (r.value.data ?? []) : []) as Record<string, unknown>[];
      const byId = (arr: Record<string, unknown>[]) =>
        Object.fromEntries(arr.map((x) => [x.id as string, x]));

      const instancesArr = safe(instancesRes);
      const instancesByAppointment: Record<string, JourneyInstanceLite> = {};
      for (const inst of instancesArr) {
        if (inst.appointment_id) instancesByAppointment[inst.appointment_id as string] = inst as unknown as JourneyInstanceLite;
      }

      const expArr = safe(expRes);
      const expedientesActivosByPatient: Record<string, Record<string, unknown>> = {};
      for (const e of expArr) {
        if (!expedientesActivosByPatient[e.patient_id as string]) expedientesActivosByPatient[e.patient_id as string] = e;
      }
      const conArr = safe(conRes);
      const consentimientosByPatient: Record<string, Record<string, unknown>> = {};
      for (const c of conArr) {
        if (!consentimientosByPatient[c.patient_id as string]) consentimientosByPatient[c.patient_id as string] = c;
      }

      setData({
        appointments: apList,
        patients: byId(safe(patientsRes)),
        doctors: byId(safe(doctorsRes)),
        rooms: byId(safe(roomsRes)),
        servicios: byId(safe(serviciosRes)),
        instancesByAppointment,
        expedientesActivosByPatient,
        consentimientosByPatient,
        recordatorios: safe(recRes),
        conversacionesEscaladas: safe(convRes),
        doctorsList: safe(allDoctorsRes),
        roomsList: safe(allRoomsRes),
      });
    } catch (e: unknown) {
      console.error("[Dashboard] loadDashboardData error", e);
      setError(e instanceof Error ? e.message : "Error al cargar el panel");
    } finally {
      setLoading(false);
    }
  }, [date, user, hasRole]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "journey_instances" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "recordatorios_cita" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return { data, loading, error, reload: load };
}
