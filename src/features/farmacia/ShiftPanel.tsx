/**
 * Apertura, vista y cierre de turno de caja del POS Farmacia.
 *
 * Conteo ciego: el cajero no ve el efectivo esperado antes de contar.
 * El sistema calcula la diferencia en backend (pharmacy_close_shift).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Banknote, LockOpen, Lock, TrendingUp, TrendingDown, Minus, FileText, ArrowUpDown, Info, CheckCircle, Printer } from "lucide-react";
import { friendlyError } from "@/lib/errors";
import SupervisorAuthDialog from "@/components/turno/SupervisorAuthDialog";
import { useAuth } from "@/hooks/useAuth";
import { printActaArqueo } from "@/lib/printActaArqueo";
import PagoReconcile from "@/components/turno/PagoReconcile";
import DenominacionCounter, { type DenomBreakdown } from "@/components/turno/DenominacionCounter";

const formatMXN = (n: number) =>
  Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export type Shift = {
  id: string;
  clinic_id: string;
  cashier_user_id: string;
  status: "open" | "closed" | "cancelled";
  opening_amount: number;
  opened_at: string;
  closed_at: string | null;
  expected_cash_amount: number | null;
  closing_cash_count: number | null;
  cash_difference: number | null;
  notes: string | null;
  close_notes: string | null;
};

type CloseResult = {
  folio: number;
  corte_id: string;
  opening_amount: number;
  cash_total_sales: number;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  supervisor_override: boolean;
};

type CorteXResult = {
  folio: number;
  corte_id: string;
  total_efectivo: number;
  total_tarjeta: number;
  total_transferencia: number;
  total_otros: number;
  total_general: number;
  tickets: number;
  opening_amount: number;
};

export function ShiftBadge({ shift }: { shift: Shift | null }) {
  if (!shift) return <Badge variant="destructive">Sin turno</Badge>;
  const shortId = shift.id ? shift.id.slice(0, 6).toUpperCase() : "------";
  return (
    <Badge variant="outline" className="gap-1">
      <LockOpen className="h-3 w-3" />
      Turno {shortId} · {formatMXN(shift.opening_amount ?? 0)}
    </Badge>
  );
}

export function OpenShiftCard({ onOpened }: { onOpened: (shift: Shift) => void }) {
  const { activeClinicId } = useActiveClinic();
  const { toast } = useToast();
  const [opening, setOpening] = useState("0");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function open() {
    if (!activeClinicId) return;
    const amount = Number(opening);
    if (Number.isNaN(amount) || amount < 0) {
      toast({ title: "Monto inválido", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data: shiftId, error } = await supabase.rpc("pharmacy_open_shift", {
      p_clinic_id: activeClinicId,
      p_opening_amount: amount,
      p_notes: notes || null,
    } as never);
    if (error) {
      setSubmitting(false);
      toast({ title: "No se pudo abrir turno", description: friendlyError(error), variant: "destructive" });
      return;
    }
    const { data: shift } = await supabase
      .from("pharmacy_cash_shifts")
      .select("*")
      .eq("id", shiftId as never)
      .maybeSingle();
    setSubmitting(false);
    if (shift) {
      onOpened(shift as unknown as Shift);
      toast({ title: "Turno abierto" });
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4 max-w-md mx-auto">
      <div className="flex items-center gap-2">
        <Banknote className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Abrir turno de caja</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Debes abrir turno antes de registrar ventas.
      </p>
      <div className="space-y-1">
        <Label className="text-xs">Monto inicial en caja (MXN)</Label>
        <MoneyInput
          value={opening}
          onValueChange={setOpening}
          className="h-11 text-base"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notas (opcional)</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button className="w-full h-12" onClick={open} disabled={submitting}>
        {submitting ? "Abriendo…" : "Abrir turno"}
      </Button>
    </div>
  );
}

export function CloseShiftDialog({
  open, shift, onClose, onClosed,
}: {
  open: boolean;
  shift: Shift | null;
  onClose: () => void;
  onClosed: () => void;
}) {
  const { toast } = useToast();
  const { activeClinic } = useActiveClinic();
  const { user } = useAuth();
  const [count, setCount] = useState("0");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [overridePrompt, setOverridePrompt] = useState<{ diff: number; umbral: number } | null>(null);
  const [result, setResult] = useState<CloseResult | null>(null);
  const [cashRefunds, setCashRefunds] = useState<{ count: number; total: number } | null>(null);
  const [fondoInput, setFondoInput] = useState("");
  const [fondoGuardado, setFondoGuardado] = useState<{ fondo: number; deposito: number } | null>(null);
  const [savingFondo, setSavingFondo] = useState(false);
  const [denomBreakdown, setDenomBreakdown] = useState<DenomBreakdown>({});

  useEffect(() => {
    if (!open || !shift) return;
    setCashRefunds(null);
    supabase
      .from("fondos_movimientos")
      .select("monto")
      .eq("pharmacy_shift_id", shift.id)
      .eq("tipo", "egreso")
      .ilike("motivo", "Reembolso%")
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        setCashRefunds({
          count: data.length,
          total: data.reduce((s, r) => s + Number(r.monto), 0),
        });
      });
  }, [open, shift?.id]);

  function reset() {
    setCount("0");
    setNotes("");
    setSubmitting(false);
    setOverridePrompt(null);
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleClosed() {
    reset();
    onClosed();
  }

  async function submit(supervisorOverride = false) {
    if (!shift) return;
    const amount = Number(count);
    if (Number.isNaN(amount) || amount < 0) {
      toast({ title: "Monto inválido", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    setOverridePrompt(null);

    const { data, error } = await supabase.rpc("pharmacy_close_shift", {
      p_shift_id: shift.id,
      p_cash_count: amount,
      p_notes: notes || null,
      p_supervisor_override: supervisorOverride,
    } as never);

    setSubmitting(false);

    if (error) {
      if (error.message?.startsWith("DIFF_EXCEEDS_THRESHOLD")) {
        const parts = error.message.split("|");
        const diff = Number(parts[1] ?? 0);
        const umbral = Number(parts[2] ?? 0);
        setOverridePrompt({ diff, umbral });
        return;
      }
      toast({ title: "No se pudo cerrar el turno", description: friendlyError(error), variant: "destructive" });
      return;
    }

    const r = data as unknown as CloseResult;
    setResult(r);
    setFondoInput(String(r.opening_amount ?? 0));
  }

  if (result) {
    const diffColor =
      result.difference === 0 ? "text-green-600" :
      result.difference > 0 ? "text-amber-600" : "text-red-600";
    const DiffIcon = result.difference === 0 ? Minus : result.difference > 0 ? TrendingUp : TrendingDown;

    return (
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Turno cerrado — Folio Z-{String(result.folio).padStart(6, "0")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-lg border border-border bg-muted/40 p-4 grid grid-cols-2 gap-2 text-sm">
              <ResultRow label="Monto inicial" value={formatMXN(result.opening_amount)} />
              <ResultRow label="Ventas efectivo" value={formatMXN(result.cash_total_sales)} />
              <ResultRow label="Esperado" value={formatMXN(result.expected_cash)} />
              <ResultRow label="Contado" value={formatMXN(result.counted_cash)} />
            </div>
            <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 ${
              result.difference === 0 ? "border-green-500/40 bg-green-500/5" :
              result.difference > 0 ? "border-amber-500/40 bg-amber-500/5" :
              "border-red-500/40 bg-red-500/5"
            }`}>
              <DiffIcon className={`h-5 w-5 ${diffColor}`} />
              <div>
                <p className={`font-semibold text-sm ${diffColor}`}>
                  {result.difference === 0 ? "Cuadrado" : result.difference > 0 ? "Sobrante" : "Faltante"}:{" "}
                  {formatMXN(result.difference)}
                </p>
                {result.supervisor_override && (
                  <p className="text-xs text-muted-foreground">Autorizado por supervisor</p>
                )}
              </div>
            </div>
          </div>
          {fondoGuardado ? (
            <div className="rounded-lg border border-green-500/40 bg-green-500/5 p-3 space-y-1 text-sm">
              <p className="font-medium text-green-700 dark:text-green-400 flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" /> Distribución registrada
              </p>
              <div className="flex justify-between text-muted-foreground">
                <span>Fondo siguiente turno</span>
                <span className="font-medium text-foreground">{formatMXN(fondoGuardado.fondo)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Para depósito / caja fuerte</span>
                <span className="font-medium text-foreground">{formatMXN(fondoGuardado.deposito)}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">¿Cuánto dejas de fondo para el siguiente cajero?</p>
              <MoneyInput
                value={fondoInput} onValueChange={setFondoInput}
                className="h-9 text-sm"
              />
              {(() => {
                const f = Number(fondoInput);
                const dep = isNaN(f) ? null : Math.max(result.counted_cash - f, 0);
                return dep !== null ? (
                  <p className="text-xs text-muted-foreground">
                    Para depósito: <span className="font-medium text-foreground">{formatMXN(dep)}</span>
                  </p>
                ) : null;
              })()}
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" disabled={savingFondo}
                  onClick={async () => {
                    const f = Number(fondoInput);
                    if (isNaN(f) || f < 0) { toast({ title: "Monto inválido", variant: "destructive" }); return; }
                    setSavingFondo(true);
                    const { error } = await supabase.rpc("corte_set_fondo", {
                      p_corte_id: result.corte_id, p_fondo_siguiente: f,
                    } as never);
                    setSavingFondo(false);
                    if (error) { toast({ title: `No se pudo guardar: ${error.message}`, variant: "destructive" }); return; }
                    setFondoGuardado({ fondo: f, deposito: Math.max(result.counted_cash - f, 0) });
                  }}
                >
                  {savingFondo ? "Guardando…" : "Guardar distribución"}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleClosed}>Omitir</Button>
              </div>
            </div>
          )}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => printActaArqueo({
              folio: result.folio,
              cajaNombre: "Farmacia",
              clinicName: activeClinic?.name,
              cajeroName: user?.email ?? undefined,
              fechaCierre: new Date().toISOString(),
              openingAmount: result.opening_amount,
              cashTotal: result.cash_total_sales,
              expectedCash: result.expected_cash,
              countedCash: result.counted_cash,
              difference: result.difference,
              supervisorOverride: result.supervisor_override,
              fondoSiguiente: fondoGuardado?.fondo,
              efectivoDeposito: fondoGuardado?.deposito,
              denominaciones: Object.keys(denomBreakdown).length > 0 ? denomBreakdown : undefined,
            })}
          >
            <Printer className="h-4 w-4" /> Imprimir acta de arqueo
          </Button>
          <PagoReconcile corteId={result.corte_id} metodo="tarjeta" />
          <PagoReconcile corteId={result.corte_id} metodo="transferencia" />
          <DialogFooter>
            <Button onClick={handleClosed}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />Cerrar turno
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Blind count: do NOT show opening_amount or expected before submit */}
          <p className="text-xs text-muted-foreground">
            Cuenta el efectivo físicamente sin revisar el sistema primero.
            El sistema calculará la diferencia al cierre.
          </p>
          {cashRefunds && (
            <div className="flex items-start gap-2 rounded-md border border-blue-300/50 bg-blue-50/60 dark:bg-blue-950/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                <strong>{cashRefunds.count} devolución{cashRefunds.count !== 1 ? "es" : ""}</strong> en efectivo
                ({formatMXN(cashRefunds.total)}) registradas este turno — ya incluidas en el cálculo.
              </span>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Efectivo contado físicamente (MXN)</Label>
            <MoneyInput
              value={count}
              onValueChange={setCount}
              className="h-11 text-base"
              autoFocus
            />
          </div>
          <DenominacionCounter
            onTotal={(total, breakdown) => {
              if (total > 0) setCount(String(total));
              setDenomBreakdown(breakdown);
            }}
          />
          <div className="space-y-1">
            <Label className="text-xs">Notas del cierre</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <SupervisorAuthDialog
            open={!!overridePrompt}
            turnoId={shift?.id ?? ""}
            cashCount={Number(count)}
            notes={notes}
            diff={overridePrompt?.diff ?? 0}
            umbral={overridePrompt?.umbral ?? 0}
            clinicId={shift?.clinic_id ?? ""}
            mode="pharmacy"
            onSuccess={(data) => {
              const r = data as CloseResult;
              setResult(r);
              setFondoInput(String(r.opening_amount ?? 0));
              setOverridePrompt(null);
            }}
            onCancel={() => setOverridePrompt(null)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={() => submit(false)} disabled={submitting}>
            {submitting ? "Cerrando…" : "Registrar conteo y cerrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CorteXDialog({
  open, shift, onClose,
}: {
  open: boolean;
  shift: Shift | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CorteXResult | null>(null);

  function handleClose() {
    setResult(null);
    onClose();
  }

  async function generate() {
    if (!shift) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("pharmacy_corte_x", {
      p_shift_id: shift.id,
    } as never);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error al generar Corte X", description: friendlyError(error), variant: "destructive" });
      return;
    }
    setResult(data as unknown as CorteXResult);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />Corte X — Reporte parcial
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Folio X-{String(result.folio).padStart(6, "0")} generado. El turno sigue abierto.
            </p>
            <div className="rounded-lg border border-border bg-muted/40 p-4 grid grid-cols-2 gap-2 text-sm">
              <ResultRow label="Monto inicial" value={formatMXN(result.opening_amount)} />
              <ResultRow label="Tickets" value={String(result.tickets)} />
              <ResultRow label="Efectivo" value={formatMXN(result.total_efectivo)} />
              <ResultRow label="Tarjeta" value={formatMXN(result.total_tarjeta)} />
              <ResultRow label="Transferencia" value={formatMXN(result.total_transferencia)} />
              <ResultRow label="Otros" value={formatMXN(result.total_otros)} />
              <ResultRow label="Total" value={formatMXN(result.total_general)} />
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Cerrar</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground py-2">
              Genera un reporte de ventas del turno actual sin cerrarlo.
              Útil para supervisión intra-turno.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={generate} disabled={submitting}>
                {submitting ? "Generando…" : "Generar Corte X"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function FondoMovimientoDialog({
  open, shift, onClose,
}: {
  open: boolean;
  shift: Shift | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [tipo, setTipo] = useState<"egreso" | "ingreso">("egreso");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setTipo("egreso");
    setMonto("");
    setMotivo("");
    onClose();
  }

  async function submit() {
    if (!shift) return;
    const amount = Number(monto);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Monto inválido", variant: "destructive" });
      return;
    }
    if (!motivo.trim()) {
      toast({ title: "El motivo es requerido", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("pharmacy_fondo_movimiento", {
      p_shift_id: shift.id,
      p_tipo: tipo,
      p_monto: amount,
      p_motivo: motivo.trim(),
    } as never);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error al registrar", description: friendlyError(error), variant: "destructive" });
      return;
    }
    toast({
      title: tipo === "egreso" ? "Egreso registrado" : "Ingreso registrado",
      description: `${formatMXN(amount)} — ${motivo.trim()}`,
    });
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />Movimiento de fondo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Registra retiros (egresos) o depósitos (ingresos) de efectivo durante el turno.
            Quedan en auditoría y se descuentan del efectivo esperado al cierre.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={tipo === "egreso" ? "default" : "outline"}
              onClick={() => setTipo("egreso")}
              className="flex-1"
            >
              Egreso (retiro)
            </Button>
            <Button
              size="sm"
              variant={tipo === "ingreso" ? "default" : "outline"}
              onClick={() => setTipo("ingreso")}
              className="flex-1"
            >
              Ingreso (depósito)
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monto (MXN)</Label>
            <MoneyInput
              value={monto}
              onValueChange={setMonto}
              className="h-11 text-base"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo</Label>
            <Textarea
              rows={2} value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={tipo === "egreso" ? "Ej: Pago a proveedor" : "Ej: Aportación de cambio"}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Registrando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}

export async function fetchCurrentShift(): Promise<Shift | null> {
  const { data } = await supabase.rpc("pharmacy_current_shift", { p_clinic: null } as never);
  if (!data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as Shift | null;
}

export { formatMXN as formatMXNShift };
