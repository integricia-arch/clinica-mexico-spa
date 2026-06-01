import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Plus, Search, ShoppingCart, Trash2, Lock, Package } from "lucide-react";
import { format } from "date-fns";
import { friendlyError } from "@/lib/errors";

const formatMXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

type Med = {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  precio_unitario: number;
  activo: boolean;
  sale_type: string;
  is_controlled: boolean;
  requires_prescription: boolean;
  allow_direct_sale: boolean;
  regulatory_notes: string | null;
};

type Lote = {
  id: string;
  medicamento_id: string;
  numero_lote: string;
  fecha_caducidad: string;
  fecha_entrada: string;
  existencia: number;
};

type CartItem = {
  med: Med;
  lote: Lote;
  quantity: number;
  unit_price: number;
  discount: number;
};

type ClienteTipo = "publico" | "paciente";

const PAYMENT_METHODS = ["Efectivo", "Tarjeta débito", "Tarjeta crédito", "Transferencia"];

export default function VentaDirecta() {
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const canSell = hasRole("admin") || hasRole("nurse") || hasRole("receptionist");

  const [meds, setMeds] = useState<Med[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState("0");
  const [payment, setPayment] = useState<string>("Efectivo");
  const [requiresInvoice, setRequiresInvoice] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [clienteTipo, setClienteTipo] = useState<ClienteTipo>("publico");
  const [customerName, setCustomerName] = useState("Público general");
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState<{ id: string; nombre: string; apellidos: string }[]>([]);
  const [patientId, setPatientId] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: m }, { data: l }] = await Promise.all([
        supabase.from("medicamentos").select("*").eq("activo", true).order("nombre"),
        supabase.from("lotes_medicamento").select("*").gt("existencia", 0).order("fecha_entrada"),
      ]);
      setMeds((m as Med[]) ?? []);
      setLotes((l as Lote[]) ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (clienteTipo !== "paciente" || patientSearch.trim().length < 2) {
      setPatients([]);
      return;
    }
    const t = setTimeout(async () => {
      const q = patientSearch.trim().replace(/[%(),]/g, "");
      if (!q) return;
      const { data } = await supabase
        .from("patients")
        .select("id, nombre, apellidos")
        .or(`nombre.ilike.%${q}%,apellidos.ilike.%${q}%`)
        .limit(8);
      setPatients(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [patientSearch, clienteTipo]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return meds.slice(0, 25);
    return meds.filter(
      (m) =>
        m.nombre.toLowerCase().includes(q) ||
        m.categoria.toLowerCase().includes(q),
    ).slice(0, 25);
  }, [meds, search]);

  const today = new Date().toISOString().slice(0, 10);

  function fifoLote(medId: string, qty: number): Lote | null {
    const opts = lotes
      .filter((l) => l.medicamento_id === medId && l.existencia >= qty && l.fecha_caducidad >= today)
      .sort((a, b) => {
        const e = a.fecha_entrada.localeCompare(b.fecha_entrada);
        return e !== 0 ? e : a.fecha_caducidad.localeCompare(b.fecha_caducidad);
      });
    return opts[0] ?? null;
  }

  function blockReason(m: Med): string | null {
    if (m.is_controlled || m.sale_type === "controlado") {
      return "Medicamento sujeto a control sanitario. Requiere validación regulatoria y receta correspondiente.";
    }
    if (m.requires_prescription || !m.allow_direct_sale) {
      return "Este medicamento requiere receta médica para su venta.";
    }
    return null;
  }

  function addToCart(m: Med) {
    const reason = blockReason(m);
    if (reason) {
      toast({ title: "Venta directa no permitida", description: reason, variant: "destructive" });
      return;
    }
    const lote = fifoLote(m.id, 1);
    if (!lote) {
      toast({ title: "Sin existencia", description: `No hay lote disponible no vencido para ${m.nombre}`, variant: "destructive" });
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.med.id === m.id && c.lote.id === lote.id);
      if (existing) {
        if (existing.quantity + 1 > lote.existencia) {
          toast({ title: "Existencia insuficiente", variant: "destructive" });
          return prev;
        }
        return prev.map((c) => (c === existing ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { med: m, lote, quantity: 1, unit_price: m.precio_unitario, discount: 0 }];
    });
  }

  function updateQty(idx: number, qty: number) {
    setCart((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const max = c.lote.existencia;
        const q = Math.max(1, Math.min(qty, max));
        return { ...c, quantity: q };
      }),
    );
  }

  function updateDisc(idx: number, d: number) {
    setCart((prev) => prev.map((c, i) => (i === idx ? { ...c, discount: Math.max(0, d) } : c)));
  }

  function removeItem(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = cart.reduce((s, c) => s + c.quantity * c.unit_price, 0);
  const itemsDiscount = cart.reduce((s, c) => s + c.discount, 0);
  const globalDiscount = Number(discount) || 0;
  const total = Math.max(0, subtotal - itemsDiscount - globalDiscount);

  async function submitSale() {
    if (!canSell) return;
    if (cart.length === 0) {
      toast({ title: "Agrega al menos un artículo", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const payload = {
      sale_type: "direct_sale",
      patient_id: clienteTipo === "paciente" ? patientId || null : null,
      customer_name: clienteTipo === "publico" ? (customerName || "Público general") : null,
      payment_method: payment,
      payment_status: "paid",
      requires_invoice: requiresInvoice,
      notes: notes || null,
      discount: globalDiscount,
      items: cart.map((c) => ({
        medicamento_id: c.med.id,
        lote_id: c.lote.id,
        quantity: c.quantity,
        unit_price: c.unit_price,
        discount: c.discount,
      })),
    };
    const { data, error } = await supabase.rpc("pharmacy_register_sale", { p_payload: payload as never });
    setSubmitting(false);
    if (error) {
      toast({ title: "No se pudo registrar la venta", description: friendlyError(error), variant: "destructive" });
      return;
    }
    toast({ title: "Venta registrada", description: `Folio ${String(data).slice(0, 8)} · ${formatMXN(total)}` });
    setCart([]);
    setDiscount("0");
    setNotes("");
    setRequiresInvoice(false);
    setPatientId("");
    setPatientSearch("");
    setCustomerName("Público general");
    // refresh lotes
    const { data: l } = await supabase
      .from("lotes_medicamento")
      .select("*")
      .gt("existencia", 0)
      .order("fecha_entrada");
    setLotes((l as Lote[]) ?? []);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      {/* Catálogo */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar producto por nombre o categoría…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {filtered.map((m) => {
              const reason = blockReason(m);
              const lote = fifoLote(m.id, 1);
              const stock = lotes
                .filter((l) => l.medicamento_id === m.id && l.fecha_caducidad >= today)
                .reduce((s, l) => s + l.existencia, 0);
              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm leading-tight">{m.nombre}</p>
                      <p className="text-xs text-muted-foreground">{m.categoria}</p>
                    </div>
                    <p className="text-sm font-semibold">{formatMXN(m.precio_unitario)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {reason ? (
                      <Badge variant="destructive" className="gap-1">
                        <Lock className="h-3 w-3" />
                        {m.is_controlled ? "Controlado" : "Requiere receta"}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">OTC</Badge>
                    )}
                    <Badge variant="outline">Stock: {stock}</Badge>
                    {lote && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        Lote {lote.numero_lote} · cad {format(new Date(lote.fecha_caducidad), "dd/MM/yy")}
                      </Badge>
                    )}
                  </div>
                  {reason && (
                    <p className="text-[11px] text-destructive flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {reason}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant={reason ? "outline" : "default"}
                    className="w-full"
                    disabled={!!reason || !lote || !canSell}
                    onClick={() => addToCart(m)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Agregar
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Carrito */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4 lg:sticky lg:top-4 self-start">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          <h3 className="font-semibold">Venta directa</h3>
        </div>

        {/* Cliente */}
        <div className="space-y-2">
          <Label className="text-xs">Cliente</Label>
          <Select value={clienteTipo} onValueChange={(v) => setClienteTipo(v as ClienteTipo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="publico">Público general</SelectItem>
              <SelectItem value="paciente">Paciente existente</SelectItem>
            </SelectContent>
          </Select>
          {clienteTipo === "publico" ? (
            <Input
              placeholder="Nombre del cliente (opcional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          ) : (
            <>
              <Input
                placeholder="Buscar paciente por nombre…"
                value={patientSearch}
                onChange={(e) => { setPatientSearch(e.target.value); setPatientId(""); }}
              />
              {patients.length > 0 && !patientId && (
                <div className="rounded-md border border-border bg-background max-h-40 overflow-auto">
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPatientId(p.id);
                        setPatientSearch(`${p.nombre} ${p.apellidos}`);
                        setPatients([]);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                    >
                      {p.nombre} {p.apellidos}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Items */}
        <div className="space-y-2 max-h-[40vh] overflow-auto">
          {cart.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Sin artículos
            </p>
          ) : (
            cart.map((c, i) => (
              <div key={i} className="rounded-md border border-border p-2 space-y-1">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-xs font-medium leading-tight">{c.med.nombre}</p>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Lote {c.lote.numero_lote} (FIFO)
                </p>
                <div className="grid grid-cols-3 gap-1">
                  <Input
                    type="number"
                    min={1}
                    max={c.lote.existencia}
                    value={c.quantity}
                    onChange={(e) => updateQty(i, Number(e.target.value))}
                    className="h-8 text-xs"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={c.discount}
                    onChange={(e) => updateDisc(i, Number(e.target.value))}
                    placeholder="Desc"
                    className="h-8 text-xs"
                  />
                  <p className="text-xs text-right self-center">
                    {formatMXN(c.quantity * c.unit_price - c.discount)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totales */}
        <div className="space-y-2 border-t pt-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMXN(subtotal)}</span></div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Descuentos en partidas</span>
            <span>-{formatMXN(itemsDiscount)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Descuento global</Label>
            <Input
              type="number"
              min={0}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="h-8 w-24 text-right text-xs"
            />
          </div>
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span>{formatMXN(total)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Método de pago</Label>
          <Select value={payment} onValueChange={setPayment}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={requiresInvoice}
              onChange={(e) => setRequiresInvoice(e.target.checked)}
            />
            Requiere factura (CFDI futuro)
          </label>
          <Textarea
            placeholder="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        <Button
          className="w-full"
          disabled={cart.length === 0 || submitting || !canSell}
          onClick={submitSale}
        >
          {submitting ? "Registrando…" : `Cobrar ${formatMXN(total)}`}
        </Button>
        {!canSell && (
          <p className="text-[11px] text-muted-foreground text-center">
            Tu rol no tiene permiso para registrar ventas.
          </p>
        )}
      </div>
    </div>
  );
}
