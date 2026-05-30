import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays, Clock, UserCheck, CalendarPlus, AlertTriangle,
  MessageSquare, UserPlus, PhoneOff, XCircle, Bell, Inbox as InboxIcon,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const statusLabel: Record<string, string> = {
  solicitada: "Solicitada",
  tentativa: "Tentativa",
  pendiente_formulario: "Pend. formulario",
  confirmada: "Confirmada",
  recordatorio_enviado: "Rec. enviado",
  confirmada_paciente: "Conf. paciente",
  confirmada_medico: "Conf. médico",
  cancelada: "Cancelada",
  liberada: "Liberada",
};

const statusColor: Record<string, string> = {
  solicitada: "bg-warning/10 text-warning",
  confirmada: "bg-success/10 text-success",
  confirmada_paciente: "bg-success/10 text-success",
  confirmada_medico: "bg-success/10 text-success",
  cancelada: "bg-destructive/10 text-destructive",
  pendiente_formulario: "bg-info/10 text-info",
  tentativa: "bg-muted text-muted-foreground",
  recordatorio_enviado: "bg-info/10 text-info",
  liberada: "bg-muted text-muted-foreground",
};

type ConvRow = {
  id: string;
  status: string;
  prioridad: string;
  insiste: boolean;
  escalated_followup_count: number;
  last_message_at: string;
  last_patient_followup_at: string | null;
  motivo_resumen: string | null;
  dolor_intensidad: number | null;
  identidad_canal_id: string;
  identidades_canal: { display_name: string | null; patient_id: string | null; canal_id: string };
  patients: { id: string; nombre: string; apellidos: string } | null;
  appointments: { id: string; status: string; doctor_confirmation_status: string }[] | null;
};

export default function RecepcionDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ citasHoy: 0, pendientes: 0, confirmadas: 0 });
  const [citas, setCitas] = useState<any[]>([]);
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [doctorPending, setDoctorPending] = useState<any[]>([]);
  const [doctorDeclined, setDoctorDeclined] = useState<any[]>([]);
  const [doctorCallsPending, setDoctorCallsPending] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    const [todayRes, pendingRes, confirmedRes, listRes, convRes, docPendRes, docDeclRes, callsRes] = await Promise.all([
      supabase.from("appointments").select("id", { count: "exact", head: true })
        .gte("fecha_inicio", startOfDay).lt("fecha_inicio", endOfDay),
      supabase.from("appointments").select("id", { count: "exact", head: true })
        .in("status", ["solicitada", "tentativa", "pendiente_formulario"]),
      supabase.from("appointments").select("id", { count: "exact", head: true })
        .in("status", ["confirmada", "confirmada_paciente", "confirmada_medico"])
        .gte("fecha_inicio", startOfDay).lt("fecha_inicio", endOfDay),
      supabase.from("appointments")
        .select("*, doctors(nombre, apellidos), patients(nombre, apellidos, telefono)")
        .gte("fecha_inicio", startOfDay)
        .order("fecha_inicio", { ascending: true })
        .limit(20),
      supabase.from("conversaciones")
        .select(`
          id, status, prioridad, insiste, escalated_followup_count,
          last_message_at, last_patient_followup_at, motivo_resumen, dolor_intensidad,
          identidad_canal_id,
          identidades_canal:identidad_canal_id ( display_name, patient_id, canal_id ),
          appointments:appointments!conversacion_id ( id, status, doctor_confirmation_status )
        `)
        .eq("status", "escalada")
        .order("last_message_at", { ascending: false })
        .limit(50),
      supabase.from("appointments")
        .select("id, fecha_inicio, doctor_confirmation_status, status, doctors(nombre, apellidos), patients(nombre, apellidos)")
        .eq("doctor_confirmation_status", "pending")
        .gte("fecha_inicio", new Date().toISOString())
        .order("fecha_inicio", { ascending: true })
        .limit(20),
      supabase.from("appointments")
        .select("id, fecha_inicio, doctor_confirmation_reason, doctors(nombre, apellidos), patients(nombre, apellidos)")
        .eq("doctor_confirmation_status", "declined")
        .order("doctor_confirmation_at", { ascending: false })
        .limit(20),
      supabase.from("doctor_contact_attempts")
        .select("id", { count: "exact", head: true })
        .in("status", ["no_answer", "busy", "voicemail"]),
    ]);

    setStats({
      citasHoy: todayRes.count ?? 0,
      pendientes: pendingRes.count ?? 0,
      confirmadas: confirmedRes.count ?? 0,
    });
    setCitas(listRes.data ?? []);
    // identidades_canal vuelve como array si la FK es ambigua; normalizamos
    const convsNorm = (convRes.data ?? []).map((c: any) => {
      const ic = Array.isArray(c.identidades_canal) ? c.identidades_canal[0] : c.identidades_canal;
      return { ...c, identidades_canal: ic ?? { display_name: null, patient_id: null, canal_id: "" }, patients: null };
    }) as ConvRow[];

    // Cargar nombres de pacientes para los que tengan patient_id
    const patientIds = convsNorm.map((c) => c.identidades_canal.patient_id).filter(Boolean) as string[];
    if (patientIds.length) {
      const { data: pats } = await supabase
        .from("patients").select("id, nombre, apellidos").in("id", patientIds);
      const byId = new Map((pats ?? []).map((p: any) => [p.id, p]));
      convsNorm.forEach((c) => {
        const pid = c.identidades_canal.patient_id;
        if (pid && byId.has(pid)) c.patients = byId.get(pid) as any;
      });
    }
    setConvs(convsNorm);
    setDoctorPending(docPendRes.data ?? []);
    setDoctorDeclined(docDeclRes.data ?? []);
    setDoctorCallsPending(callsRes.count ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("recepcion-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversaciones" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Métricas operativas derivadas
  const opStats = useMemo(() => {
    const escaladas = convs.length;
    const urgentes = convs.filter((c) => c.prioridad === "urgente").length;
    const sinPaciente = convs.filter((c) => !c.identidades_canal.patient_id).length;
    const sinCita = convs.filter((c) => !c.appointments || c.appointments.length === 0).length;
    const insistencias = convs.filter((c) => c.insiste).length;
    return { escaladas, urgentes, sinPaciente, sinCita, insistencias };
  }, [convs]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const cards: { show: boolean; el: JSX.Element }[] = [
    { show: stats.citasHoy > 0, el: <StatCard key="ch" title="Citas hoy" value={stats.citasHoy} icon={CalendarDays} /> },
    { show: opStats.escaladas > 0, el: <StatCard key="es" title="Escaladas activas" value={opStats.escaladas} icon={InboxIcon} variant="warning" /> },
    { show: opStats.urgentes > 0, el: <StatCard key="ur" title="Urgentes" value={opStats.urgentes} icon={AlertTriangle} variant="destructive" /> },
    { show: opStats.insistencias > 0, el: <StatCard key="in" title="Insistencias sin atender" value={opStats.insistencias} icon={Bell} variant="destructive" /> },
    { show: opStats.sinPaciente > 0, el: <StatCard key="sp" title="Sin paciente" value={opStats.sinPaciente} icon={UserPlus} variant="warning" /> },
    { show: opStats.sinCita > 0, el: <StatCard key="sc" title="Sin cita asignada" value={opStats.sinCita} icon={CalendarPlus} variant="warning" /> },
    { show: doctorPending.length > 0, el: <StatCard key="dp" title="Doctor pendiente" value={doctorPending.length} icon={Clock} variant="warning" /> },
    { show: doctorDeclined.length > 0, el: <StatCard key="dd" title="Doctor rechazó" value={doctorDeclined.length} icon={XCircle} variant="destructive" /> },
    { show: doctorCallsPending > 0, el: <StatCard key="cp" title="Llamadas pendientes" value={doctorCallsPending} icon={PhoneOff} variant="warning" /> },
    { show: stats.pendientes > 0, el: <StatCard key="pe" title="Citas por confirmar" value={stats.pendientes} icon={Clock} variant="warning" /> },
    { show: stats.confirmadas > 0, el: <StatCard key="co" title="Confirmadas hoy" value={stats.confirmadas} icon={UserCheck} variant="success" /> },
  ].filter((c) => c.show);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground">Recepción</h1>
          <p className="mt-1 text-sm text-muted-foreground">Centro operativo de atención al paciente</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/inbox")}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Inbox
          </Button>
          <Button onClick={() => navigate("/nueva-cita")}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            Nueva cita
          </Button>
        </div>
      </div>

      {cards.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((c) => c.el)}
        </div>
      )}

      {/* Casos por atender */}
      <div className="rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4 flex items-center justify-between">
          <h2 className="text-display font-semibold text-card-foreground">Casos por atender</h2>
          <span className="text-xs text-muted-foreground">{convs.length} activos</span>
        </div>
        {convs.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Sin casos pendientes en este momento.</p>
        ) : (
          <div className="divide-y divide-border">
            {convs.map((c) => {
              const tieneCita = c.appointments && c.appointments.length > 0;
              const cita = tieneCita ? c.appointments![0] : null;
              const docPending = cita?.doctor_confirmation_status === "pending";
              const docDeclined = cita?.doctor_confirmation_status === "declined";
              const sinPaciente = !c.identidades_canal.patient_id;
              const nombre = c.patients
                ? `${c.patients.nombre} ${c.patients.apellidos}`
                : c.identidades_canal.display_name || "Sin paciente";
              return (
                <div key={c.id} className="px-5 py-3 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-card-foreground">{nombre}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {c.identidades_canal.canal_id}
                        </Badge>
                        {c.prioridad === "urgente" && (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                            Urgente
                          </Badge>
                        )}
                        {c.insiste && (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                            Insiste · {c.escalated_followup_count}
                          </Badge>
                        )}
                        {sinPaciente && (
                          <Badge className="bg-warning/10 text-warning border-warning/30 text-[10px]">
                            Sin paciente
                          </Badge>
                        )}
                        {!tieneCita && (
                          <Badge className="bg-warning/10 text-warning border-warning/30 text-[10px]">
                            Sin cita
                          </Badge>
                        )}
                        {docPending && (
                          <Badge className="bg-warning/10 text-warning border-warning/30 text-[10px]">
                            Doctor pendiente
                          </Badge>
                        )}
                        {docDeclined && (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                            Doctor rechazó · reasignar
                          </Badge>
                        )}
                      </div>
                      {c.motivo_resumen && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {c.motivo_resumen}
                          {c.dolor_intensidad != null && ` · dolor ${c.dolor_intensidad}/10`}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Último mensaje hace {formatDistanceToNow(new Date(c.last_message_at), { locale: es })}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/inbox?id=${c.id}`)}>
                      Abrir
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pendientes de confirmar por doctor */}
      {doctorPending.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-display font-semibold text-card-foreground">Pendientes de confirmar por doctor</h2>
          </div>
          <div className="divide-y divide-border">
            {doctorPending.map((a: any) => (
              <div key={a.id}
                onClick={() => navigate(`/cita/${a.id}`)}
                className="flex items-center gap-4 px-5 py-3 hover:bg-muted/50 cursor-pointer">
                <div className="text-center min-w-[60px]">
                  <p className="text-sm font-bold text-foreground">{format(new Date(a.fecha_inicio), "HH:mm")}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(a.fecha_inicio), "dd MMM", { locale: es })}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.patients?.nombre} {a.patients?.apellidos}</p>
                  <p className="text-xs text-muted-foreground">Dr(a). {a.doctors?.nombre} {a.doctors?.apellidos}</p>
                </div>
                <Badge className="bg-warning/10 text-warning border-warning/30">Esperando doctor</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Citas rechazadas por doctor */}
      {doctorDeclined.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-display font-semibold text-card-foreground">Rechazadas por doctor · requieren reasignación</h2>
          </div>
          <div className="divide-y divide-border">
            {doctorDeclined.map((a: any) => (
              <div key={a.id}
                onClick={() => navigate(`/cita/${a.id}`)}
                className="flex items-start gap-4 px-5 py-3 hover:bg-muted/50 cursor-pointer">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.patients?.nombre} {a.patients?.apellidos}</p>
                  <p className="text-xs text-muted-foreground">
                    Dr(a). {a.doctors?.nombre} {a.doctors?.apellidos} · {format(new Date(a.fecha_inicio), "dd MMM HH:mm", { locale: es })}
                  </p>
                  {a.doctor_confirmation_reason && (
                    <p className="text-xs text-destructive mt-1 line-clamp-2">Motivo: {a.doctor_confirmation_reason}</p>
                  )}
                </div>
                <Badge className="bg-destructive/10 text-destructive border-destructive/30">Reasignar</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de citas del día */}
      <div className="rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-display font-semibold text-card-foreground">Citas del día</h2>
        </div>
        {citas.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No hay citas para hoy</p>
        ) : (
          <div className="divide-y divide-border">
            {citas.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(`/cita/${c.id}`)}
                className="flex items-center gap-4 px-5 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="text-center min-w-[50px]">
                  <p className="text-sm font-bold text-foreground">
                    {format(new Date(c.fecha_inicio), "HH:mm")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(c.fecha_fin), "HH:mm")}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground truncate">
                    {c.patients?.nombre} {c.patients?.apellidos}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dr(a). {c.doctors?.nombre} {c.doctors?.apellidos}
                    {c.patients?.telefono && ` · ${c.patients.telefono}`}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[c.status] || "bg-muted text-muted-foreground"}`}>
                  {statusLabel[c.status] || c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
