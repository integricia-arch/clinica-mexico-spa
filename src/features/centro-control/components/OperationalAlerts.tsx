import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, AlertOctagon } from "lucide-react";
import { useState } from "react";

export type AlertLevel = "info" | "advertencia" | "critica";

export interface OperationalAlert {
  id: string;
  level: AlertLevel;
  paciente?: string;
  doctor?: string;
  motivo: string;
  accion?: string;
  navigateTo?: string;
}

const LEVEL: Record<AlertLevel, { cls: string; Icon: typeof Info; label: string }> = {
  info: { cls: "bg-info/10 text-info border-info/30", Icon: Info, label: "Info" },
  advertencia: { cls: "bg-warning/10 text-warning border-warning/30", Icon: AlertTriangle, label: "Advertencia" },
  critica: { cls: "bg-destructive/10 text-destructive border-destructive/30", Icon: AlertOctagon, label: "Crítica" },
};

export default function OperationalAlerts({ alerts, onNavigate }: { alerts: OperationalAlert[]; onNavigate: (path: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? alerts : alerts.slice(0, 5);

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-display font-semibold text-foreground">Alertas y riesgos</h2>
          <p className="text-xs text-muted-foreground">Acciones requeridas en la operación</p>
        </div>
        <Badge variant="outline">{alerts.length}</Badge>
      </div>
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Sin alertas en este momento</p>
      ) : (
        <>
          <div className="space-y-2">
            {visible.map((a) => {
              const L = LEVEL[a.level];
              return (
                <div key={a.id} className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${L.cls}`}>
                  <L.Icon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{a.motivo}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.paciente && <>Paciente: {a.paciente}</>}
                      {a.doctor && <> · Médico: {a.doctor}</>}
                    </p>
                    {a.accion && <p className="text-[11px] mt-0.5">→ {a.accion}</p>}
                  </div>
                  {a.navigateTo && (
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => onNavigate(a.navigateTo!)}>
                      Abrir
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          {alerts.length > 5 && (
            <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Ver menos" : `Ver más (${alerts.length - 5})`}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
