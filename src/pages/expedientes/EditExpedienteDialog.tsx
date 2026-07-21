import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { DoctorMini, Expediente } from "./types";
import { TIPO_LABELS } from "./types";

export function EditExpedienteDialog({
  open, onClose, editTarget, canEdit, canReassign, doctors,
  form, onFormChange, keepPrevAccess, onKeepPrevAccessChange, saving, onSave,
}: {
  open: boolean;
  onClose: () => void;
  editTarget: Expediente | null;
  canEdit: boolean;
  canReassign: boolean;
  doctors: DoctorMini[];
  form: { doctor_id: string; tipo: string };
  onFormChange: (form: { doctor_id: string; tipo: string }) => void;
  keepPrevAccess: boolean;
  onKeepPrevAccessChange: (v: boolean) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Editar expediente</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {editTarget && canEdit && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={form.tipo} onValueChange={(v) => onFormChange({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {editTarget && canReassign && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Médico responsable</label>
              <Select value={form.doctor_id} onValueChange={(v) => onFormChange({ ...form, doctor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar médico" /></SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>Dr(a). {d.nombre} {d.apellidos}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {editTarget && form.doctor_id !== editTarget.doctor_id && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={keepPrevAccess}
                onChange={(e) => onKeepPrevAccessChange(e.target.checked)}
                className="rounded"
              />
              Mantener acceso de edición al médico anterior
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
