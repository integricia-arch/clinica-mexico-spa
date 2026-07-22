import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsContent } from "@/components/ui/tabs";
import {
  Search, Users as UsersIcon, Pencil, KeyRound, Trash2, ShieldAlert, Lock, Unlock,
  Stethoscope, Link2, HeartPulse, AlertCircle,
} from "lucide-react";
import { AppRole, DoctorRow, NurseRow, NURSE_CATEGORIA_LABELS, ROLE_BADGE, ROLE_LABELS, ROLE_OPTIONS, UnlinkedDoctorRow, UsuarioRow } from "./types";

interface UsersTabProps {
  loading: boolean;
  filtered: UnlinkedDoctorRow[];
  users: UsuarioRow[];
  query: string;
  setQuery: (v: string) => void;
  roleFilter: "all" | AppRole;
  setRoleFilter: (v: "all" | AppRole) => void;
  roleCounts: Record<string, number>;
  pendingAccessCount: number;
  busyUser: string | null;
  busyBan: string | null;
  fmt: (d: string | null) => string;
  toggleRole: (user: UsuarioRow, role: AppRole) => void;
  handleToggleBan: (user: UsuarioRow) => void;
  openLinkDoctor: (d: DoctorRow) => void;
  openLinkNurse: (n: NurseRow) => void;
  setEditUser: (u: UsuarioRow) => void;
  setEditEmail: (v: string) => void;
  setPwUser: (u: UsuarioRow) => void;
  setPwValue: (v: string) => void;
  setDelUser: (u: UsuarioRow) => void;
  setPinUser: (u: UsuarioRow) => void;
  setPinValue: (v: string) => void;
  setPinConfirm: (v: string) => void;
}

export function UsersTab({
  loading, filtered, query, setQuery, roleFilter, setRoleFilter, roleCounts,
  pendingAccessCount, busyUser, busyBan, fmt, toggleRole, handleToggleBan,
  openLinkDoctor, openLinkNurse, setEditUser, setEditEmail, setPwUser, setPwValue,
  setDelUser, setPinUser, setPinValue, setPinConfirm,
}: UsersTabProps) {
  return (
    <TabsContent value="usuarios" className="space-y-4 mt-4">
      {pendingAccessCount > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              {pendingAccessCount} cuenta{pendingAccessCount === 1 ? "" : "s"} confirmada
              {pendingAccessCount === 1 ? "" : "s"} sin ningún rol asignado — entraron a la app
              pero no tienen acceso a nada hasta que se les asigne un rol.
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setRoleFilter("patient")}>
            Ver cuentas sin rol
          </Button>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por correo o ID…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "admin", "manager", "receptionist", "doctor", "nurse", "patient", "cajero"] as const).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={roleFilter === r ? "default" : "outline"}
              onClick={() => setRoleFilter(r)}
              className="h-7 text-xs"
            >
              {r === "all" ? "Todos" : ROLE_LABELS[r]} ({roleCounts[r] ?? 0})
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Usuario</th>
                <th className="text-left px-4 py-3 font-medium">Roles</th>
                <th className="text-left px-4 py-3 font-medium">Último acceso</th>
                <th className="text-left px-4 py-3 font-medium">Asignar / Remover</th>
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-8 w-64" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-8 w-32" /></td>
                </tr>
              ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <UsersIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    Sin usuarios para mostrar
                  </td>
                </tr>
              )}

              {!loading && filtered.map((u) => {
                const unlinked = u._unlinkedDoctor;
                const unlinkedN = u._unlinkedNurse;
                if (unlinked || unlinkedN) {
                  const prefix = unlinked ? "Dr(a)." : "Enf.";
                  const persona = unlinked ?? unlinkedN!;
                  const role = unlinked ? "doctor" : "nurse";
                  return (
                    <tr key={u.id} className="border-t border-border align-top bg-amber-500/5">
                      <td className="px-4 py-3">
                        <div className="font-medium flex items-center gap-1.5">
                          {prefix} {persona.nombre} {persona.apellidos}
                          <Badge variant="outline" className="gap-1 text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300">
                            <AlertCircle className="h-3 w-3" /> Sin cuenta
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {unlinked ? unlinked.especialidad : NURSE_CATEGORIA_LABELS[unlinkedN!.categoria]}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={ROLE_BADGE[role]}>{ROLE_LABELS[role]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">—</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        Sin cuenta de acceso. Crea una cuenta para asignar roles.
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" onClick={() => unlinked ? openLinkDoctor(unlinked) : openLinkNurse(unlinkedN!)}>
                            <Link2 className="h-3.5 w-3.5 mr-1" /> Crear y vincular
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                <tr key={u.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium flex items-center gap-1.5 flex-wrap">
                      {u._linkedDoctor ? (
                        <>
                          <Stethoscope className="h-3.5 w-3.5 text-emerald-600" />
                          Dr(a). {u._linkedDoctor.nombre} {u._linkedDoctor.apellidos}
                        </>
                      ) : u._linkedNurse ? (
                        <>
                          <HeartPulse className="h-3.5 w-3.5 text-amber-600" />
                          Enf. {u._linkedNurse.nombre} {u._linkedNurse.apellidos}
                        </>
                      ) : (
                        u.email ?? "(sin correo)"
                      )}
                      {u.is_permanent_admin && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <ShieldAlert className="h-3 w-3" /> Permanente
                        </Badge>
                      )}
                      {u.banned && (
                        <Badge variant="outline" className="gap-1 text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300">
                          <Lock className="h-3 w-3" /> Deshabilitada
                        </Badge>
                      )}
                    </div>
                    {u._linkedDoctor && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {u._linkedDoctor.especialidad} · {u.email}
                      </div>
                    )}
                    {u._linkedNurse && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {NURSE_CATEGORIA_LABELS[u._linkedNurse.categoria]} · {u.email}
                      </div>
                    )}
                    {!u._linkedDoctor && !u._linkedNurse && (
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{u.id.slice(0, 8)}…</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Sin rol</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {u.roles.map((r) => (
                          <Badge key={r} className={ROLE_BADGE[r as AppRole]}>
                            {ROLE_LABELS[r as AppRole] ?? r}
                          </Badge>
                        ))}
                        {(u.roles.includes("admin") || u.roles.includes("manager")) && (
                          <button
                            onClick={() => { setPinUser(u); setPinValue(""); setPinConfirm(""); }}
                            className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 underline ml-1"
                          >
                            <KeyRound className="h-3 w-3" /> PIN
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{fmt(u.last_sign_in_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {ROLE_OPTIONS.map((role) => {
                        const has = u.roles.includes(role);
                        return (
                          <Button
                            key={role}
                            size="sm"
                            variant={has ? "default" : "outline"}
                            disabled={busyUser === u.id}
                            onClick={() => toggleRole(u, role)}
                            className="h-7 text-xs"
                          >
                            {has ? "✓ " : "+ "}{ROLE_LABELS[role]}
                          </Button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        title={u.banned ? "Habilitar acceso" : "Deshabilitar acceso (no elimina la cuenta)"}
                        className={u.banned ? "text-amber-600 hover:text-amber-700" : ""}
                        disabled={u.is_permanent_admin || busyBan === u.id}
                        onClick={() => handleToggleBan(u)}
                      >
                        {u.banned ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditUser(u); setEditEmail(u.email ?? ""); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setPwUser(u); setPwValue(""); }}>
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={u.is_permanent_admin}
                        onClick={() => setDelUser(u)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </TabsContent>
  );
}
