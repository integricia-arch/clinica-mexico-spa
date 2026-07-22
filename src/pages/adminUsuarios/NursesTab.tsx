import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsContent } from "@/components/ui/tabs";
import { HeartPulse, Pencil, Unlink, Link2, Trash2, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { NURSE_CATEGORIA_LABELS, NurseRow } from "./types";

interface NursesTabProps {
  nursesEnriched: NurseRow[];
  loadingNurses: boolean;
  openNurseNew: () => void;
  openNurseEdit: (n: NurseRow) => void;
  setUnlinkNurse: (n: NurseRow) => void;
  openLinkNurse: (n: NurseRow) => void;
  setNurseDel: (n: NurseRow) => void;
}

export function NursesTab({
  nursesEnriched, loadingNurses, openNurseNew, openNurseEdit, setUnlinkNurse, openLinkNurse, setNurseDel,
}: NursesTabProps) {
  return (
    <TabsContent value="enfermeras" className="space-y-4 mt-4">
      <div className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Lista de todas las enfermeras registradas. Edita los datos (cédula, categoría, horario…)
          o crea una nueva. Si una enfermera no tiene cuenta vinculada, no podrá iniciar sesión.
        </p>
        <Button onClick={openNurseNew}>
          <Plus className="h-4 w-4 mr-1.5" /> Nueva enfermera
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Enfermera</th>
                <th className="text-left px-4 py-3 font-medium">Categoría</th>
                <th className="text-left px-4 py-3 font-medium">Cédula</th>
                <th className="text-left px-4 py-3 font-medium">Horario</th>
                <th className="text-left px-4 py-3 font-medium">Cuenta</th>
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loadingNurses && Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-3" colSpan={6}><Skeleton className="h-6 w-full" /></td>
                </tr>
              ))}
              {!loadingNurses && nursesEnriched.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <HeartPulse className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  Sin enfermeras registradas
                </td></tr>
              )}
              {!loadingNurses && nursesEnriched.map((n) => (
                <tr key={n.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">Enf. {n.nombre} {n.apellidos}</div>
                    {n.telefono && <div className="text-xs text-muted-foreground">{n.telefono}</div>}
                    {!n.activo && <Badge variant="outline" className="text-[10px] mt-0.5">Inactiva</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{NURSE_CATEGORIA_LABELS[n.categoria]}</td>
                  <td className="px-4 py-3 font-mono text-xs">{n.cedula_profesional ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {(n.horario_inicio ?? "").slice(0, 5)}–{(n.horario_fin ?? "").slice(0, 5)}
                  </td>
                  <td className="px-4 py-3">
                    {n.user_id ? (
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs">{n.user_email ?? n.user_id.slice(0, 8) + "…"}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-xs">Sin cuenta</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1 flex-wrap">
                      <Button size="sm" variant="ghost" onClick={() => openNurseEdit(n)} title="Editar datos">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {n.user_id ? (
                        <Button size="sm" variant="outline" onClick={() => setUnlinkNurse(n)}>
                          <Unlink className="h-3.5 w-3.5 mr-1" /> Desvincular
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => openLinkNurse(n)}>
                          <Link2 className="h-3.5 w-3.5 mr-1" /> Crear y vincular
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setNurseDel(n)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </TabsContent>
  );
}
