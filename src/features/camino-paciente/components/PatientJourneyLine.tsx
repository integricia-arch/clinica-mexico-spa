import { Fragment } from "react";
import { Check, AlertOctagon, AlertTriangle, Shield, MinusCircle, Circle, Play } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  buildJourneyLineSteps, journeyProgress, type JourneyLineStep, type StepStatus,
} from "../lib/buildJourneyLineSteps";
import type { JourneyInstanceLite } from "../lib/journeyHelpers";

interface Props {
  journeyInstance: JourneyInstanceLite | null;
  templateSteps?: any[] | null;
  compact?: boolean;
  showLabels?: boolean;
  showProgress?: boolean;
  onStepClick?: (step: JourneyLineStep) => void;
  onStepDoubleClick?: (step: JourneyLineStep) => void;
  onStart?: () => void;
  className?: string;
}

const STATUS_STYLE: Record<StepStatus, { node: string; line: string; icon: any; label: string }> = {
  completed: { node: "bg-success text-white border-success", line: "bg-success", icon: Check, label: "Completado" },
  current:   { node: "bg-info text-white border-info ring-4 ring-info/20 animate-pulse-soft", line: "bg-muted", icon: Play, label: "Actual" },
  pending:   { node: "bg-background text-muted-foreground border-border", line: "bg-muted", icon: Circle, label: "Pendiente" },
  blocked:   { node: "bg-destructive/10 text-destructive border-destructive", line: "bg-muted", icon: AlertOctagon, label: "Bloqueado" },
  review:    { node: "bg-warning/10 text-warning border-warning", line: "bg-muted", icon: AlertTriangle, label: "Revisión" },
  override:  { node: "bg-purple-500/10 text-purple-500 border-purple-500", line: "bg-muted", icon: Shield, label: "Override" },
  skipped:   { node: "bg-background text-muted-foreground border-dashed border-border", line: "bg-muted", icon: MinusCircle, label: "N/A" },
};

export default function PatientJourneyLine({
  journeyInstance, templateSteps, compact = false, showLabels = true, showProgress = false,
  onStepClick, onStepDoubleClick, onStart, className,
}: Props) {
  if (!journeyInstance) {
    return (
      <div className={cn("flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3", className)}>
        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40">
          <Circle className="h-3 w-3 text-muted-foreground" />
        </div>
        <span className="text-xs text-muted-foreground flex-1">Sin camino iniciado</span>
        {onStart && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onStart}>
            Iniciar camino
          </Button>
        )}
      </div>
    );
  }

  const steps = buildJourneyLineSteps(journeyInstance, templateSteps);
  const progress = journeyProgress(steps);
  const nodeSize = compact ? "h-5 w-5" : "h-7 w-7";
  const iconSize = compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5";

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn("w-full", className)}>
        {showProgress && (
          <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Avance</span>
            <span className="font-medium text-foreground">{progress.label}</span>
          </div>
        )}
        <div className="overflow-x-auto pb-1">
          <div className="flex items-start min-w-max" role="list" aria-label="Camino del paciente">
            {steps.map((step, i) => {
              const style = STATUS_STYLE[step.status];
              const Icon = style.icon;
              const isLast = i === steps.length - 1;
              return (
                <Fragment key={step.key}>
                  <div className="flex flex-col items-center" role="listitem">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={`${step.fullLabel}: ${style.label}`}
                          className={cn(
                            "flex items-center justify-center rounded-full border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                            nodeSize, style.node,
                            step.isCurrent && (compact ? "h-6 w-6" : "h-8 w-8"),
                            "hover:scale-110 cursor-pointer",
                          )}
                          onClick={() => onStepClick?.(step)}
                          onDoubleClick={() => onStepDoubleClick?.(step)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") onStepDoubleClick?.(step);
                            else if (e.key === " ") { e.preventDefault(); onStepClick?.(step); }
                          }}
                        >
                          <Icon className={iconSize} strokeWidth={2.5} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                        <p className="font-semibold">{step.fullLabel}</p>
                        <p className="text-muted-foreground">{style.label}</p>
                        {step.responsibleName && <p>Responsable: {step.responsibleName}</p>}
                        {step.startedAt && <p>Inicio: {format(new Date(step.startedAt), "dd MMM HH:mm", { locale: es })}</p>}
                        {step.completedAt && <p>Fin: {format(new Date(step.completedAt), "dd MMM HH:mm", { locale: es })}</p>}
                        {step.blockedReason && <p className="text-destructive">Bloqueo: {step.blockedReason}</p>}
                        {step.nextAction && <p className="text-info">→ {step.nextAction}</p>}
                      </TooltipContent>
                    </Tooltip>
                    {showLabels && !compact && (
                      <span className={cn(
                        "mt-1.5 text-[10px] text-center leading-tight w-16 truncate",
                        step.isCurrent ? "text-info font-semibold" :
                        step.isCompleted ? "text-foreground" :
                        step.isBlocked ? "text-destructive font-medium" :
                        "text-muted-foreground",
                      )}>
                        {step.label}
                      </span>
                    )}
                  </div>
                  {!isLast && (
                    <div className={cn(
                      "flex-1 mt-3 mx-1 transition-colors",
                      compact ? "h-0.5 min-w-[20px]" : "h-0.5 min-w-[28px]",
                      steps[i].isCompleted ? "bg-success" : "bg-muted",
                    )} />
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
