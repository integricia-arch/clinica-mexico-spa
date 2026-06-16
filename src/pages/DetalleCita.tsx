import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { restSelect } from "@/lib/restClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Clock, User, Stethoscope, MapPin, FileText, Bot, CheckCircle, XCircle, Pill, Bell, Plus, CalendarClock, Route, CreditCard } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { friendlyError } from "@/lib/errors";
import PatientJourneyLine from "@/features/camino-paciente/components/PatientJourneyLine";
import { audit } from "@/features/camino-paciente/services/journeyEngine";
import QuickArrivalModal from "@/features/centro-control/components/QuickArrivalModal";
import type { JourneyInstanceLite } from "@/features/centro-control/lib/journeyHelpers";
import StripePaymentModal from "@/features/pagos/StripePaymentModal";
import { useActiveClinic } from "@/hooks/useActiveClinic";

const estadoRecordatorioLabel: Record<string, string> = {
  pendiente: "Pendiente",
  enviado: "Enviado",
  fallido: "Fallido",
  cancelado: "Cancelado",
};

const canalLabel: Record<string, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "Correo",
  telegram: "Telegram",
};

type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

const statusLabel: Record<string, string> = {
  solicitada: "Solicitada",
  tentativa: "Tentativa",
  pendiente_formulario: "Pendiente de formulario",
  confirmada: "Confirmada",
  recordatorio_enviado: "Recordatorio enviado",
  confirmada_paciente: "Confirmada por paciente",
  confirmada_medico: "Confirmada por médico",
  cancelada: "Cancelada",
  liberada: "Liberada",
};

const allStatuses: AppointmentStatus[] = [
  "solicitada", "tentativa", "pendiente_formulario", "confirmada",
  "recordatorio_enviado", "confirmada_paciente", "confirmada_medico",
  "cancelada", "liberada",
];

interface IdentidadCanal {
  id: string;
  canal_id: string;
  display_name: string | null;
}

interface RecordatorioCita {
  id: string;
  appointment_id: string;
  identidad_canal_id: string;
  programado_para: string;
  mensaje: string;
  status: string;
  enviado_at: string | null;
  tipo?: string | null;
  identidades_canal: IdentidadCanal | null;
}

type AppointmentRecord = Record<string, unknown>;
type ResourceRecord = Record<string, unknown>;
type ServicioRecord = Record<string, unknown>;

// recordatorios_cita is not in the generated Supabase types, so we bypass via unknown cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAny = supabase as unknown as any;

export default function DetalleCita() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const { activeClinicId } = useActiveClinic();
  const [appointment, setAppointment] = useState<AppointmentRecord | null>(null);
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [servicio, setServicio] = useState<ServicioRecord | null>(null);
  const [recordatorios, setRecordatorios] = useState<RecordatorioCita[]>([]);
  const [identidadesCanal, setIdentidadesCanal] = useState<IdentidadCanal[]>([]);
  const [journeyInstance, setJourneyInstance] = useState<JourneyInstanceLite | null>(null);
  const [arrivalOpen, setArrivalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enfermeraInfo, setEnfermeraInfo] = useState<{ nombre: string; apellidos: string; categoria: string } | null>(null);
  const [nursesOptions, setNursesOptions] = useState<{ user_id: string; nombre: string; apellidos: string; categoria: string }[]>([]);
  const [reassigningNurse, setReassigningNurse] = useState(false);
  const puedeReasignarEnfermera = hasRole("admin") || hasRole("doctor");

  const loadEnfermeraInfo = async (assignedNurseId: string | null) => {
    if (!assignedNurseId) { setEnfermeraInfo(null); return; }
    const { data } = await supabase
      .from("nurses")
      .select("nombre, apellidos, categoria")
      .eq("user_id", assignedNurseId)
      .maybeSingle();
    setEnfermeraInfo(data ?? null);
  };

  const reloadJourney = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("journey_instances")
      .select("id, appointment_id, patient_id, status, snapshot_json, updated_at, created_at")
      .eq("appointment_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setJourneyInstance((data as JourneyInstanceLite) ?? null);
  };

  // Modal recordatorio
  const [reminderOpen, setReminderOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<RecordatorioCita | null>(null);
  const [reminderIdentidadId, setReminderIdentidadId] = useState<string>("");
  const [reminderFecha, setReminderFecha] = useState("");
  const [reminderMensaje, setReminderMensaje] = useState("");
  const [savingReminder, setSavingReminder] = useState(false);
  const [sendingNow, setSendingNow] = useState<string | null>(null);

  const puedeGestionarRecordatorios = hasRole("admin") || hasRole("receptionist");

  // Stripe payment modal
  const stripeAmountKey = `stripe-amount-${id ?? ""}`;
  const [stripeOpen, setStripeOpen] = useState(false);
  const [stripeAmountCents, setStripeAmountCents] = useState(0);
  const [stripeAmountInput, setStripeAmountInput] = useState(() => {
    try { return sessionStorage.getItem(`stripe-amount-${id ?? ""}`) ?? ""; } catch { return ""; }
  });

  const reloadRecordatorios = async () => {
    const data = await restSelect(
      "recordatorios_cita",
      `select=*,identidades_canal(canal_id,display_name)&appointment_id=eq.${id}&order=programado_para.asc`,
    ).catch(() => []);
    setRecordatorios(data as RecordatorioCita[]);
  };

  const abrirNuevoRecordatorio = () => {
    setEditingReminder(null);
    setReminderIdentidadId(identidadesCanal[0]?.id ?? "");
    const citaMs = new Date(appointment!.fecha_inicio as string).getTime();
    const defaultDate = new Date(Math.min(
      Math.max(Date.now() + 60 * 60 * 1000, citaMs - 2 * 60 * 60 * 1000),
      citaMs - 5 * 60 * 1000  // never schedule a reminder after the appointment starts
    ));
    setReminderFecha(format(defaultDate, "yyyy-MM-dd'T'HH:mm"));
    setReminderMensaje(
      `Recordatorio: tiene una cita el ${format(new Date(appointment!.fecha_inicio as string), "dd/MM/yyyy 'a las' HH:mm", { locale: es })} hrs.`
    );
    setReminderOpen(true);
  };

  const abrirReprogramar = (r: RecordatorioCita) => {
    setEditingReminder(r);
    setReminderIdentidadId(r.identidad_canal_id ?? identidadesCanal[0]?.id ?? "");
    setReminderFecha(format(new Date(r.programado_para), "yyyy-MM-dd'T'HH:mm"));
    setReminderMensaje(r.mensaje ?? "");
    setReminderOpen(true);
  };

  const guardarRecordatorio = async () => {
    if (!reminderFecha) {
      toast({ variant: "destructive", title: "Falta fecha", description: "Selecciona fecha y hora del recordatorio." });
      return;
    }
    if (!reminderIdentidadId) {
      toast({ variant: "destructive", title: "Falta canal", description: "Selecciona un canal de comunicación." });
      return;
    }
    setSavingReminder(true);
    const programado = new Date(reminderFecha).toISOString();

    if (editingReminder) {
      const { error } = await supabaseAny
        .from("recordatorios_cita")
        .update({
          identidad_canal_id: reminderIdentidadId,
          programado_para: programado,
          mensaje: reminderMensaje,
          status: "pendiente",
          enviado_at: null,
          ultimo_error: null,
          intentos: 0,
        })
        .eq("id", editingReminder.id);
      if (error) {
        setSavingReminder(false);
        toast({ variant: "destructive", title: "Error", description: friendlyError(error) });
        return;
      }
      toast({ title: "Recordatorio reprogramado" });
    } else {
      const { error } = await supabaseAny
        .from("recordatorios_cita")
        .insert({
          appointment_id: id!,
          identidad_canal_id: reminderIdentidadId,
          programado_para: programado,
          mensaje: reminderMensaje,
          status: "pendiente",
          tipo: "manual",
        });
      if (error) {
        setSavingReminder(false);
        toast({ variant: "destructive", title: "Error", description: friendlyError(error) });
        return;
      }
      toast({ title: "Recordatorio creado", description: "Se programó el recordatorio manual." });
    }

    setSavingReminder(false);
    setReminderOpen(false);
    await reloadRecordatorios();
  };

  const enviarAhora = async (r: RecordatorioCita) => {
    setSendingNow(r.id);
    const { error } = await supabase.functions.invoke("enviar-recordatorios", {
      body: { recordatorio_id: r.id },
    });
    setSendingNow(null);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: friendlyError(error) });
      return;
    }
    toast({ title: "Envío solicitado" });
    await reloadRecordatorios();
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [aRes, rRes, remRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("*, patients(*), doctors(nombre, apellidos, especialidad), rooms(nombre, piso)")
          .eq("id", id)
          .single(),
        supabase.from("appointment_resources").select("*").eq("appointment_id", id),
        supabaseAny
          .from("recordatorios_cita")
          .select("*, identidades_canal(canal_id, display_name)")
          .eq("appointment_id", id)
          .order("programado_para", { ascending: true }),
      ]);
      setAppointment(aRes.data as AppointmentRecord);
      setResources((rRes.data ?? []) as ResourceRecord[]);
      setRecordatorios(remRes.data ?? []);
      await loadEnfermeraInfo((aRes.data as { assigned_nurse_id?: string | null } | null)?.assigned_nurse_id ?? null);
      if (aRes.data?.patient_id) {
        const { data: icData } = await supabase
          .from("identidades_canal")
          .select("id, canal_id, display_name")
          .eq("patient_id", aRes.data.patient_id);
        setIdentidadesCanal(icData ?? []);
      }
      if (aRes.data?.servicio_id) {
        const { data: sData } = await supabase
          .from("servicios")
          .select("nombre, precio_centavos, duracion_minutos")
          .eq("id", aRes.data.servicio_id)
          .single();
        setServicio(sData as ServicioRecord);
      }
      setLoading(false);
    })();
    reloadJourney();
  }, [id]);

  useEffect(() => {
    if (!puedeReasignarEnfermera) return;
    supabase
      .from("nurses")
      .select("user_id, nombre, apellidos, categoria")
      .eq("activo", true)
      .not("user_id", "is", null)
      .order("apellidos")
      .then(({ data }) => setNursesOptions((data ?? []) as never));
  }, [puedeReasignarEnfermera]);

  const handleReasignarEnfermera = async (nuevoUserId: string | null) => {
    if (!id) return;
    const anterior = appointment?.assigned_nurse_id ?? null;
    setReassigningNurse(true);
    const { error } = await supabase
      .from("appointments")
      .update({ assigned_nurse_id: nuevoUserId })
      .eq("id", id);
    if (error) {
      setReassigningNurse(false);
      toast({ variant: "destructive", title: "Error", description: friendlyError(error) });
      return;
    }
    if (nuevoUserId) {
      supabase.functions.invoke("notify-nurse-assignment", { body: { appointment_id: id } }).catch(() => {});
    }
    if (journeyInstance) {
      await audit(journeyInstance.id, "nurse_reasignada", {
        old_value: { assigned_nurse_id: anterior },
        new_value: { assigned_nurse_id: nuevoUserId },
      });
    }
    setAppointment((prev) => (prev ? { ...prev, assigned_nurse_id: nuevoUserId } as AppointmentRecord : prev));
    await loadEnfermeraInfo(nuevoUserId);
    setReassigningNurse(false);
    toast({ title: nuevoUserId ? "Enfermera reasignada" : "Enfermera removida de la cita" });
  };

  const updateStatus = async (newStatus: AppointmentStatus) => {
    const oldStatus = appointment!.status;
    const { error } = await supabase
      .from("appointments")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: friendlyError(error) });
      return;
    }

    await supabase.rpc("log_audit", {
      _accion: newStatus === "cancelada" ? "cancelar" : "actualizar",
      _tabla: "appointments",
      _registro_id: id!,
      _datos_anteriores: { status: oldStatus } as unknown as Record<string, unknown>,
      _datos_nuevos: { status: newStatus } as unknown as Record<string, unknown>,
    });

    setAppointment({ ...appointment, status: newStatus });
    toast({ title: "Estado actualizado", description: `Cita marcada como: ${statusLabel[newStatus]}` });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!appointment) {
    return <p className="text-center py-20 text-muted-foreground">Cita no encontrada</p>;
  }

  const a = appointment;
  const sinCanales = identidadesCanal.length === 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver
      </Button>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-display text-xl font-bold text-card-foreground">Detalle de cita</h1>
          {(hasRole("admin") || hasRole("receptionist")) && (
            <Select value={a.status as string} onValueChange={updateStatus}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allStatuses.map((s) => (
                  <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {a.creada_por_bot && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
            <Bot className="h-4 w-4" />
            Cita agendada vía Telegram por el bot
          </div>
        )}

        {(hasRole("admin") || hasRole("receptionist")) &&
          (a.status === "solicitada" || a.status === "tentativa") && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" className="flex-1" onClick={() => updateStatus("confirmada")}>
                <CheckCircle className="mr-2 h-4 w-4" /> Confirmar cita
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="lg" variant="destructive" className="flex-1">
                    <XCircle className="mr-2 h-4 w-4" /> Cancelar cita
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción cancelará la cita permanentemente. El paciente deberá reagendar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Volver</AlertDialogCancel>
                    <AlertDialogAction onClick={() => updateStatus("cancelada")} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Sí, cancelar cita
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

        {/* Cobro con tarjeta */}
        {(hasRole("admin") || hasRole("receptionist")) &&
          !["cancelada", "liberada"].includes(a.status as string) &&
          activeClinicId && (
            <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Cobro con tarjeta</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder={servicio?.precio_centavos
                      ? ((servicio.precio_centavos as number) / 100).toFixed(2)
                      : "0.00"}
                    value={stripeAmountInput}
                    onChange={(e) => {
                      setStripeAmountInput(e.target.value);
                      try { sessionStorage.setItem(stripeAmountKey, e.target.value); } catch { /* ignore */ }
                    }}
                    className="w-full rounded-md border border-input bg-background pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>
                <Button
                  onClick={() => {
                    const raw = stripeAmountInput.trim();
                    const mxn = raw
                      ? parseFloat(raw)
                      : servicio?.precio_centavos
                        ? (servicio.precio_centavos as number) / 100
                        : 0;
                    if (!mxn || mxn <= 0) {
                      toast({ variant: "destructive", title: "Monto requerido", description: "Ingresa el monto a cobrar." });
                      return;
                    }
                    setStripeAmountCents(Math.round(mxn * 100));
                    setStripeOpen(true);
                  }}
                  className="gap-2 shrink-0"
                >
                  <CreditCard className="h-4 w-4" />
                  Cobrar con tarjeta
                </Button>
              </div>
              {servicio?.precio_centavos && !stripeAmountInput && (
                <p className="text-xs text-muted-foreground">
                  Precio del servicio: ${((servicio.precio_centavos as number) / 100).toFixed(2)} MXN
                </p>
              )}
            </div>
          )}

        {(hasRole("admin") || hasRole("receptionist") || hasRole("doctor") || hasRole("nurse")) && (
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Camino del paciente</p>
                {journeyInstance && (
                  <span className="text-xs text-muted-foreground capitalize">
                    · {journeyInstance.status?.replace("_", " ")}
                  </span>
                )}
              </div>
              {(hasRole("admin") || hasRole("receptionist")) && (
                <Button size="sm" variant={journeyInstance ? "outline" : "default"} onClick={() => setArrivalOpen(true)}>
                  {journeyInstance ? "Registrar llegada" : "Iniciar camino"}
                </Button>
              )}
            </div>
            <PatientJourneyLine
              journeyInstance={journeyInstance}
              showProgress
              onStart={(hasRole("admin") || hasRole("receptionist")) ? () => setArrivalOpen(true) : undefined}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex gap-3">
            <Clock className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Fecha y hora</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(a.fecha_inicio as string), "EEEE d 'de' MMMM, yyyy", { locale: es })}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(a.fecha_inicio as string), "HH:mm")} – {format(new Date(a.fecha_fin as string), "HH:mm")}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <User className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Paciente</p>
              <p className="text-sm text-muted-foreground">
                {(a.patients as Record<string, unknown>)?.nombre as string} {(a.patients as Record<string, unknown>)?.apellidos as string}
              </p>
              {(a.patients as Record<string, unknown>)?.telefono && (
                <p className="text-xs text-muted-foreground">{(a.patients as Record<string, unknown>).telefono as string}</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Stethoscope className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Médico</p>
              <p className="text-sm text-muted-foreground">
                Dr(a). {(a.doctors as Record<string, unknown>)?.nombre as string} {(a.doctors as Record<string, unknown>)?.apellidos as string}
              </p>
              <p className="text-xs text-muted-foreground">{(a.doctors as Record<string, unknown>)?.especialidad as string}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <User className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Enfermera responsable</p>
              {puedeReasignarEnfermera ? (
                <div className="flex items-center gap-2 mt-1">
                  <Select
                    value={(a.assigned_nurse_id as string) ?? "__none__"}
                    onValueChange={(v) => handleReasignarEnfermera(v === "__none__" ? null : v)}
                    disabled={reassigningNurse}
                  >
                    <SelectTrigger className="h-8 text-sm max-w-xs"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin asignar</SelectItem>
                      {nursesOptions.map((n) => (
                        <SelectItem key={n.user_id} value={n.user_id}>{n.nombre} {n.apellidos}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {enfermeraInfo ? `${enfermeraInfo.nombre} ${enfermeraInfo.apellidos}` : "Sin asignar"}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <MapPin className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Consultorio</p>
              <p className="text-sm text-muted-foreground">
                {a.rooms ? `${(a.rooms as Record<string, unknown>).nombre}${(a.rooms as Record<string, unknown>).piso ? ` (Piso ${(a.rooms as Record<string, unknown>).piso})` : ""}` : "Sin asignar"}
              </p>
            </div>
          </div>

          {servicio && (
            <div className="flex gap-3">
              <Pill className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">Servicio</p>
                <p className="text-sm text-muted-foreground">{servicio.nombre as string}</p>
                <p className="text-xs text-muted-foreground">
                  ${((servicio.precio_centavos as number) / 100).toLocaleString("es-MX")} · {servicio.duracion_minutos as number} min
                </p>
              </div>
            </div>
          )}
        </div>

        {a.motivo_consulta && (
          <div className="flex gap-3">
            <FileText className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Motivo de consulta</p>
              <p className="text-sm text-muted-foreground">{a.motivo_consulta as string}</p>
            </div>
          </div>
        )}

        {a.notas && (
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm font-medium mb-1">Notas</p>
            <p className="text-sm text-muted-foreground">{a.notas as string}</p>
          </div>
        )}

        {resources.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Recursos asignados</p>
            <div className="space-y-1">
              {resources.map((r) => (
                <div key={r.id as string} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="font-medium">{r.tipo_recurso as string}</span>
                  {r.descripcion && <span>— {r.descripcion as string}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-border pt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Recordatorios</p>
            </div>
            {puedeGestionarRecordatorios && (
              sinCanales ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button size="sm" variant="outline" disabled>
                        <Plus className="mr-1 h-4 w-4" /> Nuevo recordatorio
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Este paciente no tiene canales de comunicación registrados.
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button size="sm" variant="outline" onClick={abrirNuevoRecordatorio}>
                  <Plus className="mr-1 h-4 w-4" /> Nuevo recordatorio
                </Button>
              )
            )}
          </div>
          {recordatorios.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay recordatorios programados para esta cita.</p>
          ) : (
            <div className="space-y-2">
              {recordatorios.map((r) => {
                const canalKey = r.identidades_canal?.canal_id;
                const canalNombre = canalKey ? (canalLabel[canalKey] ?? canalKey) : "—";
                const tipoLabel = r.tipo === "manual" ? "Manual" : (r.tipo ?? "");
                return (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{canalNombre}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {format(new Date(r.programado_para), "d MMM, HH:mm", { locale: es })}
                      </span>
                      {tipoLabel && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{tipoLabel}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        r.status === "enviado" ? "bg-success/10 text-success"
                        : r.status === "fallido" ? "bg-destructive/10 text-destructive"
                        : r.status === "cancelado" ? "bg-muted text-muted-foreground"
                        : "bg-warning/10 text-warning"
                      }`}>
                        {estadoRecordatorioLabel[r.status] ?? r.status}
                      </span>
                      {puedeGestionarRecordatorios && r.status !== "enviado" && (
                        <>
                          <Button size="sm" variant="ghost" className="h-7 px-2" disabled={sendingNow === r.id} onClick={() => enviarAhora(r)}>
                            {sendingNow === r.id ? "Enviando…" : "Enviar ahora"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => abrirReprogramar(r)}>
                            <CalendarClock className="mr-1 h-3.5 w-3.5" /> Reprogramar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingReminder ? "Reprogramar recordatorio" : "Nuevo recordatorio manual"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Canal</Label>
              <Select value={reminderIdentidadId} onValueChange={setReminderIdentidadId}>
                <SelectTrigger><SelectValue placeholder="Selecciona un canal" /></SelectTrigger>
                <SelectContent>
                  {identidadesCanal.map((ic) => (
                    <SelectItem key={ic.id} value={ic.id}>
                      {(canalLabel[ic.canal_id] ?? ic.canal_id)}
                      {ic.display_name ? ` — ${ic.display_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha y hora de envío</Label>
              <Input
                type="datetime-local"
                value={reminderFecha}
                onChange={(e) => setReminderFecha(e.target.value)}
              />
            </div>
            <div>
              <Label>Mensaje</Label>
              <Textarea
                rows={3}
                value={reminderMensaje}
                onChange={(e) => setReminderMensaje(e.target.value)}
                placeholder="Mensaje a enviar al paciente"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReminderOpen(false)}>Cancelar</Button>
            <Button onClick={guardarRecordatorio} disabled={savingReminder}>
              {savingReminder ? "Guardando..." : editingReminder ? "Reprogramar" : "Crear recordatorio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickArrivalModal
        open={arrivalOpen}
        onOpenChange={setArrivalOpen}
        appointmentId={id ?? null}
        patientName={a.patients ? `${(a.patients as Record<string, unknown>).nombre} ${(a.patients as Record<string, unknown>).apellidos}` : undefined}
        onCompleted={reloadJourney}
      />

      {activeClinicId && (
        <StripePaymentModal
          open={stripeOpen}
          onOpenChange={setStripeOpen}
          onSuccess={(piId) => {
            try { sessionStorage.removeItem(stripeAmountKey); } catch { /* ignore */ }
            toast({ title: "Pago exitoso", description: `Cobro registrado — PI: ${piId.slice(-8)}` });
            setStripeAmountInput("");
          }}
          clinicId={activeClinicId}
          amountCents={stripeAmountCents}
          description={
            servicio?.nombre
              ? `${servicio.nombre} — cita ${id?.slice(0, 8)}`
              : `Cita ${id?.slice(0, 8)}`
          }
          appointmentId={id}
        />
      )}
    </div>
  );
}
