import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const formatMXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

type SaleItem = {
  id: string;
  medicamento_id: string;
  lote_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  nombre?: string;
  ya_devuelto?: number;
};

type ReturnLine = {
  sale_item_id: string;
  qty: number;
  max: number;
  nombre: string;
  unit_price: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  clinicId: string;
};

export function ReturnDialog({ open, onClose, clinicId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [folio, setFolio] = useState("");
  const [saleId, setSaleId] = useState<string | null>(null);
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [motivo, setMotivo] = useState("");
  const [refundMethod, setRefundMethod] = useState<string>("sin_reembolso");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function buscarVenta() {
    if (!folio.trim()) return;
    setSearching(true);
    setSaleId(null);
    setLines([]);
    try {
      // Folio = primeros 8 chars del UUID (mayúsculas)
      const prefix = folio.trim().toLowerCase();
      const { data: sales, error } = await (supabase as any)
        .from("pharmacy_sales")
        .select("id, status, total")
        .eq("clinic_id", clinicId)
        .ilike("id", `${prefix}%`)
        .eq("status", "completed")
        .limit(1);

      if (error) throw error;
      if (!sales || sales.length === 0) {
        toast({ title: "Venta no encontrada", description: "Verifica el folio e intenta de nuevo.", variant: "destructive" });
        return;
      }

      const sale = sales[0];
      setSaleId(sale.id);

      // Cargar ítems de la venta
      const { data: saleItems, error: itemsErr } = await (supabase as any)
        .from("pharmacy_sale_items")
        .select("id, medicamento_id, lote_id, quantity, unit_price, subtotal")
        .eq("sale_id", sale.id);

      if (itemsErr) throw itemsErr;

      // Cargar devoluciones previas para este sale
      const { data: prevReturns } = await (supabase as any)
        .from("pharmacy_return_items")
        .select("sale_item_id, quantity")
        .in("sale_item_id", (saleItems ?? []).map((i) => i.id));

      const prevMap: Record<string, number> = {};
      for (const r of prevReturns ?? []) {
        prevMap[r.sale_item_id] = (prevMap[r.sale_item_id] ?? 0) + r.quantity;
      }

      // Cargar nombres de medicamentos
      const medIds = [...new Set((saleItems ?? []).map((i) => i.medicamento_id))];
      const { data: meds } = await (supabase as any)
        .from("medicamentos")
        .select("id, nombre")
        .in("id", medIds);

      const medMap: Record<string, string> = {};
      for (const m of meds ?? []) medMap[m.id] = m.nombre;

      const built: ReturnLine[] = (saleItems ?? [])
        .map((si) => {
          const yaDevuelto = prevMap[si.id] ?? 0;
          const max = si.quantity - yaDevuelto;
          return {
            sale_item_id: si.id,
            qty: max > 0 ? max : 0,
            max,
            nombre: medMap[si.medicamento_id] ?? si.medicamento_id,
            unit_price: Number(si.unit_price),
          };
        })
        .filter((l) => l.max > 0);

      if (built.length === 0) {
        toast({ title: "Venta ya devuelta", description: "Todos los artículos de esta venta ya fueron devueltos." });
        setSaleId(null);
        return;
      }

      setLines(built);
    } catch (e: unknown) {
      toast({ title: "Error al buscar venta", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }

  function setLineQty(saleItemId: string, val: string) {
    const n = Math.max(0, Math.min(parseInt(val) || 0, lines.find((l) => l.sale_item_id === saleItemId)?.max ?? 0));
    setLines((prev) => prev.map((l) => l.sale_item_id === saleItemId ? { ...l, qty: n } : l));
  }

  const totalRefund = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const selectedLines = lines.filter((l) => l.qty > 0);

  async function handleSubmit() {
    if (!saleId || selectedLines.length === 0) return;
    if (!motivo.trim()) {
      toast({ title: "Motivo requerido", variant: "destructive" });
      return;
    }
    if (!user?.id) {
      toast({ title: "Sin sesión activa", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        clinic_id: clinicId,
        sale_id: saleId,
        motivo: motivo.trim(),
        refund_method: refundMethod,
        authorized_by: user.id,
        items: selectedLines.map((l) => ({ sale_item_id: l.sale_item_id, quantity: l.qty })),
      };

      const { error } = await (supabase as any).rpc("pharmacy_register_return", { p_payload: payload } as never);
      if (error) throw error;

      toast({ title: "Devolución registrada", description: `Reembolso: ${formatMXN(totalRefund)}` });
      handleClose();
    } catch (e: unknown) {
      toast({ title: "Error al registrar devolución", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setFolio("");
    setSaleId(null);
    setLines([]);
    setMotivo("");
    setRefundMethod("sin_reembolso");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar devolución</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Búsqueda por folio */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>Folio de venta</Label>
              <Input
                placeholder="Primeros 8 caracteres del folio"
                value={folio}
                onChange={(e) => setFolio(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && buscarVenta()}
              />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={buscarVenta} disabled={searching || !folio.trim()}>
                {searching ? "Buscando…" : "Buscar"}
              </Button>
            </div>
          </div>

          {/* Ítems a devolver */}
          {lines.length > 0 && (
            <div className="space-y-2">
              <Label>Artículos a devolver</Label>
              <div className="border rounded-md divide-y max-h-52 overflow-y-auto">
                {lines.map((l) => (
                  <div key={l.sale_item_id} className="flex items-center gap-3 px-3 py-2">
                    <span className="flex-1 text-sm truncate">{l.nombre}</span>
                    <span className="text-xs text-muted-foreground">{formatMXN(l.unit_price)}</span>
                    <Input
                      type="number"
                      min={0}
                      max={l.max}
                      value={l.qty}
                      onChange={(e) => setLineQty(l.sale_item_id, e.target.value)}
                      className="w-16 text-center h-7 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">/ {l.max}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm font-medium text-right">
                Total a reembolsar: {formatMXN(totalRefund)}
              </p>
            </div>
          )}

          {/* Motivo y método */}
          {saleId && (
            <>
              <div>
                <Label>Motivo de devolución</Label>
                <Input
                  placeholder="Ej. Producto equivocado, caducidad, etc."
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </div>
              <div>
                <Label>Método de reembolso</Label>
                <Select value={refundMethod} onValueChange={setRefundMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="sin_reembolso">Sin reembolso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || selectedLines.length === 0 || !motivo.trim()}
          >
            {submitting ? "Procesando…" : "Confirmar devolución"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
