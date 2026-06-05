import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Lock, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { useClinicSettingsForm } from "@/hooks/useClinicSettingsForm";
import { useChecklists, type Checklist, type ChecklistInput } from "@/hooks/useChecklists";

/* ---------------- 7. Consultorios y Recursos (demo visual) ---------------- */
export function SectionRecursos({ onChange }: SectionProps) {
  return (
    <Tabs defaultValue="consultorios">
      <TabsList>
        <TabsTrigger value="consultorios">Consultorios</TabsTrigger>
        <TabsTrigger value="salas">Salas de procedimiento</TabsTrigger>
        <TabsTrigger value="equipos">Equipos</TabsTrigger>
      </TabsList>

      <TabsContent value="consultorios" className="mt-4">
        <ResourceTable
          headers={["Nombre", "Piso", "Capacidad", "Estado"]}
          rows={[
            ["Consultorio 1", "PB", "2", "Disponible"],
            ["Consultorio 2", "PB", "2", "Ocupado"],
            ["Consultorio 3", "1°", "3", "Disponible"],
          ]}
          onChange={onChange}
        />
      </TabsContent>
      <TabsContent value="salas" className="mt-4">
        <ResourceTable
          headers={["Sala", "Tipo", "Capacidad", "Estado"]}
          rows={[
            ["Sala A", "Curaciones", "1", "Disponible"],
            ["Sala B", "Cirugía menor", "1", "Mantenimiento"],
          ]}
          onChange={onChange}
        />
      </TabsContent>
      <TabsContent value="equipos" className="mt-4">
        <ResourceTable
          headers={["Equipo", "Ubicación", "Próx. mantenimiento", "Estado"]}
          rows={[
            ["Ultrasonido GE", "Sala A", "15/08/2026", "Disponible"],
            ["Electrocardiógrafo", "Consultorio 2", "30/07/2026", "Disponible"],
            ["Autoclave", "Sala B", "10/07/2026", "Mantenimiento"],
          ]}
          onChange={onChange}
        />
      </TabsContent>
    </Tabs>
  );
}

function ResourceTable({ headers, rows, onChange }: { headers: string[]; rows: string[][]; onChange: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardDescription>{rows.length} registros</CardDescription>
        <Button size="sm" onClick={onChange}><Plus className="mr-1.5 h-4 w-4" /> Agregar</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}<TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                {r.map((c, j) => (
                  <TableCell key={j} className={j === 0 ? "font-medium" : ""}>
                    {j === r.length - 1 ? (
                      <Badge variant={c === "Disponible" ? "default" : c === "Mantenimiento" ? "destructive" : "secondary"}>{c}</Badge>
                    ) : c}
                  </TableCell>
                ))}
                <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={onChange}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------------- 8. Formularios del Paciente (persistencia → clinic_settings/formularios) ---------------- */
interface FormulariosForm {
  datosGenerales: boolean;
  antecedentes: boolean;
  alergias: boolean;
  medicamentos: boolean;
  contactoEmergencia: boolean;
  consentimientos: boolean;
  preguntasEspecialidad: boolean;
}

const FORMULARIOS_DEFAULTS: FormulariosForm = {
  datosGenerales: true,
  antecedentes: true,
  alergias: true,
  medicamentos: true,
  contactoEmergencia: true,
  consentimientos: true,
  preguntasEspecialidad: false,
};

const FORMULARIOS_BLOQUES: { key: keyof FormulariosForm; t: string; d: string }[] = [
  { key: "datosGenerales", t: "Datos generales", d: "Nombre, fecha de nacimiento, sexo, CURP, contacto" },
  { key: "antecedentes", t: "Antecedentes médicos", d: "Personales, familiares, quirúrgicos" },
  { key: "alergias", t: "Alergias", d: "Medicamentos, alimentos, ambientales" },
  { key: "medicamentos", t: "Medicamentos actuales", d: "Lista activa con posología" },
  { key: "contactoEmergencia", t: "Contacto de emergencia", d: "Nombre, parentesco, teléfono" },
  { key: "consentimientos", t: "Consentimientos informados", d: "Vinculados al servicio" },
  { key: "preguntasEspecialidad", t: "Preguntas por especialidad", d: "Cuestionarios condicionales" },
];

export function SectionFormularios({ onChange, registerSave }: SectionProps) {
  const { activeClinicId, isGlobalAdmin } = useActiveClinic();
  const readOnly = !isGlobalAdmin;
  const { form, setField, loading, error, save, reset } = useClinicSettingsForm<FormulariosForm>(
    activeClinicId,
    "formularios",
    FORMULARIOS_DEFAULTS,
  );

  useEffect(() => {
    registerSave?.({ save, reset });
  }, [registerSave, save, reset]);

  const edit = (key: keyof FormulariosForm, value: boolean) => {
    setField(key, value);
    onChange();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando bloques del expediente…
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {readOnly && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700">
          <Lock className="h-3.5 w-3.5" /> Solo administradores pueden editar estos datos.
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Bloques del expediente</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {FORMULARIOS_BLOQUES.map((b) => (
            <div key={b.key} className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">{b.t}</p>
                <p className="text-xs text-muted-foreground">{b.d}</p>
              </div>
              <Switch checked={form[b.key]} disabled={readOnly} onCheckedChange={(v) => edit(b.key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- 9. Checklists Clínicos (persistencia real → tabla checklists) ---------------- */
const EMPTY_CHECKLIST: ChecklistInput = {
  servicio: "", pasos: 0, responsable: "", bloquearAvance: false,
  permitirJustificacion: true, activo: true,
};

export function SectionChecklists(_: SectionProps) {
  const { activeClinicId, isGlobalAdmin } = useActiveClinic();
  const { items, loading, error, create, update, toggleActivo, remove } = useChecklists(activeClinicId);
  const canEdit = isGlobalAdmin;

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Checklist | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ChecklistInput>(EMPTY_CHECKLIST);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Checklist | null>(null);

  const filtered = items.filter((c) =>
    c.servicio.toLowerCase().includes(query.toLowerCase()),
  );

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_CHECKLIST);
    setDialogOpen(true);
  };
  const openEdit = (c: Checklist) => {
    setEditing(c);
    setForm({
      servicio: c.servicio, pasos: c.pasos, responsable: c.responsable,
      bloquearAvance: c.bloquearAvance, permitirJustificacion: c.permitirJustificacion,
      activo: c.activo,
    });
    setDialogOpen(true);
  };

  const setField = <K extends keyof ChecklistInput>(k: K, v: ChecklistInput[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    if (!form.servicio.trim()) {
      toast.error("El servicio del checklist es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await update(editing.id, form);
        toast.success("Checklist actualizado");
      } else {
        await create(form);
        toast.success("Checklist creado");
      }
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el checklist");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (c: Checklist) => {
    try {
      await toggleActivo(c.id, !c.activo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await remove(toDelete.id);
      toast.success("Checklist eliminado");
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
          <CardTitle className="text-base">Checklists por servicio</CardTitle>
          <CardDescription>Procesos obligatorios antes de avanzar una atención</CardDescription>
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
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando checklists…
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {items.length === 0 ? "Aún no hay checklists registrados." : "Sin resultados."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servicio</TableHead>
                <TableHead className="text-center">Pasos</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead className="text-center">Bloquear avance</TableHead>
                <TableHead className="text-center">Activo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.servicio}</TableCell>
                  <TableCell className="text-center">{c.pasos}</TableCell>
                  <TableCell>{c.responsable ? <Badge variant="secondary">{c.responsable}</Badge> : "—"}</TableCell>
                  <TableCell className="text-center">
                    {c.bloquearAvance ? <Lock className="mx-auto h-4 w-4 text-muted-foreground" /> : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={c.activo} disabled={!canEdit} onCheckedChange={() => handleToggle(c)} />
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setToDelete(c)}>
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
            <DialogTitle>{editing ? "Editar checklist" : "Nuevo checklist"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="Servicio">
              <Input value={form.servicio} onChange={(e) => setField("servicio", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Pasos">
                <Input
                  type="number" min={0} value={form.pasos}
                  onChange={(e) => setField("pasos", Number(e.target.value))}
                />
              </Field>
              <Field label="Responsable">
                <Input value={form.responsable} onChange={(e) => setField("responsable", e.target.value)} />
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label className="text-sm">Bloquear avance hasta completarlo</Label>
              <Switch checked={form.bloquearAvance} onCheckedChange={(v) => setField("bloquearAvance", v)} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label className="text-sm">Permitir justificación al omitir un paso</Label>
                <p className="text-[11px] text-muted-foreground">Requiere capturar motivo y queda en auditoría</p>
              </div>
              <Switch checked={form.permitirJustificacion} onCheckedChange={(v) => setField("permitirJustificacion", v)} />
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
            <AlertDialogTitle>¿Eliminar el checklist de “{toDelete?.servicio}”?</AlertDialogTitle>
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
    </Card>
  );
}
