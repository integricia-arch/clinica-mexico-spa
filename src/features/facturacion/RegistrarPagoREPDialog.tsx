import { useState } from "react";
import { Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FORMAS_PAGO = [
  { value: "01", label: "01 — Efectivo" },
  { value: "02", label: "02 — Cheque nominativo" },
  { value: "03", label: "03 — Transferencia electrónica" },
  { value: "04", label: "04 — Tarjeta de crédito" },
  { value: "28", label: "28 — Tarjeta de débito" },
  { value: "29", label: "29 — Tarjeta de servicios" },
  { value: "06", label: "06 — Dinero electrónico" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: (cfdiId: string, uuid: string) => void;
  cfdi: {
    id: string;
    uuid_fiscal: string | null;
    serie: string | null;
    folio: string | null;
    nombre_receptor: string;
    rfc_receptor: string;
    total: number;
    clinic_id?: string;
  };
  clinicId: string;
}

const fmt = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function RegistrarPagoREPDialog({ open, onOpenChange, onSuccess, cfdi, clinicId }: Props) {
  const [forma, setForma]           = useState("03");
  const [monto, setMonto]           = useState(String(cfdi.total));
  const [fechaPago, setFechaPago]   = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });
  const [numOp, setNumOp]           = useState("");
  const [parcialidad, setParcialidad] = useState("1");
  const [saldoAnt, setSaldoAnt]     = useState(String(cfdi.total));
  const [submitting, setSubmitting] = useState(false);

  const montoNum     = parseFloat(monto) || 0;
  const saldoAntNum  = parseFloat(saldoAnt) || 0;
  const saldoInsoluto = Math.max(0, Math.round((saldoAntNum - montoNum) * 100) / 100);

  const handleSubmit = async () => {
    if (!montoNum || montoNum <= 0) { toast.error("Monto debe ser mayor a 0"); return; }
    if (!fechaPago) { toast.error("Fecha de pago requerida"); return; }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sin sesión");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cfdi-rep`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clinic_id:       clinicId,
          cfdi_id:         cfdi.id,
          fecha_pago:      fechaPago + ":00",
          forma_pago:      forma,
          monto:           montoNum,
          num_parcialidad: parseInt(parcialidad) || 1,
          saldo_anterior:  saldoAntNum,
          saldo_insoluto:  saldoInsoluto,
          ...(numOp.trim() ? { num_operacion: numOp.trim() } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      if (data.warning) toast.warning(data.warning);

      onSuccess(data.cfdi_id, data.uuid_fiscal ?? "");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Error al registrar pago: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Registrar pago — Complemento REP
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Resumen CFDI original */}
          <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 text-sm space-y-1">
            <div className="font-medium text-card-foreground">
              CFDI {cfdi.serie ?? "A"}-{cfdi.folio ?? "—"} — {cfdi.nombre_receptor}
            </div>
            <div className="text-muted-foreground text-xs">
              {cfdi.rfc_receptor} · Total original: <span className="font-medium text-foreground">{fmt(cfdi.total)}</span>
            </div>
            {cfdi.uuid_fiscal && (
              <div className="text-xs font-mono text-muted-foreground">{cfdi.uuid_fiscal}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rep-fecha">Fecha del pago *</Label>
              <Input
                id="rep-fecha"
                type="datetime-local"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rep-forma">Forma de pago *</Label>
              <select
                id="rep-forma"
                value={forma}
                onChange={(e) => setForma(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                {FORMAS_PAGO.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rep-parcialidad">Num. parcialidad</Label>
              <Input
                id="rep-parcialidad"
                type="number"
                min="1"
                value={parcialidad}
                onChange={(e) => setParcialidad(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rep-num-op">Núm. operación (opcional)</Label>
              <Input
                id="rep-num-op"
                value={numOp}
                onChange={(e) => setNumOp(e.target.value)}
                placeholder="Ref. bancaria"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rep-saldo-ant">Saldo anterior *</Label>
              <Input
                id="rep-saldo-ant"
                type="number"
                step="0.01"
                min="0"
                value={saldoAnt}
                onChange={(e) => setSaldoAnt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rep-monto">Importe pagado *</Label>
              <Input
                id="rep-monto"
                type="number"
                step="0.01"
                min="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg bg-muted/30 px-4 py-2.5 text-sm flex justify-between">
            <span className="text-muted-foreground">Saldo insoluto resultante</span>
            <span className={`font-semibold ${saldoInsoluto === 0 ? "text-success" : "text-foreground"}`}>
              {fmt(saldoInsoluto)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Timbrar REP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
