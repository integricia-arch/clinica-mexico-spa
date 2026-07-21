import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { usePipelineCompras } from "@/hooks/usePipelineCompras";
import { ROL_LABEL, ROL_COLOR } from "@/features/compras/pipelineConstants";

export function TabCompras() {
  const { activeClinicId } = useActiveClinic();
  const { items, loading } = usePipelineCompras(activeClinicId);

  const atrasados = items.filter((i) => i.atrasado);

  const porRol = (["compras", "gerencia", "almacen", "finanzas"] as const).map((rol) => ({
    rol,
    count: atrasados.filter((i) => i.responsable === rol).length,
  }));
  const maxRol = Math.max(...porRol.map((r) => r.count), 1);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cuellos de botella — trámites atrasados por responsable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {atrasados.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sin trámites atrasados</p>
          ) : (
            porRol
              .filter((r) => r.count > 0)
              .sort((a, b) => b.count - a.count)
              .map((r) => (
                <div key={r.rol} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <Badge className={ROL_COLOR[r.rol]}>{ROL_LABEL[r.rol]}</Badge>
                    <span className="font-semibold">{r.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-destructive"
                      style={{ width: `${(r.count / maxRol) * 100}%` }}
                    />
                  </div>
                </div>
              ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Trámites activos por etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {items.length} trámite{items.length !== 1 ? "s" : ""} en curso,{" "}
            {atrasados.length} atrasado{atrasados.length !== 1 ? "s" : ""}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
