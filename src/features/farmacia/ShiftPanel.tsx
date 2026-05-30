/**
 * Apertura, vista y cierre de turno de caja del POS Farmacia.
 *
 * El cálculo de efectivo esperado y la diferencia se hacen en backend
 * (pharmacy_close_shift) para evitar manipulación desde el cliente.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Banknote, LockOpen, Lock } from "lucide-react";
import { friendlyError } from "@/lib/errors";

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

export function OpenShiftCard({
  onOpened,
}: {
  onOpened: (shift: Shift) => void;
}) {
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
        <Input
          type="number" min={0} step="0.01" value={opening}
          onChange={(e) => setOpening(e.target.value)}
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
  const [count, setCount] = useState("0");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!shift) return;
    const amount = Number(count);
    if (Number.isNaN(amount) || amount < 0) {
      toast({ title: "Monto inválido", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("pharmacy_close_shift", {
      p_shift_id: shift.id,
      p_cash_count: amount,
      p_notes: notes || null,
    } as never);
    setSubmitting(false);
    if (error) {
      toast({ title: "No se pudo cerrar el turno", description: friendlyError(error), variant: "destructive" });
      return;
    }
    toast({ title: "Turno cerrado" });
    onClosed();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4" />Cerrar turno</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Monto inicial: <strong>{formatMXN(shift?.opening_amount ?? 0)}</strong>. El sistema calculará el efectivo esperado y la diferencia.
          </p>
          <div className="space-y-1">
            <Label className="text-xs">Efectivo contado físicamente</Label>
            <Input type="number" min={0} step="0.01" value={count} onChange={(e) => setCount(e.target.value)} className="h-11 text-base" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notas del cierre</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Cerrando…" : "Cerrar turno y generar corte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Carga el turno abierto del usuario actual en la clínica activa. */
export async function fetchCurrentShift(): Promise<Shift | null> {
  const { data } = await supabase.rpc("pharmacy_current_shift", { p_clinic: null } as never);
  if (!data) return null;
  // RPC retorna fila única
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as Shift | null;
}

export { formatMXN as formatMXNShift };
