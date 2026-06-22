import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  variant?: "default" | "warning" | "destructive" | "success";
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  index?: number;
}

export default function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  index = 0,
}: StatCardProps) {
  const changeColor =
    changeType === "positive"
      ? "text-success"
      : changeType === "negative"
      ? "text-destructive"
      : "text-muted-foreground";

  const dotColor =
    changeType === "positive"
      ? "bg-emerald-500"
      : changeType === "negative"
      ? "bg-red-400"
      : "";

  const staggerClass = `stat-card-${Math.min(index + 1, 4)}`;

  return (
    <div
      className={[
        "group relative rounded-xl bg-card p-5 cursor-default",
        staggerClass,
        "shadow-[0_1px_2px_hsl(222_47%_7%/0.05),0_4px_16px_hsl(222_47%_7%/0.04),inset_0_0.5px_0_hsl(0_0%_100%/0.85),inset_0_0_0_1px_hsl(228_20%_91%)]",
        "transition-[transform,box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
        "hover:-translate-y-[2px]",
        "hover:shadow-[0_4px_24px_hsl(222_47%_7%/0.10),0_8px_40px_hsl(222_47%_7%/0.06),inset_0_0.5px_0_hsl(0_0%_100%/0.90),inset_0_0_0_1px_hsl(228_20%_88%)]",
        "active:scale-[0.99] active:translate-y-0",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            "bg-gradient-to-br from-indigo-500/14 to-indigo-500/7",
            "border border-indigo-500/[0.14]",
            "text-indigo-500",
            "shadow-[0_2px_8px_hsl(239_84%_62%/0.10)]",
            "transition-shadow duration-200",
            "group-hover:shadow-[0_4px_12px_hsl(239_84%_62%/0.18)]",
          ].join(" ")}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-foreground [font-variant-numeric:tabular-nums] tracking-tight">
        {value}
      </p>
      {change && (
        <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${changeColor}`}>
          {changeType !== "neutral" && dotColor && (
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
          )}
          {change}
        </p>
      )}
    </div>
  );
}
