import { useState } from "react";
import { Plus, Trash2, Search, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Field, type SectionProps } from "../shared";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useServicios, type Servicio, type ServicioInput } from "@/hooks/useServicios";
import { useFieldErrors } from "@/hooks/useFieldErrors";

const EMPTY: ServicioInput = {
  nombre: "", especialidad: "", duracionMin: 30, precioMxn: 0, activo: true,
};

/* ---------------- 5. Servicios (persistencia real → tabla servicios) ---------------- */
export function SectionServicios(_: SectionProps) {
  const { activeClinicId, isGlobalAdmin } = useActiveClinic();
  const { items, loading, error, create, update, toggleActivo, remove } = useServicios(activeClinicId);
  const canEdit = isGlobalAdmin;

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Servicio | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ServicioInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Servicio | null>(null);
  const { markErrors, clearError, errorClass, resetErrors } = useFieldErrors();

  const filtered = items.filter((s) =>
    s.nombre.toLowerCase().includes(query.toLowerCase()),
  );

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    resetErrors();
    setDialogOpen(true);
  };
  const openEdit = (s: Servicio) => {
    setEditing(s);
    setForm({
      nombre: s.nombre, especialidad: s.especialidad,
      duracionMin: s.duracionMin, precioMxn: s.precioMxn, activo: s.activo,
    });
    resetErrors();
    setDialogOpen(true);
  };

  const setField = <K extends keyof ServicioInput>(k: K, v: ServicioInput[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    if (!form.nombre.trim()) {
      markErrors(["nombre"]);
      toast.error("El nombre del servicio es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await update(editing.id, form);
        toast.success("Servicio actualizado");
      } else {
        await create(form);
        toast.success("Servicio creado");
      }
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el servicio");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (s: Servicio) => {
    try {
      await toggleActivo(s.id, !s.activo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await remove(toDelete.id);
      toast.success("Servicio eliminado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setToDelete(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Catálogo de servicios</CardTitle>
          <CardDescription>Precios en MXN</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="h-9 w-48 pl-8"
              placeholder="Buscar servicio"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {canEdit && (
            <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Nuevo</Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando servicios…
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {items.length === 0 ? "Aún no hay servicios registrados." : "Sin resultados."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servicio</TableHead><TableHead>Especialidad</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Duración</TableHead>
                <TableHead className="text-center">Activo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.nombre}</TableCell>
                  <TableCell>{s.especialidad ? <Badge variant="secondary">{s.especialidad}</Badge> : "—"}</TableCell>
                  <TableCell className="text-right">${s.precioMxn.toLocaleString("es-MX")}</TableCell>
                  <TableCell className="text-right">{s.duracionMin} min</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={s.activo} disabled={!canEdit} onCheckedChange={() => handleToggle(s)} />
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setToDelete(s)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Crear / Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="Nombre *">
              <Input
                id="field-nombre"
                value={form.nombre}
                onChange={(e) => { clearError("nombre"); setField("nombre", e.target.value); }}
                className={errorClass("nombre")}
              />
            </Field>
            <Field label="Especialidad / tipo">
              <Input value={form.especialidad} onChange={(e) => setField("especialidad", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Precio (MXN)">
                <Input
                  type="number" min={0} value={form.precioMxn}
                  onChange={(e) => setField("precioMxn", Number(e.target.value))}
                />
              </Field>
              <Field label="Duración (min)">
                <Input
                  type="number" min={0} value={form.duracionMin}
                  onChange={(e) => setField("duracionMin", Number(e.target.value))}
                />
              </Field>
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

      {/* Confirmar eliminación */}
      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{toDelete?.nombre}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El servicio dejará de estar disponible.
            </AlertDialogDescription>
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
