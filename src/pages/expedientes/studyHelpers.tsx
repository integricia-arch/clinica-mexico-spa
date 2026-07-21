import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStudyFileUrl, isStoragePath, type PatientStudy } from "@/features/panel-doctor/services/studiesService";

export function SoapField({ label, color, text }: { label: string; color: string; text: string }) {
  return (
    <div className="rounded bg-muted/50 p-2">
      <span className={`font-bold ${color}`}>{label}: </span>
      <span className="text-foreground">{text}</span>
    </div>
  );
}

const STUDY_STATUS_COLORS: Record<string, string> = {
  solicitado: "bg-warning/10 text-warning",
  recibido: "bg-blue-500/10 text-blue-600",
  revisado: "bg-success/10 text-success",
  reutilizado: "bg-muted text-muted-foreground",
  descartado: "bg-muted text-muted-foreground",
};

const STUDY_STATUS_LABELS: Record<string, string> = {
  solicitado: "Pendiente",
  recibido: "Resultado recibido",
  revisado: "Revisado",
  reutilizado: "Reutilizado",
  descartado: "Descartado",
};

const STUDY_TIPO_LABELS: Record<string, string> = {
  lab: "Lab",
  imagen: "Imagen",
  otro: "Otro",
};

export function StudyRow({
  study,
  canRegister,
  onRegister,
}: {
  study: PatientStudy;
  canRegister: boolean;
  onRegister: () => void;
}) {
  const handleOpenFile = async () => {
    if (!study.archivo_url) return;
    try {
      const url = await getStudyFileUrl(study.archivo_url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      /* silently ignore — UI shows no error for read-only view */
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-card-foreground truncate">{study.nombre}</p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
            {STUDY_TIPO_LABELS[study.tipo] ?? study.tipo}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STUDY_STATUS_COLORS[study.status] ?? "bg-muted text-muted-foreground"}`}
          >
            {STUDY_STATUS_LABELS[study.status] ?? study.status}
          </span>
        </div>
        {study.motivo && (
          <p className="text-xs text-muted-foreground truncate">{study.motivo}</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          Solicitado: {format(new Date(study.solicitado_at), "dd/MM/yyyy HH:mm", { locale: es })}
          {study.prioridad !== "rutina" && (
            <span className="ml-2 font-semibold text-destructive uppercase">{study.prioridad}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {study.archivo_url && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={isStoragePath(study.archivo_url) ? "Ver archivo (nube)" : "Ver archivo"}
            onClick={handleOpenFile}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
        {canRegister && study.status === "solicitado" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={onRegister}
          >
            Registrar resultado
          </Button>
        )}
      </div>
    </div>
  );
}
