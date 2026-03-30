import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
}

export default function StatCard({ title, value, change, changeType = "neutral", icon: Icon }: StatCardProps) {
  const changeColor =
    changeType === "positive"
      ? "text-success"
      : changeType === "negative"
      ? "text-destructive"
      : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <p className="mt-2 text-display text-2xl font-bold text-card-foreground">{value}</p>
      {change && (
        <p className={`mt-1 text-xs font-medium ${changeColor}`}>{change}</p>
      )}
    </div>
  );
}
