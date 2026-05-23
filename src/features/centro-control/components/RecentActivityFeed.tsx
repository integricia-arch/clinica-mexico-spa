import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const TABLE_LABEL: Record<string, string> = {
  appointments: "Cita",
  patients: "Paciente",
  expedientes: "Expediente",
  notas_consulta: "Nota de consulta",
  medicamentos: "Medicamento",
  movimientos_inventario: "Movimiento de farmacia",
  recordatorios_cita: "Recordatorio",
  journey_instances: "Camino del paciente",
};

const ACCION_LABEL: Record<string, string> = {
  crear: "creó", actualizar: "actualizó", eliminar: "eliminó",
};

export default function RecentActivityFeed({ items }: { items: any[] }) {
  return (
    <Card className="p-5">
      <div className="mb-3">
        <h2 className="text-display font-semibold text-foreground">Actividad reciente</h2>
        <p className="text-xs text-muted-foreground">Últimos eventos operativos (resumen seguro)</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Sin actividad reciente</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 20).map((it) => (
            <li key={it.id} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-foreground">
                  Se {ACCION_LABEL[it.accion] ?? it.accion} {TABLE_LABEL[it.tabla] ?? it.tabla}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {format(new Date(it.created_at), "dd MMM HH:mm", { locale: es })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
