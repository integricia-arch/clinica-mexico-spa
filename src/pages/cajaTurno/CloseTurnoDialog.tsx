import { useState, useEffect } from "react";
import { Lock, TrendingUp, TrendingDown, Minus, CheckCircle, Printer, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import SupervisorAuthDialog from "@/components/turno/SupervisorAuthDialog";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { printActaArqueo } from "@/lib/printActaArqueo";
import PagoReconcile from "@/components/turno/PagoReconcile";
import DenominacionCounter, { type DenomBreakdown } from "@/components/turno/DenominacionCounter";
import { fmt, ResultRow } from "./shared";
import type { Turno, CloseResult } from "./types";

export function CloseTurnoDialog({
  open, turno, cajaNombre, onClose, onClosed,
}: {
  open: boolean; turno: Turno | null; cajaNombre?: string; onClose: () => void; onClosed: () => void;
}) {
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
    if (!open || !turno) return;
    setCashRefunds(null);
    (supabase as any)
      .from("fondos_movimientos")
      .select("monto")
      .eq("turno_id", turno.id)
      .eq("tipo", "egreso")
      .ilike("motivo", "Reembolso%")
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        setCashRefunds({
          count: data.length,
          total: data.reduce((s, r) => s + Number(r.monto), 0),
        });
      });
  }, [open, turno?.id]);

  function reset() {
    setCount("0"); setNotes(""); setSubmitting(false);
    setOverridePrompt(null); setResult(null);
  }
  function handleClose() { reset(); onClose(); }
  function handleClosed() { reset(); onClosed(); }

  async function submit(supervisorOverride = false) {
    if (!turno) return;
    const amount = Number(count);
    if (Number.isNaN(amount) || amount < 0) { toast.error("Monto inválido"); return; }
    setSubmitting(true); setOverridePrompt(null);

    const { data, error } = await (supabase as any).rpc("turno_close", {
      p_turno_id: turno.id,
      p_cash_count: amount,
      p_notes: notes || null,
      p_supervisor_override: supervisorOverride,
    } as never);

    setSubmitting(false);
    if (error) {
      if (error.message?.startsWith("DIFF_EXCEEDS_THRESHOLD")) {
        const parts = error.message.split("|");
        const diff   = Number.isFinite(Number(parts[1])) ? Number(parts[1]) : 0;
        const umbral = Number.isFinite(Number(parts[2])) ? Number(parts[2]) : 0;
        setOverridePrompt({ diff, umbral });
        return;
      }
      if (error.message?.startsWith("NOTES_REQUIRED_ON_DIFF")) {
        toast.error("Hay una diferencia entre lo contado y lo esperado — escribe una explicación en Notas antes de cerrar.");
        return;
      }
      toast.error(`No se pudo cerrar el turno: ${error.message}`);
      return;
    }
    const r = data as unknown as CloseResult;
    setResult(r);
    setFondoInput(String(r.opening_amount ?? 0));
  }

  if (result) {
    const diffColor = result.difference === 0 ? "text-green-600" : result.difference > 0 ? "text-amber-600" : "text-red-600";
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
              <ResultRow label="Monto inicial" value={fmt(result.opening_amount)} />
              <ResultRow label="Cobros efectivo" value={fmt(result.cash_total)} />
              <ResultRow label="Esperado" value={fmt(result.expected_cash)} />
              <ResultRow label="Contado" value={fmt(result.counted_cash)} />
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
                  {fmt(result.difference)}
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
                <span className="font-medium text-foreground">{fmt(fondoGuardado.fondo)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Para depósito / caja fuerte</span>
                <span className="font-medium text-foreground">{fmt(fondoGuardado.deposito)}</span>
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
                    Para depósito: <span className="font-medium text-foreground">{fmt(dep)}</span>
                  </p>
                ) : null;
              })()}
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" disabled={savingFondo}
                  onClick={async () => {
                    const f = Number(fondoInput);
                    if (isNaN(f) || f < 0) { toast.error("Monto inválido"); return; }
                    setSavingFondo(true);
                    const { error } = await (supabase as any).rpc("corte_set_fondo", {
                      p_corte_id: result.corte_id, p_fondo_siguiente: f,
                    } as never);
                    setSavingFondo(false);
                    if (error) { toast.error(`No se pudo guardar: ${error.message}`); return; }
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
              cajaNombre: cajaNombre ?? "Caja",
              clinicName: activeClinic?.name,
              cajeroName: user?.user_metadata?.full_name ?? user?.email ?? undefined,
              fechaCierre: new Date().toISOString(),
              openingAmount: result.opening_amount,
              cashTotal: result.cash_total,
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
          <DialogFooter><Button onClick={handleClosed}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> Cerrar turno
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Cuenta el efectivo físicamente sin revisar el sistema primero.
            El sistema calculará la diferencia al cierre.
          </p>
          {cashRefunds && (
            <div className="flex items-start gap-2 rounded-md border border-blue-300/50 bg-blue-50/60 dark:bg-blue-950/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                <strong>{cashRefunds.count} devolución{cashRefunds.count !== 1 ? "es" : ""}</strong> en efectivo
                ({fmt(cashRefunds.total)}) registradas este turno — ya incluidas en el cálculo.
              </span>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Efectivo contado físicamente (MXN)</Label>
            <MoneyInput value={count}
              onValueChange={setCount} className="h-11 text-base" autoFocus />
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
            <p className="text-xs text-muted-foreground">
              Obligatorio si el efectivo contado no coincide exactamente con lo esperado.
            </p>
          </div>
          <SupervisorAuthDialog
            open={!!overridePrompt}
            turnoId={turno?.id ?? ""}
            cashCount={Number(count)}
            notes={notes}
            diff={overridePrompt?.diff ?? 0}
            umbral={overridePrompt?.umbral ?? 0}
            clinicId={turno?.clinic_id ?? activeClinic?.id ?? ""}
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
