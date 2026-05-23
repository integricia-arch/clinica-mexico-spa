import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Item {
  id: string;
  appointment_id: string;
  programado_para: string;
  status: string;
  tipo: string;
  paciente?: string;
  vencido: boolean;
}

export default function SeguimientosPendientes({ items, onOpenInbox }: { items: Item[]; onOpenInbox: () => void }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-display font-semibold text-foreground">Seguimientos pendientes</h2>
          <p className="text-xs text-muted-foreground">Recordatorios y seguimientos programados</p>
        </div>
        <Badge variant="outline">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Sin seguimientos programados</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 8).map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <div className="flex items-start gap-2 min-w-0">
                <Bell className={`h-4 w-4 mt-0.5 ${it.vencido ? "text-destructive" : "text-info"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{it.paciente ?? "Paciente"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(it.programado_para), "dd MMM HH:mm", { locale: es })} · {it.tipo}
                    {it.vencido && <span className="ml-1 text-destructive">vencido</span>}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="h-7" onClick={onOpenInbox}>Abrir</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
