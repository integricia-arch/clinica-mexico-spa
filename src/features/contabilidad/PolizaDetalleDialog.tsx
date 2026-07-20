import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportReporteCsv } from "@/features/contabilidad/exportReporteCsv";
import type { LibroDiarioFila } from "@/hooks/useReportesContables";

export interface PolizaAgrupada {
  poliza_id: string;
  folio: number;
  tipo: string;
  fecha: string;
  concepto: string;
  uuid_cfdi: string | null;
  estado: string;
  lineas: LibroDiarioFila[];
  debe: number;
  haber: number;
}

const TIPO_POLIZA_LABELS: Record<string, string> = { diario: "Diario", ingreso: "Ingreso", egreso: "Egreso" };

function fmtMXN(centavos: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(centavos / 100);
}

export function PolizaDetalleDialog({ poliza, onOpenChange, onCancelar, cancelando }: {
  poliza: PolizaAgrupada | null;
  onOpenChange: (open: boolean) => void;
  onCancelar: (polizaId: string) => void;
  cancelando: boolean;
}) {
  const cuadra = poliza ? poliza.debe === poliza.haber : true;

  const exportar = () => {
    if (!poliza) return;
    exportReporteCsv(
      `poliza_${poliza.tipo}_${poliza.folio}`,
      ["Cuenta", "Descripción", "Cargo", "Abono"],
      poliza.lineas.map((l) => [
        `${l.cuenta_codigo} ${l.cuenta_nombre}`,
        l.descripcion ?? "",
        (l.debe_centavos / 100).toFixed(2),
        (l.haber_centavos / 100).toFixed(2),
      ]),
    );
  };

  return (
    <Dialog open={!!poliza} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        {poliza && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
                {poliza.tipo.slice(0, 3).toUpperCase()}-{poliza.folio} — {TIPO_POLIZA_LABELS[poliza.tipo] ?? poliza.tipo}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cuadra ? "bg-emerald-100 text-emerald-700" : "bg-destructive/15 text-destructive"}`}>
                  {cuadra ? "Cuadra" : "DESCUADRE"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{poliza.estado}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <p><span className="font-medium text-foreground">Fecha:</span> {poliza.fecha}</p>
                {poliza.uuid_cfdi && <p><span className="font-medium text-foreground">UUID CFDI:</span> {poliza.uuid_cfdi}</p>}
              </div>
              <p><span className="font-medium">Concepto:</span> {poliza.concepto}</p>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th className="p-2 font-medium text-muted-foreground">Cuenta</th>
                      <th className="p-2 font-medium text-muted-foreground">Descripción</th>
                      <th className="p-2 font-medium text-muted-foreground text-right">Cargo</th>
                      <th className="p-2 font-medium text-muted-foreground text-right">Abono</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poliza.lineas.map((l) => (
                      <tr key={`${poliza.poliza_id}-${l.orden}`} className="border-b border-border/40 last:border-0">
                        <td className="p-2">{l.cuenta_codigo} — {l.cuenta_nombre}</td>
                        <td className="p-2 text-muted-foreground">{l.descripcion ?? "—"}</td>
                        <td className="p-2 text-right">{l.debe_centavos > 0 ? fmtMXN(l.debe_centavos) : "—"}</td>
                        <td className="p-2 text-right">{l.haber_centavos > 0 ? fmtMXN(l.haber_centavos) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border font-medium">
                      <td className="p-2" colSpan={2}>Total</td>
                      <td className="p-2 text-right">{fmtMXN(poliza.debe)}</td>
                      <td className="p-2 text-right">{fmtMXN(poliza.haber)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              {poliza.estado === "contabilizada" && (
                <Button
                  variant="outline" className="mr-auto"
                  disabled={cancelando}
                  onClick={() => onCancelar(poliza.poliza_id)}
                >
                  Cancelar póliza
                </Button>
              )}
              <Button variant="outline" className="gap-1.5" onClick={exportar}>
                <Download className="h-3.5 w-3.5" /> Exportar CSV
              </Button>
              <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
