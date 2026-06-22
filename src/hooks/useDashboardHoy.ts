import { useState, useEffect, useCallback } from "react";
import { startOfDay, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CitaHoy {
  id: string;
  hora: string;
  paciente: string;
  medico: string;
  tipo: string;
  estado: string;
}

export interface ActividadItem {
  id: string;
  texto: string;
  tiempo: string;
  created_at: string;
}

export interface DashboardHoyData {
  loading: boolean;
  error: string | null;
  totalCitasHoy: number;
  citasHoy: CitaHoy[];
  ingresosHoy: number;
  totalPacientes: number;
  alertasPendientes: number;
  citasSinConfirmar: number;
  actividadReciente: ActividadItem[];
  refresh: () => void;
}

// ─── Pure helpers (exported for testing) ─────────────────────────────────────

export function formatHora(fechaIso: string): string {
  return fechaIso.slice(11, 16);
}

export function formatNombrePaciente(
  nombre: string,
  apellido: string | null
): string {
  return apellido ? `${nombre} ${apellido}` : nombre;
}

export function formatNombreDoctor(nombre: string, apellidos: string): string {
  return `Dr. ${nombre} ${apellidos}`;
}

const STATUS_LABEL: Record<string, string> = {
  confirmada: "Confirmada",
  confirmada_paciente: "Confirmada por paciente",
  confirmada_medico: "Confirmada por médico",
  pendiente_formulario: "Pendiente de formulario",
  recordatorio_enviado: "Recordatorio enviado",
  solicitada: "Solicitada",
  cancelada: "Cancelada",
  tentativa: "Tentativa",
  liberada: "Liberada",
};

export function mapStatusToLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

const CONFIRMED_STATUSES = new Set([
  "confirmada",
  "confirmada_paciente",
  "confirmada_medico",
  "recordatorio_enviado",
]);

const RESOLVED_STATUSES = new Set(["cancelada", "liberada"]);

const ACCION_LABEL: Record<string, string> = {
  crear: "Creación",
  actualizar: "Actualización",
  cancelar: "Cancelación",
  eliminar: "Eliminación",
  consultar: "Consulta",
};

export function mapAuditToTexto(
  accion: string,
  tabla: string,
  datosNuevos: Record<string, unknown> | null
): string {
  if (accion === "crear" && tabla === "patients") {
    const nombre = datosNuevos?.nombre as string | undefined;
    return nombre
      ? `Nuevo paciente registrado: ${nombre}`
      : "Nuevo paciente registrado";
  }
  if (accion === "crear" && tabla === "appointments") return "Cita agendada";
  if (accion === "actualizar" && tabla === "appointments") return "Cita actualizada";
  if (accion === "crear" && tabla === "pharmacy_sales")
    return "Venta registrada en farmacia";
  if (accion === "crear" && tabla === "notas_consulta")
    return "Nota clínica registrada";
  if (accion === "crear" && tabla === "expedientes") return "Expediente creado";
  const accionLabel = ACCION_LABEL[accion] ?? accion;
  return `${accionLabel} en ${tabla}`;
}

export function tiempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Hace un momento";
  if (mins < 60) return `Hace ${mins} min`;
  return `Hace ${Math.floor(mins / 60)} h`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

type AuditRow = {
  id: string;
  created_at: string;
  accion: string;
  tabla: string;
  datos_nuevos: Record<string, unknown> | null;
};

export function useDashboardHoy(): DashboardHoyData {
  const { activeClinicId } = useActiveClinic();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCitasHoy, setTotalCitasHoy] = useState(0);
  const [citasHoy, setCitasHoy] = useState<CitaHoy[]>([]);
  const [ingresosHoy, setIngresosHoy] = useState(0);
  const [totalPacientes, setTotalPacientes] = useState(0);
  const [alertasPendientes, setAlertasPendientes] = useState(0);
  const [citasSinConfirmar, setCitasSinConfirmar] = useState(0);
  const [actividadReciente, setActividadReciente] = useState<ActividadItem[]>([]);

  const load = useCallback(async () => {
    if (!activeClinicId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const todayStart = startOfDay(new Date()).toISOString();
      const tomorrowStart = startOfDay(addDays(new Date(), 1)).toISOString();

      const [citasRes, ventasRes, pacientesRes, auditRes, alertasRes] =
        await Promise.all([
          supabase
            .from("appointments")
            .select(
              "id, fecha_inicio, status, motivo_consulta, patients(nombre, apellido_paterno), doctors(nombre, apellidos)"
            )
            .eq("clinic_id", activeClinicId)
            .gte("fecha_inicio", todayStart)
            .lt("fecha_inicio", tomorrowStart)
            .order("fecha_inicio", { ascending: true }),

          supabase
            .from("pharmacy_sales")
            .select("total")
            .eq("clinic_id", activeClinicId)
            .eq("status", "completed")
            .gte("created_at", todayStart)
            .lt("created_at", tomorrowStart),

          supabase
            .from("patients")
            .select("id", { count: "exact", head: true })
            .eq("activo", true),

          supabase
            .from("audit_logs" as unknown as "appointments")
            .select("id, created_at, accion, tabla, datos_nuevos")
            .eq("clinic_id", activeClinicId)
            .gte("created_at", todayStart)
            .lt("created_at", tomorrowStart)
            .order("created_at", { ascending: false })
            .limit(10),

          supabase
            .from("almacen_alertas")
            .select("id", { count: "exact", head: true })
            .eq("clinic_id", activeClinicId)
            .eq("status", "pending"),
        ]);

      const citasRaw = citasRes.data ?? [];
      const mappedCitas: CitaHoy[] = citasRaw.map((c) => {
        const p = c.patients as { nombre: string; apellido_paterno: string | null } | null;
        const d = c.doctors as { nombre: string; apellidos: string } | null;
        return {
          id: c.id,
          hora: formatHora(c.fecha_inicio),
          paciente: p
            ? formatNombrePaciente(p.nombre, p.apellido_paterno)
            : "Paciente",
          medico: d ? formatNombreDoctor(d.nombre, d.apellidos) : "Médico",
          tipo: (c.motivo_consulta as string | null)?.slice(0, 30) ?? "Consulta general",
          estado: mapStatusToLabel(c.status as string),
        };
      });

      const sinConfirmar = citasRaw.filter(
        (c) =>
          !CONFIRMED_STATUSES.has(c.status as string) &&
          !RESOLVED_STATUSES.has(c.status as string)
      ).length;

      const ingresos = (ventasRes.data ?? []).reduce(
        (sum, v) => sum + Number(v.total),
        0
      );

      const auditRows = (auditRes.data ?? []) as unknown as AuditRow[];
      const actividad: ActividadItem[] = auditRows.map((row) => ({
        id: row.id,
        texto: mapAuditToTexto(row.accion, row.tabla, row.datos_nuevos),
        tiempo: tiempoRelativo(row.created_at),
        created_at: row.created_at,
      }));

      setTotalCitasHoy(citasRaw.length);
      setCitasHoy(mappedCitas);
      setCitasSinConfirmar(sinConfirmar);
      setIngresosHoy(ingresos);
      setTotalPacientes(pacientesRes.count ?? 0);
      setAlertasPendientes(alertasRes.count ?? 0);
      setActividadReciente(actividad);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando dashboard");
    } finally {
      setLoading(false);
    }
  }, [activeClinicId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    loading,
    error,
    totalCitasHoy,
    citasHoy,
    ingresosHoy,
    totalPacientes,
    alertasPendientes,
    citasSinConfirmar,
    actividadReciente,
    refresh: load,
  };
}
