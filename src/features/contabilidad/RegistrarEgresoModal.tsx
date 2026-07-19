import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { untypedTable } from "@/lib/untypedTable";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { friendlyError } from "@/lib/errors";

interface CuentaEgreso {
  id: string;
  codigo: string;
  nombre: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function RegistrarEgresoModal({ open, onOpenChange, onSaved }: Props) {
  const { activeClinicId } = useActiveClinic();
  const [cuentas, setCuentas] = useState<CuentaEgreso[]>([]);
  const [cuentaId, setCuentaId] = useState("");
  const [monto, setMonto] = useState("");
  const [fechaDevengo, setFechaDevengo] = useState(today());
  const [fechaPago, setFechaPago] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data, error } = await untypedTable("cuentas_contables")
        .select("id,codigo,nombre")
        .eq("tipo", "egreso")
        .eq("activo", true)
        .order("nombre");
      if (error) { toast.error(friendlyError(error)); return; }
      setCuentas((data ?? []) as CuentaEgreso[]);
    })();
  }, [open]);

  const reset = () => {
    setCuentaId("");
    setMonto("");
    setFechaDevengo(today());
    setFechaPago("");
    setDescripcion("");
  };

  const save = async () => {
    if (!activeClinicId) return;
    const montoNum = Number(monto);
    if (!cuentaId) { toast.error("Selecciona una cuenta"); return; }
    if (!monto || Number.isNaN(montoNum) || montoNum <= 0) { toast.error("Monto inválido"); return; }
    if (!fechaDevengo) { toast.error("La fecha de devengo es obligatoria"); return; }

    setSaving(true);
    const { error } = await untypedTable("movimientos_contables").insert({
      clinic_id: activeClinicId,
      cuenta_id: cuentaId,
      origen: "manual",
      monto_centavos: Math.round(montoNum * 100),
      fecha_devengo: fechaDevengo,
      fecha_pago: fechaPago || null,
      descripcion: descripcion.trim() || null,
    });
    setSaving(false);

    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Egreso registrado");
    reset();
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar egreso</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="field-cuenta">Cuenta *</Label>
            <Select value={cuentaId} onValueChange={setCuentaId}>
              <SelectTrigger id="field-cuenta">
                <SelectValue placeholder="Selecciona una cuenta" />
              </SelectTrigger>
              <SelectContent>
                {cuentas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="field-monto">Monto (MXN) *</Label>
            <MoneyInput id="field-monto" value={monto} onValueChange={setMonto} placeholder="0.00" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="field-fecha_devengo">Fecha de devengo *</Label>
              <Input id="field-fecha_devengo" type="date" value={fechaDevengo} onChange={(e) => setFechaDevengo(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="field-fecha_pago">Fecha de pago</Label>
              <Input id="field-fecha_pago" type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="field-descripcion">Descripción</Label>
            <Textarea id="field-descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
