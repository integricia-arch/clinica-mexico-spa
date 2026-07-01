import { useState, useEffect } from "react";
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
import { untypedTable } from "@/lib/untypedTable";
import { useInsumos, type Insumo, type InsumoInput } from "@/hooks/useInsumos";
import { useKits, type Kit, type KitInput, type KitItemInput } from "@/hooks/useKits";
import { useProveedores, type Proveedor, type ProveedorInput } from "@/hooks/useProveedores";
import { useFieldErrors } from "@/hooks/useFieldErrors";

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
  const { markErrors: markInsumoErrors, clearError: clearInsumoError, errorClass: insumoErrorClass, resetErrors: resetInsumoErrors } = useFieldErrors();

  const filtered = items.filter((i) => i.nombre.toLowerCase().includes(query.toLowerCase()));
  const proveedorName = (id: string | null) => proveedores.find((p) => p.id === id)?.nombre ?? "";

  const setField = <K extends keyof InsumoInput>(k: K, v: InsumoInput[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const openNew = () => { setEditing(null); setForm(EMPTY_INSUMO); resetInsumoErrors(); setDialogOpen(true); };
  const openEdit = (i: Insumo) => {
    setEditing(i);
    setForm({
      nombre: i.nombre, stock: i.stock, stockMinimo: i.stockMinimo, caducidad: i.caducidad,
      costoMxn: i.costoMxn, proveedorId: i.proveedorId, activo: i.activo,
    });
    resetInsumoErrors();
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.nombre.trim()) { markInsumoErrors(["nombre"]); toast.error("El nombre del insumo es obligatorio."); return; }
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
            <Field label="Nombre *">
              <Input
                id="field-nombre"
                value={form.nombre}
                onChange={(e) => { clearInsumoError("nombre"); setField("nombre", e.target.value); }}
                className={insumoErrorClass("nombre")}
              />
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
  const { markErrors: markKitErrors, clearError: clearKitError, errorClass: kitErrorClass, resetErrors: resetKitErrors } = useFieldErrors();

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

  const openNew = () => { setEditing(null); setForm(EMPTY_KIT); resetKitErrors(); setDialogOpen(true); };
  const openEdit = (k: Kit) => {
    setEditing(k);
    setForm({
      tratamiento: k.tratamiento,
      precioMxn: k.precioMxn,
      margenObjetivo: k.margenObjetivo,
      activo: k.activo,
      items: k.items.map((it) => ({ insumoId: it.insumoId, cantidad: it.cantidad })),
    });
    resetKitErrors();
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.tratamiento.trim()) { markKitErrors(["tratamiento"]); toast.error("El tratamiento es obligatorio."); return; }
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
            <Field label="Tratamiento *">
              <Input
                id="field-tratamiento"
                value={form.tratamiento}
                onChange={(e) => { clearKitError("tratamiento"); setField("tratamiento", e.target.value); }}
                className={kitErrorClass("tratamiento")}
              />
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
  rfc: "", regimen_fiscal: "", domicilio_fiscal: "", clabe: "", banco: "",
  terminos_pago: 30, plazo_entrega: 3, requiere_cofepris: false,
  clasificacion: "regular", estatus_efos: "no_verificado", notas: "",
  clasificacion_abc: "C", cuenta_clabe: "", banco_nombre: "",
  limite_credito_centavos: 0, dias_credito: 30,
  descuento_pronto_pago_pct: 0, dias_pronto_pago: 10,
};

function ProveedoresTab({ clinicId, canEdit }: { clinicId: string | null; canEdit: boolean }) {
  const { items, loading, error, create, update, remove } = useProveedores(clinicId);
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ProveedorInput>(EMPTY_PROVEEDOR);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Proveedor | null>(null);
  const { markErrors: markProvErrors, clearError: clearProvError, errorClass: provErrorClass, resetErrors: resetProvErrors } = useFieldErrors();

  const setField = <K extends keyof ProveedorInput>(k: K, v: ProveedorInput[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const openNew = () => { setEditing(null); setForm(EMPTY_PROVEEDOR); resetProvErrors(); setDialogOpen(true); };
  const openEdit = (p: Proveedor) => {
    setEditing(p);
    setForm({
      nombre: p.nombre, contacto: p.contacto, telefono: p.telefono, email: p.email, activo: p.activo,
      rfc: p.rfc, regimen_fiscal: p.regimen_fiscal, domicilio_fiscal: p.domicilio_fiscal,
      clabe: p.clabe, banco: p.banco, terminos_pago: p.terminos_pago, plazo_entrega: p.plazo_entrega,
      requiere_cofepris: p.requiere_cofepris, clasificacion: p.clasificacion,
      estatus_efos: p.estatus_efos, notas: p.notas,
      clasificacion_abc: p.clasificacion_abc, cuenta_clabe: p.cuenta_clabe,
      banco_nombre: p.banco_nombre, limite_credito_centavos: p.limite_credito_centavos,
      dias_credito: p.dias_credito, descuento_pronto_pago_pct: p.descuento_pronto_pago_pct,
      dias_pronto_pago: p.dias_pronto_pago,
    });
    resetProvErrors();
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.nombre.trim()) { markProvErrors(["nombre"]); toast.error("El nombre del proveedor es obligatorio."); return; }
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
              <TableHead>Proveedor</TableHead>
              <TableHead>RFC</TableHead>
              <TableHead>Clasificación</TableHead>
              <TableHead>Términos</TableHead>
              <TableHead>EFOS</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.nombre}
                    {p.requiere_cofepris && <span className="ml-1.5 text-xs text-blue-600 font-semibold">COFEPRIS</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.rfc || "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.clasificacion === "critico" ? "bg-destructive/10 text-destructive" :
                      p.clasificacion === "regular" ? "bg-muted text-muted-foreground" :
                      "bg-muted/50 text-muted-foreground"
                    }`}>
                      {p.clasificacion}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.terminos_pago === 0 ? "Contado" : `${p.terminos_pago}d`}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.estatus_efos === "ok" ? "bg-green-100 text-green-700" :
                      p.estatus_efos === "alerta" ? "bg-destructive/10 text-destructive" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {p.estatus_efos === "ok" ? "✓ OK" : p.estatus_efos === "alerta" ? "⚠ Alerta" : "Sin verificar"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{p.contacto || p.email || p.telefono || "—"}</TableCell>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">

            {/* Datos básicos */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Datos básicos</p>
            <Field label="Nombre *">
              <Input
                id="field-nombre-prov"
                value={form.nombre}
                onChange={(e) => { clearProvError("nombre"); setField("nombre", e.target.value); }}
                className={provErrorClass("nombre")}
              />
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

            {/* Datos fiscales */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Datos fiscales (SAT)</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="RFC">
                <Input
                  value={form.rfc}
                  onChange={(e) => setField("rfc", e.target.value.toUpperCase())}
                  placeholder="XXXX000000XXX"
                  maxLength={13}
                />
              </Field>
              <Field label="Régimen fiscal">
                <Input
                  value={form.regimen_fiscal}
                  onChange={(e) => setField("regimen_fiscal", e.target.value)}
                  placeholder="Ej. 601 - General de Ley"
                />
              </Field>
            </div>
            <Field label="Domicilio fiscal">
              <Input
                value={form.domicilio_fiscal}
                onChange={(e) => setField("domicilio_fiscal", e.target.value)}
                placeholder="Calle, número, colonia, CP, ciudad"
              />
            </Field>

            {/* Datos bancarios */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Datos bancarios</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="CLABE (18 dígitos)">
                <Input
                  value={form.clabe}
                  onChange={(e) => setField("clabe", e.target.value.replace(/\D/g, ""))}
                  placeholder="000000000000000000"
                  maxLength={18}
                />
              </Field>
              <Field label="Banco">
                <Input
                  value={form.banco}
                  onChange={(e) => setField("banco", e.target.value)}
                  placeholder="Ej. BBVA, HSBC, Banorte"
                />
              </Field>
            </div>

            {/* Condiciones comerciales */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Condiciones comerciales</p>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Términos de pago">
                <select
                  value={form.terminos_pago}
                  onChange={(e) => setField("terminos_pago", Number(e.target.value))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value={0}>Contado</option>
                  <option value={8}>8 días</option>
                  <option value={15}>15 días</option>
                  <option value={30}>30 días</option>
                  <option value={45}>45 días</option>
                  <option value={60}>60 días</option>
                </select>
              </Field>
              <Field label="Plazo entrega (días)">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={form.plazo_entrega}
                  onChange={(e) => setField("plazo_entrega", Number(e.target.value))}
                />
              </Field>
              <Field label="Clasificación">
                <select
                  value={form.clasificacion}
                  onChange={(e) => setField("clasificacion", e.target.value as ProveedorInput["clasificacion"])}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="critico">Crítico</option>
                  <option value="regular">Regular</option>
                  <option value="ocasional">Ocasional</option>
                </select>
              </Field>
            </div>

            {/* CxP BI: crédito y pronto pago */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Crédito y pronto pago (CxP)</p>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Clasificación ABC">
                <select
                  value={form.clasificacion_abc}
                  onChange={(e) => setField("clasificacion_abc", e.target.value as ProveedorInput["clasificacion_abc"])}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </Field>
              <Field label="Límite de crédito (MXN)">
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.limite_credito_centavos / 100}
                  onChange={(e) => setField("limite_credito_centavos", Math.round(Number(e.target.value) * 100))}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Días de crédito">
                <Input
                  type="number"
                  min={0}
                  max={180}
                  value={form.dias_credito}
                  onChange={(e) => setField("dias_credito", Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Descuento pronto pago (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={form.descuento_pronto_pago_pct}
                  onChange={(e) => setField("descuento_pronto_pago_pct", Number(e.target.value))}
                />
              </Field>
              <Field label="Días para pronto pago">
                <Input
                  type="number"
                  min={0}
                  max={90}
                  value={form.dias_pronto_pago}
                  onChange={(e) => setField("dias_pronto_pago", Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cuenta CLABE (auditoría)">
                <Input
                  value={form.cuenta_clabe}
                  onChange={(e) => setField("cuenta_clabe", e.target.value.replace(/\D/g, ""))}
                  placeholder="000000000000000000"
                  maxLength={18}
                />
              </Field>
              <Field label="Banco (auditoría)">
                <Input
                  value={form.banco_nombre}
                  onChange={(e) => setField("banco_nombre", e.target.value)}
                  placeholder="Ej. BBVA, HSBC, Banorte"
                />
              </Field>
            </div>

            {/* Control y verificación */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Control y verificación</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Estatus EFOS/EDOS (SAT)">
                <select
                  value={form.estatus_efos}
                  onChange={(e) => setField("estatus_efos", e.target.value as ProveedorInput["estatus_efos"])}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="no_verificado">Sin verificar</option>
                  <option value="ok">✓ Verificado OK</option>
                  <option value="alerta">⚠ Alerta EFOS</option>
                </select>
              </Field>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <Label className="text-sm">Requiere permiso COFEPRIS</Label>
                <Switch checked={form.requiere_cofepris} onCheckedChange={(v) => setField("requiere_cofepris", v)} />
              </div>
            </div>
            <Field label="Notas internas">
              <Input value={form.notas} onChange={(e) => setField("notas", e.target.value)} placeholder="Condiciones especiales, observaciones…" />
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
function ComprasConfigTab({ clinicId, canEdit }: { clinicId: string | null; canEdit: boolean }) {
  const [umbral, setUmbral] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    untypedTable("clinic_settings")
      .select("data")
      .eq("clinic_id", clinicId)
      .eq("section", "compras")
      .single()
      .then(({ data }) => {
        const d = (data as { data?: { umbral_aprobacion_oc_centavos?: number } } | null)?.data;
        if (d?.umbral_aprobacion_oc_centavos != null) {
          setUmbral(String(d.umbral_aprobacion_oc_centavos / 100));
        }
        setLoaded(true);
      });
  }, [clinicId]);

  const handleSave = async () => {
    if (!clinicId) return;
    const centavos = Math.round(Number(umbral) * 100);
    setSaving(true);
    const { error } = await untypedTable("clinic_settings")
      .upsert({
        clinic_id: clinicId,
        section: "compras",
        data: { umbral_aprobacion_oc_centavos: centavos > 0 ? centavos : null },
        updated_at: new Date().toISOString(),
      }, { onConflict: "clinic_id,section" });
    setSaving(false);
    if (error) toast.error("Error al guardar: " + error.message);
    else toast.success("Configuración de compras guardada");
  };

  if (!loaded) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aprobación de Órdenes de Compra</CardTitle>
        <CardDescription>
          OC que superen el umbral requieren aprobación de un manager o admin antes de enviarse al proveedor.
          Deja en 0 para desactivar el flujo de aprobación.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="umbral-oc">Umbral de aprobación (MXN)</Label>
          <Input
            id="umbral-oc"
            type="number"
            min={0}
            step={100}
            value={umbral}
            onChange={(e) => setUmbral(e.target.value)}
            placeholder="Ej: 5000 — deja en 0 para sin límite"
            disabled={!canEdit}
          />
          <p className="text-xs text-muted-foreground">
            OC con total &gt; {umbral ? `$${Number(umbral).toLocaleString("es-MX")}` : "—"} requerirán aprobación.
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Guardando…</> : "Guardar"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

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
        <TabsTrigger value="compras">Config. Compras</TabsTrigger>
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
      <TabsContent value="compras" className="mt-4">
        <ComprasConfigTab clinicId={activeClinicId} canEdit={canEdit} />
      </TabsContent>
    </Tabs>
  );
}
