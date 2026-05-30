/**
 * Punto de Venta — Farmacia
 *
 * Liga futura con almacén:
 * Cada venta crea registros en `pharmacy_sales` + `pharmacy_sale_items`
 * y un movimiento en `movimientos_inventario` (movement_type=salida_venta o
 * salida_surtido_receta, reference_type='pharmacy_sale', reference_id=sale_id).
 * El módulo de almacén futuro debe consumir `movimientos_inventario` como
 * fuente única de entradas, salidas, compras, ajustes, ventas y surtidos.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ScanLine, Plus, Minus, Trash2, AlertTriangle, Lock, ShoppingCart,
  Clock, Building2, User as UserIcon, PauseCircle, XCircle, Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { friendlyError } from "@/lib/errors";
import { posPermissions, blockReasonForDirectSale, isPrescriptionScan, DEMO_INFO_LEGEND, type Med } from "./permissions";
import { TicketInterno, type TicketData, type TicketPaymentLine } from "./TicketInterno";
import { PaymentCapture, emptyBreakdown, validatePayment, paymentsToRows, looksLikeFullCardNumber, type PaymentBreakdown } from "./PaymentCapture";

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

const PAYMENT_METHODS = ["efectivo", "tarjeta", "transferencia", "mixto", "pendiente"] as const;
const PAYMENT_LABEL: Record<typeof PAYMENT_METHODS[number], string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  mixto: "Mixto",
  pendiente: "Pendiente",
};

const formatMXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

async function logPosAudit(
  clinicId: string | null,
  event: string,
  data: Record<string, unknown>,
  registroId: string | null = null,
) {
  try {
    await supabase.from("audit_logs").insert({
      accion: "consultar",
      tabla: "pharmacy_sales",
      registro_id: registroId,
      clinic_id: clinicId,
      datos_nuevos: { event, ...data },
    } as never);
  } catch {
    /* best-effort */
  }
}

export default function PuntoDeVenta({
  onScanPrescription,
}: {
  onScanPrescription?: (code: string) => void;
}) {
  const { user, roles } = useAuth();
  const { activeClinic, activeClinicId } = useActiveClinic();
  const { toast } = useToast();
  const perms = posPermissions(roles);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [meds, setMeds] = useState<Med[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);

  const [scanText, setScanText] = useState("");
  const [matches, setMatches] = useState<Med[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState("0");
  const [payment, setPayment] = useState<typeof PAYMENT_METHODS[number]>("efectivo");
  const [requiresInvoice, setRequiresInvoice] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [clienteTipo, setClienteTipo] = useState<"publico" | "paciente">("publico");
  const [customerName, setCustomerName] = useState("Público general");
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState<{ id: string; nombre: string; apellidos: string }[]>([]);
  const [patientId, setPatientId] = useState<string>("");

  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const [breakdown, setBreakdown] = useState<PaymentBreakdown>(() => emptyBreakdown(0));

  useEffect(() => {
    inputRef.current?.focus();
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
      const q = patientSearch.trim();
      const { data } = await supabase
        .from("patients")
        .select("id, nombre, apellidos")
        .or(`nombre.ilike.%${q}%,apellidos.ilike.%${q}%`)
        .limit(8);
      setPatients(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [patientSearch, clienteTipo]);

  const today = new Date().toISOString().slice(0, 10);

  function fifoLote(medId: string, qty: number): Lote | null {
    return lotes
      .filter((l) => l.medicamento_id === medId && l.existencia >= qty && l.fecha_caducidad >= today)
      .sort((a, b) => a.fecha_entrada.localeCompare(b.fecha_entrada) || a.fecha_caducidad.localeCompare(b.fecha_caducidad))[0] ?? null;
  }

  function stockOf(medId: string) {
    return lotes
      .filter((l) => l.medicamento_id === medId && l.fecha_caducidad >= today)
      .reduce((s, l) => s + l.existencia, 0);
  }

  // TODO: cambiar a "más vendidos" cuando exista índice de ventas frecuentes.
  const frecuentes = useMemo(() => meds.slice(0, 12), [meds]);

  function norm(v: string | null | undefined) {
    return (v ?? "").trim().toLowerCase();
  }

  /** Coincidencia exacta por barcode/SKU/código interno (case-insensitive). */
  function exactCodeMatch(q: string): Med[] {
    const s = norm(q);
    if (!s) return [];
    return meds.filter(
      (m) => norm(m.barcode) === s || norm(m.sku) === s || norm(m.codigo_interno) === s,
    );
  }

  function searchMeds(q: string): Med[] {
    const s = norm(q);
    if (!s) return [];
    return meds.filter((m) => {
      const fields = [
        m.nombre,
        m.categoria,
        m.descripcion,
        m.barcode,
        m.sku,
        m.codigo_interno,
        m.laboratorio,
        m.principio_activo,
        m.forma_farmaceutica,
        m.concentracion,
        m.presentacion,
        m.registro_sanitario,
      ];
      return fields.some((f) => norm(f).includes(s));
    });
  }

  function addToCart(m: Med) {
    const reason = blockReasonForDirectSale(m);
    if (reason) {
      logPosAudit(activeClinicId, "pos_blocked_direct_sale", { medicamento_id: m.id, reason });
      toast({ title: "Venta directa no permitida", description: reason, variant: "destructive" });
      return;
    }
    const lote = fifoLote(m.id, 1);
    if (!lote) {
      logPosAudit(activeClinicId, "pos_blocked_no_stock", { medicamento_id: m.id });
      toast({ title: "Sin existencia", description: `No hay lote disponible no vencido para ${m.nombre}`, variant: "destructive" });
      return;
    }
    setCart((prev) => {
      const ex = prev.find((c) => c.med.id === m.id && c.lote.id === lote.id);
      if (ex) {
        if (ex.quantity + 1 > lote.existencia) {
          toast({ title: "Existencia insuficiente", variant: "destructive" });
          return prev;
        }
        return prev.map((c) => (c === ex ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { med: m, lote, quantity: 1, unit_price: m.precio_unitario, discount: 0 }];
    });
  }

  function onScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = scanText.trim();
    if (!text) return;
    if (isPrescriptionScan(text)) {
      logPosAudit(activeClinicId, "pos_scan_prescription", { code: text });
      onScanPrescription?.(text);
      setScanText("");
      return;
    }
    // 1) Coincidencia exacta por código de barras / SKU / código interno
    const exact = exactCodeMatch(text);
    if (exact.length === 1) {
      addToCart(exact[0]);
      setScanText("");
      setMatches([]);
      inputRef.current?.focus();
      return;
    }
    if (exact.length > 1) {
      setMatches(exact.slice(0, 20));
      return;
    }
    // 2) Búsqueda amplia por nombre/laboratorio/principio/etc.
    const hits = searchMeds(text);
    if (hits.length === 0) {
      toast({ title: "Producto no encontrado", variant: "destructive" });
      return;
    }
    if (hits.length === 1) {
      addToCart(hits[0]);
      setScanText("");
      setMatches([]);
      inputRef.current?.focus();
      return;
    }
    setMatches(hits.slice(0, 20));
  }

  function updateQty(idx: number, delta: number) {
    setCart((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const next = Math.max(1, Math.min(c.lote.existencia, c.quantity + delta));
        return { ...c, quantity: next };
      }),
    );
  }

  function removeItem(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  function cancelSale() {
    if (cart.length === 0) return;
    logPosAudit(activeClinicId, "pos_sale_cancelled", { items: cart.length });
    setCart([]);
    setDiscount("0");
    setNotes("");
    setRequiresInvoice(false);
    toast({ title: "Venta cancelada" });
  }

  async function suspendSale() {
    if (cart.length === 0) return;
    // Suspender: registramos en audit_logs y limpiamos el carrito sin descontar inventario.
    await logPosAudit(activeClinicId, "pos_sale_suspended", {
      items: cart.map((c) => ({ med: c.med.id, qty: c.quantity, lote: c.lote.id })),
      notes: notes || null,
    });
    setCart([]);
    setDiscount("0");
    setNotes("");
    toast({ title: "Venta suspendida", description: "Quedó registrada en auditoría." });
  }

  const subtotal = cart.reduce((s, c) => s + c.quantity * c.unit_price, 0);
  const itemsDiscount = cart.reduce((s, c) => s + c.discount, 0);
  const globalDiscount = perms.canPosDiscount ? Number(discount) || 0 : 0;
  const total = Math.max(0, subtotal - itemsDiscount - globalDiscount);

  // Sincroniza montos por defecto según método y total.
  useEffect(() => {
    setBreakdown((bd) => {
      if (payment === "efectivo") return { ...bd, efectivo: total, tarjeta: 0, transferencia: 0, card: { ...bd.card, amount: 0 }, transfer: { ...bd.transfer, amount: 0 } };
      if (payment === "tarjeta") return { ...bd, efectivo: 0, tarjeta: total, transferencia: 0, card: { ...bd.card, amount: total }, transfer: { ...bd.transfer, amount: 0 } };
      if (payment === "transferencia") return { ...bd, efectivo: 0, tarjeta: 0, transferencia: total, card: { ...bd.card, amount: 0 }, transfer: { ...bd.transfer, amount: total } };
      if (payment === "pendiente") return { ...bd, efectivo: 0, tarjeta: 0, transferencia: 0, card: { ...bd.card, amount: 0 }, transfer: { ...bd.transfer, amount: 0 } };
      return bd; // mixto: el usuario captura manualmente
    });
  }, [payment, total]);


  async function submitSale() {
    if (!perms.canPosSell || cart.length === 0) return;

    // Bloqueo PCI: nunca aceptar número completo de tarjeta en ningún campo.
    if (
      looksLikeFullCardNumber(breakdown.card.card_last4) ||
      breakdown.card.card_last4.length > 4
    ) {
      await logPosAudit(activeClinicId, "intento_tarjeta_numero_completo_bloqueado", {
        field: "card_last4",
      });
      toast({ title: "Captura inválida", description: "Solo los últimos 4 dígitos.", variant: "destructive" });
      return;
    }

    const v = validatePayment(payment, total, breakdown);
    if (!v.ok) {
      await logPosAudit(activeClinicId, "diferencia_pago_total", { method: payment, error: v.error, total });
      toast({ title: "Pago inválido", description: v.error, variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const payload = {
      sale_type: "direct_sale",
      patient_id: clienteTipo === "paciente" ? patientId || null : null,
      customer_name: clienteTipo === "publico" ? (customerName || "Público general") : null,
      payment_method: payment,
      payment_status: payment === "pendiente" ? "pending" : "paid",
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
    const { data: saleId, error } = await supabase.rpc("pharmacy_register_sale", { p_payload: payload as never });
    if (error) {
      setSubmitting(false);
      toast({ title: "No se pudo registrar la venta", description: friendlyError(error), variant: "destructive" });
      return;
    }

    // Inserta el desglose de pagos (pharmacy_sale_payments)
    const rows = paymentsToRows(payment, breakdown).map((r) => ({
      ...r,
      sale_id: saleId,
      clinic_id: activeClinicId,
      created_by: user?.id ?? null,
    }));
    if (rows.length > 0) {
      const { error: pErr } = await supabase.from("pharmacy_sale_payments").insert(rows as never);
      if (pErr) {
        await logPosAudit(activeClinicId, "diferencia_pago_total", { sale_id: saleId, error: pErr.message }, String(saleId));
        toast({ title: "Venta registrada, falló desglose de pago", description: friendlyError(pErr), variant: "destructive" });
      } else {
        const auditEvent =
          payment === "mixto" ? "pago_mixto_registrado"
          : payment === "tarjeta" ? "pago_tarjeta_registrado"
          : payment === "transferencia" ? "pago_transferencia_registrado"
          : "pago_efectivo_registrado";
        await logPosAudit(activeClinicId, auditEvent, {
          sale_id: saleId,
          total,
          methods: rows.map((r) => ({ m: r.payment_method, amount: r.amount, last4: (r as { card_last4?: string }).card_last4 ?? null })),
        }, String(saleId));
      }
    }
    setSubmitting(false);

    if (globalDiscount > 0) {
      await logPosAudit(activeClinicId, "pos_discount_authorized", {
        sale_id: saleId, amount: globalDiscount, authorized_by: user?.id,
      }, String(saleId));
    }
    await logPosAudit(activeClinicId, "pos_sale_completed", {
      sale_id: saleId, total, payment_method: payment, requires_invoice: requiresInvoice,
    }, String(saleId));

    if (perms.isManager && globalDiscount > 0 && user?.id) {
      await supabase.from("pharmacy_sales")
        .update({ manager_authorized_by: user.id } as never)
        .eq("id", saleId as never);
    }

    const ticketPayments: TicketPaymentLine[] = rows.map((r) => ({
      method: r.payment_method as TicketPaymentLine["method"],
      amount: Number(r.amount),
      card_brand: (r as { card_brand?: string }).card_brand ?? null,
      card_last4: (r as { card_last4?: string }).card_last4 ?? null,
      authorization_code: (r as { authorization_code?: string }).authorization_code ?? null,
      terminal_id: (r as { terminal_id?: string }).terminal_id ?? null,
      transfer_reference: (r as { transfer_reference?: string }).transfer_reference ?? null,
      bank_name: (r as { bank_name?: string }).bank_name ?? null,
    }));

    const cajeroNombre = user?.user_metadata?.full_name ?? user?.email ?? "Cajero";
    setTicketData({
      folio: String(saleId).slice(0, 8).toUpperCase(),
      fecha: new Date(),
      cajero: cajeroNombre,
      clinica: activeClinic?.name ?? "Clínica",
      cliente: clienteTipo === "publico" ? (customerName || "Público general") : (patientSearch || "Paciente"),
      paciente: clienteTipo === "paciente" ? patientSearch : null,
      metodoPago: PAYMENT_LABEL[payment],
      payments: ticketPayments,
      items: cart.map((c) => ({ nombre: c.med.nombre, cantidad: c.quantity, precio: c.unit_price })),
      subtotal, descuento: itemsDiscount + globalDiscount, total,
    });
    setTicketOpen(true);

    // reset
    setCart([]);
    setDiscount("0");
    setNotes("");
    setRequiresInvoice(false);
    setPayment("efectivo");
    setBreakdown(emptyBreakdown(0));
    setPatientId(""); setPatientSearch(""); setCustomerName("Público general");
    setClienteTipo("publico");
    const { data: l } = await supabase
      .from("lotes_medicamento").select("*").gt("existencia", 0).order("fecha_entrada");
    setLotes((l as Lote[]) ?? []);
    inputRef.current?.focus();
  }

  if (!perms.canPosView) {
    return <p className="text-sm text-muted-foreground">No tienes permiso para usar el punto de venta.</p>;
  }

  const cajeroLabel = user?.user_metadata?.full_name ?? user?.email ?? "Cajero";

  return (
    <div className="space-y-4">
      {/* Topbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5"><UserIcon className="h-4 w-4 text-muted-foreground" /><strong>{cajeroLabel}</strong></span>
          <span className="flex items-center gap-1.5 text-muted-foreground"><Building2 className="h-4 w-4" />{activeClinic?.name ?? "—"}</span>
          <span className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-4 w-4" />{format(now, "dd/MM/yyyy HH:mm", { locale: es })}</span>
        </div>
        <Badge variant="outline">Turno actual</Badge>
      </div>

      {/* Scanner unificado */}
      <form onSubmit={onScanSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <ScanLine className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
          <Input
            ref={inputRef}
            autoFocus
            value={scanText}
            onChange={(e) => setScanText(e.target.value)}
            placeholder="Escanear producto, buscar medicamento o escanear receta…"
            className="h-14 pl-10 text-base"
          />
        </div>
        <Button type="submit" size="lg" className="h-14 px-6">Buscar</Button>
      </form>

      {/* Selector de coincidencias múltiples */}
      {matches.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Varias coincidencias — selecciona:</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { addToCart(m); setMatches([]); setScanText(""); inputRef.current?.focus(); }}
                className="text-left rounded-md border border-border p-2 hover:bg-accent transition-colors"
              >
                <p className="text-sm font-medium">{m.nombre}</p>
                <p className="text-xs text-muted-foreground">{m.categoria} · {formatMXN(m.precio_unitario)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr_360px]">
        {/* Frecuentes */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frecuentes</h3>
          {loading ? (
            <p className="text-xs text-muted-foreground">Cargando…</p>
          ) : (
            <div className="space-y-1.5">
              {frecuentes.map((m) => {
                const blocked = !!blockReasonForDirectSale(m);
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={blocked}
                    onClick={() => addToCart(m)}
                    className="w-full text-left rounded-md border border-border bg-card px-3 py-2 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <p className="text-sm font-medium truncate">{m.nombre}</p>
                    <p className="text-[11px] text-muted-foreground flex justify-between">
                      <span>{formatMXN(m.precio_unitario)}</span>
                      <span>Stock {stockOf(m.id)}</span>
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-2 min-h-[300px]">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Carrito ({cart.length})</h3>
          </div>
          {cart.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Escanea o busca un producto para iniciar la venta.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {cart.map((c, i) => {
                const reason = blockReasonForDirectSale(c.med);
                return (
                  <div key={i} className="py-3 grid grid-cols-[1fr_auto] gap-2 items-start">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{c.med.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.med.categoria} · {c.med.unidad}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        Lote {c.lote.numero_lote} (FIFO) · cad {format(new Date(c.lote.fecha_caducidad), "dd/MM/yy")}
                      </p>
                      {reason && (
                        <p className="text-[11px] text-destructive flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{reason}
                        </p>
                      )}
                      {(c.med.indicaciones_uso || c.med.contraindicaciones || c.med.advertencias || c.med.interacciones_relevantes) && (
                        <details className="text-[11px] text-muted-foreground rounded border border-border/60 bg-muted/30 px-2 py-1">
                          <summary className="cursor-pointer font-medium text-foreground">Información clínica</summary>
                          <div className="space-y-1 pt-1.5">
                            {c.med.indicaciones_uso && <p><strong>Indicaciones:</strong> {c.med.indicaciones_uso}</p>}
                            {c.med.contraindicaciones && <p className="text-destructive"><strong>Contraindicaciones:</strong> {c.med.contraindicaciones}</p>}
                            {c.med.advertencias && <p className="text-warning"><strong>Advertencias:</strong> {c.med.advertencias}</p>}
                            {c.med.interacciones_relevantes && <p><strong>Interacciones:</strong> {c.med.interacciones_relevantes}</p>}
                            <p className="italic opacity-80 pt-1 border-t border-border/40">{DEMO_INFO_LEGEND}</p>
                          </div>
                        </details>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => updateQty(i, -1)}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="min-w-[2ch] text-center text-sm font-semibold">{c.quantity}</span>
                        <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => updateQty(i, 1)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-muted-foreground ml-2">{formatMXN(c.unit_price)} c/u</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="font-semibold">{formatMXN(c.quantity * c.unit_price)}</p>
                      <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => removeItem(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cobro */}
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-3 self-start">
          <h3 className="font-semibold">Cobro</h3>

          <div className="space-y-2">
            <Label className="text-xs">Cliente</Label>
            <Select value={clienteTipo} onValueChange={(v) => setClienteTipo(v as "publico" | "paciente")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="publico">Público general</SelectItem>
                <SelectItem value="paciente">Paciente existente</SelectItem>
              </SelectContent>
            </Select>
            {clienteTipo === "publico" ? (
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre (opcional)" />
            ) : (
              <>
                <Input
                  placeholder="Buscar paciente…"
                  value={patientSearch}
                  onChange={(e) => { setPatientSearch(e.target.value); setPatientId(""); }}
                />
                {patients.length > 0 && !patientId && (
                  <div className="rounded-md border border-border bg-background max-h-40 overflow-auto">
                    {patients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setPatientId(p.id); setPatientSearch(`${p.nombre} ${p.apellidos}`); setPatients([]); }}
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

          <div className="space-y-1 border-t pt-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMXN(subtotal)}</span></div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs flex items-center gap-1">
                Descuento {!perms.canPosDiscount && <Lock className="h-3 w-3" />}
              </Label>
              <Input
                type="number" min={0} value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                disabled={!perms.canPosDiscount}
                className="h-9 w-24 text-right text-xs"
              />
            </div>
            <div className="flex justify-between font-semibold text-base">
              <span>Total</span><span>{formatMXN(total)}</span>
            </div>
            {!perms.canPosDiscount && Number(discount) > 0 && (
              <p className="text-[11px] text-destructive">Solo gerente puede autorizar descuento.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Método de pago</Label>
            <Select value={payment} onValueChange={(v) => setPayment(v as typeof PAYMENT_METHODS[number])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((p) => <SelectItem key={p} value={p}>{PAYMENT_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={requiresInvoice} onChange={(e) => setRequiresInvoice(e.target.checked)} />
              Requiere factura (CFDI futuro)
            </label>
            <Textarea placeholder="Notas" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12" onClick={suspendSale} disabled={cart.length === 0}>
              <PauseCircle className="h-4 w-4 mr-1" />Suspender
            </Button>
            <Button variant="outline" className="h-12 text-destructive border-destructive/40" onClick={cancelSale} disabled={cart.length === 0}>
              <XCircle className="h-4 w-4 mr-1" />Cancelar
            </Button>
          </div>

          <Button
            className="w-full h-14 text-base"
            disabled={cart.length === 0 || submitting || !perms.canPosSell}
            onClick={submitSale}
          >
            <Receipt className="h-5 w-5 mr-2" />
            {submitting ? "Registrando…" : `Cobrar ${formatMXN(total)}`}
          </Button>
        </div>
      </div>

      <TicketInterno open={ticketOpen} onClose={() => setTicketOpen(false)} data={ticketData} />
    </div>
  );
}
