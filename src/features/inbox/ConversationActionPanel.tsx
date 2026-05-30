import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarPlus, AlertTriangle } from "lucide-react";
import { AssignAppointmentDialog } from "./AssignAppointmentDialog";

interface Props {
  conversacionId: string;
  patientId: string | null;
  clinicId: string;
  pacienteNombre: string;
  contacto: string;
  motivo?: string | null;
  prioridad?: string | null;
  dolor?: number | null;
}

export function ConversationActionPanel(props: Props) {
  const [open, setOpen] = useState(false);
  const urgente = props.prioridad === "urgente";
  return (
    <div className="border-b border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{props.pacienteNombre}</span>
            {urgente && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Urgente
              </Badge>
            )}
            {props.prioridad === "alta" && (
              <Badge className="bg-orange-500 text-white hover:bg-orange-600">Prioridad alta</Badge>
            )}
          </div>
          <p className="text-muted-foreground">{props.contacto}</p>
          {props.motivo && <p className="text-foreground"><span className="text-muted-foreground">Motivo:</span> {props.motivo}</p>}
          {typeof props.dolor === "number" && (
            <p className="text-foreground"><span className="text-muted-foreground">Dolor reportado:</span> {props.dolor}/10</p>
          )}
        </div>
        <div className="shrink-0">
          <Button size="sm" onClick={() => setOpen(true)}>
            <CalendarPlus className="h-4 w-4 mr-1.5" /> Asignar cita
          </Button>
        </div>
      </div>
      {urgente && (
        <p className="text-[11px] text-destructive">
          Valorar atención inmediata. Si el paciente reporta síntomas graves, recomendar acudir a urgencias o llamar al 911.
        </p>
      )}
      {!props.patientId && (
        <p className="text-[11px] text-orange-700 dark:text-orange-400">
          Esta conversación aún no tiene paciente asociado. Pídele datos básicos antes de asignar cita.
        </p>
      )}
      <AssignAppointmentDialog
        open={open}
        onOpenChange={setOpen}
        conversacionId={props.conversacionId}
        patientId={props.patientId}
        clinicId={props.clinicId}
      />
    </div>
  );
}
