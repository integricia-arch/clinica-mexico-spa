import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { DoctorMini, Expediente, ExpPermRow } from "./types";

export function PermissionsDialog({
  open, onClose, permTarget, expPermissions, doctors,
  newPermDoctorId, onNewPermDoctorIdChange, newPermLevel, onNewPermLevelChange,
  permSaving, onAdd, onRemove, onChangeLevel,
}: {
  open: boolean;
  onClose: () => void;
  permTarget: Expediente | null;
  expPermissions: ExpPermRow[];
  doctors: DoctorMini[];
  newPermDoctorId: string;
  onNewPermDoctorIdChange: (v: string) => void;
  newPermLevel: "view" | "edit";
  onNewPermLevelChange: (v: "view" | "edit") => void;
  permSaving: boolean;
  onAdd: () => void;
  onRemove: (permId: string) => void;
  onChangeLevel: (permId: string, level: "view" | "edit") => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gestionar acceso — {permTarget?.patients?.apellidos}, {permTarget?.patients?.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Current grants */}
          {expPermissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin permisos adicionales asignados</p>
          ) : (
            <div className="space-y-2">
              {expPermissions.map((perm) => (
                <div key={perm.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <p className="text-sm font-medium">
                    Dr(a). {perm.doctors?.nombre} {perm.doctors?.apellidos}
                  </p>
                  <div className="flex items-center gap-2">
                    <Select
                      value={perm.permission}
                      onValueChange={(v) => onChangeLevel(perm.id, v as "view" | "edit")}
                    >
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view">Solo ver</SelectItem>
                        <SelectItem value="edit">Editar</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onRemove(perm.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new grant */}
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Añadir médico</p>
            <div className="flex gap-2">
              <Select value={newPermDoctorId} onValueChange={onNewPermDoctorIdChange}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleccionar médico" />
                </SelectTrigger>
                <SelectContent>
                  {doctors
                    .filter((d) => d.id !== permTarget?.doctor_id && !expPermissions.some((p) => p.doctor_id === d.id))
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>Dr(a). {d.nombre} {d.apellidos}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select value={newPermLevel} onValueChange={(v) => onNewPermLevelChange(v as "view" | "edit")}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">Solo ver</SelectItem>
                  <SelectItem value="edit">Editar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!newPermDoctorId || permSaving}
              onClick={onAdd}
            >
              {permSaving ? "Añadiendo..." : "Añadir acceso"}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
