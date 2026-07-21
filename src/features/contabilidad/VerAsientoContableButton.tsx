import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
import { PolizaDetalleDialog, type PolizaAgrupada } from "@/features/contabilidad/PolizaDetalleDialog";
import type { LibroDiarioFila } from "@/hooks/useReportesContables";

function fmtMXN(centavos: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(centavos / 100);
}

function agrupar(rows: LibroDiarioFila[]): PolizaAgrupada | null {
  if (rows.length === 0) return null;
  const r0 = rows[0];
  return {
    poliza_id: r0.poliza_id, folio: r0.folio, tipo: r0.tipo, fecha: r0.fecha, concepto: r0.concepto,
    uuid_cfdi: r0.uuid_cfdi, estado: r0.estado, reference_type: r0.reference_type, reference_id: r0.reference_id,
    lineas: rows,
    debe: rows.reduce((s, r) => s + r.debe_centavos, 0),
    haber: rows.reduce((s, r) => s + r.haber_centavos, 0),
  };
}

interface MovimientoSimple { descripcion: string | null; monto_centavos: number; fecha_devengo: string }

// Fase 3 del plan de trazabilidad: botón reusable para pantallas operativas
// (Citas, Farmacia, Compras). Resuelve el asiento vía contab_resolver_asiento y
// muestra el detalle — como póliza formal (PolizaDetalleDialog) o, si el trámite
// solo vive en devengo simple (aún sin póliza), una tarjeta de solo lectura.
export function VerAsientoContableButton({ referenceType, referenceId }: { referenceType: string; referenceId: string }) {
  const [loading, setLoading] = useState(false);
  const [poliza, setPoliza] = useState<PolizaAgrupada | null>(null);
  const [movimiento, setMovimiento] = useState<MovimientoSimple | null>(null);
  const [sinAsiento, setSinAsiento] = useState(false);

  const abrir = async () => {
    setLoading(true);
    setSinAsiento(false);
    const { data: resuelto, error: errResolver } = await (supabase as any).rpc("contab_resolver_asiento", {
      p_reference_type: referenceType, p_reference_id: referenceId,
    });
    if (errResolver) { setLoading(false); toast.error(friendlyError(errResolver, "No se pudo resolver el asiento contable.")); return; }
    if (!resuelto) { setLoading(false); setSinAsiento(true); return; }

    if (resuelto.tipo === "poliza") {
      const { data: lineas, error: errDetalle } = await (supabase as any).rpc("poliza_detalle", { p_poliza_id: resuelto.id });
      setLoading(false);
      if (errDetalle) { toast.error(friendlyError(errDetalle, "No se pudo cargar el detalle de la póliza.")); return; }
      setPoliza(agrupar((lineas ?? []) as LibroDiarioFila[]));
      return;
    }

    const { data: mov, error: errMov } = await (supabase as any)
      .from("movimientos_contables")
      .select("descripcion, monto_centavos, fecha_devengo")
      .eq("id", resuelto.id)
      .maybeSingle();
    setLoading(false);
    if (errMov) { toast.error(friendlyError(errMov, "No se pudo cargar el movimiento contable.")); return; }
    setMovimiento(mov as MovimientoSimple);
  };

  return (
    <>
      <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={abrir} disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Ver asiento contable
      </Button>

      <PolizaDetalleDialog poliza={poliza} onOpenChange={(open) => { if (!open) setPoliza(null); }} onCancelar={() => {}} cancelando={false} />

      <Dialog open={!!movimiento} onOpenChange={(open) => { if (!open) setMovimiento(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Movimiento contable (devengo simple)</DialogTitle></DialogHeader>
          {movimiento && (
            <div className="space-y-1 text-sm">
              <p><span className="font-medium">Fecha:</span> {movimiento.fecha_devengo}</p>
              <p><span className="font-medium">Descripción:</span> {movimiento.descripcion ?? "—"}</p>
              <p><span className="font-medium">Monto:</span> {fmtMXN(Math.abs(movimiento.monto_centavos))}</p>
              <p className="text-xs text-muted-foreground pt-1">
                Este trámite todavía no tiene póliza de partida doble asociada — ver
                "Validar cuadre" en Contabilidad → Reportes para generarla.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={sinAsiento} onOpenChange={setSinAsiento}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Sin asiento contable</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Este trámite todavía no generó ningún movimiento contable.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
