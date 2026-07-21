import { Minus, TrendingUp, TrendingDown } from "lucide-react";

export const fmt = (n: number) =>
  Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}

export function DiffBadge({ diff }: { diff: number | null }) {
  if (diff === null) return <span className="text-muted-foreground text-xs">—</span>;
  const Icon = diff === 0 ? Minus : diff > 0 ? TrendingUp : TrendingDown;
  const cls = diff === 0 ? "text-green-600" : diff > 0 ? "text-amber-600" : "text-red-600";
  return (
    <span className={`flex items-center gap-1 font-medium text-sm ${cls}`}>
      <Icon className="h-3.5 w-3.5" /> {fmt(diff)}
    </span>
  );
}

export const ACTION_LABELS: Record<string, { label: string; tone: string }> = {
  linked_existing: { label: "Reutilizó corte abierto", tone: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/20" },
  created_new: { label: "Creó corte de farmacia", tone: "text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/20" },
  skipped_not_pharmacy: { label: "Caja no es de farmacia", tone: "text-muted-foreground bg-muted" },
  blocked_close_pharmacy_open: { label: "Cierre bloqueado: corte farmacia abierto", tone: "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/20" },
  manual_link: { label: "Enlace manual", tone: "text-blue-700 bg-blue-50" },
  manual_unlink: { label: "Desenlace manual", tone: "text-amber-700 bg-amber-50" },
};
