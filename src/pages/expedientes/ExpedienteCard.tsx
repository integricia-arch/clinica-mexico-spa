import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, ChevronUp, Pencil, Stethoscope, FlaskConical, Users, Trash2, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PatientStudy } from "@/features/panel-doctor/services/studiesService";
import type { Expediente, NotaConsulta } from "./types";
import { TIPO_LABELS } from "./types";
import { SoapField, StudyRow } from "./studyHelpers";

export function ExpedienteCard({
  exp, expanded, notas, estudios, canWrite,
  canManagePerms, canEditExp, canDeleteExp, canRegisterStudy,
  onToggle, onManagePerms, onEdit, onDelete, onNewNota, onEditNota, onGenerateRx, onRegisterStudy,
}: {
  exp: Expediente;
  expanded: boolean;
  notas: NotaConsulta[] | undefined;
  estudios: PatientStudy[] | undefined;
  canWrite: boolean;
  canManagePerms: boolean;
  canEditExp: boolean;
  canDeleteExp: boolean;
  canRegisterStudy: boolean;
  onToggle: () => void;
  onManagePerms: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNewNota: () => void;
  onEditNota: (nota: NotaConsulta) => void;
  onGenerateRx: (nota: NotaConsulta) => void;
  onRegisterStudy: (study: PatientStudy) => void;
}) {
  const pending = (estudios ?? []).filter(
    (s) => s.status === "solicitado" || s.status === "recibido"
  ).length;

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
          {exp.patients?.nombre?.[0]}{exp.patients?.apellidos?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-card-foreground truncate">
            {exp.patients?.apellidos}, {exp.patients?.nombre}
          </p>
          <p className="text-xs text-muted-foreground">
            Dr(a). {exp.doctors?.nombre} {exp.doctors?.apellidos} · {exp.doctors?.especialidad}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {TIPO_LABELS[exp.tipo] ?? exp.tipo}
          </span>
          {exp.patients?.tipo_sangre && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              {exp.patients.tipo_sangre}
            </span>
          )}
        </div>
        <p className="hidden lg:block text-xs text-muted-foreground whitespace-nowrap">
          {format(new Date(exp.updated_at), "dd/MM/yyyy", { locale: es })}
        </p>
        {/* Action buttons — stopPropagation prevents accordion toggle */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {canManagePerms && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Gestionar acceso"
              onClick={onManagePerms}
            >
              <Users className="h-3.5 w-3.5" />
            </Button>
          )}
          {canEditExp && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Editar expediente"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {canDeleteExp && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              title="Eliminar expediente"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {pending > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning">
            <FlaskConical className="h-3 w-3" />
            {pending}
          </span>
        )}
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-border px-5 py-4 space-y-4 bg-muted/20">
          {exp.patients?.alergias && (
            <div className="rounded-lg bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-warning font-medium">
              ⚠ Alergias: {exp.patients.alergias}
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Notas de consulta (SOAP)</p>
            {canWrite && (
              <Button size="sm" variant="outline" onClick={onNewNota}>
                <Stethoscope className="mr-1.5 h-3.5 w-3.5" />Nueva nota
              </Button>
            )}
          </div>
          {!notas ? (
            <p className="text-xs text-muted-foreground">Cargando...</p>
          ) : notas.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin notas registradas</p>
          ) : (
            <div className="space-y-3">
              {notas.map((n) => (
                <div key={n.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {format(new Date(n.fecha_consulta), "dd/MM/yyyy HH:mm", { locale: es })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Dr(a). {n.doctors?.nombre} {n.doctors?.apellidos}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {n.diagnostico_principal && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {n.diagnostico_principal}
                        </span>
                      )}
                      {canWrite && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Generar receta"
                            onClick={() => onGenerateRx(n)}>
                            <FileCheck2 className="h-3.5 w-3.5 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => onEditNota(n)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {n.subjetivo && <SoapField label="S" color="text-primary" text={n.subjetivo} />}
                    {n.objetivo && <SoapField label="O" color="text-blue-600" text={n.objetivo} />}
                    {n.analisis && <SoapField label="A" color="text-orange-600" text={n.analisis} />}
                    {n.plan && <SoapField label="P" color="text-green-600" text={n.plan} />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Estudios / Laboratorio */}
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4 text-muted-foreground" />
                Estudios / Laboratorio
              </p>
            </div>
            {!estudios ? (
              <p className="text-xs text-muted-foreground">Cargando...</p>
            ) : estudios.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin estudios solicitados</p>
            ) : (
              <div className="space-y-2">
                {estudios.map((study) => (
                  <StudyRow
                    key={study.id}
                    study={study}
                    canRegister={canRegisterStudy}
                    onRegister={() => onRegisterStudy(study)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
