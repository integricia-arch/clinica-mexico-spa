import { useEffect, useState } from "react";
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
import { AlertTriangle, ScanLine, Search, Lock, CheckCircle2, Loader2, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { friendlyError } from "@/lib/errors";

/**
 * NOTE — Liga futura con módulo de almacén:
 * Cada surtido aquí crea un registro en `pharmacy_sales` + `pharmacy_sale_items`
 * y un movimiento `salida_surtido_receta` en `movimientos_inventario`
 * (reference_type='pharmacy_sale', reference_id=sale_id).
 * El módulo de almacén futuro debe consumir `movimientos_inventario` como
 * fuente única de entradas, salidas, compras y ajustes para reconstruir existencias.
 */

const formatMXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const PAYMENT_METHODS = ["Efectivo", "Tarjeta débito", "Tarjeta crédito", "Transferencia"];

type Lote = {
  id: string;
  medicamento_id: string;
  numero_lote: string;
  fecha_caducidad: string;
  fecha_entrada: string;
  existencia: number;
};

type RxItemRow = {
  id: string;
  generic_name: string;
  brand_name: string | null;
  dose: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string | null;
  quantity: number | null;
  medication_id: string | null;
  is_controlled: boolean;
};

type Med = {
  id: string;
  nombre: string;
  precio_unitario: number;
  unidad: string;
  activo: boolean;
  is_controlled: boolean;
  regulatory_notes: string | null;
};

type Dispense = {
  item: RxItemRow;
  med: Med | null;
  lote: Lote | null;
  already: number;
  pending: number;
  stock: number;
  qtyToDispense: number;
  unitPrice: number;
};

type Prescription = {
  id: string;
  prescription_number: string | null;
  status: string;
  issue_date: string | null;
  diagnosis: string | null;
  notes: string | null;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  clinic_id: string;
};

type Patient = { nombre: string; apellidos: string };
type Doctor = { nombre: string; apellidos: string; especialidad: string };

/**
 * Extrae el identificador de receta de:
 * - prescription_number plano (ej. RX-20260527-5678-00001)
 * - payload qr_code_value formato "RX-...|patient_id|doctor_id"
 * - URL /verificar-receta/<id-o-numero>
 */
function parseScannedCode(raw: string): { number: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { number: null };
  // URL /verificar-receta/<x>
  const urlMatch = trimmed.match(/verificar-receta\/([^/?#\s]+)/i);
  if (urlMatch) return { number: decodeURIComponent(urlMatch[1]) };
  // payload con pipes: primer segmento = prescription_number
  if (trimmed.includes("|")) return { number: trimmed.split("|")[0].trim() };
  return { number: trimmed };
}

async function logAudit(
  clinicId: string | null,
  event: string,
  data: Record<string, unknown>,
  registroId: string | null = null,
) {
  try {
    await supabase.from("audit_logs").insert({
      accion: "consultar",
      tabla: "prescriptions",
      registro_id: registroId,
      clinic_id: clinicId,
      datos_nuevos: { event, ...data },
    } as never);
  } catch {
    /* audit best-effort */
  }
}

export default function SurtirReceta({ initialCode }: { initialCode?: string } = {}) {
  const { hasRole } = useAuth();
  const { activeClinicId } = useActiveClinic();
  const { toast } = useToast();
  const canSell = hasRole("admin") || hasRole("nurse") || hasRole("receptionist");

  const [code, setCode] = useState(initialCode ?? "");
  const [searching, setSearching] = useState(false);
  const [rx, setRx] = useState<Prescription | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [items, setItems] = useState<Dispense[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [payment, setPayment] = useState<string>("Efectivo");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (initialCode && initialCode.trim()) {
      setCode(initialCode);
      const { number } = parseScannedCode(initialCode);
      if (number) loadPrescription(number);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);


  function reset() {
    setRx(null);
    setPatient(null);
    setDoctor(null);
    setItems([]);
    setNotes("");
    setPayment("Efectivo");
  }

  async function loadPrescription(parsedNumber: string) {
    setSearching(true);
    try {
      // 1) Buscar por prescription_number o id
      let { data: rxRow } = await supabase
        .from("prescriptions")
        .select(
          "id, prescription_number, status, issue_date, diagnosis, notes, patient_id, doctor_id, appointment_id, clinic_id",
        )
        .eq("prescription_number", parsedNumber)
        .maybeSingle();

      if (!rxRow) {
        // intenta por id
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsedNumber);
        if (isUuid) {
          const { data } = await supabase
            .from("prescriptions")
            .select(
              "id, prescription_number, status, issue_date, diagnosis, notes, patient_id, doctor_id, appointment_id, clinic_id",
            )
            .eq("id", parsedNumber)
            .maybeSingle();
          rxRow = data ?? null;
        }
      }

      if (!rxRow) {
        await logAudit(activeClinicId, "prescription_scan_not_found", { code: parsedNumber });
        toast({ title: "Receta no encontrada.", variant: "destructive" });
        return;
      }

      if (activeClinicId && rxRow.clinic_id && rxRow.clinic_id !== activeClinicId) {
        await logAudit(rxRow.clinic_id, "prescription_scan_blocked_other_clinic", {
          code: parsedNumber,
          prescription_id: rxRow.id,
        }, rxRow.id);
        toast({ title: "Receta no pertenece a esta clínica.", variant: "destructive" });
        return;
      }

      if (rxRow.status === "draft") {
        toast({ title: "La receta aún no ha sido emitida.", variant: "destructive" });
        return;
      }
      if (rxRow.status === "cancelled") {
        await logAudit(rxRow.clinic_id, "prescription_scan_blocked_cancelled", { prescription_id: rxRow.id }, rxRow.id);
        toast({ title: "Receta cancelada.", variant: "destructive" });
        return;
      }
      if (rxRow.status === "dispensed") {
        toast({ title: "Receta ya surtida.", variant: "destructive" });
        return;
      }

      // 2) Cargar items + sums + paciente/doctor + meds + lotes en paralelo
      const [itemsRes, dispRes, pRes, dRes] = await Promise.all([
        supabase.from("prescription_items").select("*").eq("prescription_id", rxRow.id).order("created_at"),
        supabase.from("pharmacy_sale_items").select("prescription_item_id, quantity").not("prescription_item_id", "is", null),
        supabase.from("patients").select("nombre, apellidos").eq("id", rxRow.patient_id).maybeSingle(),
        supabase.from("doctors").select("nombre, apellidos, especialidad").eq("id", rxRow.doctor_id).maybeSingle(),
      ]);

      const rxItems = (itemsRes.data as RxItemRow[]) ?? [];
      const dispensedByItem = new Map<string, number>();
      for (const r of (dispRes.data ?? []) as { prescription_item_id: string; quantity: number }[]) {
        dispensedByItem.set(r.prescription_item_id, (dispensedByItem.get(r.prescription_item_id) ?? 0) + Number(r.quantity));
      }

      const medIds = Array.from(new Set(rxItems.map((i) => i.medication_id).filter(Boolean) as string[]));
      const [medsRes, lotesRes] = await Promise.all([
        medIds.length
          ? supabase.from("medicamentos").select("id, nombre, precio_unitario, unidad, activo, is_controlled, regulatory_notes").in("id", medIds)
          : Promise.resolve({ data: [] as Med[] }),
        medIds.length
          ? supabase.from("lotes_medicamento").select("*").in("medicamento_id", medIds).gt("existencia", 0).order("fecha_entrada")
          : Promise.resolve({ data: [] as Lote[] }),
      ]);
      const meds = (medsRes.data as Med[]) ?? [];
      const lotes = (lotesRes.data as Lote[]) ?? [];
      const today = new Date().toISOString().slice(0, 10);

      const dispenses: Dispense[] = rxItems.map((it) => {
        const med = it.medication_id ? meds.find((m) => m.id === it.medication_id) ?? null : null;
        const required = Number(it.quantity ?? 0);
        const already = dispensedByItem.get(it.id) ?? 0;
        const pending = Math.max(0, required - already);
        const medLotes = med
          ? lotes.filter((l) => l.medicamento_id === med.id && l.fecha_caducidad >= today)
          : [];
        const stock = medLotes.reduce((s, l) => s + l.existencia, 0);
        const lote = medLotes.sort((a, b) => {
          const e = a.fecha_entrada.localeCompare(b.fecha_entrada);
          return e !== 0 ? e : a.fecha_caducidad.localeCompare(b.fecha_caducidad);
        })[0] ?? null;
        const qtyToDispense = Math.min(pending, stock);
        return {
          item: it,
          med,
          lote,
          already,
          pending,
          stock,
          qtyToDispense,
          unitPrice: med?.precio_unitario ?? 0,
        };
      });

      setRx(rxRow);
      setPatient((pRes.data as Patient) ?? null);
      setDoctor((dRes.data as Doctor) ?? null);
      setItems(dispenses);

      await logAudit(rxRow.clinic_id, "prescription_scanned", {
        prescription_id: rxRow.id,
        prescription_number: rxRow.prescription_number,
        items: rxItems.length,
      }, rxRow.id);
    } catch (e: any) {
      toast({ title: "Error", description: friendlyError(e), variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }

  function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    const { number } = parseScannedCode(code);
    if (!number) {
      toast({ title: "Ingresa o escanea un código de receta", variant: "destructive" });
      return;
    }
    loadPrescription(number);
  }

  function updateQty(idx: number, qty: number) {
    setItems((prev) =>
      prev.map((d, i) => {
        if (i !== idx) return d;
        const max = Math.min(d.pending, d.stock);
        const q = Math.max(0, Math.min(qty, max));
        return { ...d, qtyToDispense: q };
      }),
    );
  }

  const totalToDispense = items.reduce((s, d) => s + d.qtyToDispense, 0);
  const totalMoney = items.reduce((s, d) => s + d.qtyToDispense * d.unitPrice, 0);

  async function confirmDispense() {
    if (!rx || !canSell) return;
    const dispensable = items.filter((d) => d.qtyToDispense > 0 && d.med && d.lote);
    if (dispensable.length === 0) {
      toast({ title: "Nada por surtir", description: "No hay cantidades válidas.", variant: "destructive" });
      return;
    }

    // Validar controlados: registrar evento; no bloquea porque viene con receta
    for (const d of dispensable) {
      if (d.med?.is_controlled) {
        await logAudit(rx.clinic_id, "prescription_dispense_controlled_item", {
          prescription_id: rx.id,
          medicamento_id: d.med.id,
          prescription_item_id: d.item.id,
          quantity: d.qtyToDispense,
        }, rx.id);
      }
    }

    setSubmitting(true);
    const payload = {
      sale_type: "prescription_dispense",
      patient_id: rx.patient_id,
      prescription_id: rx.id,
      payment_method: payment,
      payment_status: "paid",
      requires_invoice: false,
      notes: notes || null,
      discount: 0,
      items: dispensable.map((d) => ({
        medicamento_id: d.med!.id,
        lote_id: d.lote!.id,
        prescription_item_id: d.item.id,
        quantity: d.qtyToDispense,
        unit_price: d.unitPrice,
        discount: 0,
      })),
    };

    const { data: saleId, error } = await supabase.rpc("pharmacy_register_sale", {
      p_payload: payload as never,
    });
    if (error) {
      setSubmitting(false);
      await logAudit(rx.clinic_id, "prescription_dispense_failed", {
        prescription_id: rx.id,
        message: error.message,
      }, rx.id);
      toast({ title: "No se pudo surtir", description: friendlyError(error), variant: "destructive" });
      return;
    }

    // Recalcular estado receta
    const { data: newStatus } = await supabase.rpc("pharmacy_recompute_prescription_status", {
      p_prescription_id: rx.id,
    });

    await logAudit(rx.clinic_id, "prescription_dispensed", {
      prescription_id: rx.id,
      sale_id: saleId,
      items: dispensable.length,
      new_status: newStatus,
    }, rx.id);

    toast({
      title: "Surtido registrado",
      description: `Folio venta ${String(saleId).slice(0, 8)} · ${formatMXN(totalMoney)} · Receta: ${newStatus ?? rx.status}`,
    });

    setSubmitting(false);

    // Recargar para reflejar pendiente
    if (newStatus === "dispensed") {
      reset();
      setCode("");
    } else {
      // recargar la misma receta
      await loadPrescription(rx.prescription_number ?? rx.id);
    }
  }

  const hasInsufficient = items.some((d) => d.pending > 0 && d.stock < d.pending);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Escáner */}
      <form
        onSubmit={onSubmitCode}
        className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3"
      >
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Escanear receta</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Escanea el código QR de la receta o ingresa el folio (ej. <span className="font-mono">RX-20260527-5678-00001</span>).
          El QR contiene el identificador interno de la receta; no almacena datos clínicos sensibles.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Escanear código de receta…"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="pl-9 font-mono"
            />
          </div>
          <Button type="submit" disabled={searching || !code.trim()}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </Button>
          {rx && (
            <Button type="button" variant="outline" onClick={() => { reset(); setCode(""); }}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>

      {/* Detalle */}
      {rx && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground">Folio</p>
                <p className="font-mono font-semibold">{rx.prescription_number ?? rx.id.slice(0, 8)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paciente</p>
                <p className="font-medium">
                  {patient ? `${patient.nombre} ${patient.apellidos}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Médico</p>
                <p className="font-medium">
                  {doctor ? `${doctor.nombre} ${doctor.apellidos}` : "—"}
                </p>
                {doctor && <p className="text-[11px] text-muted-foreground">{doctor.especialidad}</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha emisión</p>
                <p className="font-medium">
                  {rx.issue_date ? format(new Date(rx.issue_date), "dd/MM/yyyy", { locale: es }) : "—"}
                </p>
              </div>
              <div className="flex flex-col items-end">
                <p className="text-xs text-muted-foreground">Estado</p>
                <Badge
                  variant={
                    rx.status === "issued"
                      ? "default"
                      : rx.status === "partially_dispensed"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {rx.status === "issued"
                    ? "Emitida"
                    : rx.status === "partially_dispensed"
                      ? "Surtido parcial"
                      : rx.status}
                </Badge>
              </div>
            </div>
            {rx.diagnosis && (
              <div className="text-xs">
                <span className="text-muted-foreground">Diagnóstico: </span>
                <span>{rx.diagnosis}</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="divide-y divide-border">
            {items.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground text-center">Sin medicamentos en esta receta.</p>
            )}
            {items.map((d, i) => {
              const noMed = !d.med;
              const fullyDispensed = d.pending === 0;
              const insufficient = d.pending > 0 && d.stock < d.pending;
              return (
                <div key={d.item.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[240px]">
                      <p className="font-medium">
                        {d.item.generic_name}
                        {d.item.brand_name && <span className="text-muted-foreground"> · {d.item.brand_name}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d.item.dose} · {d.item.frequency} · {d.item.duration} · vía {d.item.route}
                      </p>
                      {d.item.instructions && (
                        <p className="text-xs mt-1">{d.item.instructions}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {d.item.is_controlled && (
                        <Badge variant="destructive" className="gap-1">
                          <Lock className="h-3 w-3" /> Controlado
                        </Badge>
                      )}
                      {fullyDispensed && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Surtido total
                        </Badge>
                      )}
                      {noMed && (
                        <Badge variant="outline" className="gap-1 text-warning border-warning/40">
                          Sin liga a catálogo
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Indicado</p>
                      <p className="font-semibold">{d.item.quantity ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ya surtido</p>
                      <p className="font-semibold">{d.already}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Pendiente</p>
                      <p className="font-semibold">{d.pending}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Existencia</p>
                      <p className={`font-semibold ${insufficient ? "text-destructive" : ""}`}>{d.stock}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Lote FIFO</p>
                      <p className="font-mono">
                        {d.lote
                          ? `${d.lote.numero_lote} · cad ${format(new Date(d.lote.fecha_caducidad), "dd/MM/yy")}`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {insufficient && (
                    <p className="text-[11px] text-destructive flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      Sin existencia suficiente. Puede surtirse parcialmente o marcarse pendiente.
                    </p>
                  )}
                  {noMed && (
                    <p className="text-[11px] text-warning flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      Este medicamento no está ligado al catálogo de farmacia; no se puede surtir desde aquí.
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Label className="text-xs">Surtir ahora</Label>
                    <Input
                      type="number"
                      min={0}
                      max={Math.min(d.pending, d.stock)}
                      value={d.qtyToDispense}
                      onChange={(e) => updateQty(i, Number(e.target.value))}
                      disabled={fullyDispensed || noMed || d.stock === 0}
                      className="h-8 w-24"
                    />
                    <span className="text-xs text-muted-foreground">
                      {d.med?.unidad ?? ""}
                    </span>
                    <span className="ml-auto text-xs">
                      {formatMXN(d.qtyToDispense * d.unitPrice)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pie cobro */}
          {items.length > 0 && (
            <div className="p-4 border-t border-border space-y-3 bg-muted/20">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Método de pago</Label>
                  <Select value={payment} onValueChange={setPayment}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Notas</Label>
                  <Textarea
                    rows={2}
                    placeholder="Notas (opcional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-muted-foreground">Unidades a surtir: </span>
                  <span className="font-semibold">{totalToDispense}</span>
                </div>
                <div className="text-base font-semibold">{formatMXN(totalMoney)}</div>
              </div>
              {hasInsufficient && (
                <p className="text-[11px] text-warning flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  Algunos items se surtirán parcialmente; el resto quedará pendiente en la receta.
                </p>
              )}
              <Button
                className="w-full"
                disabled={submitting || totalToDispense === 0 || !canSell}
                onClick={confirmDispense}
              >
                {submitting ? "Surtiendo…" : `Confirmar surtido · ${formatMXN(totalMoney)}`}
              </Button>
              {!canSell && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Tu rol no tiene permiso para registrar surtidos.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
