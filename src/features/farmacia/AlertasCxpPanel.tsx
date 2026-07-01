import { useState } from "react";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useAuth } from "@/hooks/useAuth";
import { useCxpAlertas, type CxpAlerta } from "@/hooks/useCxpAlertas";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

const SEVERIDAD_BADGE: Record<CxpAlerta["severidad"], { label: string; className: string }> = {
  critica: { label: "Crítica", className: "bg-red-100 text-red-700 border-red-300" },
  alta:    { label: "Alta",    className: "bg-orange-100 text-orange-700 border-orange-300" },
  media:   { label: "Media",   className: "bg-amber-100 text-amber-700 border-amber-300" },
  baja:    { label: "Baja",    className: "bg-slate-100 text-slate-700 border-slate-300" },
};

const TIPO_LABEL: Record<CxpAlerta["tipo"], string> = {
  duplicado: "Factura duplicada",
  limite_excedido: "Límite de crédito excedido",
  clabe_sin_verificar: "CLABE sin verificar",
  vencimiento_hoy: "Vencimiento hoy",
  pago_sin_gr: "Pago sin GR verificada",
  fraccionamiento_sospechoso: "Fraccionamiento sospechoso",
};

export default function AlertasCxpPanel() {
  const { activeClinicId } = useActiveClinic();
  const { user } = useAuth();
  const { toast } = useToast();
  const { pendientes, loading, error, resolver } = useCxpAlertas(activeClinicId);
  const [resolving, setResolving] = useState<string | null>(null);

  const handleResolver = async (id: string) => {
    if (!user) return;
    setResolving(id);
    try {
      await resolver(id, user.id);
      toast({ title: "Alerta resuelta" });
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    } finally {
      setResolving(null);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando alertas…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (pendientes.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Sin alertas pendientes de CxP.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-destructive" />
        <h4 className="text-sm font-semibold">Alertas de Cuentas por Pagar ({pendientes.length})</h4>
      </div>
      {pendientes.map((a) => {
        const sev = SEVERIDAD_BADGE[a.severidad];
        return (
          <div key={a.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-xs ${sev.className}`}>{sev.label}</Badge>
                <span className="text-sm font-medium">{TIPO_LABEL[a.tipo]}</span>
                {a.proveedor_nombre && <span className="text-xs text-muted-foreground">{a.proveedor_nombre}</span>}
                {a.factura_folio && <span className="text-xs text-muted-foreground font-mono">{a.factura_folio}</span>}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{a.descripcion}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(a.created_at), "dd/MM/yy HH:mm")}</p>
            </div>
            <Button size="sm" variant="outline" disabled={resolving === a.id} onClick={() => handleResolver(a.id)}>
              {resolving === a.id ? "…" : "Resolver"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
