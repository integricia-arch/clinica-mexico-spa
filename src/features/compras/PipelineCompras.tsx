// src/features/compras/PipelineCompras.tsx
import { useMemo, useState } from "react";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { usePipelineCompras, type PipelineItem } from "@/hooks/usePipelineCompras";
import { ETAPA_LABEL, ETAPA_ORDEN, ROL_LABEL, ROL_COLOR } from "./pipelineConstants";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CircleDot, CheckCircle2 } from "lucide-react";

const fmt = (c: number | null) =>
  c == null ? "—" : (c / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function TarjetaPipeline({ item, onClick }: { item: PipelineItem; onClick: () => void }) {
  const monto =
    item.etapa === "factura" ? item.factura_total_centavos :
    item.etapa === "orden_compra" || item.etapa === "recepcion" ? item.orden_total_centavos :
    item.cotizacion_total_centavos;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border bg-card p-3 space-y-1.5 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold">{item.folio_solicitud}</span>
        {item.responsable && (
          <Badge className={`text-[10px] ${ROL_COLOR[item.responsable]}`}>
            {ROL_LABEL[item.responsable]}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground truncate">{item.solicitante_nombre ?? "—"}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{fmt(monto)}</span>
        <span className={item.atrasado ? "text-destructive font-semibold" : "text-muted-foreground"}>
          {item.diasEnEtapa}d
        </span>
      </div>
    </button>
  );
}

function StepperDetalle({ item }: { item: PipelineItem }) {
  const pasos: { label: string; fecha: string | null; quien: string | null; hecho: boolean }[] = [
    { label: "Solicitud", fecha: item.fecha_solicitud, quien: item.solicitante_nombre, hecho: true },
    { label: "Cotización", fecha: null, quien: null, hecho: item.cotizacion_id != null },
    { label: "Orden de Compra", fecha: item.aprobada_at, quien: item.aprobada_by, hecho: item.orden_id != null },
    { label: "Recepción", fecha: item.fecha_recepcion, quien: null, hecho: item.recepcion_id != null },
    { label: "Factura", fecha: null, quien: item.match_revisado_by, hecho: item.factura_id != null },
    { label: "Pago", fecha: item.fecha_pago, quien: null, hecho: item.pago_id != null },
  ];

  return (
    <div className="space-y-3">
      {pasos.map((p, i) => (
        <div key={i} className="flex items-start gap-2.5">
          {p.hecho ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
          ) : (
            <CircleDot className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium">{p.label}</p>
            <p className="text-xs text-muted-foreground">
              {p.hecho
                ? `${p.fecha ? new Date(p.fecha).toLocaleDateString("es-MX") : "—"}${p.quien ? ` · ${p.quien}` : ""}`
                : "Pendiente"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PipelineCompras() {
  const { activeClinicId } = useActiveClinic();
  const { items, completados, loading, error } = usePipelineCompras(activeClinicId);
  const [busqueda, setBusqueda] = useState("");
  const [ocultarCompletados, setOcultarCompletados] = useState(true);
  const [seleccionado, setSeleccionado] = useState<PipelineItem | null>(null);

  const itemsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.folio_solicitud.toLowerCase().includes(q) ||
        (i.solicitante_nombre ?? "").toLowerCase().includes(q)
    );
  }, [items, busqueda]);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );

  if (error) return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      Error cargando el pipeline: {error}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar folio o solicitante…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox
            checked={ocultarCompletados}
            onCheckedChange={(v) => setOcultarCompletados(v === true)}
          />
          Ocultar completados
        </label>
        {!ocultarCompletados && (
          <span className="text-xs text-muted-foreground">
            {completados} ciclo{completados !== 1 ? "s" : ""} completado{completados !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {ETAPA_ORDEN.map((etapa) => {
          const enEtapa = itemsFiltrados.filter((i) => i.etapa === etapa);
          return (
            <div key={etapa} className="rounded-xl border bg-muted/30 p-2.5 space-y-2 min-h-[120px]">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-semibold">{ETAPA_LABEL[etapa]}</h4>
                <span className="text-xs text-muted-foreground">{enEtapa.length}</span>
              </div>
              <div className="space-y-2">
                {enEtapa.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Sin trámites</p>
                ) : (
                  enEtapa.map((item) => (
                    <TarjetaPipeline
                      key={item.solicitud_id}
                      item={item}
                      onClick={() => setSeleccionado(item)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
        {ocultarCompletados ? null : (
          <div className="rounded-xl border bg-muted/30 p-2.5 space-y-2 min-h-[120px]">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-semibold">{ETAPA_LABEL.pago}</h4>
              <span className="text-xs text-muted-foreground">{completados}</span>
            </div>
            <p className="text-xs text-muted-foreground text-center py-4">
              {completados} ciclo{completados !== 1 ? "s" : ""} pagado{completados !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      <Dialog open={seleccionado != null} onOpenChange={(open) => !open && setSeleccionado(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{seleccionado?.folio_solicitud}</DialogTitle>
          </DialogHeader>
          {seleccionado && <StepperDetalle item={seleccionado} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
