import { useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  useBalanzaComprobacion, useBalanceGeneral, useAuditoriaHuecos, useConciliaCortes,
} from "@/hooks/useReportesContables";

function fmtMXN(centavos: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(centavos / 100);
}

const hoy = new Date();
const inicioMes = format(startOfMonth(hoy), "yyyy-MM-dd");
const finMes = format(endOfMonth(hoy), "yyyy-MM-dd");

function Resultado({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${ok ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// ponytail: validador agrega 4 checks ya existentes (balanza, balance_general,
// contab_auditoria_huecos, contab_concilia_cortes) — ninguno es lógica nueva, solo
// los junta en un solo botón. contab_auditoria_huecos/contab_concilia_cortes ya
// existían en la DB desde fase 7 pero nunca se habían expuesto en la UI.
export function ValidadorCuadreDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(finMes);
  const [ranOnce, setRanOnce] = useState(false);
  const balanza = useBalanzaComprobacion();
  const balanceGeneral = useBalanceGeneral();
  const huecos = useAuditoriaHuecos();
  const cortes = useConciliaCortes();

  const loading = balanza.loading || balanceGeneral.loading || huecos.loading || cortes.loading;

  const validar = async () => {
    setRanOnce(true);
    await Promise.all([
      balanza.load(desde, hasta),
      balanceGeneral.load(hasta),
      huecos.load(desde, hasta),
      cortes.load(desde, hasta),
    ]);
  };

  const totBalanza = balanza.rows.reduce((acc, r) => ({ debe: acc.debe + r.cargos_centavos, haber: acc.haber + r.abonos_centavos }), { debe: 0, haber: 0 });
  const balanzaCuadra = totBalanza.debe === totBalanza.haber;

  const totBalance = balanceGeneral.rows.reduce((acc, r) => {
    if (r.tipo === "activo") acc.activo += r.saldo_centavos;
    else if (r.tipo === "pasivo") acc.pasivo += r.saldo_centavos;
    else if (r.tipo === "capital") acc.capital += r.saldo_centavos;
    return acc;
  }, { activo: 0, pasivo: 0, capital: 0 });
  const ecuacionCuadra = totBalance.activo === totBalance.pasivo + totBalance.capital;

  const cortesConDiferencia = cortes.rows.filter((c) => c.diferencia_centavos !== 0);

  const errorGeneral = balanza.error || balanceGeneral.error || huecos.error || cortes.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Validar cuadre contable</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="field-validar-desde" className="text-xs">Desde</Label>
              <Input id="field-validar-desde" type="date" className="h-9 w-36" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="field-validar-hasta" className="text-xs">Hasta</Label>
              <Input id="field-validar-hasta" type="date" className="h-9 w-36" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <Button onClick={validar} disabled={loading} className="h-9 gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Calcular
            </Button>
          </div>

          {errorGeneral && <p className="text-sm text-destructive">Error: {errorGeneral}</p>}

          {ranOnce && !loading && (
            <div className="space-y-3">
              <Resultado ok={balanzaCuadra}>
                <p className="font-medium">Balanza de comprobación (partida doble, período)</p>
                <p>Debe: {fmtMXN(totBalanza.debe)} — Haber: {fmtMXN(totBalanza.haber)}
                  {!balanzaCuadra && <span> — descuadre de {fmtMXN(Math.abs(totBalanza.debe - totBalanza.haber))}</span>}
                </p>
              </Resultado>

              <Resultado ok={ecuacionCuadra}>
                <p className="font-medium">Ecuación contable (Activo = Pasivo + Capital, al {hasta})</p>
                <p>Activo: {fmtMXN(totBalance.activo)} — Pasivo + Capital: {fmtMXN(totBalance.pasivo + totBalance.capital)}
                  {!ecuacionCuadra && <span> — diferencia de {fmtMXN(Math.abs(totBalance.activo - (totBalance.pasivo + totBalance.capital)))}</span>}
                </p>
              </Resultado>

              <Resultado ok={huecos.rows.length === 0}>
                <p className="font-medium">Huecos entre devengo simple y partida doble</p>
                {huecos.rows.length === 0 ? <p>Sin huecos detectados en el período.</p> : (
                  <ul className="mt-1 space-y-1 list-disc pl-4">
                    {huecos.rows.slice(0, 20).map((h, i) => (
                      <li key={i}>
                        <span className="font-mono text-xs">{h.tipo_hueco}</span> — {h.fecha} — {h.descripcion} — {fmtMXN(h.monto_centavos)}
                      </li>
                    ))}
                    {huecos.rows.length > 20 && <li>… y {huecos.rows.length - 20} más</li>}
                  </ul>
                )}
              </Resultado>

              <Resultado ok={cortesConDiferencia.length === 0}>
                <p className="font-medium">Cortes de caja (Z) vs pólizas</p>
                {cortesConDiferencia.length === 0 ? <p>Sin diferencias en cortes del período.</p> : (
                  <ul className="mt-1 space-y-1 list-disc pl-4">
                    {cortesConDiferencia.map((c) => (
                      <li key={c.corte_id}>
                        Corte {c.corte_tipo} del {format(new Date(c.fecha_corte), "yyyy-MM-dd HH:mm")} —
                        corte: {fmtMXN(c.total_corte_centavos)}, pólizas: {fmtMXN(c.total_polizas_centavos)},
                        diferencia: {fmtMXN(c.diferencia_centavos)}
                      </li>
                    ))}
                  </ul>
                )}
              </Resultado>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
