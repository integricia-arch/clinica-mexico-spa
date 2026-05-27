import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, MapPin, Stethoscope, AlertCircle, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DoctorQueueItem } from "../hooks/useDoctorQueue";

interface Props {
  items: DoctorQueueItem[];
  loading: boolean;
  selectedAppointmentId: string | null;
  onSelect: (item: DoctorQueueItem) => void;
}

const STEP_LABELS: Record<string, string> = {
  arrival: "Por llegar",
  assignment: "Asignación",
  attention_open: "Apertura",
  identification: "Identificación",
  record: "Expediente",
  triage: "Triage",
  consultation_open: "En consulta",
  consultation_close: "Cierre",
  prescription: "Receta",
  pharmacy: "Farmacia",
  billing: "Pago",
  discharge: "Salida",
  followup: "Seguimiento",
};

const STEP_TONE: Record<string, string> = {
  arrival: "bg-muted text-muted-foreground",
  consultation_open: "bg-info/15 text-info",
  prescription: "bg-purple-500/15 text-purple-600",
  billing: "bg-warning/15 text-warning",
  discharge: "bg-success/15 text-success",
};

export default function DoctorPatientQueue({ items, loading, selectedAppointmentId, onSelect }: Props) {
  if (loading) {
    return <div className="p-4 text-xs text-muted-foreground">Cargando agenda…</div>;
  }
  if (items.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground">
        Sin citas para hoy.
      </div>
    );
  }
  return (
    <ScrollArea className="h-full">
      <ul className="divide-y divide-border">
        {items.map((it) => {
          const active = it.appointment_id === selectedAppointmentId;
          const fullName = it.patient
            ? `${it.patient.nombre} ${it.patient.apellidos}`
            : "Sin paciente";
          const stepKey = it.journey_current_step ?? "arrival";
          const stepLabel = STEP_LABELS[stepKey] ?? stepKey;
          const tone = STEP_TONE[stepKey] ?? "bg-muted text-muted-foreground";
          const alerts: string[] = [];
          if (!it.has_consentimiento) alerts.push("Consentimiento");
          if (!it.patient?.alergias) alerts.push("Alergias");
          return (
            <li key={it.appointment_id}>
              <button
                type="button"
                onClick={() => onSelect(it)}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                  active && "bg-primary/5 border-l-2 border-primary",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {format(new Date(it.fecha_inicio), "HH:mm", { locale: es })}
                  </span>
                  <Badge className={cn("text-[10px] px-1.5 py-0", tone)}>{stepLabel}</Badge>
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-foreground">{fullName}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  {it.servicio_nombre && (
                    <span className="inline-flex items-center gap-0.5">
                      <Stethoscope className="h-3 w-3" />
                      {it.servicio_nombre}
                    </span>
                  )}
                  {it.room_nombre && (
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />
                      {it.room_nombre}
                    </span>
                  )}
                </div>
                {alerts.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {alerts.map((a) => (
                      <span
                        key={a}
                        className="inline-flex items-center gap-0.5 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive"
                      >
                        <AlertCircle className="h-2.5 w-2.5" />
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
