import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsContent } from "@/components/ui/tabs";
import {
  Stethoscope, Pencil, ClipboardList, Unlink, Link2, Trash2, CheckCircle2, AlertCircle,
  CalendarDays, Plus,
} from "lucide-react";
import { DoctorRow } from "./types";

interface DoctorsTabProps {
  doctorsEnriched: DoctorRow[];
  loadingDoctors: boolean;
  doctorCalendars: Record<string, string>;
  googleClientIdPublic: string;
  generateGoogleOAuthUrl: (doctorId: string) => string;
  openDoctorNew: () => void;
  openDoctorEdit: (d: DoctorRow) => void;
  openServiciosDialog: (d: DoctorRow) => void;
  setUnlinkDoctor: (d: DoctorRow) => void;
  openLinkDoctor: (d: DoctorRow) => void;
  setDoctorDel: (d: DoctorRow) => void;
}

export function DoctorsTab({
  doctorsEnriched, loadingDoctors, doctorCalendars, googleClientIdPublic, generateGoogleOAuthUrl,
  openDoctorNew, openDoctorEdit, openServiciosDialog, setUnlinkDoctor, openLinkDoctor, setDoctorDel,
}: DoctorsTabProps) {
  return (
    <TabsContent value="medicos" className="space-y-4 mt-4">
      <div className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Lista de todos los médicos registrados. Edita los datos (cédula, horario, especialidad…)
          o crea uno nuevo. Si un médico no tiene cuenta vinculada, no podrá iniciar sesión ni firmar recetas.
        </p>
        <Button onClick={openDoctorNew}>
          <Plus className="h-4 w-4 mr-1.5" /> Nuevo médico
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Médico</th>
                <th className="text-left px-4 py-3 font-medium">Especialidad</th>
                <th className="text-left px-4 py-3 font-medium">Cédula</th>
                <th className="text-left px-4 py-3 font-medium">Horario / Cita</th>
                <th className="text-left px-4 py-3 font-medium">Cuenta</th>
                <th className="text-left px-4 py-3 font-medium">Google Calendar</th>
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loadingDoctors && Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-3" colSpan={7}><Skeleton className="h-6 w-full" /></td>
                </tr>
              ))}
              {!loadingDoctors && doctorsEnriched.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  <Stethoscope className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  Sin médicos registrados
                </td></tr>
              )}
              {!loadingDoctors && doctorsEnriched.map((d) => (
                <tr key={d.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">Dr(a). {d.nombre} {d.apellidos}</div>
                    {d.telefono && <div className="text-xs text-muted-foreground">{d.telefono}</div>}
                    {!d.activo && <Badge variant="outline" className="text-[10px] mt-0.5">Inactivo</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{d.especialidad}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.cedula_profesional ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {(d.horario_inicio ?? "").slice(0, 5)}–{(d.horario_fin ?? "").slice(0, 5)}
                    <div>{d.duracion_cita_min ?? 30} min</div>
                  </td>
                  <td className="px-4 py-3">
                    {d.user_id ? (
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs">{d.user_email ?? d.user_id.slice(0, 8) + "…"}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-xs">Sin cuenta</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {doctorCalendars[d.id] ? (
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                        <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={doctorCalendars[d.id]}>
                          {doctorCalendars[d.id]}
                        </span>
                      </div>
                    ) : googleClientIdPublic ? (
                      <button
                        onClick={() => window.open(generateGoogleOAuthUrl(d.id), "_blank", "width=600,height=700")}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                        Conectar
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1 flex-wrap">
                      <Button size="sm" variant="ghost" onClick={() => openDoctorEdit(d)} title="Editar datos">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openServiciosDialog(d)} title="Servicios">
                        <ClipboardList className="h-3.5 w-3.5" />
                      </Button>
                      {d.user_id ? (
                        <Button size="sm" variant="outline" onClick={() => setUnlinkDoctor(d)}>
                          <Unlink className="h-3.5 w-3.5 mr-1" /> Desvincular
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => openLinkDoctor(d)}>
                          <Link2 className="h-3.5 w-3.5 mr-1" /> Crear y vincular
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDoctorDel(d)}
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
