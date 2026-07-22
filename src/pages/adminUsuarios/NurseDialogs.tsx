import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NURSE_CATEGORIA_LABELS, NurseCategoria, NurseForm, NurseRow, UsuarioRow } from "./types";

interface NurseDialogsProps {
  // Crear/editar enfermera
  nurseDialogOpen: boolean;
  setNurseDialogOpen: (v: boolean) => void;
  nurseEdit: NurseRow | null;
  nurseForm: NurseForm;
  setNurseForm: (f: NurseForm) => void;
  savingNurse: boolean;
  handleSaveNurse: () => void;

  // Eliminar enfermera
  nurseDel: NurseRow | null;
  setNurseDel: (v: NurseRow | null) => void;
  deletingNurse: boolean;
  handleDeleteNurse: () => void;

  // Desvincular enfermera
  unlinkNurse: NurseRow | null;
  setUnlinkNurse: (v: NurseRow | null) => void;
  unlinkingNurse: boolean;
  handleUnlinkNurse: () => void;

  // Vincular enfermera
  linkNurse: NurseRow | null;
  setLinkNurse: (v: NurseRow | null) => void;
  linkNurseMode: "new" | "existing";
  setLinkNurseMode: (v: "new" | "existing") => void;
  linkNurseEmail: string;
  setLinkNurseEmail: (v: string) => void;
  linkNursePassword: string;
  setLinkNursePassword: (v: string) => void;
  linkNurseExistingUserId: string;
  setLinkNurseExistingUserId: (v: string) => void;
  linkingNurse: boolean;
  handleLinkNurse: () => void;
  users: UsuarioRow[];
}

export function NurseDialogs(props: NurseDialogsProps) {
  const {
    nurseDialogOpen, setNurseDialogOpen, nurseEdit, nurseForm, setNurseForm, savingNurse, handleSaveNurse,
    nurseDel, setNurseDel, deletingNurse, handleDeleteNurse,
    unlinkNurse, setUnlinkNurse, unlinkingNurse, handleUnlinkNurse,
    linkNurse, setLinkNurse, linkNurseMode, setLinkNurseMode, linkNurseEmail, setLinkNurseEmail,
    linkNursePassword, setLinkNursePassword, linkNurseExistingUserId, setLinkNurseExistingUserId,
    linkingNurse, handleLinkNurse, users,
  } = props;

  return (
    <>
      {/* Dialog: Crear / Editar enfermera */}
      <Dialog open={nurseDialogOpen} onOpenChange={setNurseDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{nurseEdit ? "Editar enfermera" : "Nueva enfermera"}</DialogTitle>
            <DialogDescription>
              {nurseEdit
                ? `Actualiza los datos de Enf. ${nurseEdit.nombre} ${nurseEdit.apellidos}.`
                : "Registra una nueva enfermera en el sistema clínico."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Nombre(s) *</Label>
              <Input value={nurseForm.nombre} maxLength={80}
                onChange={(e) => setNurseForm({ ...nurseForm, nombre: e.target.value })} />
            </div>
            <div>
              <Label>Apellidos *</Label>
              <Input value={nurseForm.apellidos} maxLength={80}
                onChange={(e) => setNurseForm({ ...nurseForm, apellidos: e.target.value })} />
            </div>
            <div>
              <Label>Categoría *</Label>
              <Select value={nurseForm.categoria} onValueChange={(v) => setNurseForm({ ...nurseForm, categoria: v as NurseCategoria })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(NURSE_CATEGORIA_LABELS) as NurseCategoria[]).map((c) => (
                    <SelectItem key={c} value={c}>{NURSE_CATEGORIA_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">NOM-019-SSA3-2013: identificación por categoría/competencia.</p>
            </div>
            <div>
              <Label>Especialidad</Label>
              <Input value={nurseForm.especialidad} maxLength={100} placeholder="Ej. Quirúrgica, Pediátrica… (opcional)"
                onChange={(e) => setNurseForm({ ...nurseForm, especialidad: e.target.value })} />
            </div>
            <div>
              <Label>Cédula profesional</Label>
              <Input value={nurseForm.cedula_profesional} maxLength={20} placeholder="Ej. 12345678"
                onChange={(e) => setNurseForm({ ...nurseForm, cedula_profesional: e.target.value })} />
              <p className="text-[11px] text-muted-foreground mt-1">SEP / DGP. Solo letras, números y guiones.</p>
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={nurseForm.telefono} maxLength={20} placeholder="+52 55 1234 5678"
                onChange={(e) => setNurseForm({ ...nurseForm, telefono: e.target.value })} />
            </div>
            <div>
              <Label>Horario de inicio *</Label>
              <Input type="time" value={nurseForm.horario_inicio}
                onChange={(e) => setNurseForm({ ...nurseForm, horario_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Horario de fin *</Label>
              <Input type="time" value={nurseForm.horario_fin}
                onChange={(e) => setNurseForm({ ...nurseForm, horario_fin: e.target.value })} />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={nurseForm.activo}
                  onChange={(e) => setNurseForm({ ...nurseForm, activo: e.target.checked })} />
                Enfermera activa
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNurseDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveNurse} disabled={savingNurse}>
              {savingNurse ? "Guardando…" : nurseEdit ? "Guardar cambios" : "Crear enfermera"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación de enfermera */}
      <AlertDialog open={!!nurseDel} onOpenChange={(o) => !o && setNurseDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a Enf. {nurseDel?.nombre} {nurseDel?.apellidos}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es permanente. Si la enfermera tiene citas o registros asociados,
              no podrá eliminarse — en ese caso márcala como <strong>Inactiva</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingNurse}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteNurse} disabled={deletingNurse} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingNurse ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar desvincular enfermera */}
      <AlertDialog open={!!unlinkNurse} onOpenChange={(o) => !o && setUnlinkNurse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desvincular cuenta de Enf. {unlinkNurse?.nombre} {unlinkNurse?.apellidos}?</AlertDialogTitle>
            <AlertDialogDescription>
              La cuenta de usuario no se elimina. La enfermera quedará sin acceso al sistema hasta que se vincule otra cuenta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinkingNurse}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlinkNurse} disabled={unlinkingNurse} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {unlinkingNurse ? "Desvinculando…" : "Desvincular"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Vincular enfermera */}
      <Dialog open={!!linkNurse} onOpenChange={(o) => !o && setLinkNurse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular cuenta a enfermera</DialogTitle>
            <DialogDescription>
              Enf. {linkNurse?.nombre} {linkNurse?.apellidos}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-1.5">
              <Button size="sm" variant={linkNurseMode === "new" ? "default" : "outline"} onClick={() => setLinkNurseMode("new")}>
                Crear cuenta nueva
              </Button>
              <Button size="sm" variant={linkNurseMode === "existing" ? "default" : "outline"} onClick={() => setLinkNurseMode("existing")}>
                Usar cuenta existente
              </Button>
            </div>
            {linkNurseMode === "new" ? (
              <>
                <div>
                  <Label>Correo</Label>
                  <Input type="email" value={linkNurseEmail} onChange={(e) => setLinkNurseEmail(e.target.value)} placeholder="enfermera@clinica.mx" />
                </div>
                <div>
                  <Label>Contraseña inicial</Label>
                  <Input type="password" value={linkNursePassword} onChange={(e) => setLinkNursePassword(e.target.value)} placeholder="mínimo 12 caracteres" />
                </div>
              </>
            ) : (
              <div>
                <Label>Usuario existente</Label>
                <select
                  className="w-full mt-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={linkNurseExistingUserId}
                  onChange={(e) => setLinkNurseExistingUserId(e.target.value)}
                >
                  <option value="">Selecciona…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.email}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkNurse(null)}>Cancelar</Button>
            <Button onClick={handleLinkNurse} disabled={linkingNurse}>{linkingNurse ? "Vinculando…" : "Vincular"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
