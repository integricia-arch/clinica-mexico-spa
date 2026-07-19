import { useEffect, useState } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { untypedTable } from "@/lib/untypedTable";
import { exportReporteCsv } from "@/features/contabilidad/exportReporteCsv";
import {
  useBalanzaComprobacion, useLibroDiario, useAuxiliaresCuenta, useBalanceGeneral,
} from "@/hooks/useReportesContables";

function fmtMXN(centavos: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(centavos / 100);
}

const hoy = new Date();
const inicioMes = format(startOfMonth(hoy), "yyyy-MM-dd");
const finMes = format(endOfMonth(hoy), "yyyy-MM-dd");

function BalanzaTab() {
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(finMes);
  const { rows, loading, error, load } = useBalanzaComprobacion();

  useEffect(() => { load(desde, hasta); }, [load, desde, hasta]);

  const totales = rows.reduce((acc, r) => ({
    debe: acc.debe + r.cargos_centavos, haber: acc.haber + r.abonos_centavos,
  }), { debe: 0, haber: 0 });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="field-balanza-desde" className="text-xs">Desde</Label>
            <Input id="field-balanza-desde" type="date" className="h-8 w-36" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="field-balanza-hasta" className="text-xs">Hasta</Label>
            <Input id="field-balanza-hasta" type="date" className="h-8 w-36" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <Button
            size="sm" variant="outline" className="h-8 gap-1.5" disabled={rows.length === 0}
            onClick={() => exportReporteCsv(
              "balanza_comprobacion",
              ["Código", "Cuenta", "Tipo", "Saldo inicial", "Cargos", "Abonos", "Saldo final"],
              rows.map((r) => [r.codigo, r.nombre, r.tipo, (r.saldo_inicial_centavos / 100).toFixed(2), (r.cargos_centavos / 100).toFixed(2), (r.abonos_centavos / 100).toFixed(2), (r.saldo_final_centavos / 100).toFixed(2)]),
            )}
          >
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Error: {error}</div>}

      <Card>
        <CardContent className="p-4">
          {loading ? <Skeleton className="h-40 w-full rounded-xl" /> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin movimientos en el período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Código</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Cuenta</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Saldo inicial</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Cargos</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Abonos</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Saldo final</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.cuenta_id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4">{r.codigo}</td>
                      <td className="py-2 pr-4">{r.nombre}</td>
                      <td className="py-2 pr-4 text-right">{fmtMXN(r.saldo_inicial_centavos)}</td>
                      <td className="py-2 pr-4 text-right">{fmtMXN(r.cargos_centavos)}</td>
                      <td className="py-2 pr-4 text-right">{fmtMXN(r.abonos_centavos)}</td>
                      <td className="py-2 text-right font-medium">{fmtMXN(r.saldo_final_centavos)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-medium">
                    <td className="py-2 pr-4" colSpan={3}>Totales</td>
                    <td className="py-2 pr-4 text-right">{fmtMXN(totales.debe)}</td>
                    <td className="py-2 pr-4 text-right">{fmtMXN(totales.haber)}</td>
                    <td className={`py-2 text-right ${totales.debe !== totales.haber ? "text-red-600" : ""}`}>
                      {totales.debe === totales.haber ? "Cuadra" : "Descuadre"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LibroDiarioTab() {
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(finMes);
  const { rows, loading, error, load } = useLibroDiario();

  useEffect(() => { load(desde, hasta); }, [load, desde, hasta]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="field-diario-desde" className="text-xs">Desde</Label>
            <Input id="field-diario-desde" type="date" className="h-8 w-36" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="field-diario-hasta" className="text-xs">Hasta</Label>
            <Input id="field-diario-hasta" type="date" className="h-8 w-36" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <Button
            size="sm" variant="outline" className="h-8 gap-1.5" disabled={rows.length === 0}
            onClick={() => exportReporteCsv(
              "libro_diario",
              ["Folio", "Tipo", "Fecha", "Concepto", "Estado", "Cuenta", "Debe", "Haber", "Descripción"],
              rows.map((r) => [r.folio, r.tipo, r.fecha, r.concepto, r.estado, `${r.cuenta_codigo} ${r.cuenta_nombre}`, (r.debe_centavos / 100).toFixed(2), (r.haber_centavos / 100).toFixed(2), r.descripcion ?? ""]),
            )}
          >
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Error: {error}</div>}

      <Card>
        <CardContent className="p-4">
          {loading ? <Skeleton className="h-40 w-full rounded-xl" /> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin pólizas en el período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Folio</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Fecha</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Concepto</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Cuenta</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Debe</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.poliza_id}-${r.orden}`} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4">{r.tipo.slice(0, 3).toUpperCase()}-{r.folio}</td>
                      <td className="py-2 pr-4">{r.fecha}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{r.concepto}</td>
                      <td className="py-2 pr-4">{r.cuenta_codigo} {r.cuenta_nombre}</td>
                      <td className="py-2 pr-4 text-right">{r.debe_centavos > 0 ? fmtMXN(r.debe_centavos) : "—"}</td>
                      <td className="py-2 text-right">{r.haber_centavos > 0 ? fmtMXN(r.haber_centavos) : "—"}</td>
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

function AuxiliaresTab() {
  const [cuentas, setCuentas] = useState<{ id: string; codigo: string; nombre: string }[]>([]);
  const [cuentaId, setCuentaId] = useState("");
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(finMes);
  const { rows, loading, error, load } = useAuxiliaresCuenta();

  useEffect(() => {
    (async () => {
      const { data, error: err } = await untypedTable("cuentas_contables").select("id,codigo,nombre").order("codigo");
      if (!err) {
        const opts = (data ?? []) as { id: string; codigo: string; nombre: string }[];
        setCuentas(opts);
        if (opts.length > 0) setCuentaId((prev) => prev || opts[0].id);
      }
    })();
  }, []);

  useEffect(() => { if (cuentaId) load(cuentaId, desde, hasta); }, [load, cuentaId, desde, hasta]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Cuenta</Label>
            <Select value={cuentaId} onValueChange={setCuentaId}>
              <SelectTrigger className="h-8 w-56 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="field-aux-desde" className="text-xs">Desde</Label>
            <Input id="field-aux-desde" type="date" className="h-8 w-36" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="field-aux-hasta" className="text-xs">Hasta</Label>
            <Input id="field-aux-hasta" type="date" className="h-8 w-36" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <Button
            size="sm" variant="outline" className="h-8 gap-1.5" disabled={rows.length === 0}
            onClick={() => exportReporteCsv(
              "auxiliar_cuenta",
              ["Folio", "Fecha", "Concepto", "Debe", "Haber", "Saldo acumulado"],
              rows.map((r) => [r.folio, r.fecha, r.concepto, (r.debe_centavos / 100).toFixed(2), (r.haber_centavos / 100).toFixed(2), (r.saldo_acumulado_centavos / 100).toFixed(2)]),
            )}
          >
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Error: {error}</div>}

      <Card>
        <CardContent className="p-4">
          {loading ? <Skeleton className="h-40 w-full rounded-xl" /> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin movimientos en el período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Folio</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Fecha</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Concepto</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Debe</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Haber</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.poliza_id}-${i}`} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4">{r.folio}</td>
                      <td className="py-2 pr-4">{r.fecha}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{r.concepto}</td>
                      <td className="py-2 pr-4 text-right">{r.debe_centavos > 0 ? fmtMXN(r.debe_centavos) : "—"}</td>
                      <td className="py-2 pr-4 text-right">{r.haber_centavos > 0 ? fmtMXN(r.haber_centavos) : "—"}</td>
                      <td className="py-2 text-right font-medium">{fmtMXN(r.saldo_acumulado_centavos)}</td>
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

function BalanceGeneralTab() {
  const [al, setAl] = useState(finMes);
  const { rows, loading, error, load } = useBalanceGeneral();

  useEffect(() => { load(al); }, [load, al]);

  const activo = rows.filter((r) => r.tipo === "activo").reduce((s, r) => s + r.saldo_centavos, 0);
  const pasivo = rows.filter((r) => r.tipo === "pasivo").reduce((s, r) => s + r.saldo_centavos, 0);
  const capital = rows.filter((r) => r.tipo === "capital").reduce((s, r) => s + r.saldo_centavos, 0);
  const cuadra = activo === pasivo + capital;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="field-balance-al" className="text-xs">Al día</Label>
            <Input id="field-balance-al" type="date" className="h-8 w-36" value={al} onChange={(e) => setAl(e.target.value)} />
          </div>
          <Button
            size="sm" variant="outline" className="h-8 gap-1.5" disabled={rows.length === 0}
            onClick={() => exportReporteCsv(
              "balance_general",
              ["Código", "Cuenta", "Tipo", "Saldo"],
              rows.map((r) => [r.codigo, r.nombre, r.tipo, (r.saldo_centavos / 100).toFixed(2)]),
            )}
          >
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Error: {error}</div>}

      <Card>
        <CardContent className="p-4">
          {loading ? <Skeleton className="h-40 w-full rounded-xl" /> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin saldos a esta fecha</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Código</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Cuenta</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Tipo</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.cuenta_id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4">{r.codigo}</td>
                      <td className="py-2 pr-4">{r.nombre}</td>
                      <td className="py-2 pr-4 capitalize text-muted-foreground">{r.tipo}</td>
                      <td className="py-2 text-right font-medium">{fmtMXN(r.saldo_centavos)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-medium">
                    <td className="py-2 pr-4" colSpan={3}>Activo {fmtMXN(activo)} = Pasivo {fmtMXN(pasivo)} + Capital {fmtMXN(capital)}</td>
                    <td className={`py-2 text-right ${cuadra ? "" : "text-red-600"}`}>{cuadra ? "Cuadra" : "Descuadre"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ReportesTab() {
  return (
    <Tabs defaultValue="balanza">
      <TabsList>
        <TabsTrigger value="balanza">Balanza</TabsTrigger>
        <TabsTrigger value="diario">Libro diario</TabsTrigger>
        <TabsTrigger value="auxiliares">Auxiliares</TabsTrigger>
        <TabsTrigger value="balance">Balance</TabsTrigger>
      </TabsList>
      <TabsContent value="balanza" className="pt-4"><BalanzaTab /></TabsContent>
      <TabsContent value="diario" className="pt-4"><LibroDiarioTab /></TabsContent>
      <TabsContent value="auxiliares" className="pt-4"><AuxiliaresTab /></TabsContent>
      <TabsContent value="balance" className="pt-4"><BalanceGeneralTab /></TabsContent>
    </Tabs>
  );
}
