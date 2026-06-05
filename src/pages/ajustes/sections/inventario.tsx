import { useState } from "react";
import { Plus, Trash2, Loader2, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Field, type SectionProps } from "../shared";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useInsumos, type Insumo, type InsumoInput } from "@/hooks/useInsumos";
import { useKits, type Kit, type KitInput, type KitItemInput } from "@/hooks/useKits";
import { useProveedores, type Proveedor, type ProveedorInput } from "@/hooks/useProveedores";

const mxn = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ====================================================================== */
/* Insumos                                                                 */
/* ====================================================================== */

const EMPTY_INSUMO: InsumoInput = {
  nombre: "", stock: 0, stockMinimo: 0, caducidad: "", costoMxn: 0,
  proveedorId: null, activo: true,
};

function InsumosTab({ clinicId, canEdit, proveedores }: {
  clinicId: string | null;
  canEdit: boolean;
  proveedores: Proveedor[];
}) {
  const { items, loading, error, create, update, remove } = useInsumos(clinicId);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Insumo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<InsumoInput>(EMPTY_INSUMO);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Insumo | null>(null);

  const filtered = items.filter((i) => i.nombre.toLowerCase().includes(query.toLowerCase()));
  const proveedorName = (id: string | null) => proveedores.find((p) => p.id === id)?.nombre ?? "";

  const setField = <K extends keyof InsumoInput>(k: K, v: InsumoInput[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const openNew = () => { setEditing(null); setForm(EMPTY_INSUMO); setDialogOpen(true); };
  const openEdit = (i: Insumo) => {
    setEditing(i);
    setForm({
      nombre: i.nombre, stock: i.stock, stockMinimo: i.stockMinimo, caducidad: i.caducidad,
      costoMxn: i.costoMxn, proveedorId: i.proveedorId, activo: i.activo,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.nombre.trim()) { toast.error("El nombre del insumo es obligatorio."); return; }
    setSaving(true);
    try {
      if (editing) { await update(editing.id, form); toast.success("Insumo actualizado"); }
      else { await create(form); toast.success("Insumo creado"); }
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el insumo");
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try { await remove(toDelete.id); toast.success("Insumo eliminado"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo eliminar"); }
    finally { setToDelete(null); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Catálogo de insumos</CardTitle>
          <CardDescription>Costos en MXN</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="h-9 w-48 pl-8" placeholder="Buscar insumo" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {canEdit && <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Nuevo</Button>}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando insumos…
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {items.length === 0 ? "Aún no hay insumos registrados." : "Sin resultados."}
          </p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Insumo</TableHead><TableHead className="text-center">Stock</TableHead>
              <TableHead className="text-center">Mínimo</TableHead><TableHead>Caducidad</TableHead>
              <TableHead>Proveedor</TableHead><TableHead className="text-right">Costo</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((i) => {
                const bajo = i.stock < i.stockMinimo;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.nombre}</TableCell>
                    <TableCell className="text-center">
                      {i.stock}{bajo && <Badge variant="destructive" className="ml-2">Bajo</Badge>}
                    </TableCell>
                    <TableCell className="text-center">{i.stockMinimo}</TableCell>
                    <TableCell>{i.caducidad || "—"}</TableCell>
                    <TableCell>{proveedorName(i.proveedorId) || "—"}</TableCell>
                    <TableCell className="text-right">{mxn(i.costoMxn)}</TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setToDelete(i)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar insumo" : "Nuevo insumo"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="Nombre">
              <Input value={form.nombre} onChange={(e) => setField("nombre", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Stock">
                <Input type="number" min={0} value={form.stock} onChange={(e) => setField("stock", Number(e.target.value))} />
              </Field>
              <Field label="Stock mínimo">
                <Input type="number" min={0} value={form.stockMinimo} onChange={(e) => setField("stockMinimo", Number(e.target.value))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Caducidad">
                <Input type="date" value={form.caducidad} onChange={(e) => setField("caducidad", e.target.value)} />
              </Field>
              <Field label="Costo (MXN)">
                <Input type="number" min={0} step="0.01" value={form.costoMxn} onChange={(e) => setField("costoMxn", Number(e.target.value))} />
              </Field>
            </div>
            <Field label="Proveedor">
              <Select
                value={form.proveedorId ?? "none"}
                onValueChange={(v) => setField("proveedorId", v === "none" ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Sin proveedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin proveedor</SelectItem>
                  {proveedores.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label className="text-sm">Activo</Label>
              <Switch checked={form.activo} onCheckedChange={(v) => setField("activo", v)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{toDelete?.nombre}”?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/* ====================================================================== */
/* Kits por tratamiento                                                    */
/* ====================================================================== */

// Margen objetivo = margen sobre el costo de insumos (no margen neto del negocio).
// Anclas de mercado MX (clínica dental/estética 2025-26): el insumo es 4-15% del
// precio, así que el margen-sobre-insumo "natural" cae en 60-90%. Rutina alta
// frecuencia margen menor; estética/premium mayor (blanqueamiento >60%).
const MARGEN_PRESETS = [
  { label: "Rutina", value: 60 },
  { label: "Estética", value: 75 },
  { label: "Premium", value: 85 },
] as const;

const EMPTY_KIT: KitInput = {
  tratamiento: "", precioMxn: 0, margenObjetivo: 75, activo: true, items: [],
};

function KitsTab({ clinicId, canEdit, insumos }: {
  clinicId: string | null;
  canEdit: boolean;
  insumos: Insumo[];
}) {
  const { items, loading, error, create, update, remove } = useKits(clinicId);
  const [editing, setEditing] = useState<Kit | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<KitInput>(EMPTY_KIT);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Kit | null>(null);

  const setField = <K extends keyof KitInput>(k: K, v: KitInput[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // Builder de líneas: alta/baja/edición de cada insumo del kit.
  const addLine = () =>
    setForm((prev) => ({ ...prev, items: [...prev.items, { insumoId: "", cantidad: 1 }] }));
  const updateLine = (idx: number, patch: Partial<KitItemInput>) =>
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  const removeLine = (idx: number) =>
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const insumoCosto = (id: string) => insumos.find((i) => i.id === id)?.costoMxn ?? 0;
  // Costo derivado en vivo de las líneas (mismo cálculo que el hook al cargar).
  const formCosto = form.items.reduce((sum, it) => sum + it.cantidad * insumoCosto(it.insumoId), 0);
  const formMargen = form.precioMxn > 0 ? Math.round(((form.precioMxn - formCosto) / form.precioMxn) * 100) : 0;
  // Opción B: precio sugerido = costo / (1 - margenObjetivo/100). margen en [0,99].
  const margenMeta = Math.min(99, Math.max(0, form.margenObjetivo));
  const precioSugerido = Math.round((formCosto / (1 - margenMeta / 100)) * 100) / 100;
  // Insumo como % del precio real: ancla de realidad (mercado MX ≈ 4-15%).
  const insumoPct = form.precioMxn > 0 ? Math.round((formCosto / form.precioMxn) * 100) : 0;

  const openNew = () => { setEditing(null); setForm(EMPTY_KIT); setDialogOpen(true); };
  const openEdit = (k: Kit) => {
    setEditing(k);
    setForm({
      tratamiento: k.tratamiento,
      precioMxn: k.precioMxn,
      margenObjetivo: k.margenObjetivo,
      activo: k.activo,
      items: k.items.map((it) => ({ insumoId: it.insumoId, cantidad: it.cantidad })),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.tratamiento.trim()) { toast.error("El tratamiento es obligatorio."); return; }
    if (form.items.some((it) => !it.insumoId)) {
      toast.error("Cada línea debe tener un insumo seleccionado."); return;
    }
    const ids = form.items.map((it) => it.insumoId);
    if (new Set(ids).size !== ids.length) {
      toast.error("Hay insumos repetidos en el kit."); return;
    }
    setSaving(true);
    try {
      if (editing) { await update(editing.id, form); toast.success("Kit actualizado"); }
      else { await create(form); toast.success("Kit creado"); }
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el kit");
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try { await remove(toDelete.id); toast.success("Kit eliminado"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo eliminar"); }
    finally { setToDelete(null); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Kits por tratamiento</CardTitle>
          <CardDescription>Costo calculado de los insumos; precio manual</CardDescription>
        </div>
        {canEdit && <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Nuevo</Button>}
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando kits…
          </div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Aún no hay kits registrados.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tratamiento</TableHead><TableHead className="text-center">Insumos</TableHead>
              <TableHead className="text-right">Costo</TableHead><TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Margen</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.map((k) => {
                const margen = k.precioMxn > 0 ? Math.round(((k.precioMxn - k.costoMxn) / k.precioMxn) * 100) : 0;
                return (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.tratamiento}</TableCell>
                    <TableCell className="text-center">{k.numInsumos} ítems</TableCell>
                    <TableCell className="text-right">{mxn(k.costoMxn)}</TableCell>
                    <TableCell className="text-right">{mxn(k.precioMxn)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={margen > 50 ? "default" : "secondary"}>{margen}%</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(k)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setToDelete(k)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar kit" : "Nuevo kit"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="Tratamiento">
              <Input value={form.tratamiento} onChange={(e) => setField("tratamiento", e.target.value)} />
            </Field>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-sm">Insumos del kit</Label>
                <Button size="sm" variant="outline" onClick={addLine} disabled={insumos.length === 0}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Agregar insumo
                </Button>
              </div>
              {insumos.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  No hay insumos en el catálogo. Crea insumos primero en la pestaña "Insumos".
                </p>
              ) : form.items.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Sin insumos. Agrega al menos uno para calcular el costo.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.items.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Select value={line.insumoId || undefined} onValueChange={(v) => updateLine(idx, { insumoId: v })}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Selecciona insumo" /></SelectTrigger>
                        <SelectContent>
                          {insumos.map((i) => (
                            <SelectItem key={i.id} value={i.id}>{i.nombre} · {mxn(i.costoMxn)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number" min={1} className="w-20"
                        value={line.cantidad}
                        onChange={(e) => updateLine(idx, { cantidad: Number(e.target.value) })}
                      />
                      <Button size="icon" variant="ghost" onClick={() => removeLine(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Margen objetivo (% sobre insumo)">
                <div className="space-y-1.5">
                  <Input
                    type="number" min={0} max={99}
                    value={form.margenObjetivo}
                    onChange={(e) => setField("margenObjetivo", Number(e.target.value))}
                  />
                  <div className="flex gap-1">
                    {MARGEN_PRESETS.map((p) => (
                      <Button
                        key={p.label} type="button" size="sm"
                        variant={form.margenObjetivo === p.value ? "default" : "outline"}
                        className="h-7 flex-1 px-1 text-xs"
                        onClick={() => setField("margenObjetivo", p.value)}
                      >
                        {p.label} {p.value}%
                      </Button>
                    ))}
                  </div>
                </div>
              </Field>
              <Field label="Precio (MXN)">
                <Input type="number" min={0} step="0.01" value={form.precioMxn} onChange={(e) => setField("precioMxn", Number(e.target.value))} />
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-md border border-dashed border-border p-3 text-sm">
              <div>
                <span className="text-muted-foreground">Precio sugerido</span>
                <div className="font-medium">{mxn(precioSugerido)}</div>
              </div>
              <Button
                size="sm" variant="outline"
                onClick={() => setField("precioMxn", precioSugerido)}
                disabled={formCosto === 0}
              >
                Usar sugerido
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              El insumo representa <span className="font-medium">{insumoPct}%</span> del precio.
              Referencia de mercado MX: el material suele ser 4-15% del precio (margen sobre
              insumo 60-90%). El margen neto del negocio (tras nómina y gastos) ronda 20-40%.
            </p>

            <div className="grid grid-cols-3 gap-2 rounded-md border border-border p-3 text-sm">
              <div><span className="text-muted-foreground">Costo</span><div className="font-medium">{mxn(formCosto)}</div></div>
              <div><span className="text-muted-foreground">Precio</span><div className="font-medium">{mxn(form.precioMxn)}</div></div>
              <div>
                <span className="text-muted-foreground">Margen</span>
                <div><Badge variant={formMargen > 50 ? "default" : "secondary"}>{formMargen}%</Badge></div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label className="text-sm">Activo</Label>
              <Switch checked={form.activo} onCheckedChange={(v) => setField("activo", v)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el kit “{toDelete?.tratamiento}”?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/* ====================================================================== */
/* Proveedores                                                             */
/* ====================================================================== */

const EMPTY_PROVEEDOR: ProveedorInput = {
  nombre: "", contacto: "", telefono: "", email: "", activo: true,
};

function ProveedoresTab({ clinicId, canEdit }: { clinicId: string | null; canEdit: boolean }) {
  const { items, loading, error, create, update, remove } = useProveedores(clinicId);
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ProveedorInput>(EMPTY_PROVEEDOR);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Proveedor | null>(null);

  const setField = <K extends keyof ProveedorInput>(k: K, v: ProveedorInput[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const openNew = () => { setEditing(null); setForm(EMPTY_PROVEEDOR); setDialogOpen(true); };
  const openEdit = (p: Proveedor) => {
    setEditing(p);
    setForm({ nombre: p.nombre, contacto: p.contacto, telefono: p.telefono, email: p.email, activo: p.activo });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.nombre.trim()) { toast.error("El nombre del proveedor es obligatorio."); return; }
    setSaving(true);
    try {
      if (editing) { await update(editing.id, form); toast.success("Proveedor actualizado"); }
      else { await create(form); toast.success("Proveedor creado"); }
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el proveedor");
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try { await remove(toDelete.id); toast.success("Proveedor eliminado"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo eliminar"); }
    finally { setToDelete(null); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Proveedores</CardTitle>
        {canEdit && <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Agregar</Button>}
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando proveedores…
          </div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Aún no hay proveedores registrados.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Proveedor</TableHead><TableHead>Contacto</TableHead>
              <TableHead>Teléfono</TableHead><TableHead>Email</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell>{p.contacto || "—"}</TableCell>
                  <TableCell>{p.telefono || "—"}</TableCell>
                  <TableCell>{p.email || "—"}</TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setToDelete(p)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="Nombre">
              <Input value={form.nombre} onChange={(e) => setField("nombre", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Contacto">
                <Input value={form.contacto} onChange={(e) => setField("contacto", e.target.value)} />
              </Field>
              <Field label="Teléfono">
                <Input value={form.telefono} onChange={(e) => setField("telefono", e.target.value)} />
              </Field>
            </div>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
            </Field>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label className="text-sm">Activo</Label>
              <Switch checked={form.activo} onCheckedChange={(v) => setField("activo", v)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{toDelete?.nombre}”?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/* ---------------- 12. Inventario y Costos (persistencia real) ---------------- */
export function SectionInventario(_: SectionProps) {
  const { activeClinicId, isGlobalAdmin } = useActiveClinic();
  const canEdit = isGlobalAdmin;
  // Proveedores se cargan a nivel shell para poblar el select de insumos.
  const { items: proveedores } = useProveedores(activeClinicId);
  // Insumos a nivel shell pueblan el builder de líneas de los kits.
  const { items: insumos } = useInsumos(activeClinicId);

  return (
    <Tabs defaultValue="insumos">
      <TabsList>
        <TabsTrigger value="insumos">Insumos</TabsTrigger>
        <TabsTrigger value="kits">Kits por tratamiento</TabsTrigger>
        <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
      </TabsList>

      <TabsContent value="insumos" className="mt-4">
        <InsumosTab clinicId={activeClinicId} canEdit={canEdit} proveedores={proveedores} />
      </TabsContent>
      <TabsContent value="kits" className="mt-4">
        <KitsTab clinicId={activeClinicId} canEdit={canEdit} insumos={insumos} />
      </TabsContent>
      <TabsContent value="proveedores" className="mt-4">
        <ProveedoresTab clinicId={activeClinicId} canEdit={canEdit} />
      </TabsContent>
    </Tabs>
  );
}
