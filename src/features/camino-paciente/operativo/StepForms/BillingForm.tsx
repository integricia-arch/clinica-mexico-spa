import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Check, ExternalLink } from "lucide-react";
import { saveJourneyStepData, closeJourneyStep } from "@/features/camino-paciente/services/journeyEngine";
import type { StepFormProps } from "./_shared";
import { isClosed } from "./_shared";

const METODOS = ["Efectivo", "Tarjeta débito", "Tarjeta crédito", "Transferencia", "Cortesía"];
const USOS_CFDI = ["G03 - Gastos en general", "D01 - Honorarios médicos", "P01 - Por definir", "S01 - Sin efectos fiscales"];

export default function BillingForm({ stepId, stepStatus, existingData, onSaved }: StepFormProps) {
  const navigate = useNavigate();
  const [monto, setMonto] = useState(existingData.monto ?? "");
  const [metodo, setMetodo] = useState(existingData.metodo_pago ?? "Efectivo");
  const [folio, setFolio] = useState(existingData.folio_pago ?? "");
  const [requiereFactura, setRequiereFactura] = useState<boolean>(existingData.requiere_factura ?? false);
  const [rfc, setRfc] = useState(existingData.rfc ?? "");
  const [razonSocial, setRazonSocial] = useState(existingData.razon_social ?? "");
  const [usoCfdi, setUsoCfdi] = useState(existingData.uso_cfdi ?? USOS_CFDI[0]);
  const [notas, setNotas] = useState(existingData.notas ?? "");
  const [saving, setSaving] = useState(false);
  const closed = isClosed(stepStatus);

  const handleConfirm = async () => {
    if (!monto) { toast.error("Capture el monto cobrado"); return; }
    if (requiereFactura && (!rfc || !razonSocial)) { toast.error("RFC y razón social son obligatorios para factura"); return; }
    setSaving(true);
    const s = await saveJourneyStepData(stepId, {
      monto, metodo_pago: metodo, folio_pago: folio,
      requiere_factura: requiereFactura, rfc, razon_social: razonSocial, uso_cfdi: usoCfdi,
      notas, cobrado_en: new Date().toISOString(),
    });
    if (!s.ok) { setSaving(false); toast.error(s.error ?? "Error"); return; }
    const c = await closeJourneyStep(stepId);
    setSaving(false);
    if (!c.ok) toast.error(c.error ?? "Error");
    else { toast.success("Pago registrado"); onSaved?.(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Registre el cobro. Si requiere factura, capture los datos fiscales para CFDI (emisión en módulo aparte).
        </p>
        <Button
          size="sm" variant="outline" type="button"
          className="shrink-0 gap-1.5 text-xs"
          onClick={() => navigate("/caja")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ir a Caja
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Monto (MXN) <span className="text-destructive">*</span></Label>
          <MoneyInput value={monto} onValueChange={setMonto} disabled={closed} />
        </div>
        <div className="space-y-2">
          <Label>Método de pago</Label>
          <Select value={metodo} onValueChange={setMetodo} disabled={closed}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{METODOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Folio / referencia</Label>
        <Input value={folio} onChange={(e) => setFolio(e.target.value)} disabled={closed} />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="rf" checked={requiereFactura} onCheckedChange={(v) => setRequiereFactura(!!v)} disabled={closed} />
        <Label htmlFor="rf" className="cursor-pointer">Requiere factura CFDI</Label>
      </div>
      {requiereFactura && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="space-y-2"><Label>RFC</Label><Input value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} disabled={closed} maxLength={13} /></div>
          <div className="space-y-2"><Label>Razón social</Label><Input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} disabled={closed} /></div>
          <div className="space-y-2">
            <Label>Uso de CFDI</Label>
            <Select value={usoCfdi} onValueChange={setUsoCfdi} disabled={closed}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{USOS_CFDI.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label>Notas</Label>
        <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} disabled={closed} rows={2} />
      </div>
      {!closed && (
        <Button onClick={handleConfirm} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Confirmar cobro
        </Button>
      )}
    </div>
  );
}
