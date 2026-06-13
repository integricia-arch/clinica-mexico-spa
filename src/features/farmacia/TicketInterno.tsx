import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const PRINT_CSS = `@media print {
  body * { visibility: hidden; }
  #pos-ticket-print, #pos-ticket-print * { visibility: visible; }
  #pos-ticket-print { position: absolute; left: 0; top: 0; width: 80mm; }
}`;

const formatMXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export type TicketPaymentLine = {
  method: "efectivo" | "tarjeta" | "transferencia";
  amount: number;
  card_brand?: string | null;
  card_last4?: string | null;
  authorization_code?: string | null;
  terminal_id?: string | null;
  transfer_reference?: string | null;
  bank_name?: string | null;
  monto_recibido?: number | null;
  cambio_entregado?: number | null;
};

export type TicketData = {
  folio: string;
  fecha: Date;
  cajero: string;
  clinica: string;
  cliente: string;
  paciente?: string | null;
  recetaFolio?: string | null;
  metodoPago: string;
  payments?: TicketPaymentLine[];
  items: { nombre: string; cantidad: number; precio: number }[];
  subtotal: number;
  descuento: number;
  total: number;
  totalIva?: number;
  baseGravable?: number;
  exento?: number;
};

export function TicketInterno({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: TicketData | null;
}) {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (!data) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Ticket interno</DialogTitle>
        </DialogHeader>
        <div id="pos-ticket-print" className="font-mono text-xs space-y-2 bg-background p-3 rounded border overflow-y-auto flex-1">
          <div className="text-center space-y-0.5">
            <p className="font-semibold text-sm">{data.clinica}</p>
            <p className="text-muted-foreground">Comprobante interno · no es CFDI</p>
          </div>
          <div className="border-t border-dashed pt-2 space-y-0.5">
            <p>Folio: {data.folio}</p>
            <p>{format(data.fecha, "dd/MM/yyyy HH:mm", { locale: es })}</p>
            <p>Cajero: {data.cajero}</p>
            <p>Cliente: {data.cliente}</p>
            {data.paciente && <p>Paciente: {data.paciente}</p>}
            {data.recetaFolio && <p>Receta: {data.recetaFolio}</p>}
          </div>
          <div className="border-t border-dashed pt-2 space-y-1">
            {data.items.map((it, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="truncate">{it.cantidad}× {it.nombre}</span>
                <span>{formatMXN(it.cantidad * it.precio)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed pt-2 space-y-0.5">
            {data.descuento > 0 && (
              <>
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatMXN(data.subtotal)}</span></div>
                <div className="flex justify-between"><span>Descuento</span><span>-{formatMXN(data.descuento)}</span></div>
              </>
            )}
            <div className="flex justify-between font-semibold text-sm">
              <span>Total</span><span>{formatMXN(data.total)}</span>
            </div>
            {/* Desglose IVA */}
            {(data.baseGravable != null || data.exento != null || data.totalIva != null) && (
              <div className="border-t border-dashed pt-1 mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                {data.baseGravable != null && data.baseGravable > 0 && (
                  <div className="flex justify-between"><span>Base gravable 16%</span><span>{formatMXN(data.baseGravable)}</span></div>
                )}
                {data.totalIva != null && data.totalIva > 0 && (
                  <div className="flex justify-between"><span>IVA 16%</span><span>{formatMXN(data.totalIva)}</span></div>
                )}
                {data.exento != null && data.exento > 0 && (
                  <div className="flex justify-between"><span>Exento</span><span>{formatMXN(data.exento)}</span></div>
                )}
              </div>
            )}
            <p className="pt-0.5">Pago: {data.metodoPago}</p>
          </div>
          {data.payments && data.payments.length > 0 && (
            <div className="border-t border-dashed pt-2 space-y-0.5">
              {data.payments.map((p, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span className="capitalize">{p.method}</span>
                    <span>{formatMXN(p.amount)}</span>
                  </div>
                  {p.method === "efectivo" && p.monto_recibido != null && p.monto_recibido > p.amount && (
                    <p className="pl-2 text-[10px] opacity-80">
                      Recibió: {formatMXN(p.monto_recibido)} · Cambio: {formatMXN(p.cambio_entregado ?? (p.monto_recibido - p.amount))}
                    </p>
                  )}
                  {p.method === "tarjeta" && (
                    <p className="pl-2 text-[10px] opacity-80">
                      {p.card_brand ?? ""} ****{p.card_last4 ?? "----"}
                      {p.authorization_code ? ` · aut ${p.authorization_code}` : ""}
                      {p.terminal_id ? ` · ${p.terminal_id}` : ""}
                    </p>
                  )}
                  {p.method === "transferencia" && (
                    <p className="pl-2 text-[10px] opacity-80">
                      ref {p.transfer_reference ?? "—"}{p.bank_name ? ` · ${p.bank_name}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-center text-muted-foreground pt-1">¡Gracias por su compra!</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button onClick={() => window.print()}>Imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
