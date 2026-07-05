/**
 * Corte de caja del POS Farmacia.
 *
 * Lista los turnos accesibles según RLS (cajero ve los suyos; manager/admin
 * ven todos los de la clínica) y construye el reporte por método de pago,
 * marca, terminal, referencias, y permite reimprimir el ticket interno.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, Lock, RefreshCw, ReceiptText, FileText, TrendingDown, TrendingUp, Minus, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { posPermissions } from "./permissions";
import { CloseShiftDialog, CorteXDialog, FondoMovimientoDialog, type Shift } from "./ShiftPanel";
import { TicketInterno, type TicketData, type TicketPaymentLine } from "./TicketInterno";
import { ReturnDialog } from "./ReturnDialog";
import { LibroControl } from "./LibroControl";

const formatMXN = (n: number) =>
  Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

type Sale = {
  id: string;
  created_at: string;
  total: number;
  subtotal: number;
  discount: number;
  status: string;
  payment_method: string | null;
  payment_status: string;
  customer_name: string | null;
  patient_id: string | null;
  cashier_user_id: string | null;
  notes: string | null;
};

type Payment = {
  id: string;
  sale_id: string;
  payment_method: "efectivo" | "tarjeta" | "transferencia";
  amount: number;
  card_type: string | null;
  card_brand: string | null;
  card_last4: string | null;
  authorization_code: string | null;
  terminal_id: string | null;
  acquirer: string | null;
  transfer_reference: string | null;
  bank_name: string | null;
};

type SaleItem = {
  id: string;
  sale_id: string;
  quantity: number;
  unit_price: number;
  medicamento_id: string;
};

type FondoMovimiento = {
  id: string;
  tipo: "egreso" | "ingreso";
  monto: number;
  motivo: string;
  registrado_by: string;
  created_at: string;
};

type CorteRow = {
  id: string;
  tipo: "Z" | "X";
  folio_secuencial: number | null;
  created_at: string;
  efectivo_esperado: number | null;
  conteo_ciego: number | null;
  diferencia: number | null;
  requiere_autorizacion: boolean;
  autorizado_by: string | null;
  total_efectivo: number;
  total_tarjeta: number;
  total_transferencia: number;
  total_otros: number;
  total_general: number;
  conteo_movimientos: number;
};

export default function CorteCaja() {
  const { user, roles } = useAuth();
  const { activeClinic, activeClinicId } = useActiveClinic();
  const perms = posPermissions(roles);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selected, setSelected] = useState<Shift | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [meds, setMeds] = useState<Record<string, string>>({});
  const [fondos, setFondos] = useState<FondoMovimiento[]>([]);
  const [cortes, setCortes] = useState<CorteRow[]>([]);
  const [closeOpen, setCloseOpen] = useState(false);
  const [corteXOpen, setCorteXOpen] = useState(false);
  const [fondoOpen, setFondoOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketData, setTicketData] = useState<TicketData | null>(null);

  async function loadShifts() {
    if (!activeClinicId) return;
    const { data } = await (supabase as any)
      .from("pharmacy_cash_shifts")
      .select("*")
      .eq("clinic_id", activeClinicId)
      .order("opened_at", { ascending: false })
      .limit(50);
    const list = (data ?? []) as unknown as Shift[];
    setShifts(list);
    if (!selected && list.length > 0) setSelected(list[0]);
  }

  async function loadShiftDetail(shift: Shift) {
    setLoading(true);
    setCortes([]);
    const [{ data: s }, { data: p }, { data: fm }] = await Promise.all([
      (supabase as any).from("pharmacy_sales").select("*").eq("shift_id", shift.id),
      (supabase as any)
        .from("pharmacy_sale_payments")
        .select("*")
        .in("sale_id", (await (supabase as any).from("pharmacy_sales").select("id").eq("shift_id", shift.id)).data?.map((r: { id: string }) => r.id) ?? []),
      (supabase as any).from("fondos_movimientos")
        .select("id,tipo,monto,motivo,registrado_by,created_at")
        .eq("pharmacy_shift_id", shift.id)
        .order("created_at", { ascending: true }),
    ]);
    const salesList = (s ?? []) as unknown as Sale[];
    setSales(salesList);
    setPayments((p ?? []) as unknown as Payment[]);
    setFondos((fm ?? []) as FondoMovimiento[]);
    // Load cortes for this shift
    const { data: ct } = await (supabase as any).from("cortes")
      .select("id,tipo,folio_secuencial,created_at,efectivo_esperado,conteo_ciego,diferencia,requiere_autorizacion,autorizado_by,total_efectivo,total_tarjeta,total_transferencia,total_otros,total_general,conteo_movimientos")
      .eq("pharmacy_shift_id", shift.id)
      .order("created_at", { ascending: true });
    setCortes((ct ?? []) as CorteRow[]);
    if (salesList.length > 0) {
      const { data: it } = await (supabase as any)
        .from("pharmacy_sale_items")
        .select("id,sale_id,quantity,unit_price,medicamento_id")
        .in("sale_id", salesList.map((x) => x.id));
      const itemsList = (it ?? []) as unknown as SaleItem[];
      setItems(itemsList);
      const medIds = [...new Set(itemsList.map((i) => i.medicamento_id))];
      if (medIds.length > 0) {
        const { data: m } = await (supabase as any).from("medicamentos").select("id,nombre").in("id", medIds);
        const map: Record<string, string> = {};
        (m ?? []).forEach((r: { id: string; nombre: string }) => { map[r.id] = r.nombre; });
        setMeds(map);
      }
    } else {
      setItems([]); setMeds({});
    }
    setLoading(false);
  }

  useEffect(() => { loadShifts(); }, [activeClinicId]);
  useEffect(() => { if (selected) loadShiftDetail(selected); }, [selected?.id]);

  const resumen = useMemo(() => {
    const active = sales.filter((s) => s.status !== "cancelled");
    const cancelled = sales.filter((s) => s.status === "cancelled");
    const totalVentas = active.reduce((a, s) => a + Number(s.total), 0);
    const tickets = active.length;

    const efectivo = payments.filter((p) => p.payment_method === "efectivo").reduce((a, p) => a + Number(p.amount), 0);
    const tarjeta = payments.filter((p) => p.payment_method === "tarjeta").reduce((a, p) => a + Number(p.amount), 0);
    const transferencia = payments.filter((p) => p.payment_method === "transferencia").reduce((a, p) => a + Number(p.amount), 0);
    const pendiente = active.filter((s) => s.payment_status === "pending").reduce((a, s) => a + Number(s.total), 0);
    const mixtoSales = active.filter((s) => s.payment_method === "mixto");
    const mixto = mixtoSales.reduce((a, s) => a + Number(s.total), 0);

    const fondoEgresos = fondos.filter((f) => f.tipo === "egreso").reduce((a, f) => a + Number(f.monto), 0);
    const fondoIngresos = fondos.filter((f) => f.tipo === "ingreso").reduce((a, f) => a + Number(f.monto), 0);
    const fondoMovimientos = fondos;
    const efectivoEsperado = Number(selected?.opening_amount ?? 0) + efectivo + fondoIngresos - fondoEgresos;
    const efectivoContado = selected?.closing_cash_count != null ? Number(selected.closing_cash_count) : null;
    const diferencia = selected?.cash_difference != null ? Number(selected.cash_difference) : null;

    const cardPayments = payments.filter((p) => p.payment_method === "tarjeta");
    const byBrand: Record<string, number> = {};
    cardPayments.forEach((p) => {
      const k = p.card_brand ?? "Otro";
      byBrand[k] = (byBrand[k] ?? 0) + Number(p.amount);
    });
    const byTerminal: Record<string, number> = {};
    cardPayments.forEach((p) => {
      const k = p.terminal_id ?? "—";
      byTerminal[k] = (byTerminal[k] ?? 0) + Number(p.amount);
    });

    const transferRefs = payments
      .filter((p) => p.payment_method === "transferencia")
      .map((p) => ({ ref: p.transfer_reference ?? "—", bank: p.bank_name ?? "—", amount: Number(p.amount) }));

    return {
      tickets, totalVentas, efectivo, tarjeta, transferencia, pendiente, mixto,
      cancelled: cancelled.length,
      promedio: tickets > 0 ? totalVentas / tickets : 0,
      efectivoEsperado, efectivoContado, diferencia,
      fondoEgresos, fondoIngresos, fondoMovimientos,
      byBrand, byTerminal, cardPayments, transferRefs,
    };
  }, [sales, payments, selected, fondos]);

  function reimprimir(sale: Sale) {
    const itemRows = items.filter((i) => i.sale_id === sale.id);
    const payRows = payments.filter((p) => p.sale_id === sale.id);
    const ticketPayments: TicketPaymentLine[] = payRows.map((p) => ({
      method: p.payment_method,
      amount: Number(p.amount),
      card_brand: p.card_brand,
      card_last4: p.card_last4,
      authorization_code: p.authorization_code,
      terminal_id: p.terminal_id,
      transfer_reference: p.transfer_reference,
      bank_name: p.bank_name,
    }));
    setTicketData({
      folio: sale.id.slice(0, 8).toUpperCase(),
      fecha: new Date(sale.created_at),
      cajero: "—",
      clinica: activeClinic?.name ?? "Clínica",
      cliente: sale.customer_name ?? "Público general",
      paciente: null,
      metodoPago: sale.payment_method ?? "—",
      payments: ticketPayments,
      items: itemRows.map((i) => ({
        nombre: meds[i.medicamento_id] ?? "Producto",
        cantidad: i.quantity,
        precio: Number(i.unit_price),
      })),
      subtotal: Number(sale.subtotal),
      descuento: Number(sale.discount),
      total: Number(sale.total),
    });
    setTicketOpen(true);
  }

  const canCloseSelected =
    !!selected &&
    selected.status === "open" &&
    (perms.isManager || selected.cashier_user_id === user?.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Corte de caja</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadShifts}>
            <RefreshCw className="h-4 w-4 mr-1" />Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />Imprimir corte
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Lista de turnos */}
        <div className="rounded-xl border border-border bg-card p-2 space-y-1 max-h-[500px] overflow-auto">
          {shifts.length === 0 && (
            <p className="text-xs text-muted-foreground p-3">Sin turnos registrados.</p>
          )}
          {shifts.map((sh) => (
            <button
              key={sh.id}
              type="button"
              onClick={() => setSelected(sh)}
              className={`w-full text-left rounded-md px-3 py-2 text-xs border transition-colors ${
                selected?.id === sh.id ? "bg-accent border-primary" : "border-transparent hover:bg-accent"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono">{sh.id.slice(0, 6).toUpperCase()}</span>
                <Badge variant={sh.status === "open" ? "default" : "outline"} className="text-[10px]">
                  {sh.status}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {format(new Date(sh.opened_at), "dd/MM HH:mm", { locale: es })}
                {sh.closed_at && ` → ${format(new Date(sh.closed_at), "HH:mm", { locale: es })}`}
              </p>
              <p className="text-[11px]">Inicial: {formatMXN(sh.opening_amount)}</p>
            </button>
          ))}
        </div>

        {/* Detalle del turno */}
        {selected ? (
          <div id="corte-print" className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    Turno {selected.id.slice(0, 6).toUpperCase()}{" "}
                    <Badge variant={selected.status === "open" ? "default" : "outline"} className="ml-2">
                      {selected.status}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Abierto {format(new Date(selected.opened_at), "dd/MM/yyyy HH:mm", { locale: es })}
                    {selected.closed_at && ` · Cerrado ${format(new Date(selected.closed_at), "dd/MM/yyyy HH:mm", { locale: es })}`}
                  </p>
                </div>
                {canCloseSelected && (
                  <div className="flex gap-2 flex-wrap">
                    {perms.isManager && (
                      <Button size="sm" variant="outline" onClick={() => setReturnOpen(true)}>
                        <span className="text-xs">Devolución</span>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setFondoOpen(true)}>
                      <span className="text-xs">Fondo</span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCorteXOpen(true)}>
                      <FileText className="h-4 w-4 mr-1" />Corte X
                    </Button>
                    <Button size="sm" onClick={() => setCloseOpen(true)}>
                      <Lock className="h-4 w-4 mr-1" />Cerrar turno
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <Stat label="Monto inicial" value={formatMXN(selected.opening_amount)} />
                <Stat label="Total ventas" value={formatMXN(resumen.totalVentas)} />
                <Stat label="Tickets" value={String(resumen.tickets)} />
                <Stat label="Promedio" value={formatMXN(resumen.promedio)} />
                <Stat label="Efectivo" value={formatMXN(resumen.efectivo)} />
                <Stat label="Tarjeta" value={formatMXN(resumen.tarjeta)} />
                <Stat label="Transferencia" value={formatMXN(resumen.transferencia)} />
                <Stat label="Pendiente" value={formatMXN(resumen.pendiente)} />
                <Stat label="Mixto (ventas)" value={formatMXN(resumen.mixto)} />
                <Stat label="Canceladas" value={String(resumen.cancelled)} />
                {resumen.fondoEgresos > 0 && <Stat label="Retiros de fondo" value={`-${formatMXN(resumen.fondoEgresos)}`} />}
                {resumen.fondoIngresos > 0 && <Stat label="Ingresos de fondo" value={`+${formatMXN(resumen.fondoIngresos)}`} />}
                <Stat label="Efectivo esperado" value={formatMXN(resumen.efectivoEsperado)} />
                <Stat
                  label="Efectivo contado"
                  value={resumen.efectivoContado != null ? formatMXN(resumen.efectivoContado) : "—"}
                />
              </div>

              {resumen.diferencia != null && (
                <div className={`rounded-md p-3 text-sm border ${
                  resumen.diferencia === 0 ? "border-primary/40 bg-primary/5"
                    : resumen.diferencia > 0 ? "border-warning/40 bg-warning/5"
                    : "border-destructive/40 bg-destructive/5"
                }`}>
                  <strong>
                    {resumen.diferencia === 0 ? "Cuadrado" : resumen.diferencia > 0 ? "Sobrante" : "Faltante"}:
                  </strong>{" "}
                  {formatMXN(resumen.diferencia)}
                </div>
              )}
            </div>

            {/* Desglose tarjeta */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h3 className="font-semibold text-sm">Desglose tarjeta</h3>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="font-medium mb-1">Por marca</p>
                  {Object.keys(resumen.byBrand).length === 0 && <p className="text-muted-foreground">—</p>}
                  {Object.entries(resumen.byBrand).map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span>{k}</span><span>{formatMXN(v)}</span></div>
                  ))}
                </div>
                <div>
                  <p className="font-medium mb-1">Por terminal</p>
                  {Object.keys(resumen.byTerminal).length === 0 && <p className="text-muted-foreground">—</p>}
                  {Object.entries(resumen.byTerminal).map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span>{k}</span><span>{formatMXN(v)}</span></div>
                  ))}
                </div>
              </div>
              {resumen.cardPayments.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Autorizaciones ({resumen.cardPayments.length})</summary>
                  <div className="space-y-0.5 pt-2 font-mono">
                    {resumen.cardPayments.map((p) => (
                      <p key={p.id}>
                        {p.card_brand ?? "—"} ****{p.card_last4 ?? "----"} · aut {p.authorization_code ?? "—"} · {formatMXN(Number(p.amount))}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* Desglose transferencia */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h3 className="font-semibold text-sm">Desglose transferencia</h3>
              {resumen.transferRefs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin transferencias.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr><th className="text-left">Referencia</th><th className="text-left">Banco</th><th className="text-right">Monto</th></tr>
                  </thead>
                  <tbody>
                    {resumen.transferRefs.map((t, i) => (
                      <tr key={i}><td className="font-mono">{t.ref}</td><td>{t.bank}</td><td className="text-right">{formatMXN(t.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Movimientos de fondo */}
            {resumen.fondoMovimientos.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" />Movimientos de fondo
                </h3>
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left py-1">Hora</th>
                      <th className="text-left">Tipo</th>
                      <th className="text-left">Motivo</th>
                      <th className="text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {resumen.fondoMovimientos.map((f) => (
                      <tr key={f.id}>
                        <td className="py-1 text-muted-foreground whitespace-nowrap">
                          {format(new Date(f.created_at), "HH:mm", { locale: es })}
                        </td>
                        <td>
                          <span className={`font-medium ${f.tipo === "egreso" ? "text-destructive" : "text-success"}`}>
                            {f.tipo === "egreso" ? "Retiro" : "Depósito"}
                          </span>
                        </td>
                        <td className="max-w-[200px] truncate">{f.motivo}</td>
                        <td className={`text-right font-mono ${f.tipo === "egreso" ? "text-destructive" : "text-success"}`}>
                          {f.tipo === "egreso" ? "-" : "+"}{formatMXN(Number(f.monto))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Cortes del turno (Z y X) */}
            {cortes.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />Cortes del turno
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground bg-muted/50">
                      <tr>
                        <th className="text-left px-2 py-1.5">Folio</th>
                        <th className="text-left px-2 py-1.5">Tipo</th>
                        <th className="text-left px-2 py-1.5">Fecha</th>
                        <th className="text-right px-2 py-1.5">Efectivo</th>
                        <th className="text-right px-2 py-1.5">Tarjeta</th>
                        <th className="text-right px-2 py-1.5">Total</th>
                        <th className="text-right px-2 py-1.5">Esperado</th>
                        <th className="text-right px-2 py-1.5">Contado</th>
                        <th className="text-right px-2 py-1.5">Diferencia</th>
                        <th className="text-center px-2 py-1.5">Tickets</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {cortes.map((c) => {
                        const diff = c.diferencia != null ? Number(c.diferencia) : null;
                        const diffColor = diff == null ? "" : diff === 0 ? "text-green-600" : diff > 0 ? "text-amber-600" : "text-destructive";
                        const DiffIcon = diff == null ? null : diff === 0 ? Minus : diff > 0 ? TrendingUp : TrendingDown;
                        return (
                          <tr key={c.id} className="hover:bg-muted/30">
                            <td className="px-2 py-1.5 font-mono font-semibold">
                              {c.tipo}-{String(c.folio_secuencial ?? 0).padStart(6, "0")}
                            </td>
                            <td className="px-2 py-1.5">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                c.tipo === "Z" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                              }`}>{c.tipo === "Z" ? "Corte Z" : "Corte X"}</span>
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                              {format(new Date(c.created_at), "dd/MM HH:mm", { locale: es })}
                            </td>
                            <td className="px-2 py-1.5 text-right">{formatMXN(c.total_efectivo)}</td>
                            <td className="px-2 py-1.5 text-right">{formatMXN(c.total_tarjeta)}</td>
                            <td className="px-2 py-1.5 text-right font-semibold">{formatMXN(c.total_general)}</td>
                            <td className="px-2 py-1.5 text-right">{c.efectivo_esperado != null ? formatMXN(c.efectivo_esperado) : "—"}</td>
                            <td className="px-2 py-1.5 text-right">{c.conteo_ciego != null ? formatMXN(c.conteo_ciego) : "—"}</td>
                            <td className={`px-2 py-1.5 text-right font-medium ${diffColor}`}>
                              {diff != null ? (
                                <span className="flex items-center justify-end gap-1">
                                  {DiffIcon && <DiffIcon className="h-3 w-3" />}
                                  {formatMXN(diff)}
                                  {c.requiere_autorizacion && (
                                    <span className="ml-1 rounded-full bg-amber-500/20 text-amber-700 text-[9px] px-1">Auth</span>
                                  )}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-center">{c.conteo_movimientos}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tabla de ventas */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h3 className="font-semibold text-sm">Ventas del turno</h3>
              {loading ? (
                <p className="text-xs text-muted-foreground">Cargando…</p>
              ) : sales.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin ventas registradas.</p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="text-left">Folio</th>
                        <th className="text-left">Hora</th>
                        <th className="text-left">Cliente</th>
                        <th className="text-left">Métodos</th>
                        <th className="text-left">Status</th>
                        <th className="text-right">Total</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((s) => {
                        const pays = payments.filter((p) => p.sale_id === s.id);
                        const methods = pays.length > 0
                          ? pays.map((p) => `${p.payment_method}${p.card_last4 ? ` ****${p.card_last4}` : ""}`).join(", ")
                          : (s.payment_method ?? "—");
                        return (
                          <tr key={s.id} className="border-t border-border">
                            <td className="font-mono py-1">{s.id.slice(0, 8).toUpperCase()}</td>
                            <td>{format(new Date(s.created_at), "HH:mm", { locale: es })}</td>
                            <td>{s.customer_name ?? "—"}</td>
                            <td className="text-[11px]">{methods}</td>
                            <td>
                              <Badge variant={s.status === "cancelled" ? "destructive" : "outline"} className="text-[10px]">
                                {s.status}
                              </Badge>
                            </td>
                            <td className="text-right">{formatMXN(Number(s.total))}</td>
                            <td>
                              <Button size="sm" variant="ghost" onClick={() => reimprimir(s)}>
                                <ReceiptText className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Selecciona un turno para ver el detalle.</p>
        )}
      </div>

      {perms.isManager && activeClinicId && (
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-sm">Libro de control COFEPRIS</h3>
          <LibroControl clinicId={activeClinicId} clinicName={activeClinic?.name} />
        </div>
      )}

      <CloseShiftDialog
        open={closeOpen}
        shift={selected}
        onClose={() => setCloseOpen(false)}
        onClosed={() => { setCloseOpen(false); loadShifts().then(() => selected && loadShiftDetail(selected)); }}
      />
      <CorteXDialog
        open={corteXOpen}
        shift={selected}
        onClose={() => setCorteXOpen(false)}
      />
      <FondoMovimientoDialog
        open={fondoOpen}
        shift={selected}
        onClose={() => setFondoOpen(false)}
      />
      <TicketInterno open={ticketOpen} onClose={() => setTicketOpen(false)} data={ticketData} />
      {activeClinicId && (
        <ReturnDialog
          open={returnOpen}
          onClose={() => { setReturnOpen(false); selected && loadShiftDetail(selected); }}
          clinicId={activeClinicId}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  );
}
