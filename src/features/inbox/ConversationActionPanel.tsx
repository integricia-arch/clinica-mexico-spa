import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarPlus, AlertTriangle, UserPlus } from "lucide-react";
import { AssignAppointmentDialog } from "./AssignAppointmentDialog";
import { QuickPatientDialog } from "./QuickPatientDialog";

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

export function ConversationActionPanel(props: Props) {
  const [openAssign, setOpenAssign] = useState(false);
  const [openPatient, setOpenPatient] = useState(false);
  const urgente = props.prioridad === "urgente";
  const sinPaciente = !props.patientId;

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
        <div className="shrink-0 flex flex-col gap-2">
          {sinPaciente ? (
            <Button size="sm" onClick={() => setOpenPatient(true)}>
              <UserPlus className="h-4 w-4 mr-1.5" /> Crear/asociar paciente
            </Button>
          ) : (
            <Button size="sm" onClick={() => setOpenAssign(true)}>
              <CalendarPlus className="h-4 w-4 mr-1.5" /> Asignar cita
            </Button>
          )}
        </div>
      </div>
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
