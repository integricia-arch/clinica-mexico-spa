import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { KanbanRow } from "./PatientJourneyCard";
import {
  getJourneyStageColor, getJourneyStageLabel, getPatientNextAction,
  getPatientOperationalRisk, riskBadgeClass,
} from "../lib/journeyHelpers";
import { FileText, Calendar as CalIcon, Pill, Receipt, MessageSquare, ShieldCheck } from "lucide-react";
import PatientJourneyLine from "@/features/camino-paciente/components/PatientJourneyLine";

interface Props {
  row: KanbanRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNavigate: (path: string) => void;
  canViewClinical: boolean;
}

export default function PatientOperationalDrawer({ row, open, onOpenChange, onNavigate, canViewClinical }: Props) {
  if (!row) return null;
  const { appointment, patient, doctor, room, instance } = row;
  const stage = getJourneyStageColor(instance?.status);
  const risk = getPatientOperationalRisk(row);
  const stepKey = instance?.snapshot_json?.current_step_key ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{patient ? `${patient.nombre} ${patient.apellidos}` : "Paciente"}</SheetTitle>
          <SheetDescription>Detalle operativo del paciente y su cita</SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Camino del paciente</h3>
              <Badge variant="outline" className={`${stage.bg} ${stage.text} border-0`}>{stage.label}</Badge>
            </div>
            <div className="rounded-lg border border-border p-4">
              <PatientJourneyLine journeyInstance={instance} showLabels showProgress />
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Datos básicos</h3>
            <div className="rounded-lg border border-border p-3 text-sm space-y-1">
              {patient?.telefono && <p><span className="text-muted-foreground">Tel:</span> {patient.telefono}</p>}
              {patient?.email && <p><span className="text-muted-foreground">Email:</span> {patient.email}</p>}
              {canViewClinical && patient?.alergias && (
                <p><span className="text-muted-foreground">Alergias:</span> {patient.alergias}</p>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Cita</h3>
            <div className="rounded-lg border border-border p-3 text-sm space-y-1">
              <p><CalIcon className="inline h-3.5 w-3.5 mr-1" />{format(new Date(appointment.fecha_inicio), "dd MMM yyyy · HH:mm", { locale: es })}</p>
              {doctor && <p>Dr(a). {doctor.nombre} {doctor.apellidos}</p>}
              {room && <p>Consultorio: {room.nombre}</p>}
              {appointment.motivo_consulta && <p className="text-muted-foreground">Motivo: {appointment.motivo_consulta}</p>}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Camino del paciente</h3>
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${stage.bg} ${stage.text} border-0`}>{stage.label}</Badge>
                {stepKey && <Badge variant="outline">{getJourneyStageLabel(stepKey)}</Badge>}
                <Badge variant="outline" className={riskBadgeClass(risk)}>Riesgo {risk}</Badge>
              </div>
              <p className="text-sm">→ {getPatientNextAction(row)}</p>
              <div className="text-[11px] text-muted-foreground space-y-0.5">
                <p className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Consentimiento: {row.hasConsentimiento ? "registrado" : "pendiente"}</p>
                <p className="flex items-center gap-1"><FileText className="h-3 w-3" /> Expediente: {row.hasExpediente ? "activo" : "sin crear"}</p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Acciones</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => onNavigate(`/cita/${appointment.id}`)}>
                <CalIcon className="h-4 w-4" />Abrir cita
              </Button>
              <Button variant="outline" size="sm" onClick={() => onNavigate("/expedientes")}>
                <FileText className="h-4 w-4" />Expediente
              </Button>
              <Button variant="outline" size="sm" onClick={() => onNavigate("/farmacia")}>
                <Pill className="h-4 w-4" />Farmacia
              </Button>
              <Button variant="outline" size="sm" onClick={() => onNavigate("/facturacion")}>
                <Receipt className="h-4 w-4" />Facturación
              </Button>
              <Button variant="outline" size="sm" onClick={() => onNavigate("/inbox")}>
                <MessageSquare className="h-4 w-4" />Conversación
              </Button>
              <Button variant="outline" size="sm" onClick={() => onNavigate("/auditoria")}>
                <ShieldCheck className="h-4 w-4" />Auditoría
              </Button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
