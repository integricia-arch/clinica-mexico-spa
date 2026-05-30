import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
  if (!data) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ticket interno</DialogTitle>
        </DialogHeader>
        <div id="pos-ticket-print" className="font-mono text-xs space-y-2 bg-background p-3 rounded border">
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
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMXN(data.subtotal)}</span></div>
            {data.descuento > 0 && (
              <div className="flex justify-between"><span>Descuento</span><span>-{formatMXN(data.descuento)}</span></div>
            )}
            <div className="flex justify-between font-semibold text-sm">
              <span>Total</span><span>{formatMXN(data.total)}</span>
            </div>
            <p>Pago: {data.metodoPago}</p>
          </div>
          <p className="text-center text-muted-foreground pt-1">¡Gracias por su compra!</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button onClick={() => window.print()}>Imprimir</Button>
        </DialogFooter>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #pos-ticket-print, #pos-ticket-print * { visibility: visible; }
            #pos-ticket-print { position: absolute; left: 0; top: 0; width: 80mm; }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
