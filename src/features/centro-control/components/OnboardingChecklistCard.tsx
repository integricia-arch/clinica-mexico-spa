import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, Rocket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useOnboardingChecklist } from "@/hooks/useOnboardingChecklist";

/**
 * U4 — checklist de activación. Se muestra solo mientras falte algún paso;
 * al 100% desaparece sola (no requiere dismiss manual, spec: "oculto al
 * completar 100%").
 */
export default function OnboardingChecklistCard({ clinicId }: { clinicId: string | null }) {
  const navigate = useNavigate();
  const { steps, percent, completed, loading } = useOnboardingChecklist(clinicId);

  if (loading || completed) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Primeros pasos de tu clínica</h3>
          </div>
          <span className="text-xs text-muted-foreground">{percent}% listo</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <ul className="space-y-1.5">
          {steps.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => navigate(s.href)}
                disabled={s.done}
                className="w-full flex items-center gap-2 text-left text-sm rounded-md px-2 py-1.5 hover:bg-primary/10 disabled:hover:bg-transparent disabled:cursor-default transition-colors"
              >
                {s.done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
