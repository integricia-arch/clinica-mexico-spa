import { useEffect, useMemo, useState } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ChevronRight, ChevronDown, Network } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { untypedTable } from "@/lib/untypedTable";
import { useBalanzaComprobacion } from "@/hooks/useReportesContables";

interface CuentaNodo {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  naturaleza: "deudora" | "acreedora";
  cuenta_padre_id: string | null;
  nivel: number;
  activo: boolean;
}

const TIPO_LABELS: Record<string, string> = {
  activo: "Activo", pasivo: "Pasivo", capital: "Capital", ingreso: "Ingreso", egreso: "Egreso",
};

function fmtMXN(centavos: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(centavos / 100);
}

const hoy = new Date();
const inicioMes = format(startOfMonth(hoy), "yyyy-MM-dd");
const finMes = format(endOfMonth(hoy), "yyyy-MM-dd");

function TreeNode({
  nodo, hijosPorPadre, saldoPropio, expandidos, toggle, depth,
}: {
  nodo: CuentaNodo;
  hijosPorPadre: Map<string, CuentaNodo[]>;
  saldoPropio: Map<string, number>;
  expandidos: Set<string>;
  toggle: (id: string) => void;
  depth: number;
}) {
  const hijos = hijosPorPadre.get(nodo.id) ?? [];
  const esMayor = hijos.length > 0;
  const abierto = expandidos.has(nodo.id);

  const saldoAcumulado = useMemo(() => {
    const acumular = (n: CuentaNodo): number => {
      const propios = saldoPropio.get(n.id) ?? 0;
      const delosHijos = (hijosPorPadre.get(n.id) ?? []).reduce((s, h) => s + acumular(h), 0);
      return propios + delosHijos;
    };
    return acumular(nodo);
  }, [nodo, hijosPorPadre, saldoPropio]);

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 rounded-md hover:bg-muted/50 ${!nodo.activo ? "opacity-50" : ""}`}
        style={{ paddingLeft: depth * 20 }}
      >
        <button
          type="button"
          onClick={() => esMayor && toggle(nodo.id)}
          className={`shrink-0 h-5 w-5 flex items-center justify-center ${esMayor ? "text-muted-foreground" : "text-transparent"}`}
          disabled={!esMayor}
          aria-label={abierto ? "Contraer" : "Expandir"}
        >
          {esMayor ? (abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
        </button>
        <span className="font-mono text-xs text-muted-foreground w-24 shrink-0 truncate" title={nodo.codigo}>{nodo.codigo}</span>
        <span className={`text-sm truncate min-w-0 flex-1 ${esMayor ? "font-medium" : ""}`} title={nodo.nombre}>{nodo.nombre}</span>
        <Badge variant="outline" className="text-[10px] shrink-0">{TIPO_LABELS[nodo.tipo] ?? nodo.tipo}</Badge>
        <Badge variant="secondary" className="text-[10px] shrink-0">{nodo.naturaleza === "deudora" ? "Deudora" : "Acreedora"}</Badge>
        {esMayor ? (
          <span className="text-[10px] text-muted-foreground shrink-0">cuenta de mayor</span>
        ) : null}
        <span className="ml-auto text-sm font-medium shrink-0 tabular-nums">{fmtMXN(saldoAcumulado)}</span>
      </div>
      {esMayor && abierto ? (
        <div>
          {hijos.map((h) => (
            <TreeNode
              key={h.id} nodo={h} hijosPorPadre={hijosPorPadre} saldoPropio={saldoPropio}
              expandidos={expandidos} toggle={toggle} depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ArbolCuentasDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [cuentas, setCuentas] = useState<CuentaNodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(finMes);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const { rows: balanza, load: loadBalanza } = useBalanzaComprobacion();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    untypedTable("cuentas_contables")
      .select("id,codigo,nombre,tipo,naturaleza,cuenta_padre_id,nivel,activo")
      .order("codigo")
      .then(({ data }) => {
        setCuentas((data ?? []) as CuentaNodo[]);
        setLoading(false);
      });
  }, [open]);

  useEffect(() => { if (open) loadBalanza(desde, hasta); }, [open, loadBalanza, desde, hasta]);

  const toggle = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandirTodo = () => setExpandidos(new Set(cuentas.map((c) => c.id)));
  const contraerTodo = () => setExpandidos(new Set());

  const hijosPorPadre = useMemo(() => {
    const map = new Map<string, CuentaNodo[]>();
    for (const c of cuentas) {
      if (!c.cuenta_padre_id) continue;
      const arr = map.get(c.cuenta_padre_id) ?? [];
      arr.push(c);
      map.set(c.cuenta_padre_id, arr);
    }
    return map;
  }, [cuentas]);

  const saldoPropio = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of balanza) map.set(r.cuenta_id, r.saldo_final_centavos);
    return map;
  }, [balanza]);

  const raices = cuentas.filter((c) => !c.cuenta_padre_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Árbol de cuentas contables</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3 pb-2 border-b border-border">
          <div>
            <Label htmlFor="field-arbol-desde" className="text-xs">Saldos desde</Label>
            <Input id="field-arbol-desde" type="date" className="h-8 w-36" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="field-arbol-hasta" className="text-xs">hasta</Label>
            <Input id="field-arbol-hasta" type="date" className="h-8 w-36" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" className="h-8" onClick={expandirTodo}>Expandir todo</Button>
          <Button size="sm" variant="outline" className="h-8" onClick={contraerTodo}>Contraer todo</Button>
        </div>

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {loading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : raices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin cuentas en el catálogo</p>
          ) : (
            raices.map((r) => (
              <TreeNode
                key={r.id} nodo={r} hijosPorPadre={hijosPorPadre} saldoPropio={saldoPropio}
                expandidos={expandidos} toggle={toggle} depth={0}
              />
            ))
          )}
        </div>

        <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
          <Network className="h-3 w-3 inline mr-1" />
          El saldo de una cuenta de mayor es la suma acumulada de todas sus subcuentas. Saldos calculados con pólizas del período seleccionado.
        </p>
      </DialogContent>
    </Dialog>
  );
}
