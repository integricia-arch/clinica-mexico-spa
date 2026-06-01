import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { JourneyInstanceLite } from "../lib/journeyHelpers";

export interface DashboardData {
  appointments: any[];
  patients: Record<string, any>;
  doctors: Record<string, any>;
  rooms: Record<string, any>;
  servicios: Record<string, any>;
  instancesByAppointment: Record<string, JourneyInstanceLite>;
  expedientesActivosByPatient: Record<string, any>;
  consentimientosByPatient: Record<string, any>;
  recordatorios: any[];
  conversacionesEscaladas: any[];
  auditReciente: any[];
  doctorsList: any[];
  roomsList: any[];
}

const EMPTY: DashboardData = {
  appointments: [], patients: {}, doctors: {}, rooms: {}, servicios: {},
  instancesByAppointment: {}, expedientesActivosByPatient: {}, consentimientosByPatient: {},
  recordatorios: [], conversacionesEscaladas: [], auditReciente: [],
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
        myDoctorIds = (docs ?? []).map((d: any) => d.id);
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
      const apList = appointments ?? [];

      const patientIds = [...new Set(apList.map((a: any) => a.patient_id).filter(Boolean))];
      const doctorIds = [...new Set(apList.map((a: any) => a.doctor_id).filter(Boolean))];
      const roomIds = [...new Set(apList.map((a: any) => a.room_id).filter(Boolean))];
      const servicioIds = [...new Set(apList.map((a: any) => a.servicio_id).filter(Boolean))];
      const apIds = apList.map((a: any) => a.id);

      const [
        patientsRes, doctorsRes, roomsRes, serviciosRes, instancesRes,
        expRes, conRes, recRes, convRes, auditRes, allDoctorsRes, allRoomsRes,
      ] = await Promise.allSettled([
        patientIds.length ? supabase.from("patients").select("id,nombre,apellidos,telefono,email,alergias,activo").in("id", patientIds) : Promise.resolve({ data: [] }),
        doctorIds.length ? supabase.from("doctors").select("id,nombre,apellidos,especialidad").in("id", doctorIds) : Promise.resolve({ data: [] }),
        roomIds.length ? supabase.from("rooms").select("id,nombre,piso").in("id", roomIds) : Promise.resolve({ data: [] }),
        servicioIds.length ? supabase.from("servicios").select("id,nombre,duracion_minutos").in("id", servicioIds) : Promise.resolve({ data: [] }),
        apIds.length ? supabase.from("journey_instances").select("id, appointment_id, status, snapshot_json").in("appointment_id", apIds) : Promise.resolve({ data: [] }),
        patientIds.length ? supabase.from("expedientes").select("id,patient_id,activo,tipo").in("patient_id", patientIds).eq("activo", true) : Promise.resolve({ data: [] }),
        patientIds.length ? supabase.from("consentimientos").select("id,patient_id,tipo,otorgado,otorgado_at").in("patient_id", patientIds).eq("otorgado", true) : Promise.resolve({ data: [] }),
        supabase.from("recordatorios_cita").select("*").gte("programado_para", start).lt("programado_para", new Date(date.getTime() + 7 * 86400000).toISOString()).order("programado_para").limit(50),
        supabase.from("conversaciones").select("*").eq("status", "escalada").order("last_message_at", { ascending: false }).limit(20),
        supabase.from("audit_logs").select("id,accion,tabla,registro_id,user_id,created_at").order("created_at", { ascending: false }).limit(20),
        supabase.from("doctors").select("id,nombre,apellidos,especialidad,activo").eq("activo", true).order("apellidos"),
        supabase.from("rooms").select("id,nombre,piso,activo").eq("activo", true).order("nombre"),
      ]);

      const safe = (r: any) => (r.status === "fulfilled" ? (r.value.data ?? []) : []);
      const byId = (arr: any[]) => Object.fromEntries(arr.map((x: any) => [x.id, x]));

      const instancesArr = safe(instancesRes);
      const instancesByAppointment: Record<string, JourneyInstanceLite> = {};
      for (const inst of instancesArr) {
        if (inst.appointment_id) instancesByAppointment[inst.appointment_id] = inst;
      }

      const expArr = safe(expRes);
      const expedientesActivosByPatient: Record<string, any> = {};
      for (const e of expArr) {
        if (!expedientesActivosByPatient[e.patient_id]) expedientesActivosByPatient[e.patient_id] = e;
      }
      const conArr = safe(conRes);
      const consentimientosByPatient: Record<string, any> = {};
      for (const c of conArr) {
        if (!consentimientosByPatient[c.patient_id]) consentimientosByPatient[c.patient_id] = c;
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
        auditReciente: safe(auditRes),
        doctorsList: safe(allDoctorsRes),
        roomsList: safe(allRoomsRes),
      });
    } catch (e: any) {
      console.error("[Dashboard] loadDashboardData error", e);
      setError("Error al cargar el panel de control");
    } finally {
      setLoading(false);
    }
  }, [date, user, hasRole]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => load(), 1500);
    };
    const ch = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, debouncedLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "journey_instances" }, debouncedLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "recordatorios_cita" }, debouncedLoad)
      .subscribe();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(ch);
    };
  }, [load]);

  return { data, loading, error, reload: load };
}
