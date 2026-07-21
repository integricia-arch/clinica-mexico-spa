import { useState } from "react";
import { FileBarChart2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { fmt, ResultRow } from "./shared";

interface CorteXResult {
  folio: number;
  opening_amount: number;
  cash_cobros: number;
  fondos_net: number;
  expected_cash: number;
  tickets: number;
  tarjeta_total: number;
  transf_total: number;
  otros_total: number;
  total_general: number;
}

export function CorteXDialog({
  open, turnoId, onClose,
}: {
  open: boolean; turnoId: string | null; onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CorteXResult | null>(null);

  async function generate() {
    if (!turnoId) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("turno_corte_x", { p_turno_id: turnoId } as never);
    setLoading(false);
    if (error) { toast.error(`Error: ${error.message}`); return; }
    setResult(data as unknown as CorteXResult);
  }

  function handleClose() { setResult(null); onClose(); }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBarChart2 className="h-4 w-4" /> Corte X — Reporte parcial
          </DialogTitle>
        </DialogHeader>
        {!result ? (
          <>
            <p className="text-sm text-muted-foreground py-2">
              Genera un snapshot del estado actual del turno sin cerrarlo.
              El turno seguirá activo después del Corte X.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={generate} disabled={loading}>
                {loading ? "Generando…" : "Generar Corte X"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3 py-1">
              <p className="text-xs text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20 rounded-md px-3 py-2 font-medium">
                Corte X generado — Folio X-{String(result.folio).padStart(6, "0")}
              </p>
              {/* Desglose por método de pago */}
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-1 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Cobros por método de pago</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <ResultRow label="Efectivo" value={fmt(result.cash_cobros)} />
                  <ResultRow label="Tarjeta" value={fmt(result.tarjeta_total)} />
                  <ResultRow label="Transferencia" value={fmt(result.transf_total)} />
                  {result.otros_total > 0 && <ResultRow label="Otros" value={fmt(result.otros_total)} />}
                </div>
                <div className="border-t border-border mt-2 pt-2 flex justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground">Total cobrado</span>
                  <span className="font-semibold text-sm">{fmt(result.total_general)}</span>
                </div>
              </div>
              {/* Cuadre efectivo */}
              <div className="rounded-lg border border-border bg-muted/40 p-4 grid grid-cols-2 gap-2 text-sm">
                <ResultRow label="Fondo apertura" value={fmt(result.opening_amount)} />
                <ResultRow label="Neto fondos manuales" value={fmt(result.fondos_net)} />
                <ResultRow label="Efectivo esperado en caja" value={fmt(result.expected_cash)} />
                <ResultRow label="Tickets" value={String(result.tickets)} />
              </div>
              <p className="text-xs text-muted-foreground">El turno permanece abierto. Este reporte es informativo.</p>
            </div>
            <DialogFooter><Button onClick={handleClose}>Cerrar</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
