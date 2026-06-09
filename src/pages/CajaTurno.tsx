import { useState, useEffect } from "react";
import { Timer, PlayCircle, StopCircle, AlertCircle, Lock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const formatMXN = (n: number) =>
  Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

interface Caja {
  id: string;
  nombre: string;
  fondo_default: number;
  es_farmacia: boolean;
}

interface Turno {
  id: string;
  caja_id: string;
  estado: string;
  monto_apertura: number;
  abierto_at: string;
  pharmacy_shift_id: string | null;
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

const ACTION_LABELS: Record<string, { label: string; tone: string }> = {
  linked_existing: { label: "Reutilizó corte abierto", tone: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/20" },
  created_new: { label: "Creó corte de farmacia", tone: "text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/20" },
  skipped_not_pharmacy: { label: "Caja no es de farmacia", tone: "text-muted-foreground bg-muted" },
  blocked_close_pharmacy_open: { label: "Cierre bloqueado: corte farmacia abierto", tone: "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/20" },
  manual_link: { label: "Enlace manual", tone: "text-blue-700 bg-blue-50" },
  manual_unlink: { label: "Desenlace manual", tone: "text-amber-700 bg-amber-50" },
};

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}

function CloseTurnoDialog({
  open,
  turno,
  onClose,
  onClosed,
}: {
  open: boolean;
  turno: Turno | null;
  onClose: () => void;
  onClosed: () => void;
}) {
  const { roles } = useAuth();
  const [count, setCount] = useState("0");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [overridePrompt, setOverridePrompt] = useState<{ diff: number; umbral: number } | null>(null);
  const [result, setResult] = useState<CloseResult | null>(null);

  const isManager = roles.includes("admin") || roles.includes("manager");

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
    if (!turno) return;
    const amount = Number(count);
    if (Number.isNaN(amount) || amount < 0) {
      toast.error("Monto inválido");
      return;
    }
    setSubmitting(true);
    setOverridePrompt(null);

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

    setResult(data as unknown as CloseResult);
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
              <ResultRow label="Cobros efectivo" value={formatMXN(result.cash_total)} />
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
          <p className="text-xs text-muted-foreground">
            Cuenta el efectivo físicamente sin revisar el sistema primero.
            El sistema calculará la diferencia al cierre.
          </p>
          <div className="space-y-1">
            <Label className="text-xs">Efectivo contado físicamente (MXN)</Label>
            <Input
              type="number" min={0} step="0.01" value={count}
              onChange={(e) => setCount(e.target.value)}
              className="h-11 text-base"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notas del cierre</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {overridePrompt && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/8 p-3 space-y-2">
              <p className="text-sm font-medium text-amber-700">
                Diferencia de {formatMXN(overridePrompt.diff)} excede el umbral de {formatMXN(overridePrompt.umbral)}.
              </p>
              <p className="text-xs text-muted-foreground">
                {isManager
                  ? "Como admin/gerente puedes autorizar el cierre con esta diferencia."
                  : "Se requiere autorización de un admin o gerente para continuar."}
              </p>
              {isManager && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-amber-500 text-amber-700 hover:bg-amber-500/10"
                  onClick={() => submit(true)}
                  disabled={submitting}
                >
                  Autorizar y cerrar turno
                </Button>
              )}
            </div>
          )}
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

export default function CajaTurno({ onTurnoCerrado }: { onTurnoCerrado?: () => void } = {}) {
  const { user } = useAuth();
  const { activeClinic } = useActiveClinic();

  const [cajas, setCajas] = useState<Caja[]>([]);
  const [turnoActivo, setTurnoActivo] = useState<Turno | null>(null);
  const [auditLog, setAuditLog] = useState<LinkAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cajaId, setCajaId] = useState("");
  const [montoApertura, setMontoApertura] = useState(0);
  const [notas, setNotas] = useState("");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const load = async () => {
    if (!activeClinic?.id || !user?.id) return;
    setLoading(true);

    const [{ data: cajasData }, { data: turnoData }, { data: auditData }] = await Promise.all([
      supabase.from("cajas").select("id, nombre, fondo_default, es_farmacia").eq("clinic_id", activeClinic.id).eq("activo", true).order("nombre"),
      supabase.from("turnos").select("*").eq("clinic_id", activeClinic.id).eq("cajero_user_id", user.id).eq("estado", "abierto").maybeSingle(),
      (supabase as any).from("turno_pharmacy_link_audit")
        .select("id, turno_id, caja_id, pharmacy_shift_id, action, reason, created_at")
        .eq("clinic_id", activeClinic.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const cajasList = (cajasData as Caja[]) ?? [];
    setCajas(cajasList);
    setTurnoActivo((turnoData as Turno | null) ?? null);
    setAuditLog((auditData as LinkAudit[]) ?? []);

    if (cajasList[0] && !cajaId) {
      setCajaId(cajasList[0].id);
      setMontoApertura(cajasList[0].fondo_default);
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

  const handleTurnoCerrado = () => {
    setCloseDialogOpen(false);
    load();
    onTurnoCerrado?.();
  };

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
            <p className="text-sm text-muted-foreground mt-1">Pide al administrador que configure al menos una caja en <strong>Configuración → Caja</strong>.</p>
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
                Abierto: {new Date(turnoActivo.abierto_at).toLocaleString("es-MX")} — Fondo: ${turnoActivo.monto_apertura.toFixed(2)} MXN
              </p>
              {turnoActivo.pharmacy_shift_id && (
                <p className="text-xs text-primary mt-1">
                  Vinculado al POS Farmacia. Cierra primero el corte en <strong>Farmacia</strong> antes de cerrar este turno.
                </p>
              )}
            </div>
          </div>
          <Button
            variant="destructive"
            onClick={() => setCloseDialogOpen(true)}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            <StopCircle className="h-4 w-4 mr-2" />
            Cerrar turno
          </Button>
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
            <Input
              id="monto"
              type="number"
              min={0}
              step={0.01}
              value={montoApertura}
              onChange={(e) => setMontoApertura(parseFloat(e.target.value) || 0)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="notas-apertura">Notas de apertura (opcional)</Label>
            <Input
              id="notas-apertura"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones al abrir el turno…"
              className="mt-1"
            />
          </div>
          <Button onClick={abrirTurno} disabled={saving} className="w-full sm:w-auto">
            <PlayCircle className="h-4 w-4 mr-2" />
            {saving ? "Abriendo…" : "Abrir turno"}
          </Button>
        </div>
      )}

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
    </div>
  );
}
