import { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Lock, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCierresMensuales, useAuditoriaHuecos, useConciliaCortes } from "@/hooks/useCierreMensual";

function fmtMXN(centavos: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(centavos / 100);
}

const hoy = new Date();
const mesPasado = subMonths(hoy, 1);
const inicioMesPasado = format(startOfMonth(mesPasado), "yyyy-MM-dd");
const finMesPasado = format(endOfMonth(mesPasado), "yyyy-MM-dd");

function CierresSection() {
  const [periodo, setPeriodo] = useState(inicioMesPasado);
  const [cerrando, setCerrando] = useState(false);
  const { rows, loading, error, load, cerrar } = useCierresMensuales();

  useEffect(() => { load(); }, [load]);

  const handleCerrar = async () => {
    setCerrando(true);
    const { error: err } = await cerrar(periodo);
    setCerrando(false);
    if (err) toast.error(err);
    else toast.success(`Período ${format(new Date(periodo + "T12:00:00"), "MMMM yyyy", { locale: es })} cerrado`);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="field-cierre-periodo" className="text-xs">Cerrar período (mes)</Label>
            <Input id="field-cierre-periodo" type="date" className="h-8 w-36" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" className="h-8 gap-1.5" disabled={cerrando}>
                <Lock className="h-3.5 w-3.5" /> Cerrar período
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cerrar {format(new Date(periodo + "T12:00:00"), "MMMM yyyy", { locale: es })}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se genera una póliza de cierre de resultados y el período queda bloqueado:
                  ninguna póliza nueva podrá fecharse dentro de ese mes. Los ajustes posteriores
                  van al período abierto. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleCerrar}>Confirmar cierre</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Error: {error}</div>}

        {loading ? <Skeleton className="h-24 w-full rounded-xl" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Sin períodos cerrados todavía</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Período</th>
                  <th className="pb-2 font-medium text-muted-foreground">Cerrado el</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-4 capitalize">{format(new Date(r.periodo + "T12:00:00"), "MMMM yyyy", { locale: es })}</td>
                    <td className="py-2">{r.cerrado_at ? format(new Date(r.cerrado_at), "dd/MM/yyyy HH:mm") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AuditoriaSection() {
  const [desde, setDesde] = useState(inicioMesPasado);
  const [hasta, setHasta] = useState(finMesPasado);
  const { rows, loading, error, load } = useAuditoriaHuecos();

  useEffect(() => { load(desde, hasta); }, [load, desde, hasta]);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="field-aud-desde" className="text-xs">Desde</Label>
            <Input id="field-aud-desde" type="date" className="h-8 w-36" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="field-aud-hasta" className="text-xs">Hasta</Label>
            <Input id="field-aud-hasta" type="date" className="h-8 w-36" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Error: {error}</div>}

        {loading ? <Skeleton className="h-24 w-full rounded-xl" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 flex items-center gap-1.5">Sin huecos detectados en el período — motor de asientos al día</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Tipo</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Fecha</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Descripción</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.tipo_hueco}-${r.origen_id}`} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-4">
                      <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3.5 w-3.5" />
                        {r.tipo_hueco === "sin_referencia" ? "Póliza sin referencia" : "Movimiento sin póliza"}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{r.fecha}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.descripcion ?? "—"}</td>
                    <td className="py-2 text-right">{fmtMXN(r.monto_centavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConciliacionSection() {
  const [desde, setDesde] = useState(inicioMesPasado);
  const [hasta, setHasta] = useState(finMesPasado);
  const { rows, loading, error, load } = useConciliaCortes();

  useEffect(() => { load(desde, hasta); }, [load, desde, hasta]);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="field-conc-desde" className="text-xs">Desde</Label>
            <Input id="field-conc-desde" type="date" className="h-8 w-36" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="field-conc-hasta" className="text-xs">Hasta</Label>
            <Input id="field-conc-hasta" type="date" className="h-8 w-36" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Solo cortes Z de caja general. Turnos de farmacia usan otro esquema de cierre, fuera de esta conciliación.</p>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Error: {error}</div>}

        {loading ? <Skeleton className="h-24 w-full rounded-xl" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Sin cortes Z en el período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Fecha corte</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Total corte Z</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Total pólizas</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.corte_id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-4">{format(new Date(r.fecha_corte), "dd/MM/yyyy HH:mm")}</td>
                    <td className="py-2 pr-4 text-right">{fmtMXN(r.total_corte_centavos)}</td>
                    <td className="py-2 pr-4 text-right">{fmtMXN(r.total_polizas_centavos)}</td>
                    <td className={`py-2 text-right font-medium ${r.diferencia_centavos !== 0 ? "text-red-600" : ""}`}>
                      {fmtMXN(r.diferencia_centavos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CierreTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Cierre de período</h2>
        <p className="text-xs text-muted-foreground">Congela un mes y genera la póliza de cierre de resultados</p>
      </div>
      <CierresSection />

      <div className="pt-2">
        <h2 className="text-sm font-semibold">Auditoría — asientos huecos</h2>
        <p className="text-xs text-muted-foreground">Pólizas sin trazabilidad y movimientos que aún no generaron póliza</p>
      </div>
      <AuditoriaSection />

      <div className="pt-2">
        <h2 className="text-sm font-semibold">Conciliación de caja</h2>
        <p className="text-xs text-muted-foreground">Corte Z vs pólizas del mismo turno</p>
      </div>
      <ConciliacionSection />
    </div>
  );
}
