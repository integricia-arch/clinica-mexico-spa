import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SupervisorAuthDialog from "@/components/turno/SupervisorAuthDialog";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Lock, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle, Heart, Info,
} from "lucide-react";
import { toast } from "sonner";
import type { OpenTurno } from "@/components/TurnoGuard";

interface CloseResult {
  folio: number;
  opening_amount: number;
  cash_total: number;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  supervisor_override: boolean;
}

interface Props {
  turno: OpenTurno;
  onClosed: () => void;
  onCancel: () => void;
}

type Step = "count" | "diff-alert" | "done";

const fmt = (n: number) =>
  Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function TurnoCloseWizard({ turno, onClosed, onCancel }: Props) {
  const { activeClinicId } = useActiveClinic();
  const [count, setCount] = useState("0");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<Step>("count");
  const [saving, setSaving] = useState(false);
  const [overrideData, setOverrideData] = useState<{ diff: number; umbral: number } | null>(null);
  const [result, setResult] = useState<CloseResult | null>(null);
  const [cashRefunds, setCashRefunds] = useState<{ count: number; total: number } | null>(null);

  useEffect(() => {
    supabase
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
  }, [turno.id]);

  async function submit(supervisorOverride = false) {
    const amount = Number(count);
    if (isNaN(amount) || amount < 0) { toast.error("Monto inválido"); return; }
    setSaving(true);
    setOverrideData(null);

    const { data, error } = await supabase.rpc("turno_close", {
      p_turno_id: turno.id,
      p_cash_count: amount,
      p_notes: notes.trim() || null,
      p_supervisor_override: supervisorOverride,
    } as never);

    setSaving(false);

    if (error) {
      if (error.message?.startsWith("DIFF_EXCEEDS_THRESHOLD")) {
        const parts = error.message.split("|");
        setOverrideData({ diff: Number(parts[1] ?? 0), umbral: Number(parts[2] ?? 0) });
        setStep("diff-alert");
        return;
      }
      toast.error(`No se pudo cerrar el turno: ${error.message}`);
      return;
    }

    setResult(data as unknown as CloseResult);
    setStep("done");
  }

  const diff = result?.difference ?? 0;
  const DiffIcon = diff === 0 ? Minus : diff > 0 ? TrendingUp : TrendingDown;
  const diffColor = diff === 0 ? "text-green-600" : diff > 0 ? "text-amber-600" : "text-red-600";
  const diffLabel = diff === 0 ? "Cuadrado" : diff > 0 ? "Sobrante" : "Faltante";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background p-6">
      <div className="mb-6 flex flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
          <Heart className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="text-display text-lg font-bold text-foreground">Cierre de turno</h1>
        <p className="text-sm text-muted-foreground">{turno.caja_nombre}</p>
      </div>

      <div className="mb-6 flex items-center gap-2 text-sm">
        <span className={step === "count" ? "font-semibold text-primary" : "text-muted-foreground opacity-50"}>
          1. Conteo
        </span>
        <span className="text-muted-foreground">›</span>
        <span className={step === "diff-alert" ? "font-semibold text-amber-600" : "text-muted-foreground opacity-50"}>
          2. Diferencia
        </span>
        <span className="text-muted-foreground">›</span>
        <span className={step === "done" ? "font-semibold text-green-600" : "text-muted-foreground opacity-50"}>
          3. Cerrado
        </span>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-card space-y-5">

        {step === "count" && (
          <>
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground">
                <Lock className="h-5 w-5 text-primary" /> Conteo ciego
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Cuenta el efectivo <strong>físicamente</strong> sin revisar el sistema.
                El sistema calculará la diferencia al confirmar.
              </p>
            </div>
            {cashRefunds && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-300/50 bg-blue-50/60 dark:bg-blue-950/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Se registraron <strong>{cashRefunds.count} devolución{cashRefunds.count !== 1 ? "es" : ""}</strong> en efectivo
                  por <strong>{fmt(cashRefunds.total)}</strong> durante este turno.
                  Ya están incluidas en el cálculo esperado.
                </span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="close-count">Efectivo contado (MXN)</Label>
              <Input
                id="close-count"
                type="number"
                min={0}
                step="0.01"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="h-12 text-xl font-semibold text-center"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="close-notes">Notas (opcional)</Label>
              <Textarea
                id="close-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones del cierre…"
              />
            </div>
            <Button onClick={() => submit(false)} className="w-full" size="lg" disabled={saving}>
              {saving ? "Cerrando turno…" : "Cerrar turno →"}
            </Button>
            <button
              onClick={onCancel}
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
            >
              Cancelar — volver a caja
            </button>
          </>
        )}

        {step === "diff-alert" && overrideData && (
          <>
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-700">
                <AlertTriangle className="h-5 w-5" /> Diferencia fuera de rango
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Se requiere autorización de un supervisor para continuar.
              </p>
            </div>
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/8 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Diferencia</span>
                <span className={`font-semibold ${overrideData.diff > 0 ? "text-amber-700" : "text-red-700"}`}>
                  {fmt(overrideData.diff)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Umbral permitido</span>
                <span className="font-medium">{fmt(overrideData.umbral)}</span>
              </div>
            </div>
            <SupervisorAuthDialog
              open={step === "diff-alert" && !!overrideData}
              turnoId={turno.id}
              cashCount={Number(count)}
              notes={notes}
              diff={overrideData.diff}
              umbral={overrideData.umbral}
              clinicId={activeClinicId ?? ""}
              onSuccess={(data) => {
                setResult(data as CloseResult);
                setOverrideData(null);
                setStep("done");
              }}
              onCancel={() => setStep("count")}
            />
            <button
              onClick={() => setStep("count")}
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
            >
              ← Volver a recontar
            </button>
          </>
        )}

        {step === "done" && result && (
          <>
            <div className="text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
              <h2 className="text-lg font-semibold text-card-foreground">Turno cerrado</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Folio Z-{String(result.folio).padStart(6, "0")}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fondo inicial</span>
                <span>{fmt(result.opening_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cobros efectivo</span>
                <span>{fmt(result.cash_total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Esperado</span>
                <span className="font-medium">{fmt(result.expected_cash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contado</span>
                <span className="font-medium">{fmt(result.counted_cash)}</span>
              </div>
              <div className={`flex justify-between border-t border-border pt-2 ${diffColor}`}>
                <span className="font-semibold flex items-center gap-1">
                  <DiffIcon className="h-3.5 w-3.5" />
                  {diffLabel}
                </span>
                <span className="font-semibold">{fmt(result.difference)}</span>
              </div>
              {result.supervisor_override && (
                <p className="text-xs text-muted-foreground">Autorizado por supervisor</p>
              )}
            </div>
            <Button onClick={onClosed} className="w-full" size="lg">
              Finalizar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
