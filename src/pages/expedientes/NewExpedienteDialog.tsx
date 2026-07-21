import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { PersonaMini, DoctorMini } from "./types";
import { TIPO_LABELS } from "./types";

export function NewExpedienteDialog({
  open, onClose, patients, doctors, form, onFormChange, saving, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  patients: PersonaMini[];
  doctors: DoctorMini[];
  form: { patient_id: string; doctor_id: string; tipo: string };
  onFormChange: (form: { patient_id: string; doctor_id: string; tipo: string }) => void;
  saving: boolean;
  onCreate: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nuevo expediente</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Paciente *</label>
            <Select value={form.patient_id} onValueChange={(v) => onFormChange({ ...form, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar paciente" /></SelectTrigger>
              <SelectContent>
                {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.apellidos}, {p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Médico responsable *</label>
            <Select value={form.doctor_id} onValueChange={(v) => onFormChange({ ...form, doctor_id: v })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar médico" /></SelectTrigger>
              <SelectContent>
                {doctors.map((d) => <SelectItem key={d.id} value={d.id}>Dr(a). {d.nombre} {d.apellidos}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tipo</label>
            <Select value={form.tipo} onValueChange={(v) => onFormChange({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onCreate} disabled={saving}>
            {saving ? "Creando..." : "Crear expediente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
