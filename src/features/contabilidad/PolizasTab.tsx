import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { untypedTable } from "@/lib/untypedTable";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { friendlyError } from "@/lib/errors";

const PAGE_SIZE = 50;

const ORIGEN_LABELS: Record<string, string> = {
  manual: "Manual",
  consulta: "Consulta",
  farmacia: "Farmacia",
  compra: "Compra",
  honorario: "Honorario",
};

interface CuentaOption {
  id: string;
  nombre: string;
}

interface Movimiento {
  id: string;
  fecha_devengo: string;
  fecha_pago: string | null;
  origen: string;
  evento: string;
  descripcion: string | null;
  monto_centavos: number;
  cuentas_contables: { nombre: string } | null;
}

function fmtMXN(centavos: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(centavos / 100);
}

export function PolizasTab() {
  const { activeClinicId } = useActiveClinic();
  const [cuentas, setCuentas] = useState<CuentaOption[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [cuentaId, setCuentaId] = useState<string>("todas");
  const [origen, setOrigen] = useState<string>("todos");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await untypedTable("cuentas_contables").select("id,nombre").order("nombre");
      if (!err) setCuentas((data ?? []) as CuentaOption[]);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!activeClinicId) return;
    setLoading(true);
    setError(null);
    let query = untypedTable("movimientos_contables")
      .select("id,fecha_devengo,fecha_pago,origen,evento,descripcion,monto_centavos,cuentas_contables(nombre)")
      .eq("clinic_id", activeClinicId)
      .order("fecha_devengo", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    if (desde) query = query.gte("fecha_devengo", desde);
    if (hasta) query = query.lte("fecha_devengo", hasta);
    if (cuentaId !== "todas") query = query.eq("cuenta_id", cuentaId);
    if (origen !== "todos") query = query.eq("origen", origen);

    const { data, error: err } = await query;
    if (err) { setError(friendlyError(err)); setLoading(false); return; }
    const items = (data ?? []) as Movimiento[];
    setHasMore(items.length > PAGE_SIZE);
    setRows(items.slice(0, PAGE_SIZE));
    setLoading(false);
  }, [activeClinicId, page, desde, hasta, cuentaId, origen]);

  useEffect(() => { load(); }, [load]);

  // Cualquier cambio de filtro regresa a la primera página.
  useEffect(() => { setPage(0); }, [desde, hasta, cuentaId, origen]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="field-desde" className="text-xs">Desde</Label>
            <Input id="field-desde" type="date" className="h-8 w-36" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="field-hasta" className="text-xs">Hasta</Label>
            <Input id="field-hasta" type="date" className="h-8 w-36" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Cuenta</Label>
            <Select value={cuentaId} onValueChange={setCuentaId}>
              <SelectTrigger className="h-8 w-48 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Origen</Label>
            <Select value={origen} onValueChange={setOrigen}>
              <SelectTrigger className="h-8 w-40 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(ORIGEN_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Error cargando movimientos: {error}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin movimientos con estos filtros</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Fecha devengo</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Fecha pago</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Cuenta</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Origen</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Evento</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Descripción</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4">{m.fecha_devengo}</td>
                      <td className="py-2 pr-4">{m.fecha_pago ?? "—"}</td>
                      <td className="py-2 pr-4">{m.cuentas_contables?.nombre ?? "—"}</td>
                      <td className="py-2 pr-4">{ORIGEN_LABELS[m.origen] ?? m.origen}</td>
                      <td className="py-2 pr-4">{m.evento === "cancelacion" ? "Cancelación" : "Devengo"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{m.descripcion ?? "—"}</td>
                      <td className={`py-2 text-right font-medium ${m.monto_centavos < 0 ? "text-red-600" : ""}`}>
                        {fmtMXN(m.monto_centavos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between pt-3">
            <Button size="sm" variant="outline" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">Página {page + 1}</span>
            <Button size="sm" variant="outline" disabled={!hasMore || loading} onClick={() => setPage((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
