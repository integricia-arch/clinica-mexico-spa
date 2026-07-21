import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HeatmapCell } from "@/hooks/useBI";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HORAS_INICIO = 7;
const HORAS_FIN = 21;

export function CitasHeatmap({ heatmap }: { heatmap: HeatmapCell[] }) {
  const maxCount = Math.max(1, ...heatmap.map(c => c.count));
  const cellMap = new Map<string, number>();
  heatmap.forEach(c => cellMap.set(`${c.hora}-${c.dia}`, c.count));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Citas por hora y día</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `40px repeat(7, 1fr)` }}>
            <div />
            {DIAS.map(d => (
              <div key={d} className="text-center text-[10px] text-muted-foreground font-medium pb-1">{d}</div>
            ))}
            {Array.from({ length: HORAS_FIN - HORAS_INICIO }, (_, i) => {
              const hora = HORAS_INICIO + i;
              const label = hora < 12 ? `${hora}am` : hora === 12 ? "12pm" : `${hora - 12}pm`;
              return [
                <div key={`h-${hora}`} className="text-[10px] text-muted-foreground text-right pr-1.5 leading-5">{label}</div>,
                ...Array.from({ length: 7 }, (_, dia) => {
                  const count = cellMap.get(`${hora}-${dia}`) ?? 0;
                  const intensity = count / maxCount;
                  const bg = count === 0
                    ? "bg-muted"
                    : intensity < 0.25
                    ? "bg-blue-100"
                    : intensity < 0.5
                    ? "bg-blue-300"
                    : intensity < 0.75
                    ? "bg-blue-500"
                    : "bg-blue-700";
                  return (
                    <div
                      key={`${hora}-${dia}`}
                      className={`h-5 rounded-sm ${bg} cursor-default`}
                      title={count > 0 ? `${DIAS[dia]} ${label}: ${count} citas` : undefined}
                    />
                  );
                }),
              ];
            })}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[10px] text-muted-foreground">Menos</span>
            {["bg-muted", "bg-blue-100", "bg-blue-300", "bg-blue-500", "bg-blue-700"].map(c => (
              <div key={c} className={`h-3 w-5 rounded-sm ${c}`} />
            ))}
            <span className="text-[10px] text-muted-foreground">Más</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
