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
  LayoutGrid, Copy, X,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { friendlyError } from "@/lib/errors";
import { posPermissions, blockReasonForDirectSale, isPrescriptionScan, DEMO_INFO_LEGEND, type Med } from "./permissions";
import { RecetaValidacionModal, type RecetaData } from "./RecetaValidacionModal";
import { TicketInterno, type TicketData, type TicketPaymentLine } from "./TicketInterno";
import { PaymentCapture, emptyBreakdown, validatePayment, paymentsToRows, looksLikeFullCardNumber, type PaymentBreakdown } from "./PaymentCapture";
import { OpenShiftCard, ShiftBadge, fetchCurrentShift, type Shift } from "./ShiftPanel";
import StripePaymentModal from "@/features/pagos/StripePaymentModal";
import { LoyaltyPanel } from "@/features/lealtad/LoyaltyPanel";
import { useLoyaltyMember } from "@/features/lealtad/hooks/useLoyaltyMember";

type Lote = {
  id: string;
  medicamento_id: string;
  numero_lote: string;
  fecha_caducidad: string;
  created_at: string;
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

function PosClockDisplay() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return <>{format(now, "dd/MM/yyyy HH:mm", { locale: es })}</>;
}

async function logPosAudit(
  clinicId: string | null,
  event: string,
  data: Record<string, unknown>,
  registroId: string | null = null,
  userId?: string | null,
) {
  try {
    await (supabase as any).from("audit_logs").insert({
      user_id: userId ?? (await supabase.auth.getUser()).data.user?.id ?? null,
      accion: event.includes("error") || event.includes("bloqueado") ? "error" : "crear",
      tabla: "pharmacy_sales",
      registro_id: registroId,
      clinic_id: clinicId,
      datos_nuevos: { event, ...data },
    } as never);
  } catch {
    /* best-effort */
  }
}

async function logPosError(
  clinicId: string | null,
  userId: string | null | undefined,
  funcion: string,
  error_msg: string,
  error_detail: string,
  payload: Record<string, unknown>,
) {
  const { error } = await (supabase as any).from("pos_error_logs").insert({
    user_id: userId ?? null,
    clinic_id: clinicId,
    funcion,
    error_msg,
    error_detail,
    payload: payload as unknown as import("@/integrations/supabase/types").Json,
  });
  if (error) {
    console.error("[logPosError] No se pudo guardar en pos_error_logs:", error.message, error);
  }
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch {
      /* clipboard not available */
    }
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

  const [meds, setMeds] = useState<Med[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);

  const [scanText, setScanText] = useState("");
  const [matches, setMatches] = useState<Med[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState("0");
  const [payment, setPayment] = useState<typeof PAYMENT_METHODS[number]>("efectivo");

  const hasControlledInCart = useMemo(
    () => cart.some((c) => c.med.is_controlled),
    [cart],
  );

  useEffect(() => {
    if (hasControlledInCart && payment === "pendiente") setPayment("efectivo");
  }, [hasControlledInCart]);
  const [requiresInvoice, setRequiresInvoice] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [clienteTipo, setClienteTipo] = useState<"publico" | "paciente">("publico");
  const [customerName, setCustomerName] = useState("Público general");
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState<{ id: string; nombre: string; apellidos: string }[]>([]);
  const [patientId, setPatientId] = useState<string>("");

  const [recetaModalOpen, setRecetaModalOpen] = useState(false);
  const [recetaMedsInfo, setRecetaMedsInfo] = useState<{ nombre: string; is_controlled: boolean }[]>([]);
  const [pendingRxSaleId, setPendingRxSaleId] = useState<string | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const [breakdown, setBreakdown] = useState<PaymentBreakdown>(() => emptyBreakdown(0));
  const [shift, setShift] = useState<Shift | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"scanner" | "catalogo">("scanner");
  const [lastError, setLastError] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [stripeOpen, setStripeOpen] = useState(false);
  const [stripeTxnId, setStripeTxnId] = useState<string | null>(null);

  // Fidelización
  const [loyaltyMemberId, setLoyaltyMemberId] = useState<string | null>(null);
  const [loyaltyDescuento, setLoyaltyDescuento] = useState(0);
  const loyaltyHook = useLoyaltyMember(activeClinicId);

  async function refreshShift() {
    setShiftLoading(true);
    const s = await fetchCurrentShift();
    setShift(s);
    setShiftLoading(false);
  }
  useEffect(() => { refreshShift(); }, []);

  // Llamado cuando Stripe Elements confirma el cobro exitosamente.
  async function handleStripeSuccess(paymentIntentId: string, txnId: string | null) {
    setStripeTxnId(txnId);
    setStripeOpen(false);
    const stripeBreakdown: PaymentBreakdown = {
      ...breakdown,
      tarjeta: totalConLealtad,
      efectivo: 0,
      monto_recibido: 0,
      transferencia: 0,
      card: {
        amount: totalConLealtad,
        card_last4: "0000",
        card_type: "credito",
        card_brand: "Visa",
        authorization_code: paymentIntentId,
        terminal_id: "STRIPE",
        acquirer: "Stripe",
      },
      transfer: { amount: 0, transfer_reference: "", bank_name: "" },
    };
    setBreakdown(stripeBreakdown);
    await submitSale(stripeBreakdown, txnId);
  }

  // Advertir antes de cerrar/navegar con carrito activo
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (cart.length > 0) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [cart.length]);

  useEffect(() => {
    inputRef.current?.focus();
    (async () => {
      setLoading(true);
      const [{ data: m }, { data: l }] = await Promise.all([
        (supabase as any).from("medicamentos").select("*").eq("activo", true).order("nombre"),
        (supabase as any).from("lotes_medicamento").select("*").gt("existencia", 0).order("created_at"),
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
      const { data } = await (supabase as any)
        .from("patients")
        .select("id, nombre, apellidos")
        .or(`nombre.ilike.%${q}%,apellidos.ilike.%${q}%`)
        .limit(8);
      setPatients(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [patientSearch, clienteTipo]);

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  function fifoLote(medId: string, qty: number): Lote | null {
    return lotes
      .filter((l) => l.medicamento_id === medId && l.existencia >= qty && l.fecha_caducidad >= today)
      .sort((a, b) => a.fecha_caducidad.localeCompare(b.fecha_caducidad) || a.created_at.localeCompare(b.created_at))[0] ?? null;
  }

  function stockOf(medId: string) {
    return lotes
      .filter((l) => l.medicamento_id === medId && l.fecha_caducidad >= today)
      .reduce((s, l) => s + l.existencia, 0);
  }

  // TODO: cambiar a "más vendidos" cuando exista índice de ventas frecuentes.
  const frecuentes = useMemo(() => meds.slice(0, 12), [meds]);

  const catalogFiltered = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return meds.slice(0, 30);
    return meds.filter((m) =>
      [m.nombre, m.categoria,
       (m as Med & { laboratorio?: string | null }).laboratorio ?? "",
       (m as Med & { principio_activo?: string | null }).principio_activo ?? ""]
        .some((f) => (f ?? "").toLowerCase().includes(q))
    ).slice(0, 30);
  }, [meds, catalogSearch]);

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
  const itemsDiscount = cart.reduce((s, c) => s + c.discount * c.quantity, 0);
  const globalDiscount = perms.canPosDiscount ? Number(discount) || 0 : 0;
  const total = Math.max(0, subtotal - itemsDiscount - globalDiscount);
  const totalConLealtad = Math.max(0, total - loyaltyDescuento);
  // IVA proporcional: precios incluyen IVA; aplicar ratio del descuento global
  const discountRatio = subtotal > 0 ? total / subtotal : 1;
  const totalIva = cart.reduce((s, c) => {
    const tasa = c.med.tasa_iva ?? 0;
    if (tasa === 0) return s;
    const itemSub = (c.quantity * c.unit_price - c.discount) * discountRatio;
    return s + (itemSub - itemSub / (1 + tasa));
  }, 0);
  const baseGravable = cart.reduce((s, c) => {
    const tasa = c.med.tasa_iva ?? 0;
    if (tasa === 0) return s;
    const itemSub = (c.quantity * c.unit_price - c.discount) * discountRatio;
    return s + itemSub / (1 + tasa);
  }, 0);
  const exento = cart.reduce((s, c) => {
    const tasa = c.med.tasa_iva ?? 0;
    if (tasa > 0) return s;
    return s + (c.quantity * c.unit_price - c.discount) * discountRatio;
  }, 0);

  // Sincroniza montos por defecto según método y total.
  useEffect(() => {
    setBreakdown((bd) => {
      if (payment === "efectivo") return { ...bd, efectivo: totalConLealtad, monto_recibido: totalConLealtad, tarjeta: 0, transferencia: 0, card: { ...bd.card, amount: 0 }, transfer: { ...bd.transfer, amount: 0 } };
      if (payment === "tarjeta") return { ...bd, efectivo: 0, tarjeta: totalConLealtad, transferencia: 0, card: { ...bd.card, amount: totalConLealtad }, transfer: { ...bd.transfer, amount: 0 } };
      if (payment === "transferencia") return { ...bd, efectivo: 0, tarjeta: 0, transferencia: totalConLealtad, card: { ...bd.card, amount: 0 }, transfer: { ...bd.transfer, amount: totalConLealtad } };
      if (payment === "pendiente") return { ...bd, efectivo: 0, tarjeta: 0, transferencia: 0, card: { ...bd.card, amount: 0 }, transfer: { ...bd.transfer, amount: 0 } };
      // mixto: iniciar en 0/0 para que usuario capture el split explícitamente
      return { ...bd, efectivo: 0, monto_recibido: 0, tarjeta: 0, transferencia: 0, card: { ...bd.card, amount: 0 }, transfer: { ...bd.transfer, amount: 0 } };
    });
  }, [payment, totalConLealtad]);


  async function submitSale(bdOverride?: PaymentBreakdown, stripeTxnIdOverride?: string | null) {
    if (!perms.canPosSell || cart.length === 0) return;
    const bd = bdOverride ?? breakdown;
    const rxMeds = cart.filter(
      (c) => c.med.requires_prescription || c.med.is_controlled || !!blockReasonForDirectSale(c.med),
    );

    // Bloqueo PCI: nunca aceptar número completo de tarjeta en ningún campo.
    if (
      looksLikeFullCardNumber(bd.card.card_last4) ||
      bd.card.card_last4.length > 4
    ) {
      await logPosAudit(activeClinicId, "intento_tarjeta_numero_completo_bloqueado", {
        field: "card_last4",
      });
      toast({ title: "Captura inválida", description: "Solo los últimos 4 dígitos.", variant: "destructive" });
      return;
    }

    const v = validatePayment(payment, totalConLealtad, bd);
    if (!v.ok) {
      await logPosAudit(activeClinicId, "diferencia_pago_total", { method: payment, error: v.error, total });
      toast({ title: "Pago inválido", description: v.error, variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const payload = {
      clinic_id: activeClinicId,
      sale_type: rxMeds.length > 0 ? "prescription_dispense" : "direct_sale",
      receta_capturada: false,
      patient_id: clienteTipo === "paciente" ? patientId || null : null,
      customer_name: clienteTipo === "publico" ? (customerName || "Público general") : null,
      payment_method: payment,
      payment_status: payment === "pendiente" ? "pending" : "paid",
      requires_invoice: requiresInvoice,
      notes: notes || null,
      discount: globalDiscount,
      loyalty_discount: loyaltyDescuento,   // ← NUEVO
      items: cart.map((c) => ({
        medicamento_id: c.med.id,
        lote_id: c.lote.id,
        quantity: c.quantity,
        unit_price: c.unit_price,
        discount: c.discount,
      })),
    };
    const { data: saleId, error } = await (supabase as any).rpc("pharmacy_register_sale", { p_payload: payload as never });
    if (error) {
      setSubmitting(false);
      const detail = `${error.message} | code: ${error.code} | hint: ${error.hint ?? ""} | details: ${error.details ?? ""}`;
      setLastError(detail);
      await Promise.all([
        logPosAudit(activeClinicId, "pos_sale_rpc_error", { error: error.message, code: error.code, hint: error.hint, items: cart.length }, null, user?.id),
        logPosError(activeClinicId, user?.id, "pharmacy_register_sale", error.message, `code:${error.code} hint:${error.hint ?? ""}`, { items: cart.length, payment, total }),
      ]);
      await copyToClipboard(detail);
      toast({ title: "Error al registrar venta", description: error.message, variant: "destructive", duration: 10000 });
      return;
    }

    // Si el cobro fue por Stripe, actualizar payment_transactions con el sale_id
    const resolvedStripeTxnId = stripeTxnIdOverride ?? stripeTxnId;
    if (resolvedStripeTxnId) {
      await (supabase as any)
        .from("payment_transactions" as never)
        .update({ sale_id: saleId } as never)
        .eq("id", resolvedStripeTxnId as never);
    }

    // Inserta el desglose de pagos (pharmacy_sale_payments)
    type PayRow = Record<string, unknown> & { payment_method: string; amount: number; card_last4?: string; card_brand?: string; authorization_code?: string; terminal_id?: string; transfer_reference?: string; bank_name?: string };
    const baseRows = paymentsToRows(payment, bd) as PayRow[];
    const rows: PayRow[] = baseRows.map((r) => Object.assign({}, r, {
      sale_id: saleId as unknown as string,
      clinic_id: activeClinicId,
      created_by: user?.id ?? null,
    }));
    if (rows.length > 0) {
      const { error: pErr } = await (supabase as any).from("pharmacy_sale_payments").insert(rows as never);
      if (pErr) {
        const pDetail = `${pErr.message} | code: ${pErr.code} | hint: ${pErr.hint ?? ""} | details: ${pErr.details ?? ""}`;
        await Promise.all([
          logPosAudit(activeClinicId, "pos_payments_insert_error", { sale_id: saleId, error: pErr.message }, String(saleId), user?.id),
          logPosError(activeClinicId, user?.id, "pharmacy_sale_payments.insert", pErr.message, `code:${pErr.code} hint:${pErr.hint ?? ""}`, { sale_id: String(saleId), payment, total }),
        ]);
        await copyToClipboard(pDetail);
        toast({ title: "Venta registrada, falló desglose de pago — error copiado", description: pDetail, variant: "destructive", duration: 20000 });
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

    // Registrar puntos de fidelización si hay miembro seleccionado
    // FIX 1 [VERIFIED]: saleId is a UUID returned from pharmacy_register_sale RPC.
    // String(saleId) coerces it to a UUID string, which PostgreSQL accepts for
    // the loyalty_register_sale(p_sale_id uuid, ...) parameter type. This is safe.
    if (loyaltyMemberId && saleId) {
      const loyaltySaleResult = await loyaltyHook.registerSale(String(saleId), loyaltyMemberId);
      if (!loyaltySaleResult.ok) {
        toast({
          title: "Fidelización: error al registrar puntos",
          description: loyaltySaleResult.error ?? "No se pudieron acumular los puntos de esta venta.",
          variant: "destructive",
          duration: 6000,
        });
      }
      setLoyaltyMemberId(null);
      setLoyaltyDescuento(0);
    }

    if (perms.isManager && globalDiscount > 0 && user?.id) {
      await (supabase as any).from("pharmacy_sales")
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
      monto_recibido: (r as { monto_recibido?: number }).monto_recibido ?? null,
      cambio_entregado: (r as { cambio_entregado?: number }).cambio_entregado ?? null,
    }));

    const cajeroNombre = user?.user_metadata?.full_name ?? user?.email ?? "Cajero";
    setTicketData({
      folio: String(saleId).slice(0, 12).toUpperCase(),
      fecha: new Date(),
      cajero: cajeroNombre,
      clinica: activeClinic?.name ?? "Clínica",
      cliente: clienteTipo === "publico" ? (customerName || "Público general") : (patientSearch || "Paciente"),
      paciente: clienteTipo === "paciente" ? patientSearch : null,
      metodoPago: PAYMENT_LABEL[payment],
      payments: ticketPayments,
      items: cart.map((c) => ({ nombre: c.med.nombre, cantidad: c.quantity, precio: c.unit_price })),
      subtotal, descuento: itemsDiscount + globalDiscount,
      descuentoLealtad: loyaltyDescuento > 0 ? loyaltyDescuento : undefined,  // ← NUEVO
      total: totalConLealtad,   // ← era `total`
      totalIva, baseGravable, exento,
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
    setLoyaltyDescuento(0);
    setLoyaltyMemberId(null);
    const { data: l } = await (supabase as any)
      .from("lotes_medicamento").select("*").gt("existencia", 0).order("created_at");
    setLotes((l as Lote[]) ?? []);
    inputRef.current?.focus();

    if (rxMeds.length > 0) {
      setPendingRxSaleId(saleId as unknown as string);
      setRecetaMedsInfo(rxMeds.map((c) => ({
        nombre: c.med.nombre,
        is_controlled: !!c.med.is_controlled,
      })));
      setRecetaModalOpen(true);
    }
  }

  async function saveRecetaPostSale(recetaData: RecetaData) {
    if (!pendingRxSaleId) return;
    await (supabase as any).from("recetas_capturadas").insert({
      clinic_id: activeClinicId,
      sale_id: pendingRxSaleId,
      nombre_medico: recetaData.nombre_medico,
      cedula_profesional: recetaData.cedula_profesional,
      especialidad: recetaData.especialidad || null,
      fecha_receta: recetaData.fecha_receta,
      folio_receta: recetaData.folio_receta || null,
      nombre_paciente: recetaData.nombre_paciente || null,
      diagnostico: recetaData.diagnostico || null,
      receta_retenida: recetaData.receta_retenida,
      grupo: recetaData.grupo,
      folio_cofepris: recetaData.folio_cofepris || null,
      notas: recetaData.notas || null,
      created_by: user?.id ?? null,
    } as never);
    setPendingRxSaleId(null);
  }

  function handleCobrar() {
    submitSale();
  }

  if (!perms.canPosView) {
    return <p className="text-sm text-muted-foreground">No tienes permiso para usar el punto de venta.</p>;
  }

  const cajeroLabel = user?.user_metadata?.full_name ?? user?.email ?? "Cajero";

  return (
    <div className="space-y-4">
      {lastError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />Último error de venta
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                onClick={() => copyToClipboard(lastError)}>
                <Copy className="h-3 w-3 mr-1" />Copiar
              </Button>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                onClick={() => setLastError(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <pre className="text-[11px] font-mono text-destructive bg-destructive/5 rounded p-2 whitespace-pre-wrap break-all select-all cursor-text">
            {lastError}
          </pre>
        </div>
      )}
      {/* Topbar */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3 text-sm min-w-0">
          <span className="flex items-center gap-1.5 shrink-0"><UserIcon className="h-4 w-4 text-muted-foreground" /><strong className="truncate max-w-[120px] xl:max-w-none">{cajeroLabel}</strong></span>
          <span className="hidden xl:flex items-center gap-1.5 text-muted-foreground"><Building2 className="h-4 w-4 shrink-0" />{activeClinic?.name ?? "—"}</span>
          <span className="hidden xl:flex items-center gap-1.5 text-muted-foreground"><Clock className="h-4 w-4 shrink-0" /><PosClockDisplay /></span>
        </div>
        <ShiftBadge shift={shift} />
      </div>

      {/* Toggle de modo */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1 w-fit">
        <button
          type="button"
          onClick={() => setViewMode("scanner")}
          className={`flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] text-sm rounded-md transition-colors ${
            viewMode === "scanner" ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ScanLine className="h-4 w-4" />Escáner
        </button>
        <button
          type="button"
          onClick={() => setViewMode("catalogo")}
          className={`flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] text-sm rounded-md transition-colors ${
            viewMode === "catalogo" ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid className="h-4 w-4" />Catálogo
        </button>
      </div>

      {/* Sin turno → solo se permite abrir turno; el resto del POS se oculta */}
      {!shiftLoading && !shift && (
        <OpenShiftCard onOpened={(s) => setShift(s)} />
      )}
      {shift && (<>
      {/* Frecuentes accordion — visible only on tablet (hidden on desktop where left column shows) */}
      {viewMode === "scanner" && frecuentes.length > 0 && (
        <details className="xl:hidden rounded-lg border border-border bg-card overflow-hidden">
          <summary className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none text-sm font-semibold text-foreground hover:bg-accent transition-colors">
            <span>Frecuentes</span>
            <span className="text-xs text-muted-foreground font-normal">{frecuentes.length} productos</span>
          </summary>
          <div className="grid grid-cols-2 gap-1.5 p-2 border-t border-border">
            {frecuentes.map((m) => {
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => addToCart(m)}
                  className="text-left rounded-md border border-border bg-background px-3 py-3 min-h-[64px] hover:bg-accent transition-colors"
                >
                  <p className="text-sm font-medium truncate leading-tight">{m.nombre}</p>
                  <p className="text-xs text-muted-foreground flex justify-between mt-1">
                    <span>{formatMXN(m.precio_unitario)}</span>
                    <span>Stock {stockOf(m.id)}</span>
                  </p>
                </button>
              );
            })}
          </div>
        </details>
      )}
      {/* Scanner (modo escáner) */}
      {viewMode === "scanner" && (
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
      )}

      {/* Coincidencias múltiples (modo escáner) */}
      {viewMode === "scanner" && matches.length > 1 && (
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

      <div className="grid gap-4 xl:grid-cols-[220px_1fr_360px] md:grid-cols-[1fr_360px] items-start">
        {/* Panel izquierdo: Frecuentes (escáner) o Catálogo */}
        <div className="hidden xl:block space-y-2 sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
          {viewMode === "scanner" ? (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frecuentes</h3>
              {loading ? (
                <p className="text-xs text-muted-foreground">Cargando…</p>
              ) : (
                <div className="space-y-1.5">
                  {frecuentes.map((m) => {
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => addToCart(m)}
                        className="w-full text-left rounded-md border border-border bg-card px-3 py-3 min-h-[52px] hover:bg-accent transition-colors"
                      >
                        <p className="text-base font-medium truncate leading-tight">{m.nombre}</p>
                        <div className="flex items-center justify-between mt-0.5 gap-1">
                          <span className="text-sm text-muted-foreground">{formatMXN(m.precio_unitario)}</span>
                          <span className={`text-xs px-1 py-0.5 rounded font-medium ${
                            stockOf(m.id) === 0
                              ? "bg-red-100 text-red-800"
                              : stockOf(m.id) <= 5
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-green-100 text-green-800"
                          }`}>Stock {stockOf(m.id)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Catálogo</h3>
              <Input
                placeholder="Buscar por nombre, categoría…"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="h-9"
              />
              <div className="space-y-1.5 overflow-auto">
                {loading ? (
                  <p className="text-xs text-muted-foreground">Cargando…</p>
                ) : catalogFiltered.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin resultados.</p>
                ) : (
                  catalogFiltered.map((m) => {
                    const stock = stockOf(m.id);
                    const blockReason = blockReasonForDirectSale(m);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={stock === 0}
                        onClick={() => addToCart(m)}
                        className="w-full text-left rounded-md border border-border bg-card px-3 py-3 min-h-[72px] hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <p className="text-base font-medium truncate leading-tight">{m.nombre}</p>
                        <p className="text-xs text-muted-foreground">{m.categoria}</p>
                        <div className="flex items-center justify-between mt-1 gap-1 flex-wrap">
                          <span className="text-sm font-semibold text-primary">{formatMXN(m.precio_unitario)}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            stock === 0
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                              : stock <= 5
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          }`}>Stock {stock}</span>
                        </div>
                        {blockReason && <p className="text-xs text-destructive mt-0.5">Requiere receta</p>}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Carrito */}
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-2 flex flex-col sticky top-4 max-h-[calc(100vh-6rem)]">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Carrito ({cart.length})</h3>
          </div>
          {cart.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Escanea o busca un producto para iniciar la venta.
            </div>
          ) : (
            <div className="divide-y divide-border overflow-y-auto flex-1">
              {cart.map((c, i) => {
                const reason = blockReasonForDirectSale(c.med);
                return (
                  <div key={i} className="py-3 min-h-[56px] grid grid-cols-[1fr_auto] gap-2 items-start">
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
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <Button size="icon" variant="outline" className="h-10 w-10" onClick={() => updateQty(i, -1)}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="min-w-[2ch] text-center text-sm font-semibold">{c.quantity}</span>
                        <Button size="icon" variant="outline" className="h-10 w-10" onClick={() => updateQty(i, 1)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-muted-foreground ml-1">{formatMXN(c.unit_price)} c/u</span>
                        {perms.canPosDiscount && (
                          <div className="flex items-center gap-1 ml-auto">
                            <span className="text-[10px] text-muted-foreground">Desc.</span>
                            <Input
                              type="number"
                              min={0}
                              value={c.discount}
                              onChange={(e) => setCart((prev) => prev.map((x, j) => j === i ? { ...x, discount: Math.max(0, Number(e.target.value) || 0) } : x))}
                              className="h-7 w-20 text-xs text-right"
                            />
                          </div>
                        )}
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
        <div className="rounded-xl border border-border bg-card shadow-sm self-start sticky top-4 max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <h3 className="font-semibold">Cobro</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
            {loyaltyDescuento > 0 && (
              <div className="flex justify-between text-sm text-teal-700 dark:text-teal-400">
                <span>Desc. lealtad</span><span>-{formatMXN(loyaltyDescuento)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base">
              <span>Total</span><span>{formatMXN(totalConLealtad)}</span>
            </div>
            {!perms.canPosDiscount && Number(discount) > 0 && (
              <p className="text-[11px] text-destructive">Solo gerente puede autorizar descuento.</p>
            )}
          </div>

          {activeClinicId && (
            <LoyaltyPanel
              clinicId={activeClinicId}
              totalVenta={totalConLealtad}
              onMemberSelected={m => {
                setLoyaltyMemberId(m?.id ?? null)
                if (!m) setLoyaltyDescuento(0)
              }}
              onRedeemApplied={(desc, _mid) => setLoyaltyDescuento(desc)}
            />
          )}

          <div className="space-y-2">
            <Label className="text-xs">Método de pago</Label>
            <Select value={payment} onValueChange={(v) => setPayment(v as typeof PAYMENT_METHODS[number])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((p) => (
                  <SelectItem key={p} value={p} disabled={p === "pendiente" && hasControlledInCart}>
                    {PAYMENT_LABEL[p]}{p === "pendiente" && hasControlledInCart ? " (controlado)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <PaymentCapture method={payment} total={totalConLealtad} value={breakdown} onChange={setBreakdown} />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={requiresInvoice} onChange={(e) => setRequiresInvoice(e.target.checked)} />
              Requiere factura (CFDI futuro)
            </label>
            <Textarea placeholder="Notas" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          </div>{/* end scrollable content */}
          <div className="p-3 border-t border-border space-y-2 bg-card">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-12" onClick={suspendSale} disabled={cart.length === 0}>
                <PauseCircle className="h-4 w-4 mr-1" />Suspender
              </Button>
              <Button variant="outline" className="h-12 text-destructive border-destructive/40" onClick={cancelSale} disabled={cart.length === 0}>
                <XCircle className="h-4 w-4 mr-1" />Cancelar
              </Button>
            </div>
            <Button
              className="w-full h-14 text-base font-semibold"
              disabled={cart.length === 0 || submitting || !perms.canPosSell}
              onClick={handleCobrar}
            >
              <Receipt className="h-5 w-5 mr-2" />
              {submitting ? "Registrando…" : `Cobrar ${formatMXN(totalConLealtad)}`}
            </Button>
            {payment === "tarjeta" && activeClinicId && (
              <Button
                variant="outline"
                className="w-full h-10 text-sm border-violet-300 text-violet-700 hover:bg-violet-50"
                disabled={cart.length === 0 || submitting || !perms.canPosSell}
                onClick={() => setStripeOpen(true)}
              >
                <Receipt className="h-4 w-4 mr-2" />
                Cobrar con Stripe
              </Button>
            )}
          </div>
        </div>
      </div>
      </>)}

      {recetaModalOpen && (
        <RecetaValidacionModal
          medsConReceta={recetaMedsInfo}
          onConfirm={(data) => { setRecetaModalOpen(false); saveRecetaPostSale(data); }}
          onCancel={() => { setRecetaModalOpen(false); setPendingRxSaleId(null); }}
        />
      )}
      <TicketInterno open={ticketOpen} onClose={() => setTicketOpen(false)} data={ticketData} />
      {activeClinicId && (
        <StripePaymentModal
          open={stripeOpen}
          onOpenChange={setStripeOpen}
          onSuccess={handleStripeSuccess}
          clinicId={activeClinicId}
          amountCents={Math.round(totalConLealtad * 100)}
          description={`Venta farmacia — ${cart.length} art.`}
        />
      )}
    </div>
  );
}
