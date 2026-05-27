import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users, CalendarDays, Clock, Activity, FlaskConical, Pill,
  Receipt, CheckCircle2, AlertOctagon, AlertTriangle,
} from "lucide-react";
import DashboardFilters, { type DashboardFiltersState } from "@/features/centro-control/components/DashboardFilters";
import OperationalStatCard from "@/features/centro-control/components/OperationalStatCard";
import PatientJourneyKanban from "@/features/centro-control/components/PatientJourneyKanban";
import type { KanbanRow } from "@/features/centro-control/components/PatientJourneyCard";
import TodayAppointmentsTable from "@/features/centro-control/components/TodayAppointmentsTable";
import DoctorLoadCard, { type DoctorLoad } from "@/features/centro-control/components/DoctorLoadCard";
import RoomStatusCard, { type RoomStatus } from "@/features/centro-control/components/RoomStatusCard";
import OperationalAlerts, { type OperationalAlert } from "@/features/centro-control/components/OperationalAlerts";
import SeguimientosPendientes from "@/features/centro-control/components/SeguimientosPendientes";
import RecentActivityFeed from "@/features/centro-control/components/RecentActivityFeed";
import PatientOperationalDrawer from "@/features/centro-control/components/PatientOperationalDrawer";
import QuickArrivalModal from "@/features/centro-control/components/QuickArrivalModal";
import { useDashboardData } from "@/features/centro-control/hooks/useDashboardData";
import { getKanbanColumnFor, getPatientOperationalRisk, minutesSince } from "@/features/centro-control/lib/journeyHelpers";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const canViewClinical = hasRole("admin") || hasRole("doctor") || hasRole("nurse");

  const [filters, setFilters] = useState<DashboardFiltersState>({
    date: new Date(),
    doctorId: "all", roomId: "all", apptStatus: "all",
    stageKey: "all", risk: "all", search: "",
  });
  const [drawerRow, setDrawerRow] = useState<KanbanRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [arrivalRow, setArrivalRow] = useState<KanbanRow | null>(null);
  const [arrivalOpen, setArrivalOpen] = useState(false);

  const { data, loading, reload } = useDashboardData(filters.date);

  const rows: KanbanRow[] = useMemo(() => {
    return data.appointments.map((a: any) => {
      const patient = data.patients[a.patient_id];
      return {
        appointment: a,
        patient,
        doctor: data.doctors[a.doctor_id],
        room: a.room_id ? data.rooms[a.room_id] : null,
        instance: data.instancesByAppointment[a.id] ?? null,
        hasExpediente: !!data.expedientesActivosByPatient[a.patient_id],
        hasConsentimiento: !!data.consentimientosByPatient[a.patient_id],
        hasAlergias: !!patient?.alergias,
      };
    });
  }, [data]);

  const filteredRows = useMemo(() => {
    const s = filters.search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filters.doctorId !== "all" && r.appointment.doctor_id !== filters.doctorId) return false;
      if (filters.roomId !== "all" && r.appointment.room_id !== filters.roomId) return false;
      if (filters.apptStatus !== "all" && r.appointment.status !== filters.apptStatus) return false;
      if (filters.stageKey !== "all" && getKanbanColumnFor(r.instance) !== filters.stageKey) return false;
      if (filters.risk !== "all" && getPatientOperationalRisk(r) !== filters.risk) return false;
      if (s && r.patient) {
        const full = `${r.patient.nombre} ${r.patient.apellidos}`.toLowerCase();
        if (!full.includes(s)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  // ============ STATS ============
  const stats = useMemo(() => {
    const inProcess = rows.filter((r) => r.instance && (r.instance.status === "en_proceso" || r.instance.status === "in_progress"));
    const byCol = (k: string) => rows.filter((r) => getKanbanColumnFor(r.instance) === k);
    const espera = rows.filter((r) => !r.instance || getKanbanColumnFor(r.instance) === "arrival" || getKanbanColumnFor(r.instance) === "identification");
    const consulta = byCol("consultation");
    const analisis = byCol("diagnosis");
    const receta = byCol("prescription");
    const cobro = byCol("billing");
    const altas = byCol("discharge").filter((r) => r.instance?.status === "completado");
    const bloq = rows.filter((r) => r.instance?.status === "bloqueado");
    const alertas = rows.filter((r) => getPatientOperationalRisk(r) === "alto");
    return {
      citas: rows.length,
      enAtencion: inProcess.length,
      espera: espera.length,
      consulta: consulta.length,
      analisis: analisis.length,
      receta: receta.length,
      cobro: cobro.length,
      altas: altas.length,
      bloq: bloq.length,
      alertas: alertas.length,
    };
  }, [rows]);

  // ============ DOCTOR LOAD ============
  const doctorLoads: DoctorLoad[] = useMemo(() => {
    return data.doctorsList.map((d: any) => {
      const myRows = rows.filter((r) => r.appointment.doctor_id === d.id);
      const enEspera = myRows.filter((r) => !r.instance || getKanbanColumnFor(r.instance) === "arrival").length;
      const enConsulta = myRows.filter((r) => getKanbanColumnFor(r.instance) === "consultation").length;
      const seguimiento = myRows.filter((r) => getKanbanColumnFor(r.instance) === "followup").length;
      const now = Date.now();
      const proximaCita = myRows
        .filter((r) => new Date(r.appointment.fecha_inicio).getTime() > now)
        .sort((a, b) => new Date(a.appointment.fecha_inicio).getTime() - new Date(b.appointment.fecha_inicio).getTime())[0];
      let estado: DoctorLoad["estado"] = "disponible";
      if (myRows.length === 0) estado = "sin_citas";
      else if (enConsulta > 0) estado = "en_consulta";
      else if (myRows.length > 8) estado = "saturado";
      else if (myRows.some((r) => {
        const t = new Date(r.appointment.fecha_inicio).getTime();
        return t < now - 15 * 60000 && (!r.instance || getKanbanColumnFor(r.instance) === "arrival");
      })) estado = "con_retraso";
      return {
        doctor: d,
        citasHoy: myRows.length,
        enEspera, enConsulta, seguimiento,
        proximoPaciente: proximaCita?.patient
          ? { nombre: `${proximaCita.patient.nombre} ${proximaCita.patient.apellidos}`, hora: new Date(proximaCita.appointment.fecha_inicio).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) }
          : null,
        estado,
      };
    });
  }, [data.doctorsList, rows]);

  // ============ ROOM STATUS ============
  const roomStatuses: RoomStatus[] = useMemo(() => {
    const now = Date.now();
    return data.roomsList.map((room: any) => {
      const myRows = rows.filter((r) => r.appointment.room_id === room.id);
      const current = myRows.find((r) => {
        const ini = new Date(r.appointment.fecha_inicio).getTime();
        const fin = new Date(r.appointment.fecha_fin).getTime();
        return ini <= now && now <= fin;
      });
      const next = myRows
        .filter((r) => new Date(r.appointment.fecha_inicio).getTime() > now)
        .sort((a, b) => new Date(a.appointment.fecha_inicio).getTime() - new Date(b.appointment.fecha_inicio).getTime())[0];
      return {
        room: { id: room.id, nombre: room.nombre, piso: room.piso },
        estado: current ? "ocupado" : "disponible",
        pacienteActual: current?.patient ? `${current.patient.nombre} ${current.patient.apellidos}` : null,
        doctorActual: current?.doctor ? `Dr(a). ${current.doctor.nombre} ${current.doctor.apellidos}` : null,
        proximaHoraLibre: current ? new Date(current.appointment.fecha_fin) : null,
        proximaCita: !current && next ? { paciente: next.patient ? `${next.patient.nombre} ${next.patient.apellidos}` : "—", hora: new Date(next.appointment.fecha_inicio) } : null,
      };
    });
  }, [data.roomsList, rows]);

  // ============ ALERTS ============
  const alerts: OperationalAlert[] = useMemo(() => {
    const out: OperationalAlert[] = [];
    const now = Date.now();
    for (const r of rows) {
      const pacienteName = r.patient ? `${r.patient.nombre} ${r.patient.apellidos}` : "Paciente";
      const docName = r.doctor ? `Dr(a). ${r.doctor.nombre} ${r.doctor.apellidos}` : undefined;
      if (r.appointment.status === "confirmada" && !r.instance) {
        out.push({ id: `${r.appointment.id}-noj`, level: "advertencia", paciente: pacienteName, doctor: docName, motivo: "Cita confirmada sin camino iniciado", accion: "Iniciar camino del paciente", navigateTo: `/cita/${r.appointment.id}` });
      }
      if (!r.hasConsentimiento) {
        out.push({ id: `${r.appointment.id}-noc`, level: "critica", paciente: pacienteName, motivo: "Sin consentimiento registrado", accion: "Registrar consentimiento informado" });
      }
      if (!r.hasExpediente && getKanbanColumnFor(r.instance) === "consultation") {
        out.push({ id: `${r.appointment.id}-noe`, level: "critica", paciente: pacienteName, doctor: docName, motivo: "En consulta sin expediente activo", navigateTo: "/expedientes" });
      }
      if (!r.hasAlergias) {
        out.push({ id: `${r.appointment.id}-noa`, level: "info", paciente: pacienteName, motivo: "Alergias no confirmadas" });
      }
      if (r.instance?.status === "bloqueado") {
        out.push({ id: `${r.appointment.id}-blk`, level: "critica", paciente: pacienteName, motivo: "Camino bloqueado", accion: "Revisar bloqueo", navigateTo: `/cita/${r.appointment.id}` });
      }
      if (r.instance?.status === "override") {
        out.push({ id: `${r.appointment.id}-ovr`, level: "advertencia", paciente: pacienteName, motivo: "Override autorizado en el camino" });
      }
      const ini = new Date(r.appointment.fecha_inicio).getTime();
      if (ini < now - 15 * 60000 && (!r.instance || getKanbanColumnFor(r.instance) === "arrival") && r.appointment.status !== "cancelada") {
        out.push({ id: `${r.appointment.id}-late`, level: "advertencia", paciente: pacienteName, motivo: `Cita con retraso de ${Math.floor((now - ini) / 60000)} min` });
      }
    }
    for (const d of doctorLoads) {
      if (d.estado === "saturado") {
        out.push({ id: `dr-${d.doctor.id}-sat`, level: "advertencia", doctor: `Dr(a). ${d.doctor.nombre} ${d.doctor.apellidos}`, motivo: "Médico con carga elevada (más de 8 pacientes)" });
      }
    }
    return out;
  }, [rows, doctorLoads]);

  // ============ FOLLOWUP ============
  const seguimientos = useMemo(() => {
    const now = Date.now();
    return data.recordatorios
      .filter((r: any) => r.status !== "enviado")
      .map((r: any) => {
        const appt = data.appointments.find((a: any) => a.id === r.appointment_id);
        const patient = appt ? data.patients[appt.patient_id] : null;
        return {
          id: r.id,
          appointment_id: r.appointment_id,
          programado_para: r.programado_para,
          status: r.status,
          tipo: r.tipo,
          paciente: patient ? `${patient.nombre} ${patient.apellidos}` : undefined,
          vencido: new Date(r.programado_para).getTime() < now,
        };
      });
  }, [data.recordatorios, data.appointments, data.patients]);

  // ============ ACTIONS ============
  const openRow = (row: KanbanRow) => { setDrawerRow(row); setDrawerOpen(true); };

  const startJourney = async (row: KanbanRow) => {
    if (!row.patient || !row.appointment) return;
    const { createJourneyFromAppointment } = await import("@/features/camino-paciente/services/journeyEngine");
    const r = await createJourneyFromAppointment(row.appointment.id);
    if (!r.ok) { toast.error(r.error ?? "No se pudo iniciar el camino"); return; }
    toast.success(r.data?.created ? "Camino del paciente iniciado" : "El camino ya existía, abriéndolo");
    if (r.data?.journey_instance_id) navigate(`/camino-paciente/${r.data.journey_instance_id}`);
    reload();
  };

  const registerArrival = (row: KanbanRow) => {
    if (!row.appointment) return;
    setArrivalRow(row);
    setArrivalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-2xl font-bold text-foreground">Centro de control clínico</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vista operativa en tiempo real de citas, pacientes, médicos, consultorios y camino del paciente
        </p>
      </div>

      <DashboardFilters
        value={filters}
        onChange={(next) => setFilters((f) => ({ ...f, ...next }))}
        onReload={reload}
        onNewAppointment={() => navigate("/nueva-cita")}
        onShowBlocked={() => setFilters((f) => ({ ...f, stageKey: "bloqueado" }))}
        doctors={data.doctorsList}
        rooms={data.roomsList}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <OperationalStatCard title="Citas hoy" value={stats.citas} icon={CalendarDays} />
        <OperationalStatCard title="En atención" value={stats.enAtencion} icon={Activity} variant="info" />
        <OperationalStatCard title="En espera" value={stats.espera} icon={Clock} variant="warning" />
        <OperationalStatCard title="En consulta" value={stats.consulta} icon={Users} variant="info" />
        <OperationalStatCard title="Pend. análisis" value={stats.analisis} icon={FlaskConical} variant="warning" />
        <OperationalStatCard title="Pend. receta/farmacia" value={stats.receta} icon={Pill} variant="warning" />
        <OperationalStatCard title="Pend. cobro/factura" value={stats.cobro} icon={Receipt} variant="warning" />
        <OperationalStatCard title="Altas del día" value={stats.altas} icon={CheckCircle2} variant="success" />
        <OperationalStatCard title="Bloqueados" value={stats.bloq} icon={AlertOctagon} variant="destructive" />
        <OperationalStatCard title="Alertas críticas" value={stats.alertas} icon={AlertTriangle} variant="destructive" />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      <PatientJourneyKanban rows={filteredRows} onOpen={openRow} />

      <TodayAppointmentsTable
        rows={filteredRows}
        onOpenRow={openRow}
        onNavigate={navigate}
        onStartJourney={startJourney}
        onRegisterArrival={registerArrival}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-display font-semibold text-foreground">Médicos y carga operativa</h2>
          {doctorLoads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin médicos activos registrados</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {doctorLoads.map((d) => <DoctorLoadCard key={d.doctor.id} load={d} />)}
            </div>
          )}
        </div>
        <div className="space-y-3">
          <h2 className="text-display font-semibold text-foreground">Consultorios</h2>
          {roomStatuses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin consultorios registrados</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {roomStatuses.map((r) => <RoomStatusCard key={r.room.id} status={r} />)}
            </div>
          )}
        </div>
      </div>

      <OperationalAlerts alerts={alerts} onNavigate={navigate} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SeguimientosPendientes items={seguimientos} onOpenInbox={() => navigate("/inbox")} />
        <RecentActivityFeed items={data.auditReciente} />
      </div>

      <PatientOperationalDrawer
        row={drawerRow}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onNavigate={(p) => { setDrawerOpen(false); navigate(p); }}
        canViewClinical={canViewClinical}
      />
    </div>
  );
}
