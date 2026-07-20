import { useEffect, useState } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { Download, FileDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { untypedTable } from "@/lib/untypedTable";
import { exportReporteCsv } from "@/features/contabilidad/exportReporteCsv";
import { exportarCatalogoCuentasAnexo24, exportarBalanzaAnexo24 } from "@/features/contabilidad/exportAnexo24";
import { NuevaPolizaDialog } from "@/features/contabilidad/NuevaPolizaDialog";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import {
  useBalanzaComprobacion, useLibroDiario, useAuxiliaresCuenta, useBalanceGeneral, useReporteIva,
  useEstadoResultados, type LibroDiarioFila,
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

const TIPO_POLIZA_LABELS: Record<string, string> = { diario: "Diario", ingreso: "Ingreso", egreso: "Egreso" };
const TIPO_CUENTA_LABELS: Record<string, string> = { activo: "Activo", pasivo: "Pasivo", capital: "Capital", ingreso: "Ingreso", egreso: "Egreso" };

export function LibroDiarioTab() {
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(finMes);
  const [tipoPoliza, setTipoPoliza] = useState<string>("todos");
  const [tipoCuenta, setTipoCuenta] = useState<string>("todos");
  const [tipoMovimiento, setTipoMovimiento] = useState<string>("todos");
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const { rows: allRows, loading, error, load } = useLibroDiario();

  useEffect(() => { load(desde, hasta); }, [load, desde, hasta]);

  const handleCancelar = async (polizaId: string) => {
    if (!confirm("¿Cancelar esta póliza? Se genera una póliza de reversa, no se borra.")) return;
    setCancelandoId(polizaId);
    const { error: err } = await (supabase as any).rpc("cancelar_poliza", { p_poliza_id: polizaId });
    setCancelandoId(null);
    if (err) { toast.error(friendlyError(err, "No se pudo cancelar la póliza.")); return; }
    toast.success("Póliza cancelada (reversa generada)");
    load(desde, hasta);
  };

  const rows = allRows.filter((r) =>
    (tipoPoliza === "todos" || r.tipo === tipoPoliza) &&
    (tipoCuenta === "todos" || r.cuenta_tipo === tipoCuenta) &&
    (tipoMovimiento === "todos" || (tipoMovimiento === "cargo" ? r.debe_centavos > 0 : r.haber_centavos > 0))
  );

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
          <div>
            <Label className="text-xs">Tipo de póliza</Label>
            <Select value={tipoPoliza} onValueChange={setTipoPoliza}>
              <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(TIPO_POLIZA_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo de cuenta</Label>
            <Select value={tipoCuenta} onValueChange={setTipoCuenta}>
              <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {Object.entries(TIPO_CUENTA_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Movimiento</Label>
            <Select value={tipoMovimiento} onValueChange={setTipoMovimiento}>
              <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="cargo">Cargo</SelectItem>
                <SelectItem value="abono">Abono</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm" variant="outline" className="h-8 gap-1.5" disabled={rows.length === 0}
            onClick={() => exportReporteCsv(
              "libro_diario",
              ["Folio", "Tipo", "Fecha", "Concepto", "Estado", "UUID CFDI", "Cuenta", "Tipo cuenta", "Cargo", "Abono", "Descripción"],
              rows.map((r) => [r.folio, r.tipo, r.fecha, r.concepto, r.estado, r.uuid_cfdi ?? "", `${r.cuenta_codigo} ${r.cuenta_nombre}`, r.cuenta_tipo, (r.debe_centavos / 100).toFixed(2), (r.haber_centavos / 100).toFixed(2), r.descripcion ?? ""]),
            )}
          >
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setNuevaOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva póliza
          </Button>
        </CardContent>
      </Card>

      <NuevaPolizaDialog open={nuevaOpen} onOpenChange={setNuevaOpen} onCreated={() => load(desde, hasta)} />

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Error: {error}</div>}

      {loading ? <Skeleton className="h-40 w-full rounded-xl" /> : rows.length === 0 ? (
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground py-4 text-center">Sin pólizas con estos filtros</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {agruparPorPoliza(rows).map((p) => {
            const cuadra = p.debe === p.haber;
            return (
              <Card key={p.poliza_id} className={cuadra ? undefined : "border-destructive"}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                    <p className="text-sm font-medium">
                      {p.tipo.slice(0, 3).toUpperCase()}-{p.folio} — {TIPO_POLIZA_LABELS[p.tipo] ?? p.tipo} · {p.fecha}
                      <span className="text-muted-foreground font-normal"> · {p.concepto}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cuadra ? "bg-emerald-100 text-emerald-700" : "bg-destructive/15 text-destructive"}`}>
                        {cuadra ? "Cuadra" : "DESCUADRE"}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{p.estado}</span>
                      {p.estado === "contabilizada" && (
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs"
                          disabled={cancelandoId === p.poliza_id}
                          onClick={() => handleCancelar(p.poliza_id)}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                  {p.uuid_cfdi && <p className="text-xs text-muted-foreground pb-2">UUID CFDI: {p.uuid_cfdi}</p>}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="pb-1.5 pr-4 font-medium text-muted-foreground">Cuenta</th>
                          <th className="pb-1.5 pr-4 font-medium text-muted-foreground">Descripción</th>
                          <th className="pb-1.5 pr-4 font-medium text-muted-foreground text-right">Cargo</th>
                          <th className="pb-1.5 font-medium text-muted-foreground text-right">Abono</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.lineas.map((l) => (
                          <tr key={`${p.poliza_id}-${l.orden}`} className="border-b border-border/40 last:border-0">
                            <td className="py-1.5 pr-4">{l.cuenta_codigo} {l.cuenta_nombre}</td>
                            <td className="py-1.5 pr-4 text-muted-foreground">{l.descripcion ?? "—"}</td>
                            <td className="py-1.5 pr-4 text-right">{l.debe_centavos > 0 ? fmtMXN(l.debe_centavos) : "—"}</td>
                            <td className="py-1.5 text-right">{l.haber_centavos > 0 ? fmtMXN(l.haber_centavos) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border font-medium">
                          <td className="py-1.5 pr-4" colSpan={2}>Total</td>
                          <td className="py-1.5 pr-4 text-right">{fmtMXN(p.debe)}</td>
                          <td className="py-1.5 text-right">{fmtMXN(p.haber)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function agruparPorPoliza(rows: LibroDiarioFila[]) {
  const grupos = new Map<string, { poliza_id: string; folio: number; tipo: string; fecha: string; concepto: string; uuid_cfdi: string | null; estado: string; lineas: LibroDiarioFila[]; debe: number; haber: number }>();
  for (const r of rows) {
    let g = grupos.get(r.poliza_id);
    if (!g) {
      g = { poliza_id: r.poliza_id, folio: r.folio, tipo: r.tipo, fecha: r.fecha, concepto: r.concepto, uuid_cfdi: r.uuid_cfdi, estado: r.estado, lineas: [], debe: 0, haber: 0 };
      grupos.set(r.poliza_id, g);
    }
    g.lineas.push(r);
    g.debe += r.debe_centavos;
    g.haber += r.haber_centavos;
  }
  return Array.from(grupos.values()).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.folio - b.folio);
}

function MayorTab() {
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(finMes);
  const { rows: balanza, loading: loadingBalanza, error: errorBalanza, load: loadBalanza } = useBalanzaComprobacion();
  const { rows: diario, loading: loadingDiario, error: errorDiario, load: loadDiario } = useLibroDiario();

  useEffect(() => { loadBalanza(desde, hasta); loadDiario(desde, hasta); }, [loadBalanza, loadDiario, desde, hasta]);

  const loading = loadingBalanza || loadingDiario;
  const error = errorBalanza || errorDiario;

  // Libro Mayor: mayorización de cada cuenta con movimiento — detalle cronológico
  // + saldo acumulado (naturaleza-aware, arranca en el saldo inicial de la balanza).
  const porCuenta = balanza.map((cta) => {
    const movs = diario
      .filter((d) => d.cuenta_codigo === cta.codigo)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden);
    let saldo = cta.saldo_inicial_centavos;
    const filas = movs.map((m) => {
      saldo += cta.naturaleza === "deudora" ? m.debe_centavos - m.haber_centavos : m.haber_centavos - m.debe_centavos;
      return { ...m, saldo_acumulado: saldo };
    });
    return { cuenta: cta, filas };
  }).filter((c) => c.filas.length > 0 || c.cuenta.saldo_inicial_centavos !== 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="field-mayor-desde" className="text-xs">Desde</Label>
            <Input id="field-mayor-desde" type="date" className="h-8 w-36" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="field-mayor-hasta" className="text-xs">Hasta</Label>
            <Input id="field-mayor-hasta" type="date" className="h-8 w-36" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Error: {error}</div>}

      {loading ? <Skeleton className="h-40 w-full rounded-xl" /> : porCuenta.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Sin movimientos en el período</p>
      ) : (
        <div className="space-y-3">
          {porCuenta.map(({ cuenta, filas }) => (
            <Card key={cuenta.cuenta_id}>
              <CardContent className="p-4">
                <p className="text-sm font-medium pb-2">{cuenta.codigo} — {cuenta.nombre} <span className="text-xs text-muted-foreground capitalize">({cuenta.naturaleza})</span></p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">Fecha</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">Concepto</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Cargo</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Abono</th>
                        <th className="pb-2 font-medium text-muted-foreground text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/40">
                        <td className="py-1.5 pr-4 text-muted-foreground" colSpan={4}>Saldo inicial</td>
                        <td className="py-1.5 text-right">{fmtMXN(cuenta.saldo_inicial_centavos)}</td>
                      </tr>
                      {filas.map((f) => (
                        <tr key={`${f.poliza_id}-${f.orden}`} className="border-b border-border/40 last:border-0">
                          <td className="py-1.5 pr-4">{f.fecha}</td>
                          <td className="py-1.5 pr-4 text-muted-foreground">{f.concepto}</td>
                          <td className="py-1.5 pr-4 text-right">{f.debe_centavos > 0 ? fmtMXN(f.debe_centavos) : "—"}</td>
                          <td className="py-1.5 pr-4 text-right">{f.haber_centavos > 0 ? fmtMXN(f.haber_centavos) : "—"}</td>
                          <td className="py-1.5 text-right font-medium">{fmtMXN(f.saldo_acumulado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EstadoResultadosTab() {
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(finMes);
  const { rows, loading, error, load } = useEstadoResultados();

  useEffect(() => { load(desde, hasta); }, [load, desde, hasta]);

  const ingresos = rows.filter((r) => r.tipo === "ingreso").reduce((s, r) => s + r.monto_centavos, 0);
  const egresos = rows.filter((r) => r.tipo === "egreso").reduce((s, r) => s + r.monto_centavos, 0);
  const utilidad = ingresos - egresos;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="field-er-desde" className="text-xs">Desde</Label>
            <Input id="field-er-desde" type="date" className="h-8 w-36" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="field-er-hasta" className="text-xs">Hasta</Label>
            <Input id="field-er-hasta" type="date" className="h-8 w-36" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <Button
            size="sm" variant="outline" className="h-8 gap-1.5" disabled={rows.length === 0}
            onClick={() => exportReporteCsv(
              "estado_resultados",
              ["Código", "Cuenta", "Tipo", "Monto"],
              rows.map((r) => [r.codigo, r.nombre, r.tipo, (r.monto_centavos / 100).toFixed(2)]),
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
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Tipo</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.cuenta_id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4">{r.codigo}</td>
                      <td className="py-2 pr-4">{r.nombre}</td>
                      <td className="py-2 pr-4 capitalize text-muted-foreground">{r.tipo}</td>
                      <td className="py-2 text-right font-medium">{fmtMXN(r.monto_centavos)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-medium">
                    <td className="py-2 pr-4" colSpan={3}>Ingresos {fmtMXN(ingresos)} − Egresos {fmtMXN(egresos)}</td>
                    <td className={`py-2 text-right ${utilidad >= 0 ? "" : "text-red-600"}`}>
                      {utilidad >= 0 ? "Utilidad" : "Pérdida"} {fmtMXN(Math.abs(utilidad))}
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

function IvaTab() {
  const { activeClinicId } = useActiveClinic();
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(finMes);
  const [exportando, setExportando] = useState<"catalogo" | "balanza" | null>(null);
  const { rows, loading, error, load } = useReporteIva();

  useEffect(() => { load(desde, hasta); }, [load, desde, hasta]);

  const trasladado = rows.find((r) => r.tipo === "trasladado")?.monto_centavos ?? 0;
  const acreditable = rows.find((r) => r.tipo === "acreditable")?.monto_centavos ?? 0;
  const aPagar = trasladado - acreditable;

  const mes = new Date(hasta + "T12:00:00").getMonth() + 1;
  const anio = new Date(hasta + "T12:00:00").getFullYear();

  const exportarAnexo = async (tipo: "catalogo" | "balanza") => {
    if (!activeClinicId) return;
    setExportando(tipo);
    try {
      if (tipo === "catalogo") await exportarCatalogoCuentasAnexo24(activeClinicId, mes, anio);
      else await exportarBalanzaAnexo24(activeClinicId, mes, anio, desde, hasta);
      toast.success("XML generado — recuerda: no está firmado, tu contador debe firmarlo con e.firma antes de subirlo al SAT.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error generando el XML");
    }
    setExportando(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="field-iva-desde" className="text-xs">Desde</Label>
            <Input id="field-iva-desde" type="date" className="h-8 w-36" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="field-iva-hasta" className="text-xs">Hasta</Label>
            <Input id="field-iva-hasta" type="date" className="h-8 w-36" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Error: {error}</div>}

      <Card>
        <CardContent className="p-4">
          {loading ? <Skeleton className="h-24 w-full rounded-xl" /> : (
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">IVA trasladado (ventas)</p>
                <p className="text-lg font-bold">{fmtMXN(trasladado)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">IVA acreditable (compras)</p>
                <p className="text-lg font-bold">{fmtMXN(acreditable)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{aPagar >= 0 ? "IVA a pagar" : "IVA a favor"}</p>
                <p className={`text-lg font-bold ${aPagar >= 0 ? "" : "text-emerald-600"}`}>{fmtMXN(Math.abs(aPagar))}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium">Anexo 24 (contabilidad electrónica)</p>
          <p className="text-xs text-muted-foreground">
            Genera catálogo de cuentas y balanza de comprobación del mes de la fecha "Hasta", en formato XML.
            <strong> No están firmados</strong> — tu contador debe firmarlos con e.firma antes de subirlos al SAT.
            Configura el RFC en Configuración → Facturación y CFDI antes de exportar.
          </p>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={exportando !== null} onClick={() => exportarAnexo("catalogo")}>
              <FileDown className="h-3.5 w-3.5" /> {exportando === "catalogo" ? "Generando…" : "Catálogo de cuentas XML"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={exportando !== null} onClick={() => exportarAnexo("balanza")}>
              <FileDown className="h-3.5 w-3.5" /> {exportando === "balanza" ? "Generando…" : "Balanza XML"}
            </Button>
          </div>
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
        <TabsTrigger value="mayor">Libro mayor</TabsTrigger>
        <TabsTrigger value="auxiliares">Auxiliares</TabsTrigger>
        <TabsTrigger value="resultados">Estado de resultados</TabsTrigger>
        <TabsTrigger value="balance">Balance general</TabsTrigger>
        <TabsTrigger value="iva">IVA</TabsTrigger>
      </TabsList>
      <TabsContent value="balanza" className="pt-4"><BalanzaTab /></TabsContent>
      <TabsContent value="diario" className="pt-4"><LibroDiarioTab /></TabsContent>
      <TabsContent value="mayor" className="pt-4"><MayorTab /></TabsContent>
      <TabsContent value="auxiliares" className="pt-4"><AuxiliaresTab /></TabsContent>
      <TabsContent value="resultados" className="pt-4"><EstadoResultadosTab /></TabsContent>
      <TabsContent value="balance" className="pt-4"><BalanceGeneralTab /></TabsContent>
      <TabsContent value="iva" className="pt-4"><IvaTab /></TabsContent>
    </Tabs>
  );
}
