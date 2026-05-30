import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarPlus, AlertTriangle, UserPlus, CheckCircle2, XCircle, Clock } from "lucide-react";
import { AssignAppointmentDialog } from "./AssignAppointmentDialog";
import { QuickPatientDialog } from "./QuickPatientDialog";
import { DoctorCallDialog } from "./DoctorCallDialog";
import { Phone, PhoneOff } from "lucide-react";

interface Props {
  conversacionId: string;
  identidadCanalId: string;
  patientId: string | null;
  clinicId: string;
  pacienteNombre: string;
  displayName: string | null;
  contacto: string;
  motivo?: string | null;
  prioridad?: string | null;
  dolor?: number | null;
  onPatientLinked?: (patientId: string) => void;
}

interface LatestAppt {
  id: string;
  doctor_id: string | null;
  doctor_confirmation_status: "pending" | "confirmed" | "declined";
  doctor_confirmation_reason: string | null;
  fecha_inicio: string;
}

interface LastAttempt {
  status: string;
  channel: string;
  created_at: string;
}

export function ConversationActionPanel(props: Props) {
  const [openAssign, setOpenAssign] = useState(false);
  const [openPatient, setOpenPatient] = useState(false);
  const [openCall, setOpenCall] = useState(false);
  const [latest, setLatest] = useState<LatestAppt | null>(null);
  const [lastAttempt, setLastAttempt] = useState<LastAttempt | null>(null);
  const urgente = props.prioridad === "urgente";
  const sinPaciente = !props.patientId;

  const fetchLatest = async () => {
    const { data } = await supabase
      .from("appointments")
      .select("id, doctor_id, doctor_confirmation_status, doctor_confirmation_reason, fecha_inicio")
      .eq("conversacion_id", props.conversacionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatest((data as LatestAppt | null) ?? null);
    if (data?.id) {
      const { data: att } = await supabase
        .from("doctor_contact_attempts")
        .select("status, channel, created_at")
        .eq("appointment_id", data.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLastAttempt((att as LastAttempt | null) ?? null);
    } else {
      setLastAttempt(null);
    }
  };

  useEffect(() => {
    let active = true;
    fetchLatest();
    const ch = supabase
      .channel(`conv-appt-${props.conversacionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `conversacion_id=eq.${props.conversacionId}` }, () => {
        if (active) fetchLatest();
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.conversacionId]);

  const declined = latest?.doctor_confirmation_status === "declined";
  const confirmed = latest?.doctor_confirmation_status === "confirmed";
  const pendingDoctor = latest?.doctor_confirmation_status === "pending";
  const callPending = pendingDoctor && lastAttempt && ["no_answer","busy","callback_requested"].includes(lastAttempt.status);
  const minutesPending = latest && pendingDoctor
    ? Math.floor((Date.now() - new Date(latest.fecha_inicio).getTime()) / 60000)
    : 0;

  return (
    <div className="border-b border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{props.pacienteNombre}</span>
            {urgente && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Urgente
              </Badge>
            )}
            {props.prioridad === "alta" && (
              <Badge className="bg-orange-500 text-white hover:bg-orange-600">Prioridad alta</Badge>
            )}
            {sinPaciente && (
              <Badge variant="outline" className="border-orange-500 text-orange-700 dark:text-orange-400">
                Sin paciente
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">{props.contacto}</p>
          {props.motivo && <p className="text-foreground"><span className="text-muted-foreground">Motivo:</span> {props.motivo}</p>}
          {typeof props.dolor === "number" && (
            <p className="text-foreground"><span className="text-muted-foreground">Dolor reportado:</span> {props.dolor}/10</p>
          )}
        </div>
        <div className="shrink-0 flex flex-col gap-2 items-end">
          {confirmed && (
            <Badge className="bg-emerald-600 text-white gap-1"><CheckCircle2 className="h-3 w-3" /> Confirmada por doctor</Badge>
          )}
          {pendingDoctor && (
            <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 gap-1">
              <Clock className="h-3 w-3" /> Pendiente confirmación doctor
            </Badge>
          )}
          {callPending && (
            <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400 gap-1">
              <PhoneOff className="h-3 w-3" /> Llamada pendiente
            </Badge>
          )}
          {pendingDoctor && minutesPending >= 15 && (
            <Badge variant="outline" className="border-red-500 text-red-700 dark:text-red-400 gap-1">
              <AlertTriangle className="h-3 w-3" /> Sin confirmar {minutesPending}m
            </Badge>
          )}
          {declined && (
            <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rechazada por doctor</Badge>
          )}
          {sinPaciente ? (
            <Button size="sm" onClick={() => setOpenPatient(true)}>
              <UserPlus className="h-4 w-4 mr-1.5" /> Crear/asociar paciente
            </Button>
          ) : (
            <Button size="sm" onClick={() => setOpenAssign(true)}>
              <CalendarPlus className="h-4 w-4 mr-1.5" /> {declined ? "Reasignar cita" : "Asignar cita"}
            </Button>
          )}
          {latest && pendingDoctor && latest.doctor_id && (
            <Button size="sm" variant="outline" onClick={() => setOpenCall(true)}>
              <Phone className="h-4 w-4 mr-1.5" /> Registrar llamada al doctor
            </Button>
          )}
        </div>
      </div>
      {declined && latest?.doctor_confirmation_reason && (
        <p className="text-[11px] text-destructive">
          Motivo del doctor: {latest.doctor_confirmation_reason}. Reasigna con otro horario o doctor.
        </p>
      )}
      {urgente && (
        <p className="text-[11px] text-destructive">
          Valorar atención inmediata. Si el paciente reporta síntomas graves, recomendar acudir a urgencias o llamar al 911.
        </p>
      )}
      {sinPaciente && (
        <p className="text-[11px] text-orange-700 dark:text-orange-400">
          Esta conversación aún no tiene paciente asociado. Crea uno nuevo o asóciale un paciente existente antes de asignar cita.
        </p>
      )}

      <QuickPatientDialog
        open={openPatient}
        onOpenChange={setOpenPatient}
        conversacionId={props.conversacionId}
        identidadCanalId={props.identidadCanalId}
        clinicId={props.clinicId}
        contactoPrecargado={props.contacto}
        displayName={props.displayName}
        motivoInicial={props.motivo}
        onLinked={(pid) => {
          props.onPatientLinked?.(pid);
          setOpenAssign(true);
        }}
      />

      <AssignAppointmentDialog
        open={openAssign}
        onOpenChange={setOpenAssign}
        conversacionId={props.conversacionId}
        patientId={props.patientId}
        clinicId={props.clinicId}
        notasPrecargadas={[
          props.motivo ? `Motivo: ${props.motivo}` : null,
          typeof props.dolor === "number" ? `Dolor reportado: ${props.dolor}/10` : null,
        ].filter(Boolean).join(" · ")}
      />
    </div>
  );
}
