import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, User, MapPin, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  getJourneyStageLabel, getJourneyStageColor, getPatientNextAction,
  getPatientOperationalRisk, riskBadgeClass, minutesSince,
  type JourneyInstanceLite,
} from "../lib/journeyHelpers";
import PatientJourneyLine from "@/features/camino-paciente/components/PatientJourneyLine";

export interface KanbanRow {
  appointment: any;
  patient: any;
  doctor: any;
  room: any;
  instance: JourneyInstanceLite | null;
  hasExpediente: boolean;
  hasConsentimiento: boolean;
  hasAlergias: boolean;
}

interface Props {
  row: KanbanRow;
  onOpen: (row: KanbanRow) => void;
}

export default function PatientJourneyCard({ row, onOpen }: Props) {
  const { appointment, patient, doctor, room, instance } = row;
  const stage = getJourneyStageColor(instance?.status);
  const risk = getPatientOperationalRisk(row);
  const nextAction = getPatientNextAction(row);
  const since = instance ? minutesSince(instance.updated_at ?? instance.created_at) : 0;
  const stepKey =
    instance?.snapshot_json?.current_step_key ?? instance?.snapshot_json?.currentStepKey ?? null;

  return (
    <Card className={`p-3 border-l-4 ${
      instance?.status === "bloqueado" ? "border-l-destructive" :
      instance?.status === "completado" ? "border-l-success" :
      instance?.status === "override" ? "border-l-purple-500" :
      instance ? "border-l-info" : "border-l-muted-foreground/40"
    } hover:shadow-md transition-shadow`}>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {patient ? `${patient.nombre} ${patient.apellidos}` : "Paciente"}
            </p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {appointment?.fecha_inicio && format(new Date(appointment.fecha_inicio), "HH:mm", { locale: es })}
              {instance && <span className="ml-1">• {since} min en etapa</span>}
            </p>
          </div>
          <Badge variant="outline" className={riskBadgeClass(risk)}>
            {risk === "alto" ? "Alto" : risk === "medio" ? "Medio" : "OK"}
          </Badge>
        </div>

        <div className="space-y-1 text-[11px] text-muted-foreground">
          {doctor && (
            <p className="flex items-center gap-1 truncate">
              <User className="h-3 w-3" />Dr(a). {doctor.nombre} {doctor.apellidos}
            </p>
          )}
          {room && (
            <p className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3" />{room.nombre}
            </p>
          )}
        </div>

        <PatientJourneyLine journeyInstance={instance} compact showLabels={false} />


        <div className="flex items-start gap-1 text-[11px] text-foreground bg-muted/50 rounded px-2 py-1">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
          <span className="truncate">{nextAction}</span>
        </div>

        <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => onOpen(row)}>
          Ver detalle
        </Button>
      </div>
    </Card>
  );
}
