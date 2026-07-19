import { useEffect, useRef, useState } from "react";
import { Upload, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { untypedTable } from "@/lib/untypedTable";
import { useConciliacionBancaria } from "@/hooks/useConciliacionBancaria";
import { parseEstadoCuentaCsv } from "@/features/contabilidad/parseEstadoCuentaCsv";

function fmtMXN(centavos: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(centavos / 100);
}

export function BancosTab() {
  const [cuentas, setCuentas] = useState<{ id: string; codigo: string; nombre: string }[]>([]);
  const [cuentaId, setCuentaId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { rows, loading, error, load, importar, importing, conciliar } = useConciliacionBancaria();

  useEffect(() => {
    (async () => {
      const { data, error: err } = await untypedTable("cuentas_contables")
        .select("id,codigo,nombre").eq("tipo", "activo").order("codigo");
      if (!err) {
        const opts = (data ?? []) as { id: string; codigo: string; nombre: string }[];
        setCuentas(opts);
        if (opts.length > 0) setCuentaId((prev) => prev || opts[0].id);
      }
    })();
  }, []);

  useEffect(() => { if (cuentaId) load(cuentaId); }, [load, cuentaId]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cuentaId) return;
    const texto = await file.text();
    const { lineas, errores } = parseEstadoCuentaCsv(texto);
    if (errores.length > 0) toast.warning(`${errores.length} línea(s) inválidas, se ignoraron`);
    if (lineas.length === 0) { toast.error("Sin líneas válidas en el archivo"); return; }
    const { error: err, insertadas } = await importar(cuentaId, lineas);
    if (err) toast.error(err);
    else {
      toast.success(`${insertadas} línea(s) nuevas importadas de ${lineas.length} leídas`);
      load(cuentaId);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleConciliar = async (estadoCuentaId: string, polizaPartidaId: string) => {
    const { error: err } = await conciliar(estadoCuentaId, polizaPartidaId);
    if (err) toast.error(err);
    else { toast.success("Línea conciliada"); load(cuentaId); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Cuenta bancaria</Label>
              <Select value={cuentaId} onValueChange={setCuentaId}>
                <SelectTrigger className="h-8 w-56 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="field-bancos-csv" className="text-xs">Importar estado de cuenta (CSV: fecha,concepto,monto,referencia)</Label>
              <div className="flex items-center gap-2">
                <input ref={fileRef} id="field-bancos-csv" type="file" accept=".csv,text/csv" onChange={handleFile} disabled={importing || !cuentaId} className="text-sm" />
                {importing && <Upload className="h-3.5 w-3.5 animate-pulse" />}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Monto positivo = depósito, negativo = retiro. Reimportar el mismo archivo no duplica líneas.</p>
        </CardContent>
      </Card>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Error: {error}</div>}

      <Card>
        <CardContent className="p-4">
          {loading ? <Skeleton className="h-40 w-full rounded-xl" /> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin líneas pendientes de conciliar</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Fecha</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Concepto</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Monto</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Sugerencia (póliza)</th>
                    <th className="pb-2 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.estado_cuenta_id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4">{r.fecha}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{r.concepto ?? "—"}</td>
                      <td className={`py-2 pr-4 text-right ${r.monto_centavos < 0 ? "text-red-600" : ""}`}>{fmtMXN(r.monto_centavos)}</td>
                      <td className="py-2 pr-4">
                        {r.sugerido_poliza_partida_id ? (
                          <span className="text-xs text-muted-foreground">Folio {r.sugerido_folio} ({r.sugerido_fecha}, {r.dias_diferencia}d)</span>
                        ) : <span className="text-xs text-muted-foreground">Sin sugerencia</span>}
                      </td>
                      <td className="py-2 text-right">
                        {r.sugerido_poliza_partida_id && (
                          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => handleConciliar(r.estado_cuenta_id, r.sugerido_poliza_partida_id!)}>
                            <Check className="h-3.5 w-3.5" /> Conciliar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
