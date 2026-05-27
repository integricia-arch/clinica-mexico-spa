import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ShieldCheck, Search, Users as UsersIcon, UserPlus, Pencil, KeyRound,
  Trash2, ShieldAlert, Lock, Stethoscope, Link2, Unlink, CheckCircle2, AlertCircle, Plus,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type AppRole = "admin" | "receptionist" | "doctor" | "nurse" | "patient";

const ROLE_OPTIONS: AppRole[] = ["admin", "receptionist", "doctor", "nurse", "patient"];

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  receptionist: "Recepción",
  doctor: "Médico",
  nurse: "Enfermería",
  patient: "Paciente",
};

const ROLE_BADGE: Record<AppRole, string> = {
  admin: "bg-primary text-primary-foreground",
  receptionist: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  doctor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  nurse: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  patient: "bg-muted text-muted-foreground",
};

interface UsuarioRow {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  roles: AppRole[];
  is_permanent_admin?: boolean;
}

interface DoctorRow {
  id: string;
  nombre: string;
  apellidos: string;
  especialidad: string;
  cedula_profesional: string | null;
  telefono: string | null;
  activo: boolean;
  user_id: string | null;
  user_email?: string | null;
}

export default function AdminUsuarios() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UsuarioRow[]>([]);
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");
  const [query, setQuery] = useState("");
  const [busyUser, setBusyUser] = useState<string | null>(null);

  // Diálogos
  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<AppRole>("patient");
  const [creating, setCreating] = useState(false);

  const [editUser, setEditUser] = useState<UsuarioRow | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [pwUser, setPwUser] = useState<UsuarioRow | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const [delUser, setDelUser] = useState<UsuarioRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [baseOpen, setBaseOpen] = useState(false);
  const [basePw, setBasePw] = useState("");
  const [applyingBase, setApplyingBase] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "list" } });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast.error("No se pudieron cargar los usuarios");
      return;
    }
    setUsers(((data as any)?.users ?? []) as UsuarioRow[]);
  };

  const fetchDoctors = async () => {
    setLoadingDoctors(true);
    const { data, error } = await supabase
      .from("doctors")
      .select("id, nombre, apellidos, especialidad, cedula_profesional, telefono, activo, user_id")
      .order("apellidos");
    setLoadingDoctors(false);
    if (error) {
      toast.error("No se pudieron cargar los médicos");
      return;
    }
    setDoctors((data ?? []) as DoctorRow[]);
  };

  useEffect(() => {
    fetchUsers();
    fetchDoctors();
  }, []);

  // Enriquecer doctores con email del usuario vinculado
  const doctorsEnriched = useMemo<DoctorRow[]>(() => {
    const byId = new Map(users.map((u) => [u.id, u.email]));
    return doctors.map((d) => ({ ...d, user_email: d.user_id ? byId.get(d.user_id) ?? null : null }));
  }, [doctors, users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = users;
    if (roleFilter !== "all") {
      list = list.filter((u) =>
        roleFilter === "patient"
          ? u.roles.includes("patient") || u.roles.length === 0
          : u.roles.includes(roleFilter),
      );
    }
    if (!q) return list;
    return list.filter((u) =>
      u.email?.toLowerCase().includes(q) || u.id.toLowerCase().includes(q),
    );
  }, [users, query, roleFilter]);

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = { all: users.length, admin: 0, receptionist: 0, doctor: 0, nurse: 0, patient: 0 };
    for (const u of users) {
      for (const r of u.roles) c[r] = (c[r] ?? 0) + 1;
      if (u.roles.length === 0) c.patient += 1;
    }
    return c;
  }, [users]);

  const toggleRole = async (user: UsuarioRow, role: AppRole) => {
    const has = user.roles.includes(role);
    setBusyUser(user.id);
    try {
      if (has) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", role);
        if (error) throw error;
        setUsers((prev) => prev.map((u) =>
          u.id === user.id ? { ...u, roles: u.roles.filter((r) => r !== role) } : u
        ));
        toast.success(`Rol "${ROLE_LABELS[role]}" removido`);
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role });
        if (error) throw error;
        setUsers((prev) => prev.map((u) =>
          u.id === user.id ? { ...u, roles: [...u.roles, role] } : u
        ));
        toast.success(`Rol "${ROLE_LABELS[role]}" asignado`);
      }
    } catch (err: any) {
      toast.error(err.message || "No se pudo actualizar el rol");
    } finally {
      setBusyUser(null);
    }
  };

  const handleCreate = async () => {
    if (!createEmail || !createPassword) {
      toast.error("Correo y contraseña requeridos"); return;
    }
    if (createPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres"); return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "create", email: createEmail, password: createPassword, roles: [createRole] },
    });
    setCreating(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || "No se pudo crear el usuario");
      return;
    }
    toast.success("Usuario creado");
    setCreateOpen(false);
    setCreateEmail(""); setCreatePassword(""); setCreateRole("patient");
    fetchUsers();
  };

  const handleEdit = async () => {
    if (!editUser || !editEmail) return;
    setSavingEdit(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "update", user_id: editUser.id, email: editEmail },
    });
    setSavingEdit(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || "No se pudo actualizar");
      return;
    }
    toast.success("Usuario actualizado");
    setEditUser(null);
    fetchUsers();
  };

  const handleSetPassword = async () => {
    if (!pwUser || !pwValue) return;
    if (pwValue.length < 8) { toast.error("Mínimo 8 caracteres"); return; }
    setSavingPw(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "set_password", user_id: pwUser.id, password: pwValue },
    });
    setSavingPw(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || "No se pudo cambiar la contraseña");
      return;
    }
    toast.success(`Contraseña actualizada para ${pwUser.email}`);
    setPwUser(null); setPwValue("");
  };

  const handleDelete = async () => {
    if (!delUser) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "delete", user_id: delUser.id },
    });
    setDeleting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || "No se pudo eliminar");
      return;
    }
    toast.success("Usuario eliminado");
    setDelUser(null);
    fetchUsers();
  };

  const handleApplyBase = async () => {
    if (basePw.length < 8) { toast.error("Mínimo 8 caracteres"); return; }
    setApplyingBase(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "set_base_password_all", password: basePw },
    });
    setApplyingBase(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || "No se pudo aplicar la contraseña base");
      return;
    }
    const d = data as any;
    toast.success(`Aplicada a ${d.updated} usuario(s). Omitidos: ${d.skipped} (admin permanente)`);
    setBaseOpen(false); setBasePw("");
  };

  // ---- Vinculación de médicos ----
  const [linkDoctor, setLinkDoctor] = useState<DoctorRow | null>(null);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkPassword, setLinkPassword] = useState("");
  const [linkExistingUserId, setLinkExistingUserId] = useState<string>("");
  const [linkMode, setLinkMode] = useState<"new" | "existing">("new");
  const [linking, setLinking] = useState(false);

  const openLinkDoctor = (d: DoctorRow) => {
    setLinkDoctor(d);
    setLinkEmail("");
    setLinkPassword("");
    setLinkExistingUserId("");
    setLinkMode("new");
  };

  const handleLinkDoctor = async () => {
    if (!linkDoctor) return;
    setLinking(true);
    const payload: any = { action: "link_doctor_user", doctor_id: linkDoctor.id };
    if (linkMode === "existing") {
      if (!linkExistingUserId) { setLinking(false); toast.error("Selecciona un usuario"); return; }
      payload.existing_user_id = linkExistingUserId;
    } else {
      if (!linkEmail || linkPassword.length < 8) { setLinking(false); toast.error("Correo y contraseña (8+) requeridos"); return; }
      payload.email = linkEmail;
      payload.password = linkPassword;
    }
    const { data, error } = await supabase.functions.invoke("admin-users", { body: payload });
    setLinking(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || "No se pudo vincular");
      return;
    }
    toast.success(`Médico ${linkDoctor.nombre} ${linkDoctor.apellidos} vinculado`);
    setLinkDoctor(null);
    fetchUsers();
    fetchDoctors();
  };

  const handleUnlinkDoctor = async (d: DoctorRow) => {
    if (!confirm(`¿Desvincular la cuenta de ${d.nombre} ${d.apellidos}? La cuenta de usuario no se elimina.`)) return;
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "unlink_doctor_user", doctor_id: d.id },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || "No se pudo desvincular");
      return;
    }
    toast.success("Médico desvinculado");
    fetchDoctors();
  };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-display text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Gestión de usuarios y roles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crea, edita y asigna roles o contraseñas a cada usuario del sistema.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { fetchUsers(); fetchDoctors(); }} disabled={loading}>Recargar</Button>
          <Button variant="outline" onClick={() => setBaseOpen(true)}>
            <Lock className="h-4 w-4 mr-1.5" />
            Contraseña base
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Nuevo usuario
          </Button>
        </div>
      </div>

      <Tabs defaultValue="usuarios" className="w-full">
        <TabsList>
          <TabsTrigger value="usuarios" className="gap-1.5">
            <UsersIcon className="h-4 w-4" /> Cuentas de usuario ({users.length})
          </TabsTrigger>
          <TabsTrigger value="medicos" className="gap-1.5">
            <Stethoscope className="h-4 w-4" /> Médicos del registro ({doctors.length})
            {doctors.some((d) => !d.user_id) && (
              <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                {doctors.filter((d) => !d.user_id).length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB: Usuarios */}
        <TabsContent value="usuarios" className="space-y-4 mt-4">
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
              {(["all", "admin", "receptionist", "doctor", "nurse", "patient"] as const).map((r) => (
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

                  {!loading && filtered.map((u) => (
                    <tr key={u.id} className="border-t border-border align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium flex items-center gap-1.5">
                          {u.email ?? "(sin correo)"}
                          {u.is_permanent_admin && (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <ShieldAlert className="h-3 w-3" /> Permanente
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{u.id.slice(0, 8)}…</div>
                      </td>
                      <td className="px-4 py-3">
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Sin rol</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {u.roles.map((r) => (
                              <Badge key={r} className={ROLE_BADGE[r as AppRole]}>
                                {ROLE_LABELS[r as AppRole] ?? r}
                              </Badge>
                            ))}
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB: Médicos del registro clínico */}
        <TabsContent value="medicos" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Lista de todos los médicos registrados en el sistema clínico. Si un médico no tiene cuenta vinculada,
            no podrá iniciar sesión ni firmar recetas. Crea o vincula una cuenta desde aquí.
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Médico</th>
                    <th className="text-left px-4 py-3 font-medium">Especialidad</th>
                    <th className="text-left px-4 py-3 font-medium">Cédula</th>
                    <th className="text-left px-4 py-3 font-medium">Cuenta vinculada</th>
                    <th className="text-right px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingDoctors && Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-3" colSpan={5}><Skeleton className="h-6 w-full" /></td>
                    </tr>
                  ))}
                  {!loadingDoctors && doctorsEnriched.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      <Stethoscope className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      Sin médicos registrados
                    </td></tr>
                  )}
                  {!loadingDoctors && doctorsEnriched.map((d) => (
                    <tr key={d.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <div className="font-medium">Dr(a). {d.nombre} {d.apellidos}</div>
                        {!d.activo && <Badge variant="outline" className="text-[10px] mt-0.5">Inactivo</Badge>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{d.especialidad}</td>
                      <td className="px-4 py-3 font-mono text-xs">{d.cedula_profesional ?? "—"}</td>
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
                        <div className="flex justify-end gap-1.5">
                          {d.user_id ? (
                            <Button size="sm" variant="outline" onClick={() => handleUnlinkDoctor(d)}>
                              <Unlink className="h-3.5 w-3.5 mr-1" /> Desvincular
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => openLinkDoctor(d)}>
                              <Link2 className="h-3.5 w-3.5 mr-1" /> Crear y vincular
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

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
                  <Input type="text" value={linkPassword} onChange={(e) => setLinkPassword(e.target.value)} placeholder="mínimo 8 caracteres" />
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
              <Input type="text" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} placeholder="mínimo 8 caracteres" />
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
              <Input type="text" value={pwValue} onChange={(e) => setPwValue(e.target.value)} placeholder="mínimo 8 caracteres" />
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
              <Input type="text" value={basePw} onChange={(e) => setBasePw(e.target.value)} placeholder="mínimo 8 caracteres" />
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
    </div>
  );
}
