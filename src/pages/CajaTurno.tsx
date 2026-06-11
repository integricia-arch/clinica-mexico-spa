import { useState, useEffect } from "react";
import {
  Timer, PlayCircle, StopCircle, AlertCircle, Lock, TrendingUp, TrendingDown,
  Minus, ArrowUpDown, FileBarChart2, ChevronDown, ChevronRight, Info, CheckCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import SupervisorAuthDialog from "@/components/turno/SupervisorAuthDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const fmt = (n: number) =>
  Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

// ─── Types ───────────────────────────────────────────────────────────────────

interface Caja {
  id: string;
  nombre: string;
  fondo_default: number;
  es_farmacia: boolean;
}

interface Turno {
  id: string;
  caja_id: string;
  clinic_id: string;
  estado: string;
  monto_apertura: number;
  abierto_at: string;
  pharmacy_shift_id: string | null;
}

interface FondoMovimiento {
  id: string;
  tipo: "egreso" | "ingreso";
  monto: number;
  motivo: string;
  created_at: string;
}

interface CorteRow {
  id: string;
  tipo: "Z" | "X";
  folio_secuencial: number | null;
  created_at: string;
  efectivo_esperado: number | null;
  conteo_ciego: number | null;
  diferencia: number | null;
  total_general: number;
  conteo_movimientos: number;
  requiere_autorizacion: boolean;
}

interface TurnoHistorial {
  id: string;
  caja_id: string;
  estado: string;
  monto_apertura: number;
  monto_cierre: number | null;
  abierto_at: string;
  cerrado_at: string | null;
  notas_cierre: string | null;
  cortes: CorteRow[];
}

interface CloseResult {
  folio: number;
  corte_id: string;
  opening_amount: number;
  cash_total: number;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  supervisor_override: boolean;
}

interface LinkAudit {
  id: string;
  turno_id: string;
  caja_id: string;
  pharmacy_shift_id: string | null;
  action: string;
  reason: string | null;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}

function DiffBadge({ diff }: { diff: number | null }) {
  if (diff === null) return <span className="text-muted-foreground text-xs">—</span>;
  const Icon = diff === 0 ? Minus : diff > 0 ? TrendingUp : TrendingDown;
  const cls = diff === 0 ? "text-green-600" : diff > 0 ? "text-amber-600" : "text-red-600";
  return (
    <span className={`flex items-center gap-1 font-medium text-sm ${cls}`}>
      <Icon className="h-3.5 w-3.5" /> {fmt(diff)}
    </span>
  );
}

const ACTION_LABELS: Record<string, { label: string; tone: string }> = {
  linked_existing: { label: "Reutilizó corte abierto", tone: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/20" },
  created_new: { label: "Creó corte de farmacia", tone: "text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/20" },
  skipped_not_pharmacy: { label: "Caja no es de farmacia", tone: "text-muted-foreground bg-muted" },
  blocked_close_pharmacy_open: { label: "Cierre bloqueado: corte farmacia abierto", tone: "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/20" },
  manual_link: { label: "Enlace manual", tone: "text-blue-700 bg-blue-50" },
  manual_unlink: { label: "Desenlace manual", tone: "text-amber-700 bg-amber-50" },
};

// ─── CloseTurnoDialog ─────────────────────────────────────────────────────────

function CloseTurnoDialog({
  open, turno, onClose, onClosed,
}: {
  open: boolean; turno: Turno | null; onClose: () => void; onClosed: () => void;
}) {
  const { activeClinicId } = useActiveClinic();
  const [count, setCount] = useState("0");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [overridePrompt, setOverridePrompt] = useState<{ diff: number; umbral: number } | null>(null);
  const [result, setResult] = useState<CloseResult | null>(null);
  const [cashRefunds, setCashRefunds] = useState<{ count: number; total: number } | null>(null);
  const [fondoInput, setFondoInput] = useState("");
  const [fondoGuardado, setFondoGuardado] = useState<{ fondo: number; deposito: number } | null>(null);
  const [savingFondo, setSavingFondo] = useState(false);

  useEffect(() => {
    if (!open || !turno) return;
    setCashRefunds(null);
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

    const { data, error } = await supabase.rpc("turno_close", {
      p_turno_id: turno.id,
      p_cash_count: amount,
      p_notes: notes || null,
      p_supervisor_override: supervisorOverride,
    } as never);

    setSubmitting(false);
    if (error) {
      if (error.message?.startsWith("DIFF_EXCEEDS_THRESHOLD")) {
        const parts = error.message.split("|");
        setOverridePrompt({ diff: Number(parts[1] ?? 0), umbral: Number(parts[2] ?? 0) });
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
              <Input
                type="number" min={0} step="0.01"
                value={fondoInput} onChange={(e) => setFondoInput(e.target.value)}
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
                    const { error } = await supabase.rpc("corte_set_fondo", {
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
            <Input type="number" min={0} step="0.01" value={count}
              onChange={(e) => setCount(e.target.value)} className="h-11 text-base" autoFocus />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notas del cierre</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <SupervisorAuthDialog
            open={!!overridePrompt}
            turnoId={turno?.id ?? ""}
            cashCount={Number(count)}
            notes={notes}
            diff={overridePrompt?.diff ?? 0}
            umbral={overridePrompt?.umbral ?? 0}
            clinicId={turno?.clinic_id ?? activeClinicId ?? ""}
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

// ─── FondoMovimientoDialog ────────────────────────────────────────────────────

function FondoMovimientoDialog({
  open, turnoId, onClose, onDone,
}: {
  open: boolean; turnoId: string | null; onClose: () => void; onDone: () => void;
}) {
  const [tipo, setTipo] = useState<"egreso" | "ingreso">("egreso");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() { setTipo("egreso"); setMonto(""); setMotivo(""); setSaving(false); }

  async function handleSubmit() {
    if (!turnoId) return;
    const amount = Number(monto);
    if (Number.isNaN(amount) || amount <= 0) { toast.error("Monto debe ser mayor a cero"); return; }
    if (!motivo.trim()) { toast.error("Motivo requerido"); return; }
    setSaving(true);

    const { error } = await supabase.rpc("turno_fondo_movimiento", {
      p_turno_id: turnoId,
      p_tipo: tipo,
      p_monto: amount,
      p_motivo: motivo.trim(),
    } as never);

    setSaving(false);
    if (error) { toast.error(`Error: ${error.message}`); return; }
    toast.success(`${tipo === "egreso" ? "Retiro" : "Depósito"} registrado`);
    reset();
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" /> Movimiento de fondo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as "egreso" | "ingreso")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="egreso">Retiro / Egreso</SelectItem>
                <SelectItem value="ingreso">Depósito / Ingreso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monto (MXN)</Label>
            <Input type="number" min={0.01} step={0.01} value={monto}
              onChange={(e) => setMonto(e.target.value)} placeholder="0.00" autoFocus />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Pago a proveedor, cambio de billetes…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CorteXDialog ─────────────────────────────────────────────────────────────

interface CorteXResult {
  folio: number; tipo: string; opening_amount: number;
  cash_cobros: number; fondos_net: number; expected_cash: number; tickets: number;
}

function CorteXDialog({
  open, turnoId, onClose,
}: {
  open: boolean; turnoId: string | null; onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CorteXResult | null>(null);

  async function generate() {
    if (!turnoId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("turno_corte_x", { p_turno_id: turnoId } as never);
    setLoading(false);
    if (error) { toast.error(`Error: ${error.message}`); return; }
    setResult(data as unknown as CorteXResult);
  }

  function handleClose() { setResult(null); onClose(); }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBarChart2 className="h-4 w-4" /> Corte X — Reporte parcial
          </DialogTitle>
        </DialogHeader>
        {!result ? (
          <>
            <p className="text-sm text-muted-foreground py-2">
              Genera un snapshot del estado actual del turno sin cerrarlo.
              El turno seguirá activo después del Corte X.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={generate} disabled={loading}>
                {loading ? "Generando…" : "Generar Corte X"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3 py-1">
              <p className="text-xs text-green-700 bg-green-50 rounded-md px-3 py-2 font-medium">
                Corte X generado — Folio X-{String(result.folio).padStart(6, "0")}
              </p>
              <div className="rounded-lg border border-border bg-muted/40 p-4 grid grid-cols-2 gap-2 text-sm">
                <ResultRow label="Monto inicial" value={fmt(result.opening_amount)} />
                <ResultRow label="Cobros efectivo" value={fmt(result.cash_cobros)} />
                <ResultRow label="Neto fondos" value={fmt(result.fondos_net)} />
                <ResultRow label="Efectivo esperado" value={fmt(result.expected_cash)} />
                <ResultRow label="Tickets cobrados" value={String(result.tickets)} />
              </div>
              <p className="text-xs text-muted-foreground">El turno permanece abierto. Este reporte es informativo.</p>
            </div>
            <DialogFooter><Button onClick={handleClose}>Cerrar</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── HistorialTurnos ──────────────────────────────────────────────────────────

function HistorialTurnos({ turnos, cajas }: { turnos: TurnoHistorial[]; cajas: Caja[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (turnos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin turnos cerrados aún.</p>;
  }

  return (
    <ul className="space-y-2">
      {turnos.map((t) => {
        const cajaNombre = cajas.find((c) => c.id === t.caja_id)?.nombre ?? "Caja desconocida";
        const corteZ = t.cortes.find((c) => c.tipo === "Z") ?? null;
        const cortesX = t.cortes.filter((c) => c.tipo === "X");
        const isOpen = expanded === t.id;
        const estadoBadge =
          t.estado === "cerrado"
            ? "bg-muted text-muted-foreground"
            : "bg-red-100 text-red-700 dark:bg-red-900/20";

        return (
          <li key={t.id} className="rounded-lg border border-border bg-card text-sm">
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
              onClick={() => setExpanded(isOpen ? null : t.id)}
            >
              {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="font-medium flex-1">{cajaNombre}</span>
              {corteZ && (
                <span className="text-xs font-mono text-primary">
                  Z-{String(corteZ.folio_secuencial ?? 0).padStart(6, "0")}
                </span>
              )}
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${estadoBadge}`}>
                {t.estado}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(t.abierto_at).toLocaleDateString("es-MX")}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  <ResultRow label="Apertura" value={fmt(t.monto_apertura)} />
                  {t.monto_cierre !== null && <ResultRow label="Contado" value={fmt(t.monto_cierre)} />}
                  {t.cerrado_at && (
                    <ResultRow label="Cierre" value={new Date(t.cerrado_at).toLocaleString("es-MX")} />
                  )}
                  {t.notas_cierre && (
                    <div className="col-span-2 sm:col-span-3">
                      <p className="text-[11px] text-muted-foreground">Notas cierre</p>
                      <p className="font-medium">{t.notas_cierre}</p>
                    </div>
                  )}
                </div>

                {corteZ && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Corte Z</p>
                    <div className="rounded-md border border-border bg-muted/30 p-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <div>
                        <p className="text-muted-foreground">Folio</p>
                        <p className="font-mono font-semibold">Z-{String(corteZ.folio_secuencial ?? 0).padStart(6, "0")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Esperado</p>
                        <p className="font-medium">{fmt(corteZ.efectivo_esperado ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Contado</p>
                        <p className="font-medium">{corteZ.conteo_ciego !== null ? fmt(corteZ.conteo_ciego) : "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Diferencia</p>
                        <DiffBadge diff={corteZ.diferencia ?? null} />
                      </div>
                      {corteZ.requiere_autorizacion && (
                        <div className="col-span-2 sm:col-span-4">
                          <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 text-[10px]">
                            Requirió autorización supervisor
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {cortesX.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Cortes X ({cortesX.length})</p>
                    <div className="space-y-1">
                      {cortesX.map((cx) => (
                        <div key={cx.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-xs">
                          <span className="font-mono text-muted-foreground">
                            X-{String(cx.folio_secuencial ?? 0).padStart(6, "0")}
                          </span>
                          <span className="flex-1 text-muted-foreground">
                            {new Date(cx.created_at).toLocaleString("es-MX")}
                          </span>
                          <span className="font-medium">{fmt(cx.efectivo_esperado ?? 0)}</span>
                          <span className="text-muted-foreground">{cx.conteo_movimientos} tickets</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CajaTurno({ onTurnoCerrado }: { onTurnoCerrado?: () => void } = {}) {
  const { user } = useAuth();
  const { activeClinic } = useActiveClinic();

  const [cajas, setCajas] = useState<Caja[]>([]);
  const [turnoActivo, setTurnoActivo] = useState<Turno | null>(null);
  const [fondos, setFondos] = useState<FondoMovimiento[]>([]);
  const [historial, setHistorial] = useState<TurnoHistorial[]>([]);
  const [auditLog, setAuditLog] = useState<LinkAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cajaId, setCajaId] = useState("");
  const [montoApertura, setMontoApertura] = useState(0);
  const [notas, setNotas] = useState("");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [fondoDialogOpen, setFondoDialogOpen] = useState(false);
  const [corteXDialogOpen, setCorteXDialogOpen] = useState(false);

  const load = async () => {
    if (!activeClinic?.id || !user?.id) return;
    setLoading(true);

    const [{ data: cajasData }, { data: turnoData }, { data: auditData }] = await Promise.all([
      supabase.from("cajas").select("id, nombre, fondo_default, es_farmacia")
        .eq("clinic_id", activeClinic.id).eq("activo", true).order("nombre"),
      supabase.from("turnos").select("*")
        .eq("clinic_id", activeClinic.id).eq("cajero_user_id", user.id)
        .eq("estado", "abierto").maybeSingle(),
      (supabase as any).from("turno_pharmacy_link_audit")
        .select("id, turno_id, caja_id, pharmacy_shift_id, action, reason, created_at")
        .eq("clinic_id", activeClinic.id)
        .order("created_at", { ascending: false }).limit(20),
    ]);

    const cajasList = (cajasData as Caja[]) ?? [];
    const activeTurno = (turnoData as Turno | null) ?? null;

    setCajas(cajasList);
    setTurnoActivo(activeTurno);
    setAuditLog((auditData as LinkAudit[]) ?? []);

    if (cajasList[0] && !cajaId) {
      setCajaId(cajasList[0].id);
      setMontoApertura(cajasList[0].fondo_default);
    }

    // Fondos del turno activo
    if (activeTurno) {
      const { data: fondosData } = await (supabase as any)
        .from("fondos_movimientos")
        .select("id, tipo, monto, motivo, created_at")
        .eq("turno_id", activeTurno.id)
        .order("created_at", { ascending: false });
      setFondos((fondosData as FondoMovimiento[]) ?? []);
    } else {
      setFondos([]);
    }

    // Historial de turnos cerrados/cancelados
    const { data: turnosHist } = await supabase.from("turnos")
      .select("id, caja_id, estado, monto_apertura, monto_cierre, abierto_at, cerrado_at, notas_cierre")
      .eq("clinic_id", activeClinic.id)
      .neq("estado", "abierto")
      .order("abierto_at", { ascending: false })
      .limit(20);

    if (turnosHist && turnosHist.length > 0) {
      const ids = turnosHist.map((t: any) => t.id);
      const { data: cortesData } = await (supabase as any)
        .from("cortes")
        .select("id, tipo, folio_secuencial, created_at, efectivo_esperado, conteo_ciego, diferencia, total_general, conteo_movimientos, requiere_autorizacion, turno_id")
        .in("turno_id", ids)
        .order("created_at");

      const cortesByTurno: Record<string, CorteRow[]> = {};
      for (const c of (cortesData as any[]) ?? []) {
        if (!cortesByTurno[c.turno_id]) cortesByTurno[c.turno_id] = [];
        cortesByTurno[c.turno_id].push(c as CorteRow);
      }

      setHistorial(
        turnosHist.map((t: any) => ({ ...t, cortes: cortesByTurno[t.id] ?? [] }))
      );
    } else {
      setHistorial([]);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [activeClinic?.id, user?.id]);

  const onCajaChange = (id: string) => {
    setCajaId(id);
    const caja = cajas.find((c) => c.id === id);
    if (caja) setMontoApertura(caja.fondo_default);
  };

  const abrirTurno = async () => {
    if (!cajaId) { toast.error("Selecciona una caja"); return; }
    if (!activeClinic?.id || !user?.id) return;
    setSaving(true);

    const { data: newTurno, error } = await supabase.from("turnos").insert({
      clinic_id: activeClinic.id,
      caja_id: cajaId,
      cajero_user_id: user.id,
      monto_apertura: montoApertura,
      notas_apertura: notas.trim() || null,
      estado: "abierto",
    }).select("id").single();

    if (error) { setSaving(false); toast.error(`No se pudo abrir el turno: ${error.message}`); return; }

    const selectedCaja = cajas.find((c) => c.id === cajaId);
    if (selectedCaja?.es_farmacia && newTurno) {
      const { data: shiftId, error: shiftError } = await supabase.rpc("pharmacy_open_shift", {
        p_clinic_id: activeClinic.id,
        p_opening_amount: montoApertura,
        p_notes: notas.trim() || null,
      } as never);
      if (!shiftError && shiftId) {
        await supabase.from("turnos").update({ pharmacy_shift_id: shiftId }).eq("id", newTurno.id);
      } else if (shiftError) {
        toast.warning(`Turno abierto, pero no se pudo abrir turno POS Farmacia: ${shiftError.message}`);
      }
    }

    setSaving(false);
    toast.success("Turno abierto");
    setNotas("");
    load();
  };

  const handleTurnoCerrado = () => { setCloseDialogOpen(false); load(); onTurnoCerrado?.(); };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-2xl font-bold text-foreground">Turno de Caja</h1>
        <p className="mt-1 text-sm text-muted-foreground">Abre o cierra tu turno de trabajo en caja</p>
      </div>

      {cajas.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-300/50 bg-yellow-50/50 p-5 dark:border-yellow-800/30 dark:bg-yellow-900/10">
          <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Sin cajas configuradas</p>
            <p className="text-sm text-muted-foreground mt-1">
              Pide al administrador que configure al menos una caja en <strong>Configuración → Caja</strong>.
            </p>
          </div>
        </div>
      ) : turnoActivo ? (
        <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Turno activo</p>
              <p className="text-xs text-muted-foreground">
                Abierto: {new Date(turnoActivo.abierto_at).toLocaleString("es-MX")} — Fondo: {fmt(turnoActivo.monto_apertura)}
              </p>
              {turnoActivo.pharmacy_shift_id && (
                <p className="text-xs text-primary mt-1">
                  Vinculado al POS Farmacia. Cierra primero el corte en <strong>Farmacia</strong> antes de cerrar este turno.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setFondoDialogOpen(true)}>
              <ArrowUpDown className="h-4 w-4 mr-1.5" /> Egreso / Ingreso
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCorteXDialogOpen(true)}>
              <FileBarChart2 className="h-4 w-4 mr-1.5" /> Corte X
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setCloseDialogOpen(true)} disabled={saving}>
              <StopCircle className="h-4 w-4 mr-1.5" /> Cerrar turno
            </Button>
          </div>

          {fondos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Movimientos de fondo del turno</p>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Hora</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tipo</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Motivo</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fondos.map((f) => (
                      <tr key={f.id}>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(f.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`font-medium ${f.tipo === "egreso" ? "text-red-600" : "text-green-600"}`}>
                            {f.tipo === "egreso" ? "Retiro" : "Depósito"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-foreground">{f.motivo}</td>
                        <td className={`px-3 py-2 text-right font-medium ${f.tipo === "egreso" ? "text-red-600" : "text-green-600"}`}>
                          {f.tipo === "egreso" ? "−" : "+"}{fmt(f.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <PlayCircle className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-card-foreground">Abrir turno</h2>
          </div>
          <div>
            <Label htmlFor="caja">Caja *</Label>
            <Select value={cajaId} onValueChange={onCajaChange}>
              <SelectTrigger id="caja" className="mt-1">
                <SelectValue placeholder="Selecciona una caja…" />
              </SelectTrigger>
              <SelectContent>
                {cajas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="monto">Monto de apertura (MXN) *</Label>
            <Input id="monto" type="number" min={0} step={0.01} value={montoApertura}
              onChange={(e) => setMontoApertura(parseFloat(e.target.value) || 0)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="notas-apertura">Notas de apertura (opcional)</Label>
            <Input id="notas-apertura" value={notas} onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones al abrir el turno…" className="mt-1" />
          </div>
          <Button onClick={abrirTurno} disabled={saving} className="w-full sm:w-auto">
            <PlayCircle className="h-4 w-4 mr-2" />
            {saving ? "Abriendo…" : "Abrir turno"}
          </Button>
        </div>
      )}

      {/* Historial de turnos */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-semibold text-card-foreground mb-1">Historial de turnos</h2>
        <p className="text-xs text-muted-foreground mb-4">Últimos 20 turnos cerrados con sus cortes de arqueo.</p>
        <HistorialTurnos turnos={historial} cajas={cajas} />
      </div>

      {/* Audit log farmacia */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-semibold text-card-foreground mb-1">Historial de enlace con POS Farmacia</h2>
        <p className="text-xs text-muted-foreground mb-4">Últimos 20 eventos de vinculación entre turnos de caja y cortes de farmacia en esta clínica.</p>
        {auditLog.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin eventos registrados aún.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {auditLog.map((a) => {
              const meta = ACTION_LABELS[a.action] ?? { label: a.action, tone: "text-muted-foreground bg-muted" };
              return (
                <li key={a.id} className="py-3 flex items-start gap-3">
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${meta.tone}`}>{meta.label}</span>
                  <div className="flex-1 min-w-0">
                    {a.reason && <p className="text-foreground">{a.reason}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(a.created_at).toLocaleString("es-MX")}
                      {a.pharmacy_shift_id && <> · corte <code className="font-mono">{a.pharmacy_shift_id.slice(0, 8)}</code></>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <CloseTurnoDialog
        open={closeDialogOpen}
        turno={turnoActivo}
        onClose={() => setCloseDialogOpen(false)}
        onClosed={handleTurnoCerrado}
      />
      <FondoMovimientoDialog
        open={fondoDialogOpen}
        turnoId={turnoActivo?.id ?? null}
        onClose={() => setFondoDialogOpen(false)}
        onDone={() => { setFondoDialogOpen(false); load(); }}
      />
      <CorteXDialog
        open={corteXDialogOpen}
        turnoId={turnoActivo?.id ?? null}
        onClose={() => setCorteXDialogOpen(false)}
      />
    </div>
  );
}
