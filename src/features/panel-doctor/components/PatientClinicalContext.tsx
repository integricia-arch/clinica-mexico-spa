import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, differenceInYears } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, FlaskConical, Pill, FileText, Phone, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import PatientJourneyLine from "@/features/camino-paciente/components/PatientJourneyLine";
import { useJourneyInstance } from "@/features/camino-paciente/hooks/useJourneyInstance";
import DoctorActionPanel from "./DoctorActionPanel";
import type { DoctorQueueItem } from "../hooks/useDoctorQueue";
import type { PatientSnapshot } from "../hooks/usePatientClinicalSnapshot";

interface Props {
  item: DoctorQueueItem;
  snapshot: PatientSnapshot;
  doctorId: string | null;
}

export default function PatientClinicalContext({ item, snapshot, doctorId }: Props) {
  const { patient, notas, recetas, studies } = snapshot;
  const journey = useJourneyInstance(item.journey_instance_id);

  const edad = useMemo(() => {
    if (!patient?.fecha_nacimiento) return null;
    try {
      return differenceInYears(new Date(), new Date(patient.fecha_nacimiento));
    } catch {
      return null;
    }
  }, [patient?.fecha_nacimiento]);

  const alergiasConfirmadas = !!(patient?.alergias && patient.alergias.trim());
  const studiesPendientes = studies.filter((s) => s.status === "solicitado").length;
  const studiesParaRevisar = studies.filter((s) => s.status === "recibido").length;

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Ficha */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-display text-lg font-semibold truncate">
                {patient ? `${patient.nombre} ${patient.apellidos}` : "Sin paciente"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
                {edad !== null && <span>{edad} años</span>}
                {patient?.sexo && <span className="capitalize">{patient.sexo}</span>}
                {patient?.telefono && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {patient.telefono}
                  </span>
                )}
                {patient?.tipo_sangre && <Badge variant="outline" className="text-[10px]">Sangre {patient.tipo_sangre}</Badge>}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{format(new Date(item.fecha_inicio), "EEEE d MMM · HH:mm", { locale: es })}</p>
              <p>{item.servicio_nombre ?? "Sin servicio"} · {item.room_nombre ?? "Sin consultorio"}</p>
            </div>
          </div>

          {!alergiasConfirmadas && (
            <Alert variant="destructive" className="mt-3 py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Debe confirmar alergias antes de recetar.
              </AlertDescription>
            </Alert>
          )}
          {alergiasConfirmadas && (
            <p className="mt-3 text-xs">
              <span className="font-medium text-destructive">Alergias: </span>
              <span className="text-foreground">{patient.alergias}</span>
            </p>
          )}
          {patient?.contacto_emergencia_nombre && (
            <p className="mt-1 text-xs text-muted-foreground">
              <User className="inline h-3 w-3 mr-1" />
              Contacto emergencia: {patient.contacto_emergencia_nombre} · {patient.contacto_emergencia_telefono ?? "—"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Línea del camino */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Camino del paciente
            </h3>
            {journey.instance && (
              <span className="text-[11px] text-muted-foreground">
                {(journey.instance.snapshot_json as any)?.progress_percent ?? 0}% avance
              </span>
            )}
          </div>
          <PatientJourneyLine
            journeyInstance={journey.instance as any}
            templateSteps={journey.steps as any}
            showLabels
          />
        </CardContent>
      </Card>

      {doctorId && <DoctorActionPanel item={item} doctorId={doctorId} snapshot={snapshot} />}

      {/* Tabs clínicos */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0">
          <Tabs defaultValue="antecedentes" className="h-full">
            <TabsList className="w-full justify-start rounded-none border-b px-2">
              <TabsTrigger value="antecedentes" className="text-xs">Antecedentes</TabsTrigger>
              <TabsTrigger value="estudios" className="text-xs">
                Estudios {studies.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{studies.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="recetas" className="text-xs">
                Recetas {recetas.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{recetas.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="notas" className="text-xs">
                Notas {notas.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{notas.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="antecedentes" className="m-0">
              <ScrollArea className="h-64 px-4 py-3">
                <Section label="Antecedentes y notas generales">
                  {patient?.notas?.trim() ?? <Empty>Sin antecedentes registrados</Empty>}
                </Section>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="estudios" className="m-0">
              <ScrollArea className="h-64 px-4 py-3">
                {studies.length === 0 ? (
                  <Empty>Sin estudios previos</Empty>
                ) : (
                  <ul className="space-y-2">
                    {studies.map((s) => (
                      <li key={s.id} className="rounded-md border border-border p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            <FlaskConical className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                            {s.nombre}
                          </span>
                          <Badge variant="outline" className="text-[10px] capitalize">{s.status}</Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {format(new Date(s.solicitado_at), "dd MMM yyyy", { locale: es })} · {s.tipo} · {s.prioridad}
                        </p>
                        {s.resultado_resumen && (
                          <p className="mt-1 text-xs text-foreground line-clamp-2">{s.resultado_resumen}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="recetas" className="m-0">
              <ScrollArea className="h-64 px-4 py-3">
                {recetas.length === 0 ? (
                  <Empty>Sin recetas previas</Empty>
                ) : (
                  <ul className="space-y-2">
                    {recetas.map((r) => (
                      <li key={r.id} className="rounded-md border border-border p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            <Pill className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                            {r.prescription_number}
                          </span>
                          <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {format(new Date(r.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                        </p>
                        {r.diagnosis && <p className="mt-1 text-xs text-foreground line-clamp-1">{r.diagnosis}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="notas" className="m-0">
              <ScrollArea className="h-64 px-4 py-3">
                {notas.length === 0 ? (
                  <Empty>Sin notas clínicas previas</Empty>
                ) : (
                  <ul className="space-y-2">
                    {notas.map((n) => (
                      <li key={n.id} className="rounded-md border border-border p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            <FileText className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                            {n.diagnostico_principal ?? "Nota de consulta"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(n.fecha_consulta), "dd MMM yyyy", { locale: es })}
                          </span>
                        </div>
                        {n.subjetivo && <p className="mt-1 text-xs line-clamp-2 text-foreground">{n.subjetivo}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {(studiesPendientes > 0 || studiesParaRevisar > 0) && (
        <div className="flex gap-2 text-[11px]">
          {studiesPendientes > 0 && (
            <Badge variant="outline" className="border-warning text-warning">
              {studiesPendientes} análisis pendiente{studiesPendientes !== 1 && "s"}
            </Badge>
          )}
          {studiesParaRevisar > 0 && (
            <Badge variant="outline" className="border-info text-info">
              {studiesParaRevisar} resultado{studiesParaRevisar !== 1 && "s"} por revisar
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground whitespace-pre-wrap">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground italic">{children}</p>;
}
