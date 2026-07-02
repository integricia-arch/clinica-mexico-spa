import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function FaltantesPanel() {
  const { toast } = useToast();
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loadingAlertas, setLoadingAlertas] = useState(false);
  const [filtroAlertas, setFiltroAlertas] = useState<"pending" | "resolved" | "external">("pending");

  const loadAlertas = useCallback(async () => {
    setLoadingAlertas(true);
    const { data } = await supabase
      .from("almacen_alertas" as never)
      .select("*, medicamentos(nombre)")
      .eq("status", filtroAlertas)
      .order("created_at", { ascending: false })
      .limit(100);
    setAlertas((data as any[]) ?? []);
    setLoadingAlertas(false);
  }, [filtroAlertas]);

  useEffect(() => { loadAlertas(); }, [loadAlertas]);

  async function resolveAlerta(id: string, newStatus: "resolved" | "external") {
    const { error } = await supabase
      .from("almacen_alertas" as never)
      .update({ status: newStatus, resolved_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    setAlertas((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Bitácora de faltantes</h2>
        <div className="flex gap-1">
          {(["pending", "resolved", "external"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFiltroAlertas(s)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${filtroAlertas === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
            >
              {s === "pending" ? "Pendientes" : s === "resolved" ? "Resueltos" : "Externos"}
            </button>
          ))}
        </div>
      </div>
      {loadingAlertas ? (
        <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : alertas.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <AlertTriangle className="mx-auto h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">Sin alertas {filtroAlertas === "pending" ? "pendientes" : filtroAlertas === "resolved" ? "resueltas" : "externas"}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Medicamento</th>
                <th className="px-4 py-2 text-center font-medium">Solicitado</th>
                <th className="px-4 py-2 text-center font-medium">Disponible</th>
                <th className="px-4 py-2 text-center font-medium">Diferencia</th>
                <th className="px-4 py-2 text-left font-medium">Fecha</th>
                {filtroAlertas === "pending" && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {alertas.map((a: any) => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2 font-medium">{a.medicamentos?.nombre ?? a.generic_name ?? "Sin nombre"}</td>
                  <td className="px-4 py-2 text-center">{a.quantity_needed}</td>
                  <td className="px-4 py-2 text-center text-destructive">{a.quantity_available}</td>
                  <td className="px-4 py-2 text-center font-semibold text-destructive">-{a.quantity_needed - a.quantity_available}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</td>
                  {filtroAlertas === "pending" && (
                    <td className="px-4 py-2">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resolveAlerta(a.id, "external")}>Externo</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50" onClick={() => resolveAlerta(a.id, "resolved")}>Recibido</Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
