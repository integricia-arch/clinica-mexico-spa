import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { ValidationResult } from "../lib/validateJourneyConfiguration";
import { cn } from "@/lib/utils";

export function ConfigHealthBadge({ result }: { result: ValidationResult }) {
  const map = {
    green: { Icon: CheckCircle2, text: "Configuración segura", cls: "bg-success/10 text-success border-success/30" },
    yellow: { Icon: AlertTriangle, text: "Advertencias", cls: "bg-warning/10 text-warning border-warning/30" },
    red: { Icon: XCircle, text: "Configuración inválida", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  } as const;
  const { Icon, text, cls } = map[result.status];
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium", cls)}>
      <Icon className="h-4 w-4" />
      <span>{text}</span>
      {result.issues.length > 0 && <span className="opacity-70">({result.issues.length})</span>}
    </div>
  );
}
