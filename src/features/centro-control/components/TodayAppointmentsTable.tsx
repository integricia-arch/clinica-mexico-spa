import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { KanbanRow } from "./PatientJourneyCard";
import { getJourneyStageColor, getPatientNextAction } from "../lib/journeyHelpers";
import PatientJourneyLine from "@/features/camino-paciente/components/PatientJourneyLine";
import { buildJourneyLineSteps, journeyProgress } from "@/features/camino-paciente/lib/buildJourneyLineSteps";

interface Props {
  rows: KanbanRow[];
  onOpenRow: (row: KanbanRow) => void;
  onNavigate: (path: string) => void;
  onStartJourney: (row: KanbanRow) => void;
}

const STATUS_LABEL: Record<string, string> = {
  solicitada: "Solicitada", confirmada: "Confirmada", confirmada_paciente: "Conf. paciente",
  confirmada_medico: "Conf. médico", cancelada: "Cancelada", pendiente_formulario: "Pend. formulario",
  tentativa: "Tentativa", recordatorio_enviado: "Recordatorio", liberada: "Liberada",
};

export default function TodayAppointmentsTable({ rows, onOpenRow, onNavigate, onStartJourney }: Props) {
  return (
    <Card>
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-display font-semibold text-card-foreground">Agenda y citas del día</h2>
      </div>
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Sin citas para la fecha seleccionada</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Hora</th>
                <th className="px-5 py-3 font-medium">Paciente</th>
                <th className="px-5 py-3 font-medium">Médico</th>
                <th className="px-5 py-3 font-medium">Consultorio</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Etapa</th>
                <th className="px-5 py-3 font-medium">Próxima acción</th>
                <th className="px-5 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = getJourneyStageColor(r.instance?.status);
                return (
                  <tr key={r.appointment.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-5 py-3 font-medium">
                      {format(new Date(r.appointment.fecha_inicio), "HH:mm", { locale: es })}
                    </td>
                    <td className="px-5 py-3">{r.patient ? `${r.patient.nombre} ${r.patient.apellidos}` : "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {r.doctor ? `Dr(a). ${r.doctor.nombre} ${r.doctor.apellidos}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{r.room?.nombre ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Badge variant="outline" className="text-[11px]">
                        {STATUS_LABEL[r.appointment.status] ?? r.appointment.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {r.instance ? (
                        <Badge variant="outline" className={`${st.bg} ${st.text} border-0 text-[11px]`}>{st.label}</Badge>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Sin camino iniciado</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-foreground">{getPatientNextAction(r)}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {!r.instance && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onStartJourney(r)}>
                          Iniciar camino
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOpenRow(r)}>Ver</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onNavigate(`/cita/${r.appointment.id}`)}>Cita</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
