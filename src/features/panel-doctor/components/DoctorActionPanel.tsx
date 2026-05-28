import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Stethoscope, FlaskConical, FileText, Pill, CheckCircle2,
  CreditCard, LogOut, CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/errors";
import NotaConsultaModal from "@/components/NotaConsultaModal";
import PrescriptionEditorModal from "@/features/recetas/components/PrescriptionEditorModal";
import RequestStudyDrawer from "./RequestStudyDrawer";
import FollowupDrawer from "./FollowupDrawer";
import StudyResultDrawer from "./StudyResultDrawer";
import { ensureExpediente } from "../services/ensureExpediente";
import { advancePatientJourneyFromClinicalEvent } from "@/features/camino-paciente/services/clinicalEvents";
import type { DoctorQueueItem } from "../hooks/useDoctorQueue";
import type { PatientSnapshot } from "../hooks/usePatientClinicalSnapshot";
import type { PatientStudy } from "../services/studiesService";

interface Props {
  item: DoctorQueueItem;
  doctorId: string;
  snapshot: PatientSnapshot;
}

export default function DoctorActionPanel({ item, doctorId, snapshot }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const patientId = item.patient?.id ?? null;
  const journeyId = item.journey_instance_id;
  const [expedienteId, setExpedienteId] = useState<string | null>(snapshot.expediente?.id ?? null);
  const [openingConsulta, setOpeningConsulta] = useState(false);
  const [notaOpen, setNotaOpen] = useState(false);
  const [rxOpen, setRxOpen] = useState(false);
  const [studyOpen, setStudyOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const [resultStudy, setResultStudy] = useState<PatientStudy | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const expId = expedienteId ?? snapshot.expediente?.id ?? null;
  const latestNota = snapshot.notas[0] ?? null;

  const ensureExp = async (): Promise<string | null> => {
    if (!patientId) return null;
    if (expId) return expId;
    const id = await ensureExpediente(patientId, doctorId);
    setExpedienteId(id);
    return id;
  };

  const openConsulta = async () => {
    if (!patientId || !journeyId) return;
    setOpeningConsulta(true);
    try {
      await ensureExp();
      await advancePatientJourneyFromClinicalEvent("consultation_opened", {
        journey_instance_id: journeyId,
      });
      setNotaOpen(true);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: friendlyError(e) });
    } finally {
      setOpeningConsulta(false);
    }
  };

  const triggerEvent = async (event: any, label: string) => {
    if (!journeyId) return;
    setBusy(label);
    try {
      const r = await advancePatientJourneyFromClinicalEvent(event, { journey_instance_id: journeyId });
      if (!r.ok) throw new Error(r.error);
      toast({ title: label });
      snapshot.reload();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  };

  if (!patientId || !journeyId) {
    return (
      <Card><CardContent className="p-4 text-xs text-muted-foreground">Cita sin paciente o sin camino del paciente.</CardContent></Card>
    );
  }

  const studiesRecibidos = snapshot.studies.filter((s) => s.status === "recibido");

  return (
    <>
      <Card>
        <CardContent className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acciones clínicas</h3>
            <button
              className="text-[11px] text-primary hover:underline disabled:opacity-50"
              disabled={!journeyId}
              onClick={() => journeyId && navigate(`/camino-paciente/${journeyId}`)}
            >
              Ver camino completo →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ActionBtn icon={Stethoscope} label="Abrir consulta" onClick={openConsulta} loading={openingConsulta} />
            <ActionBtn icon={FileText} label={latestNota ? "Editar nota SOAP" : "Nueva nota SOAP"} onClick={async () => { await ensureExp(); setNotaOpen(true); }} />
            <ActionBtn icon={FlaskConical} label="Solicitar análisis" onClick={async () => { await ensureExp(); setStudyOpen(true); }} />
            <ActionBtn icon={Pill} label="Emitir receta" onClick={async () => { await ensureExp(); setRxOpen(true); }} />
            <ActionBtn icon={CheckCircle2} label="Cerrar consulta" onClick={() => triggerEvent("consultation_closed", "Consulta cerrada")} loading={busy === "Consulta cerrada"} />
            <ActionBtn icon={CreditCard} label="Enviar a pago" onClick={() => triggerEvent("patient_sent_to_billing", "Enviado a pago")} loading={busy === "Enviado a pago"} />
            <ActionBtn icon={LogOut} label="Dar de alta" onClick={() => triggerEvent("patient_discharged", "Alta registrada")} loading={busy === "Alta registrada"} />
            <ActionBtn icon={CalendarClock} label="Programar seguimiento" onClick={() => setFollowOpen(true)} />
          </div>

          {studiesRecibidos.length > 0 && (
            <div className="mt-3 rounded-md border border-info/30 bg-info/5 p-2.5">
              <p className="text-[11px] font-semibold text-info mb-1.5">Resultados pendientes de revisión</p>
              <div className="flex flex-wrap gap-1.5">
                {studiesRecibidos.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setResultStudy(s)}
                    className="rounded bg-background border border-info/30 px-2 py-0.5 text-[11px] hover:bg-info/10"
                  >
                    {s.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {expId && (
        <NotaConsultaModal
          open={notaOpen}
          onClose={() => setNotaOpen(false)}
          expedienteId={expId}
          doctorId={doctorId}
          nota={latestNota}
          onSaved={async (saved) => {
            if (journeyId) {
              await advancePatientJourneyFromClinicalEvent("consultation_note_saved", {
                journey_instance_id: journeyId,
                consultation_note_id: saved?.id,
              });
            }
            snapshot.reload();
          }}
        />
      )}

      {expId && (
        <PrescriptionEditorModal
          open={rxOpen}
          onClose={() => setRxOpen(false)}
          patientId={patientId}
          doctorId={doctorId}
          expedienteId={expId}
          consultationNoteId={latestNota?.id}
          appointmentId={item.appointment_id}
          journeyInstanceId={journeyId}
          diagnosis={latestNota?.diagnostico_principal}
          onIssued={async (prescriptionId) => {
            if (journeyId) {
              await advancePatientJourneyFromClinicalEvent("prescription_issued", {
                journey_instance_id: journeyId,
                prescription_id: prescriptionId,
              });
            }
            snapshot.reload();
          }}
        />
      )}

      <RequestStudyDrawer
        open={studyOpen}
        onClose={() => setStudyOpen(false)}
        patientId={patientId}
        doctorId={doctorId}
        appointmentId={item.appointment_id}
        journeyInstanceId={journeyId}
        expedienteId={expId}
        onCreated={() => snapshot.reload()}
      />

      <FollowupDrawer
        open={followOpen}
        onClose={() => setFollowOpen(false)}
        patientId={patientId}
        journeyInstanceId={journeyId}
        onCreated={() => snapshot.reload()}
      />

      <StudyResultDrawer
        open={!!resultStudy}
        onClose={() => setResultStudy(null)}
        study={resultStudy}
        journeyInstanceId={journeyId}
        onSaved={() => snapshot.reload()}
      />
    </>
  );
}

function ActionBtn({
  icon: Icon, label, onClick, loading,
}: { icon: any; label: string; onClick: () => void; loading?: boolean }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={loading}
      className="h-auto flex-col gap-1 py-2.5 text-[11px] leading-tight"
    >
      <Icon className="h-4 w-4" />
      <span className="text-center">{label}</span>
    </Button>
  );
}
