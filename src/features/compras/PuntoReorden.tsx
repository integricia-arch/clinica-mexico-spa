import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrdenesCompra } from "@/hooks/useOrdenesCompra";
import { useProveedores } from "@/hooks/useProveedores";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { toast } from "@/lib/toast";
import { ShoppingCart, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

interface Medicamento {
  id: string;
  nombre: string;
  unidad: string;
  stock_minimo: number;
  tasa_iva?: number;
  categoria?: string;
}

interface Lote {
  id: string;
  medicamento_id: string;
  existencia: number;
  costo_unitario_centavos?: number | null;
  proveedor_id?: string | null;
  fecha_entrada?: string | null;
}

interface Props {
  medicamentos: Medicamento[];
  lotes: Lote[];
  onOcCreada?: () => void;
}

interface ReordenRow {
  med: Medicamento & { stock_maximo?: number };
  stockActual: number;
  aPedir: number;
  ultimoCosto: number;
  ultimoProveedorId: string | null;
}

export default function PuntoReorden({ medicamentos, lotes, onOcCreada }: Props) {
  const { activeClinicId } = useActiveClinic();
  const { create } = useOrdenesCompra(activeClinicId);
  const { items: proveedores } = useProveedores(activeClinicId);

  const [ocDialog, setOcDialog] = useState(false);
  const [proveedorId, setProveedorId] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [saving, setSaving] = useState(false);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [precios, setPrecios] = useState<Record<string, string>>({});

  const stockTotal = (medId: string) =>
    lotes.filter((l) => l.medicamento_id === medId).reduce((s, l) => s + l.existencia, 0);

  const bajosStock: ReordenRow[] = useMemo(() => {
    return (medicamentos as (Medicamento & { stock_maximo?: number })[])
      .filter((m) => stockTotal(m.id) < m.stock_minimo)
      .map((m) => {
        const stockActual = stockTotal(m.id);
        const stockMax = m.stock_maximo ?? m.stock_minimo * 3;
        const aPedir = Math.max(0, stockMax - stockActual);
        // Find most recent lote's cost and proveedor (última compra, no el costo más alto)
        const loteDeMed = lotes
          .filter((l) => l.medicamento_id === m.id && l.costo_unitario_centavos)
          .sort((a, b) => new Date(b.fecha_entrada ?? 0).getTime() - new Date(a.fecha_entrada ?? 0).getTime());
        return {
          med: m,
          stockActual,
          aPedir,
          ultimoCosto: loteDeMed[0]?.costo_unitario_centavos ?? 0,
          ultimoProveedorId: loteDeMed[0]?.proveedor_id ?? null,
        };
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicamentos, lotes]);

  const efectivaCantidad = (row: ReordenRow) =>
    cantidades[row.med.id] !== undefined ? cantidades[row.med.id] : row.aPedir;

  const efectivoPrecio = (row: ReordenRow) => {
    const raw = precios[row.med.id];
    if (raw === undefined || raw === "") return row.ultimoCosto;
    const pesos = Number(raw);
    return Number.isNaN(pesos) ? row.ultimoCosto : Math.round(pesos * 100);
  };

  const itemsParaOC = bajosStock.filter((r) => efectivaCantidad(r) > 0);
  const itemsSinPrecio = itemsParaOC.filter((r) => efectivoPrecio(r) <= 0);

  const handleGenerarOC = async () => {
    if (!proveedorId) { toast.error("Selecciona un proveedor"); return; }
    if (itemsParaOC.length === 0) { toast.error("Sin ítems a pedir"); return; }
    if (itemsSinPrecio.length > 0) { toast.error("Carga el precio unitario de todos los productos antes de generar la OC"); return; }
    setSaving(true);
    try {
      await create({
        proveedor_id: proveedorId,
        fecha_entrega_est: fechaEntrega,
        terminos_pago: 30,
        notas: `OC sugerida automáticamente — punto de reorden (${new Date().toLocaleDateString("es-MX")})`,
        items: itemsParaOC.map((r) => ({
          medicamento_id: r.med.id,
          cantidad_pedida: efectivaCantidad(r),
          precio_unitario_centavos: efectivoPrecio(r),
          tasa_iva: r.med.tasa_iva ?? 0,
        })),
      });
      toast.success(`OC sugerida creada con ${itemsParaOC.length} producto(s)`);
      setOcDialog(false);
      onOcCreada?.();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (bajosStock.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <CheckCircle2 className="h-10 w-10 text-green-500 opacity-60" />
        <p className="text-sm font-medium">Sin productos por debajo del punto de reorden</p>
        <p className="text-xs">Todos los productos tienen existencia ≥ stock mínimo</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Punto de Reorden
          </h2>
          <p className="text-sm text-muted-foreground">
            {bajosStock.length} producto(s) bajo stock mínimo — modelo min-max
          </p>
        </div>
        <Button onClick={() => setOcDialog(true)} className="gap-2">
          <ShoppingCart className="h-4 w-4" />
          Generar OC sugerida
        </Button>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Producto</th>
              <th className="px-4 py-2 text-center font-medium">Stock actual</th>
              <th className="px-4 py-2 text-center font-medium">Mínimo</th>
              <th className="px-4 py-2 text-center font-medium">Máximo</th>
              <th className="px-4 py-2 text-center font-medium">A pedir</th>
              <th className="px-4 py-2 text-center font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {bajosStock.map((row) => {
              const stockMax = (row.med as Medicamento & { stock_maximo?: number }).stock_maximo ?? row.med.stock_minimo * 3;
              const pct = row.med.stock_minimo > 0
                ? Math.round((row.stockActual / row.med.stock_minimo) * 100)
                : 100;
              const critico = row.stockActual === 0;
              return (
                <tr key={row.med.id} className={`border-b border-border/50 hover:bg-muted/20 ${critico ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}>
                  <td className="px-4 py-2">
                    <p className="font-medium">{row.med.nombre}</p>
                    <p className="text-xs text-muted-foreground">{row.med.categoria} · {row.med.unidad}</p>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`font-bold ${critico ? "text-destructive" : "text-orange-600"}`}>
                      {row.stockActual}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center text-muted-foreground">{row.med.stock_minimo}</td>
                  <td className="px-4 py-2 text-center text-muted-foreground">{stockMax}</td>
                  <td className="px-4 py-2 text-center">
                    <Input
                      type="number"
                      min={0}
                      className="h-7 w-20 text-center mx-auto text-xs"
                      value={cantidades[row.med.id] ?? row.aPedir}
                      onChange={(e) =>
                        setCantidades((prev) => ({ ...prev, [row.med.id]: Math.max(0, parseInt(e.target.value) || 0) }))
                      }
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    {critico ? (
                      <Badge variant="destructive" className="text-xs">Sin stock</Badge>
                    ) : (
                      <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">
                        {pct}% del mínimo
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        La columna "A pedir" se calcula como: stock_máximo − stock_actual. Editable antes de generar OC.
        Configura stock_mínimo y stock_máximo en el catálogo de productos.
      </p>

      {/* Dialog: Generar OC sugerida */}
      <Dialog open={ocDialog} onOpenChange={setOcDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generar OC Sugerida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-muted p-3 text-sm space-y-2">
              <p className="font-medium">{itemsParaOC.length} producto(s) incluido(s)</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {itemsParaOC.map((r) => {
                  const sinPrecio = efectivoPrecio(r) <= 0;
                  return (
                    <div key={r.med.id} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 truncate">{r.med.nombre} — {efectivaCantidad(r)} {r.med.unidad}</span>
                      <span className="text-muted-foreground">$</span>
                      <MoneyInput
                        className={`h-7 w-24 text-xs ${sinPrecio ? "border-destructive" : ""}`}
                        value={precios[r.med.id] ?? (efectivoPrecio(r) / 100).toFixed(2)}
                        onValueChange={(raw) => setPrecios((prev) => ({ ...prev, [r.med.id]: raw }))}
                      />
                    </div>
                  );
                })}
              </div>
              {itemsSinPrecio.length > 0 && (
                <p className="text-xs text-destructive">
                  Falta precio unitario en {itemsSinPrecio.length} producto(s) — sin costo de referencia previo, cárgalo manualmente.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Proveedor *</Label>
              <Select value={proveedorId} onValueChange={setProveedorId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar proveedor…" /></SelectTrigger>
                <SelectContent>
                  {proveedores.filter((p) => p.activo).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Fecha entrega estimada</Label>
              <Input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
            </div>

            <p className="text-xs text-muted-foreground">
              Se creará como borrador en Órdenes de Compra.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOcDialog(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleGenerarOC} disabled={saving || itemsSinPrecio.length > 0} className="gap-1">
              {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
              {saving ? "Creando…" : "Crear OC borrador"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
