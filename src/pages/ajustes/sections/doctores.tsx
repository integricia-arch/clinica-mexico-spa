import { useState } from "react";
import { Plus, Trash2, Loader2, Pencil, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useDoctores, type Doctor, type DoctorInput } from "@/hooks/useDoctores";

const EMPTY: DoctorInput = {
  nombre: "", apellidos: "", especialidad: "", cedula: "", telefono: "",
  horarioInicio: "09:00", horarioFin: "19:00", activo: true,
};

/* ---------------- 6. Doctores (persistencia real → tabla doctors) ---------------- */
export function SectionDoctores(_: SectionProps) {
  const { activeClinicId, isGlobalAdmin } = useActiveClinic();
  const { items, loading, error, create, update, remove } = useDoctores(activeClinicId);
  const canEdit = isGlobalAdmin;

  const [editing, setEditing] = useState<Doctor | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<DoctorInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Doctor | null>(null);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };
  const openEdit = (d: Doctor) => {
    setEditing(d);
    setForm({
      nombre: d.nombre, apellidos: d.apellidos, especialidad: d.especialidad,
      cedula: d.cedula, telefono: d.telefono,
      horarioInicio: d.horarioInicio || "09:00", horarioFin: d.horarioFin || "19:00",
      activo: d.activo,
    });
    setDialogOpen(true);
  };

  const setField = <K extends keyof DoctorInput>(k: K, v: DoctorInput[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    if (!form.nombre.trim() || !form.apellidos.trim()) {
      toast.error("Nombre y apellidos son obligatorios.");
      return;
    }
    if (!form.especialidad.trim()) {
      toast.error("La especialidad es obligatoria.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await update(editing.id, form);
        toast.success("Doctor actualizado");
      } else {
        await create(form);
        toast.success("Doctor creado");
      }
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el doctor");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await remove(toDelete.id);
      toast.success("Doctor eliminado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Personal médico</CardTitle>
          {canEdit && (
            <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Agregar doctor</Button>
          )}
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando doctores…
            </div>
          ) : items.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Aún no hay doctores registrados.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Nombre</TableHead><TableHead>Especialidad</TableHead>
                <TableHead>Cédula</TableHead><TableHead>Horario</TableHead>
                <TableHead className="text-center">Activo</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {items.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.nombre} {d.apellidos}</TableCell>
                    <TableCell>{d.especialidad}</TableCell>
                    <TableCell>{d.cedula || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.horarioInicio}–{d.horarioFin}
                    </TableCell>
                    <TableCell className="text-center">
                      {d.activo ? <Badge>Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(d)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setToDelete(d)}>
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
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Firma y encabezado de receta</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-40 items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
              Vista previa
            </div>
            <Button variant="outline" size="sm" disabled>
              <Upload className="mr-1.5 h-4 w-4" /> Subir firma · próximamente
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Crear / Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar doctor" : "Nuevo doctor"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre">
                <Input value={form.nombre} onChange={(e) => setField("nombre", e.target.value)} />
              </Field>
              <Field label="Apellidos">
                <Input value={form.apellidos} onChange={(e) => setField("apellidos", e.target.value)} />
              </Field>
            </div>
            <Field label="Especialidad">
              <Input value={form.especialidad} onChange={(e) => setField("especialidad", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cédula profesional">
                <Input value={form.cedula} onChange={(e) => setField("cedula", e.target.value)} />
              </Field>
              <Field label="Teléfono">
                <Input value={form.telefono} onChange={(e) => setField("telefono", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Horario inicio">
                <Input type="time" value={form.horarioInicio} onChange={(e) => setField("horarioInicio", e.target.value)} />
              </Field>
              <Field label="Horario fin">
                <Input type="time" value={form.horarioFin} onChange={(e) => setField("horarioFin", e.target.value)} />
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
            <AlertDialogTitle>¿Eliminar a {toDelete?.nombre} {toDelete?.apellidos}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
