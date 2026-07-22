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
import { Loader2 } from "lucide-react";
import { DoctorForm, DoctorRow, ServicioCatalog, UsuarioRow } from "./types";

interface DoctorDialogsProps {
  // Crear/editar médico
  doctorDialogOpen: boolean;
  setDoctorDialogOpen: (v: boolean) => void;
  doctorEdit: DoctorRow | null;
  doctorForm: DoctorForm;
  setDoctorForm: (f: DoctorForm) => void;
  savingDoctor: boolean;
  handleSaveDoctor: () => void;

  // Servicios
  serviciosDialog: { doctor: DoctorRow } | null;
  setServiciosDialog: (v: { doctor: DoctorRow } | null) => void;
  loadingServicios: boolean;
  catalogoServicios: ServicioCatalog[];
  asignadosIds: Set<string>;
  toggleServicio: (id: string) => void;
  savingServicios: boolean;
  saveServicios: () => void;

  // Eliminar médico
  doctorDel: DoctorRow | null;
  setDoctorDel: (v: DoctorRow | null) => void;
  deletingDoctor: boolean;
  handleDeleteDoctor: () => void;

  // Desvincular médico
  unlinkDoctor: DoctorRow | null;
  setUnlinkDoctor: (v: DoctorRow | null) => void;
  unlinking: boolean;
  handleUnlinkDoctor: () => void;

  // Vincular médico
  linkDoctor: DoctorRow | null;
  setLinkDoctor: (v: DoctorRow | null) => void;
  linkMode: "new" | "existing";
  setLinkMode: (v: "new" | "existing") => void;
  linkEmail: string;
  setLinkEmail: (v: string) => void;
  linkPassword: string;
  setLinkPassword: (v: string) => void;
  linkExistingUserId: string;
  setLinkExistingUserId: (v: string) => void;
  linking: boolean;
  handleLinkDoctor: () => void;
  users: UsuarioRow[];
}

export function DoctorDialogs(props: DoctorDialogsProps) {
  const {
    doctorDialogOpen, setDoctorDialogOpen, doctorEdit, doctorForm, setDoctorForm, savingDoctor, handleSaveDoctor,
    serviciosDialog, setServiciosDialog, loadingServicios, catalogoServicios, asignadosIds, toggleServicio, savingServicios, saveServicios,
    doctorDel, setDoctorDel, deletingDoctor, handleDeleteDoctor,
    unlinkDoctor, setUnlinkDoctor, unlinking, handleUnlinkDoctor,
    linkDoctor, setLinkDoctor, linkMode, setLinkMode, linkEmail, setLinkEmail, linkPassword, setLinkPassword,
    linkExistingUserId, setLinkExistingUserId, linking, handleLinkDoctor, users,
  } = props;

  return (
    <>
      {/* Dialog: Crear / Editar médico */}
      <Dialog open={doctorDialogOpen} onOpenChange={setDoctorDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{doctorEdit ? "Editar médico" : "Nuevo médico"}</DialogTitle>
            <DialogDescription>
              {doctorEdit
                ? `Actualiza los datos de Dr(a). ${doctorEdit.nombre} ${doctorEdit.apellidos}.`
                : "Registra un nuevo médico en el sistema clínico."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Nombre(s) *</Label>
              <Input value={doctorForm.nombre} maxLength={80}
                onChange={(e) => setDoctorForm({ ...doctorForm, nombre: e.target.value })} />
            </div>
            <div>
              <Label>Apellidos *</Label>
              <Input value={doctorForm.apellidos} maxLength={80}
                onChange={(e) => setDoctorForm({ ...doctorForm, apellidos: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Especialidad *</Label>
              <Input value={doctorForm.especialidad} maxLength={100} placeholder="Ej. Medicina General, Pediatría…"
                onChange={(e) => setDoctorForm({ ...doctorForm, especialidad: e.target.value })} />
            </div>
            <div>
              <Label>Cédula profesional</Label>
              <Input value={doctorForm.cedula_profesional} maxLength={20} placeholder="Ej. 12345678"
                onChange={(e) => setDoctorForm({ ...doctorForm, cedula_profesional: e.target.value })} />
              <p className="text-[11px] text-muted-foreground mt-1">SEP / DGP. Solo letras, números y guiones.</p>
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={doctorForm.telefono} maxLength={20} placeholder="+52 55 1234 5678"
                onChange={(e) => setDoctorForm({ ...doctorForm, telefono: e.target.value })} />
            </div>
            <div>
              <Label>Horario de inicio *</Label>
              <Input type="time" value={doctorForm.horario_inicio}
                onChange={(e) => setDoctorForm({ ...doctorForm, horario_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Horario de fin *</Label>
              <Input type="time" value={doctorForm.horario_fin}
                onChange={(e) => setDoctorForm({ ...doctorForm, horario_fin: e.target.value })} />
            </div>
            <div>
              <Label>Duración de cita (min) *</Label>
              <Input type="number" min={5} max={240} value={doctorForm.duracion_cita_min}
                onChange={(e) => setDoctorForm({ ...doctorForm, duracion_cita_min: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Modelo de cobro *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={doctorForm.modo_cobro}
                onChange={(e) => setDoctorForm({ ...doctorForm, modo_cobro: e.target.value as "clinica" | "directo" })}
              >
                <option value="clinica">A la clínica (paga honorarios al doctor)</option>
                <option value="directo">Directo al doctor (fuera de caja de la clínica)</option>
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                "Directo": el paciente le paga al doctor, no se genera ingreso/póliza en la clínica. Los insumos consumidos sí se registran igual.
              </p>
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={doctorForm.activo}
                  onChange={(e) => setDoctorForm({ ...doctorForm, activo: e.target.checked })} />
                Médico activo
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDoctorDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveDoctor} disabled={savingDoctor}>
              {savingDoctor ? "Guardando…" : doctorEdit ? "Guardar cambios" : "Crear médico"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Servicios del médico */}
      <Dialog open={!!serviciosDialog} onOpenChange={(o) => !o && setServiciosDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Servicios — Dr(a). {serviciosDialog?.doctor.nombre} {serviciosDialog?.doctor.apellidos}</DialogTitle>
            <DialogDescription>Selecciona los servicios que ofrece este médico.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-1 py-2">
            {loadingServicios ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
            ) : catalogoServicios.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">Sin servicios en el catálogo. Agrégalos en Ajustes → Servicios.</p>
            ) : catalogoServicios.map((s) => (
              <label key={s.id} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={asignadosIds.has(s.id)}
                  onChange={() => toggleServicio(s.id)}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="flex-1 text-sm font-medium">{s.nombre}</span>
                <span className="text-xs text-muted-foreground">{s.duracion_minutos} min</span>
                {s.precio_centavos > 0 && (
                  <span className="text-xs text-muted-foreground">${(s.precio_centavos / 100).toLocaleString("es-MX")}</span>
                )}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiciosDialog(null)} disabled={savingServicios}>Cancelar</Button>
            <Button onClick={saveServicios} disabled={savingServicios || loadingServicios}>
              {savingServicios ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación de médico */}
      <AlertDialog open={!!doctorDel} onOpenChange={(o) => !o && setDoctorDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a Dr(a). {doctorDel?.nombre} {doctorDel?.apellidos}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es permanente. Si el médico tiene citas, recetas o expedientes asociados,
              no podrá eliminarse — en ese caso márcalo como <strong>Inactivo</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDoctor}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDoctor} disabled={deletingDoctor} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingDoctor ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar desvincular médico */}
      <AlertDialog open={!!unlinkDoctor} onOpenChange={(o) => !o && setUnlinkDoctor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desvincular cuenta de Dr(a). {unlinkDoctor?.nombre} {unlinkDoctor?.apellidos}?</AlertDialogTitle>
            <AlertDialogDescription>
              La cuenta de usuario no se elimina. El médico quedará sin acceso al sistema hasta que se vincule otra cuenta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlinkDoctor} disabled={unlinking} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {unlinking ? "Desvinculando…" : "Desvincular"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Vincular médico */}
      <Dialog open={!!linkDoctor} onOpenChange={(o) => !o && setLinkDoctor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular cuenta a médico</DialogTitle>
            <DialogDescription>
              Dr(a). {linkDoctor?.nombre} {linkDoctor?.apellidos}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-1.5">
              <Button size="sm" variant={linkMode === "new" ? "default" : "outline"} onClick={() => setLinkMode("new")}>
                Crear cuenta nueva
              </Button>
              <Button size="sm" variant={linkMode === "existing" ? "default" : "outline"} onClick={() => setLinkMode("existing")}>
                Usar cuenta existente
              </Button>
            </div>
            {linkMode === "new" ? (
              <>
                <div>
                  <Label>Correo</Label>
                  <Input type="email" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} placeholder="medico@clinica.mx" />
                </div>
                <div>
                  <Label>Contraseña inicial</Label>
                  <Input type="password" value={linkPassword} onChange={(e) => setLinkPassword(e.target.value)} placeholder="mínimo 12 caracteres" />
                </div>
              </>
            ) : (
              <div>
                <Label>Usuario existente</Label>
                <select
                  className="w-full mt-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={linkExistingUserId}
                  onChange={(e) => setLinkExistingUserId(e.target.value)}
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
            <Button variant="outline" onClick={() => setLinkDoctor(null)}>Cancelar</Button>
            <Button onClick={handleLinkDoctor} disabled={linking}>{linking ? "Vinculando…" : "Vincular"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
