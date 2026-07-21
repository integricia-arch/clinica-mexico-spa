import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SupervisorPinDialog from "@/components/turno/SupervisorPinDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export function FondoMovimientoDialog({
  open, turnoId, clinicId, onClose, onDone,
}: {
  open: boolean; turnoId: string | null; clinicId: string; onClose: () => void; onDone: () => void;
}) {
  const [tipo, setTipo] = useState<"egreso" | "ingreso" | "cash_drop">("egreso");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [destino, setDestino] = useState("");
  const [saving, setSaving] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  function reset() { setTipo("egreso"); setMonto(""); setMotivo(""); setDestino(""); setSaving(false); }

  function requestSubmit() {
    if (!turnoId) return;
    const amount = Number(monto);
    if (Number.isNaN(amount) || amount <= 0) { toast.error("Monto debe ser mayor a cero"); return; }
    if (!motivo.trim()) { toast.error("Motivo requerido"); return; }
    if (tipo === "cash_drop") {
      if (!destino.trim()) { toast.error("Destino requerido para cash drop"); return; }
      setPinDialogOpen(true);
      return;
    }
    doSubmit();
  }

  async function doSubmit(supervisorId?: string, pin?: string) {
    if (!turnoId) return;
    setPinDialogOpen(false);
    setSaving(true);

    const { error } = await (supabase as any).rpc("turno_fondo_movimiento", {
      p_turno_id: turnoId,
      p_tipo: tipo,
      p_monto: Number(monto),
      p_motivo: motivo.trim(),
      p_destino: tipo === "cash_drop" ? destino.trim() : null,
      p_supervisor_id: supervisorId ?? null,
      p_supervisor_pin: pin ?? null,
    } as never);

    setSaving(false);
    if (error) { toast.error(`Error: ${error.message}`); return; }
    toast.success(tipo === "egreso" ? "Retiro registrado" : tipo === "ingreso" ? "Depósito registrado" : "Cash drop registrado");
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
            <Select value={tipo} onValueChange={(v) => setTipo(v as "egreso" | "ingreso" | "cash_drop")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="egreso">Retiro / Egreso</SelectItem>
                <SelectItem value="ingreso">Depósito / Ingreso</SelectItem>
                <SelectItem value="cash_drop">Cash drop (retiro a caja fuerte/banco)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monto (MXN)</Label>
            <MoneyInput value={monto}
              onValueChange={setMonto} placeholder="0.00" autoFocus />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Pago a proveedor, cambio de billetes…" />
          </div>
          {tipo === "cash_drop" && (
            <div className="space-y-1">
              <Label className="text-xs">Destino</Label>
              <Input value={destino} onChange={(e) => setDestino(e.target.value)}
                placeholder="Ej. Caja fuerte, banco…" />
              <p className="text-xs text-muted-foreground">Requiere doble firma: tu registro + PIN de un supervisor.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={requestSubmit} disabled={saving}>
            {saving ? "Guardando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <SupervisorPinDialog
        open={pinDialogOpen}
        clinicId={clinicId}
        title="Autorización de cash drop"
        description="El cash drop requiere PIN de un supervisor distinto al cajero."
        onAuthorized={(supervisorId, pin) => doSubmit(supervisorId, pin)}
        onCancel={() => setPinDialogOpen(false)}
      />
    </Dialog>
  );
}
