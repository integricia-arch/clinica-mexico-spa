import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: "default" | "info" | "warning" | "destructive" | "success" | "purple";
  hint?: string;
}

const variantClasses: Record<string, string> = {
  default: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
  purple: "bg-purple-500/10 text-purple-500",
};

export default function OperationalStatCard({ title, value, icon: Icon, variant = "default", hint }: Props) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {value === 0 ? (hint ?? "Sin datos registrados todavía") : (hint ?? " ")}
          </p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", variantClasses[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
