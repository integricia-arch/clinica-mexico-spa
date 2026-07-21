import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function fmtMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

export function pctDelta(current: number, prev: number): number {
  if (prev === 0) return 0;
  return Math.round(((current - prev) / prev) * 100);
}

export function tickDia(v: string): string {
  try { return format(new Date(v + "T12:00:00"), "d/M"); } catch { return v; }
}

export const ORIGEN_LABELS: Record<string, string> = {
  web: "Web",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  bot: "Bot",
  walk_in: "Presencial",
  directo: "Directo",
  desconocido: "Desconocido",
};

export const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface KpiCardProps {
  title: string;
  value: string | number;
  prev?: number;
  current?: number;
  icon: ReactNode;
  iconBg: string;
  suffix?: string;
  lowIsBetter?: boolean;
}

export function KpiCard({ title, value, prev, current, icon, iconBg, suffix, lowIsBetter }: KpiCardProps) {
  const delta = prev !== undefined && current !== undefined ? pctDelta(current, prev) : null;
  const isPositive = delta === null ? true : lowIsBetter ? delta <= 0 : delta >= 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold mt-0.5">
              {value}
              {suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
            </p>
            {delta !== null && (
              <p className={`flex items-center gap-1 text-xs mt-1 ${isPositive ? "text-green-600" : "text-red-600"}`}>
                {isPositive
                  ? <TrendingUp className="h-3 w-3" />
                  : <TrendingDown className="h-3 w-3" />}
                {Math.abs(delta)}% vs período ant.
              </p>
            )}
          </div>
          <div className={`shrink-0 rounded-lg p-2 ${iconBg}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ChartSkeleton() {
  return <Skeleton className="h-64 w-full rounded-xl" />;
}
