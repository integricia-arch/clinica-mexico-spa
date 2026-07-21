import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
import { useActiveClinic } from "@/hooks/useActiveClinic";

interface SaldoDoctor {
  doctor_id: string;
  doctor_nombre: string;
  devengado_centavos: number;
  pagado_centavos: number;
  saldo_centavos: number;
}

function fmtMXN(centavos: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(centavos / 100);
}

export function HonorariosTab() {
  const { activeClinicId } = useActiveClinic();
  const [rows, setRows] = useState<SaldoDoctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagoDialog, setPagoDialog] = useState<SaldoDoctor | null>(null);
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeClinicId) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("honorarios_saldo_por_doctor", { p_clinic_id: activeClinicId });
    if (!error) setRows((data ?? []) as SaldoDoctor[]);
    setLoading(false);
  }, [activeClinicId]);

  useEffect(() => { load(); }, [load]);

  const abrirPago = (r: SaldoDoctor) => {
    setPagoDialog(r);
    setMonto("");
    setConcepto(`Pago de honorarios — ${r.doctor_nombre}`);
  };

  const handlePagar = async () => {
    if (!pagoDialog || !activeClinicId) return;
    const montoCentavos = Math.round(Number(monto) * 100);
    if (!montoCentavos || montoCentavos <= 0) {
      toast.error("Monto inválido.");
      return;
    }
    if (montoCentavos > pagoDialog.saldo_centavos) {
      toast.error(`Excede el saldo pendiente (${fmtMXN(pagoDialog.saldo_centavos)}).`);
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc("honorario_registrar_pago", {
      p_payload: {
        clinic_id: activeClinicId, doctor_id: pagoDialog.doctor_id,
        monto_centavos: montoCentavos, concepto: concepto.trim() || undefined,
      },
    });
    setSaving(false);
    if (error) { toast.error(friendlyError(error, "No se pudo registrar el pago.")); return; }
    toast.success("Pago registrado — póliza generada.");
    setPagoDialog(null);
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-3">Honorarios por doctor — devengado vs. pagado</p>
          {loading ? <Skeleton className="h-40 w-full rounded-xl" /> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin honorarios devengados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Doctor</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Devengado</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Pagado</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Saldo pendiente</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.doctor_id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4">{r.doctor_nombre}</td>
                      <td className="py-2 pr-4 text-right">{fmtMXN(r.devengado_centavos)}</td>
                      <td className="py-2 pr-4 text-right">{fmtMXN(r.pagado_centavos)}</td>
                      <td className={`py-2 pr-4 text-right font-medium ${r.saldo_centavos > 0 ? "text-amber-600" : ""}`}>
                        {fmtMXN(r.saldo_centavos)}
                      </td>
                      <td className="py-2 text-right">
                        <Button size="sm" variant="outline" disabled={r.saldo_centavos <= 0} onClick={() => abrirPago(r)}>
                          Pagar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!pagoDialog} onOpenChange={(open) => !open && setPagoDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago de honorarios</DialogTitle>
          </DialogHeader>
          {pagoDialog && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {pagoDialog.doctor_nombre} — saldo pendiente: <span className="font-medium text-foreground">{fmtMXN(pagoDialog.saldo_centavos)}</span>
              </p>
              <div>
                <Label htmlFor="field-honorario-monto" className="text-xs">Monto a pagar (MXN)</Label>
                <Input id="field-honorario-monto" type="number" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="field-honorario-concepto" className="text-xs">Concepto</Label>
                <Input id="field-honorario-concepto" value={concepto} onChange={(e) => setConcepto(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoDialog(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={handlePagar} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Registrar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
