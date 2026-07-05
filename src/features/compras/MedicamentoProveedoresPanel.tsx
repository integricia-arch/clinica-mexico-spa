import { useState } from "react";
import { useMedicamentoProveedores, type MedicamentoProveedorInput } from "@/hooks/useMedicamentoProveedores";
import { useProveedores } from "@/hooks/useProveedores";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Star } from "lucide-react";

const formatMXN = (c: number) => (c / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const EMPTY_INPUT: MedicamentoProveedorInput = {
  proveedor_id: "",
  proveedor_orden: 1,
  precio_pactado_centavos: 0,
  precio_vigente_desde: new Date().toISOString().split("T")[0],
  precio_vigente_hasta: "",
  minimo_pedido: 1,
  multiplo_pedido: 1,
  maximo_pedido: null,
  plazo_entrega_dias: 3,
  codigo_proveedor: "",
  iva_aplica: true,
  notas: "",
};

interface Props {
  medicamentoId: string;
  medicamentoNombre: string;
}

export default function MedicamentoProveedoresPanel({ medicamentoId, medicamentoNombre }: Props) {
  const { activeClinicId } = useActiveClinic();
  const { toast } = useToast();
  const { items, loading, error, create, update, remove, toggleActivo } = useMedicamentoProveedores(medicamentoId);
  const { items: proveedores } = useProveedores(activeClinicId);

  const [dialog, setDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<MedicamentoProveedorInput>(EMPTY_INPUT);
  const [precioStr, setPrecioStr] = useState("");
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    const nextOrden = items.length + 1;
    setForm({ ...EMPTY_INPUT, proveedor_orden: Math.min(nextOrden, 5) });
    setPrecioStr("");
    setEditId(null);
    setDialog(true);
  };

  const openEdit = (mp: typeof items[0]) => {
    setForm({
      proveedor_id: mp.proveedor_id,
      proveedor_orden: mp.proveedor_orden,
      precio_pactado_centavos: mp.precio_pactado_centavos,
      precio_vigente_desde: mp.precio_vigente_desde,
      precio_vigente_hasta: mp.precio_vigente_hasta ?? "",
      minimo_pedido: mp.minimo_pedido,
      multiplo_pedido: mp.multiplo_pedido,
      maximo_pedido: mp.maximo_pedido,
      plazo_entrega_dias: mp.plazo_entrega_dias,
      codigo_proveedor: mp.codigo_proveedor ?? "",
      iva_aplica: mp.iva_aplica,
      notas: mp.notas ?? "",
    });
    setPrecioStr((mp.precio_pactado_centavos / 100).toFixed(2));
    setEditId(mp.id);
    setDialog(true);
  };

  const handleSave = async () => {
    if (!form.proveedor_id) { toast({ title: "Selecciona un proveedor", variant: "destructive" }); return; }
    const precio = Math.round(Number(precioStr) * 100);
    if (!precio) { toast({ title: "Ingresa el precio pactado", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const input: MedicamentoProveedorInput = { ...form, precio_pactado_centavos: precio };
      if (editId) {
        await update(editId, input);
        toast({ title: "Proveedor actualizado" });
      } else {
        await create(input);
        toast({ title: "Proveedor agregado" });
      }
      setDialog(false);
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove(id);
      toast({ title: "Proveedor eliminado" });
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Proveedores preferidos</p>
          <p className="text-xs text-muted-foreground">Asigna hasta 5 proveedores en orden de preferencia para auto-reorden</p>
        </div>
        <Button size="sm" variant="outline" onClick={openNew} disabled={items.length >= 5}>
          <Plus className="h-3 w-3 mr-1" /> Agregar
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {loading && <p className="text-xs text-muted-foreground">Cargando…</p>}

      {!loading && items.length === 0 && (
        <div className="rounded border border-dashed p-4 text-center text-xs text-muted-foreground">
          Sin proveedores asignados — el auto-reorden no funcionará para <strong>{medicamentoNombre}</strong>.
        </div>
      )}

      <div className="space-y-1.5">
        {items.map((mp) => (
          <div key={mp.id} className={`flex items-center gap-2 rounded border p-2 text-sm ${!mp.activo ? "opacity-50" : ""}`}>
            <span className="text-muted-foreground w-4 text-center font-mono text-xs">{mp.proveedor_orden}</span>
            {mp.proveedor_orden === 1 && <Star className="h-3 w-3 text-yellow-500 shrink-0" />}
            <div className="flex-1 min-w-0">
              <span className="font-medium">{mp.proveedor_nombre}</span>
              {mp.codigo_proveedor && (
                <span className="ml-2 text-xs text-muted-foreground font-mono">{mp.codigo_proveedor}</span>
              )}
              <div className="text-xs text-muted-foreground">
                {formatMXN(mp.precio_pactado_centavos)} · {mp.plazo_entrega_dias}d entrega
                {mp.minimo_pedido > 1 && ` · mín ${mp.minimo_pedido}`}
                {!mp.activo && " · inactivo"}
              </div>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">
              {mp.iva_aplica ? "+IVA" : "s/IVA"}
            </Badge>
            <button
              onClick={() => toggleActivo(mp.id, !mp.activo)}
              className="text-xs text-muted-foreground hover:text-foreground"
              title={mp.activo ? "Desactivar" : "Activar"}
            >
              {mp.activo ? "●" : "○"}
            </button>
            <button onClick={() => openEdit(mp)} className="text-muted-foreground hover:text-foreground">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => handleDelete(mp.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <Dialog open={dialog} onOpenChange={(o) => { if (!o) setDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar proveedor" : "Agregar proveedor preferido"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Proveedor *</Label>
              <Select value={form.proveedor_id} onValueChange={(v) => setForm((f) => ({ ...f, proveedor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                <SelectContent>
                  {proveedores.filter((p) => p.activo).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Orden de preferencia</Label>
                <Select value={String(form.proveedor_orden)} onValueChange={(v) => setForm((f) => ({ ...f, proveedor_orden: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n === 1 ? "1 — Primario" : n === 2 ? "2 — Secundario" : `${n} — Terciario+`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Precio pactado (MXN) *</Label>
                <MoneyInput value={precioStr}
                  onValueChange={setPrecioStr} placeholder="0.00" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Vigente desde</Label>
                <Input type="date" value={form.precio_vigente_desde}
                  onChange={(e) => setForm((f) => ({ ...f, precio_vigente_desde: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Vigente hasta (opcional)</Label>
                <Input type="date" value={form.precio_vigente_hasta ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, precio_vigente_hasta: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Mínimo pedido</Label>
                <Input type="number" min={1} value={form.minimo_pedido}
                  onChange={(e) => setForm((f) => ({ ...f, minimo_pedido: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>Múltiplo</Label>
                <Input type="number" min={1} value={form.multiplo_pedido}
                  onChange={(e) => setForm((f) => ({ ...f, multiplo_pedido: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>Plazo entrega (días)</Label>
                <Input type="number" min={1} value={form.plazo_entrega_dias}
                  onChange={(e) => setForm((f) => ({ ...f, plazo_entrega_dias: Number(e.target.value) }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Clave en catálogo proveedor</Label>
                <Input value={form.codigo_proveedor} placeholder="SKU del proveedor"
                  onChange={(e) => setForm((f) => ({ ...f, codigo_proveedor: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>IVA aplicable</Label>
                <Select value={form.iva_aplica ? "si" : "no"} onValueChange={(v) => setForm((f) => ({ ...f, iva_aplica: v === "si" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="si">Sí — precio + 16% IVA</SelectItem>
                    <SelectItem value="no">No — precio incluye o exento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notas</Label>
              <Input value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                placeholder="Condiciones especiales, descuentos, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : editId ? "Actualizar" : "Agregar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
