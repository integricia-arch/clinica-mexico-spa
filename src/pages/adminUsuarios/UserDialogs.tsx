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
import { KeyRound } from "lucide-react";
import { AppRole, ROLE_LABELS, ROLE_OPTIONS, UsuarioRow } from "./types";

interface UserDialogsProps {
  // Crear usuario
  createOpen: boolean;
  setCreateOpen: (v: boolean) => void;
  createEmail: string;
  setCreateEmail: (v: string) => void;
  createPassword: string;
  setCreatePassword: (v: string) => void;
  createRole: AppRole;
  setCreateRole: (v: AppRole) => void;
  createPin: string;
  setCreatePin: (v: string) => void;
  createPinConfirm: string;
  setCreatePinConfirm: (v: string) => void;
  creating: boolean;
  handleCreate: () => void;

  // Editar correo
  editUser: UsuarioRow | null;
  setEditUser: (v: UsuarioRow | null) => void;
  editEmail: string;
  setEditEmail: (v: string) => void;
  savingEdit: boolean;
  handleEdit: () => void;

  // Cambiar contraseña individual
  pwUser: UsuarioRow | null;
  setPwUser: (v: UsuarioRow | null) => void;
  pwValue: string;
  setPwValue: (v: string) => void;
  savingPw: boolean;
  handleSetPassword: () => void;

  // Contraseña base masiva
  baseOpen: boolean;
  setBaseOpen: (v: boolean) => void;
  basePw: string;
  setBasePw: (v: string) => void;
  applyingBase: boolean;
  handleApplyBase: () => void;

  // Eliminar usuario
  delUser: UsuarioRow | null;
  setDelUser: (v: UsuarioRow | null) => void;
  deleting: boolean;
  handleDelete: () => void;

  // PIN de supervisor
  pinUser: UsuarioRow | null;
  setPinUser: (v: UsuarioRow | null) => void;
  pinValue: string;
  setPinValue: (v: string) => void;
  pinConfirm: string;
  setPinConfirm: (v: string) => void;
  savingPin: boolean;
  handleSavePin: () => void;
}

export function UserDialogs(props: UserDialogsProps) {
  const {
    createOpen, setCreateOpen, createEmail, setCreateEmail, createPassword, setCreatePassword,
    createRole, setCreateRole, createPin, setCreatePin, createPinConfirm, setCreatePinConfirm, creating, handleCreate,
    editUser, setEditUser, editEmail, setEditEmail, savingEdit, handleEdit,
    pwUser, setPwUser, pwValue, setPwValue, savingPw, handleSetPassword,
    baseOpen, setBaseOpen, basePw, setBasePw, applyingBase, handleApplyBase,
    delUser, setDelUser, deleting, handleDelete,
    pinUser, setPinUser, pinValue, setPinValue, pinConfirm, setPinConfirm, savingPin, handleSavePin,
  } = props;

  return (
    <>
      {/* Crear usuario */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>Se creará confirmado y podrá iniciar sesión de inmediato.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Correo</Label>
              <Input type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} placeholder="correo@clinica.mx" />
            </div>
            <div>
              <Label>Contraseña inicial</Label>
              <Input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} placeholder="mínimo 12 caracteres" />
            </div>
            <div>
              <Label>Rol</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {ROLE_OPTIONS.map((r) => (
                  <Button
                    key={r}
                    type="button"
                    size="sm"
                    variant={createRole === r ? "default" : "outline"}
                    onClick={() => setCreateRole(r)}
                  >
                    {ROLE_LABELS[r]}
                  </Button>
                ))}
              </div>
            </div>
            {["admin", "manager"].includes(createRole) && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="create-pin">
                    PIN de autorización <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Requerido para admin/gerente. Se usará para autorizar cierres de turno con diferencia.
                  </p>
                  <Input
                    id="create-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="4-6 dígitos"
                    value={createPin}
                    onChange={(e) => setCreatePin(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-pin-confirm">Confirmar PIN</Label>
                  <Input
                    id="create-pin-confirm"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Repite el PIN"
                    value={createPinConfirm}
                    onChange={(e) => setCreatePinConfirm(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "Creando…" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar correo */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>Actualiza el correo del usuario.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Correo</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={savingEdit}>{savingEdit ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cambiar contraseña individual */}
      <Dialog open={!!pwUser} onOpenChange={(o) => !o && setPwUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>{pwUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nueva contraseña</Label>
              <Input type="password" value={pwValue} onChange={(e) => setPwValue(e.target.value)} placeholder="mínimo 12 caracteres" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwUser(null)}>Cancelar</Button>
            <Button onClick={handleSetPassword} disabled={savingPw}>{savingPw ? "Aplicando…" : "Cambiar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contraseña base masiva */}
      <Dialog open={baseOpen} onOpenChange={setBaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar contraseña base</DialogTitle>
            <DialogDescription>
              Se aplicará a <strong>todos los usuarios</strong> excepto los administradores permanentes.
              Comunícala de forma segura y pide a cada usuario cambiarla al iniciar sesión.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Contraseña base</Label>
              <Input type="password" value={basePw} onChange={(e) => setBasePw(e.target.value)} placeholder="mínimo 12 caracteres" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBaseOpen(false)}>Cancelar</Button>
            <Button onClick={handleApplyBase} disabled={applyingBase}>
              {applyingBase ? "Aplicando…" : "Aplicar a todos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <AlertDialog open={!!delUser} onOpenChange={(o) => !o && setDelUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {delUser?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es permanente y eliminará el acceso del usuario al sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Set supervisor PIN */}
      <Dialog open={!!pinUser} onOpenChange={(v) => !v && setPinUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> PIN de autorización
            </DialogTitle>
            <DialogDescription>
              Configura el PIN para <strong>{pinUser?.email}</strong>.
              Déjalo vacío para conservar el PIN actual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="set-pin">Nuevo PIN (4-6 dígitos)</Label>
              <Input
                id="set-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="4-6 dígitos numéricos"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-pin-confirm">Confirmar PIN</Label>
              <Input
                id="set-pin-confirm"
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Repite el PIN"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinUser(null)}>Cancelar</Button>
            <Button disabled={savingPin} onClick={handleSavePin}>
              {savingPin ? "Guardando…" : "Guardar PIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
