import { useEffect, useMemo, useState } from "react";
import { useActiveClinic } from "@/hooks/useActiveClinic";
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
  Trash2, ShieldAlert, Lock, Unlock, Stethoscope, Link2, Unlink, CheckCircle2, AlertCircle, Plus,
  HeartPulse, CalendarDays,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type AppRole = "admin" | "manager" | "receptionist" | "doctor" | "nurse" | "patient" | "cajero";

const ROLE_OPTIONS: AppRole[] = ["admin", "manager", "receptionist", "doctor", "nurse", "patient", "cajero"];

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  manager: "Gerente",
  receptionist: "Recepción",
  doctor: "Médico",
  nurse: "Enfermería",
  patient: "Paciente",
  cajero: "Cajero",
};

const ROLE_BADGE: Record<AppRole, string> = {
  admin: "bg-primary text-primary-foreground",
  manager: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  receptionist: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  doctor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  nurse: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  patient: "bg-muted text-muted-foreground",
  cajero: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
};

interface UsuarioRow {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  roles: AppRole[];
  is_permanent_admin?: boolean;
  banned?: boolean;
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
  horario_inicio?: string;
  horario_fin?: string;
  duracion_cita_min?: number;
}

type NurseCategoria = "licenciada" | "tecnica" | "auxiliar";

const NURSE_CATEGORIA_LABELS: Record<NurseCategoria, string> = {
  licenciada: "Licenciada",
  tecnica: "Técnica",
  auxiliar: "Auxiliar",
};

interface NurseRow {
  id: string;
  nombre: string;
  apellidos: string;
  categoria: NurseCategoria;
  especialidad: string | null;
  cedula_profesional: string | null;
  telefono: string | null;
  activo: boolean;
  user_id: string | null;
  user_email?: string | null;
  horario_inicio?: string;
  horario_fin?: string;
}

// Typed envelope returned by the admin-users edge function
interface AdminUsersPayload {
  error?: string;
  users?: UsuarioRow[];
  user_id?: string;
  updated?: number;
  skipped?: number;
}

export default function AdminUsuarios() {
  const { activeClinicId } = useActiveClinic();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UsuarioRow[]>([]);
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [nurses, setNurses] = useState<NurseRow[]>([]);
  const [loadingNurses, setLoadingNurses] = useState(true);
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

  const [createPin, setCreatePin] = useState("");
  const [createPinConfirm, setCreatePinConfirm] = useState("");
  const [pinUser, setPinUser] = useState<UsuarioRow | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [doctorCalendars, setDoctorCalendars] = useState<Record<string, string>>({});

  const GOOGLE_CLIENT_ID_PUBLIC = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
  const SUPABASE_FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "") + "/functions/v1";

  const generateGoogleOAuthUrl = (doctorId: string) => {
    const state = btoa(`${doctorId}:${activeClinicId ?? ""}`);
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID_PUBLIC,
      redirect_uri: `${SUPABASE_FUNCTIONS_URL}/google-oauth-callback`,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email",
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  const fetchDoctorCalendars = async () => {
    if (!activeClinicId) return;
    const { data } = await supabase.rpc("get_doctor_calendars", { p_clinic_id: activeClinicId });
    const map: Record<string, string> = {};
    ((data ?? []) as { doctor_id: string; google_email: string }[]).forEach((c) => {
      map[c.doctor_id] = c.google_email;
    });
    setDoctorCalendars(map);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "list" } });
      const payload = data as AdminUsersPayload | null;
      if (error || payload?.error) {
        toast.error("No se pudieron cargar los usuarios");
        return;
      }
      setUsers((payload?.users ?? []) as UsuarioRow[]);
    } catch {
      toast.error("Error al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    setLoadingDoctors(true);
    const { data, error } = await supabase
      .from("doctors")
      .select("id, nombre, apellidos, especialidad, cedula_profesional, telefono, activo, user_id, horario_inicio, horario_fin, duracion_cita_min")
      .order("apellidos");
    setLoadingDoctors(false);
    if (error) {
      toast.error("No se pudieron cargar los médicos");
      return;
    }
    setDoctors((data ?? []) as DoctorRow[]);
  };

  const fetchNurses = async () => {
    setLoadingNurses(true);
    const { data, error } = await supabase
      .from("nurses")
      .select("id, nombre, apellidos, categoria, especialidad, cedula_profesional, telefono, activo, user_id, horario_inicio, horario_fin")
      .order("apellidos");
    setLoadingNurses(false);
    if (error) {
      toast.error("No se pudieron cargar las enfermeras");
      return;
    }
    setNurses((data ?? []) as NurseRow[]);
  };

  useEffect(() => {
    fetchUsers();
    fetchDoctors();
    fetchNurses();
    fetchDoctorCalendars();
  }, [activeClinicId]);

  // Enriquecer doctores con email del usuario vinculado
  const doctorsEnriched = useMemo<DoctorRow[]>(() => {
    const byId = new Map(users.map((u) => [u.id, u.email]));
    return doctors.map((d) => ({ ...d, user_email: d.user_id ? byId.get(d.user_id) ?? null : null }));
  }, [doctors, users]);

  // Mapa: user_id → médico vinculado (para mostrar nombre del doctor en filas de usuario)
  const doctorByUserId = useMemo(() => {
    const m = new Map<string, DoctorRow>();
    for (const d of doctors) if (d.user_id) m.set(d.user_id, d);
    return m;
  }, [doctors]);

  // Enriquecer enfermeras con email del usuario vinculado
  const nursesEnriched = useMemo<NurseRow[]>(() => {
    const byId = new Map(users.map((u) => [u.id, u.email]));
    return nurses.map((n) => ({ ...n, user_email: n.user_id ? byId.get(n.user_id) ?? null : null }));
  }, [nurses, users]);

  // Mapa: user_id → enfermera vinculada
  const nurseByUserId = useMemo(() => {
    const m = new Map<string, NurseRow>();
    for (const n of nurses) if (n.user_id) m.set(n.user_id, n);
    return m;
  }, [nurses]);

  // Filas virtuales para médicos/enfermeras sin cuenta vinculada (para que aparezcan en la pestaña de usuarios)
  type UnlinkedDoctorRow = UsuarioRow & {
    _unlinkedDoctor?: DoctorRow; _linkedDoctor?: DoctorRow;
    _unlinkedNurse?: NurseRow; _linkedNurse?: NurseRow;
  };
  const unlinkedDoctorRows = useMemo<UnlinkedDoctorRow[]>(() => {
    return doctors
      .filter((d) => !d.user_id && d.activo)
      .map((d) => ({
        id: `doctor:${d.id}`,
        email: null,
        created_at: null,
        last_sign_in_at: null,
        roles: ["doctor" as AppRole],
        is_permanent_admin: false,
        _unlinkedDoctor: d,
      }));
  }, [doctors]);

  const unlinkedNurseRows = useMemo<UnlinkedDoctorRow[]>(() => {
    return nurses
      .filter((n) => !n.user_id && n.activo)
      .map((n) => ({
        id: `nurse:${n.id}`,
        email: null,
        created_at: null,
        last_sign_in_at: null,
        roles: ["nurse" as AppRole],
        is_permanent_admin: false,
        _unlinkedNurse: n,
      }));
  }, [nurses]);

  const filtered = useMemo<UnlinkedDoctorRow[]>(() => {
    const q = query.trim().toLowerCase();
    const enrichedUsers: UnlinkedDoctorRow[] = users.map((u) => ({
      ...u,
      _linkedDoctor: doctorByUserId.get(u.id),
      _linkedNurse: nurseByUserId.get(u.id),
    }));
    const combined: UnlinkedDoctorRow[] = [...enrichedUsers, ...unlinkedDoctorRows, ...unlinkedNurseRows];
    let list = combined;
    if (roleFilter !== "all") {
      list = list.filter((u) =>
        roleFilter === "patient"
          ? u.roles.includes("patient") || u.roles.length === 0
          : u.roles.includes(roleFilter),
      );
    }
    if (!q) return list;
    return list.filter((u) => {
      if (u.email?.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)) return true;
      const d = u._unlinkedDoctor ?? u._linkedDoctor ?? u._unlinkedNurse ?? u._linkedNurse;
      if (d) {
        return (
          `${d.nombre} ${d.apellidos}`.toLowerCase().includes(q) ||
          (d.especialidad ?? "").toLowerCase().includes(q)
        );
      }
      return false;
    });
  }, [users, unlinkedDoctorRows, unlinkedNurseRows, doctorByUserId, nurseByUserId, query, roleFilter]);

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = {
      all: users.length + unlinkedDoctorRows.length + unlinkedNurseRows.length,
      admin: 0, manager: 0, receptionist: 0, doctor: unlinkedDoctorRows.length,
      nurse: unlinkedNurseRows.length, patient: 0, cajero: 0,
    };
    for (const u of users) {
      for (const r of u.roles) c[r] = (c[r] ?? 0) + 1;
      if (u.roles.length === 0) c.patient += 1;
    }
    return c;
  }, [users, unlinkedDoctorRows, unlinkedNurseRows]);

  const toggleRole = async (user: UsuarioRow, role: AppRole) => {
    const has = user.roles.includes(role);
    setBusyUser(user.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "toggle_role", user_id: user.id, role, has, clinic_id: activeClinicId },
      });
      const payload = data as AdminUsersPayload | null;
      if (error || payload?.error) throw new Error(payload?.error || error?.message || "Error");
      setUsers((prev) => prev.map((u) =>
        u.id === user.id
          ? { ...u, roles: has ? u.roles.filter((r) => r !== role) : [...u.roles, role] }
          : u
      ));
      toast.success(has ? `Rol "${ROLE_LABELS[role]}" removido` : `Rol "${ROLE_LABELS[role]}" asignado`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el rol");
    } finally {
      setBusyUser(null);
    }
  };

  const handleCreate = async () => {
    if (!createEmail || !createPassword) {
      toast.error("Correo y contraseña requeridos"); return;
    }
    if (createPassword.length < 12) {
      toast.error("La contraseña debe tener al menos 12 caracteres"); return;
    }
    if (["admin", "manager"].includes(createRole)) {
      if (!createPin || !/^\d{4,6}$/.test(createPin)) {
        toast.error("PIN de autorización requerido (4-6 dígitos) para este rol");
        return;
      }
      if (createPin !== createPinConfirm) {
        toast.error("Los PINs no coinciden");
        return;
      }
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "create", email: createEmail, password: createPassword, roles: [createRole] },
    });
    const createPayload = data as AdminUsersPayload | null;
    if (error || createPayload?.error) {
      setCreating(false);
      toast.error(createPayload?.error || "No se pudo crear el usuario");
      return;
    }
    if (["admin", "manager"].includes(createRole) && createPin) {
      const newUserId = createPayload?.user_id;
      if (newUserId) {
        const { error: pinErr } = await supabase.rpc("set_supervisor_pin", {
          p_user_id: newUserId,
          p_pin: createPin,
        } as never);
        if (pinErr) {
          setCreating(false);
          toast.error(`Usuario creado pero PIN no se pudo guardar: ${pinErr.message}. Configura el PIN manualmente desde la lista de usuarios.`);
          fetchUsers();
          return;
        }
      }
    }
    setCreating(false);
    toast.success("Usuario creado");
    setCreateOpen(false);
    setCreateEmail(""); setCreatePassword(""); setCreateRole("patient");
    setCreatePin(""); setCreatePinConfirm("");
    fetchUsers();
  };

  const handleEdit = async () => {
    if (!editUser || !editEmail) return;
    setSavingEdit(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "update", user_id: editUser.id, email: editEmail },
    });
    setSavingEdit(false);
    const editPayload = data as AdminUsersPayload | null;
    if (error || editPayload?.error) {
      toast.error(editPayload?.error || "No se pudo actualizar");
      return;
    }
    toast.success("Usuario actualizado");
    setEditUser(null);
    fetchUsers();
  };

  const handleSetPassword = async () => {
    if (!pwUser || !pwValue) return;
    if (pwValue.length < 12) { toast.error("Mínimo 12 caracteres"); return; }
    setSavingPw(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "set_password", user_id: pwUser.id, password: pwValue },
    });
    setSavingPw(false);
    const pwPayload = data as AdminUsersPayload | null;
    if (error || pwPayload?.error) {
      toast.error(pwPayload?.error || "No se pudo cambiar la contraseña");
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
    const delPayload = data as AdminUsersPayload | null;
    if (error || delPayload?.error) {
      toast.error(delPayload?.error || "No se pudo eliminar");
      return;
    }
    toast.success("Usuario eliminado");
    setDelUser(null);
    fetchUsers();
  };

  const [busyBan, setBusyBan] = useState<string | null>(null);
  const handleToggleBan = async (user: UsuarioRow) => {
    setBusyBan(user.id);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "toggle_ban", user_id: user.id, banned: !user.banned },
    });
    setBusyBan(null);
    const payload = data as AdminUsersPayload | null;
    if (error || payload?.error) {
      toast.error(payload?.error || "No se pudo actualizar el acceso");
      return;
    }
    toast.success(user.banned ? "Acceso habilitado" : "Acceso deshabilitado");
    fetchUsers();
  };

  const handleApplyBase = async () => {
    if (basePw.length < 12) { toast.error("Mínimo 12 caracteres"); return; }
    setApplyingBase(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "set_base_password_all", password: basePw, clinic_id: activeClinicId },
    });
    setApplyingBase(false);
    const basePayload = data as AdminUsersPayload | null;
    if (error || basePayload?.error) {
      toast.error(basePayload?.error || "No se pudo aplicar la contraseña base");
      return;
    }
    toast.success(`Aplicada a ${basePayload?.updated ?? 0} usuario(s). Omitidos: ${basePayload?.skipped ?? 0} (admin permanente)`);
    setBaseOpen(false); setBasePw("");
  };

  // ---- Vinculación de médicos ----
  const [linkDoctor, setLinkDoctor] = useState<DoctorRow | null>(null);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkPassword, setLinkPassword] = useState("");
  const [linkExistingUserId, setLinkExistingUserId] = useState<string>("");
  const [linkMode, setLinkMode] = useState<"new" | "existing">("new");
  const [linking, setLinking] = useState(false);
  const [unlinkDoctor, setUnlinkDoctor] = useState<DoctorRow | null>(null);
  const [unlinking, setUnlinking] = useState(false);

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
    const payload: Record<string, unknown> = { action: "link_doctor_user", doctor_id: linkDoctor.id };
    if (linkMode === "existing") {
      if (!linkExistingUserId) { setLinking(false); toast.error("Selecciona un usuario"); return; }
      payload.existing_user_id = linkExistingUserId;
    } else {
      if (!linkEmail || linkPassword.length < 12) { setLinking(false); toast.error("Correo y contraseña (mínimo 12 caracteres) requeridos"); return; }
      payload.email = linkEmail;
      payload.password = linkPassword;
    }
    const { data, error } = await supabase.functions.invoke("admin-users", { body: payload });
    setLinking(false);
    const linkPayload = data as AdminUsersPayload | null;
    if (error || linkPayload?.error) {
      toast.error(linkPayload?.error || "No se pudo vincular");
      return;
    }
    toast.success(`Médico ${linkDoctor.nombre} ${linkDoctor.apellidos} vinculado`);
    setLinkDoctor(null);
    fetchUsers();
    fetchDoctors();
  };

  const handleUnlinkDoctor = async () => {
    if (!unlinkDoctor) return;
    setUnlinking(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "unlink_doctor_user", doctor_id: unlinkDoctor.id },
    });
    setUnlinking(false);
    const unlinkPayload = data as AdminUsersPayload | null;
    if (error || unlinkPayload?.error) {
      toast.error(unlinkPayload?.error || "No se pudo desvincular");
      setUnlinkDoctor(null);
      return;
    }
    toast.success("Médico desvinculado");
    setUnlinkDoctor(null);
    fetchDoctors();
  };

  // ---- CRUD de médicos ----
  type DoctorForm = {
    nombre: string;
    apellidos: string;
    especialidad: string;
    cedula_profesional: string;
    telefono: string;
    horario_inicio: string;
    horario_fin: string;
    duracion_cita_min: number;
    activo: boolean;
  };
  const emptyDoctor: DoctorForm = {
    nombre: "", apellidos: "", especialidad: "", cedula_profesional: "",
    telefono: "", horario_inicio: "08:00", horario_fin: "18:00",
    duracion_cita_min: 30, activo: true,
  };
  const [doctorEdit, setDoctorEdit] = useState<DoctorRow | null>(null);
  const [doctorForm, setDoctorForm] = useState<DoctorForm>(emptyDoctor);
  const [doctorDialogOpen, setDoctorDialogOpen] = useState(false);
  const [savingDoctor, setSavingDoctor] = useState(false);
  const [doctorDel, setDoctorDel] = useState<DoctorRow | null>(null);
  const [deletingDoctor, setDeletingDoctor] = useState(false);

  const openDoctorNew = () => {
    setDoctorEdit(null);
    setDoctorForm(emptyDoctor);
    setDoctorDialogOpen(true);
  };
  const openDoctorEdit = (d: DoctorRow) => {
    setDoctorEdit(d);
    setDoctorForm({
      nombre: d.nombre ?? "",
      apellidos: d.apellidos ?? "",
      especialidad: d.especialidad ?? "",
      cedula_profesional: d.cedula_profesional ?? "",
      telefono: d.telefono ?? "",
      horario_inicio: (d.horario_inicio ?? "08:00:00").slice(0, 5),
      horario_fin: (d.horario_fin ?? "18:00:00").slice(0, 5),
      duracion_cita_min: d.duracion_cita_min ?? 30,
      activo: d.activo,
    });
    setDoctorDialogOpen(true);
  };

  const validateDoctorForm = (): string | null => {
    const f = doctorForm;
    if (!f.nombre.trim()) return "El nombre es requerido";
    if (!f.apellidos.trim()) return "Los apellidos son requeridos";
    if (!f.especialidad.trim()) return "La especialidad es requerida";
    if (f.nombre.length > 80) return "Nombre demasiado largo";
    if (f.apellidos.length > 80) return "Apellidos demasiado largos";
    if (f.especialidad.length > 100) return "Especialidad demasiado larga";
    if (f.cedula_profesional && !/^[A-Za-z0-9-]{4,20}$/.test(f.cedula_profesional.trim())) {
      return "Cédula profesional: solo letras, números y guiones (4 a 20 caracteres)";
    }
    if (f.telefono && !/^[+\d\s()-]{7,20}$/.test(f.telefono.trim())) {
      return "Teléfono inválido (usa solo dígitos, +, espacios o guiones)";
    }
    const hi = (f.horario_inicio || "").slice(0, 5);
    const hf = (f.horario_fin || "").slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(hi) || !/^\d{2}:\d{2}$/.test(hf)) {
      return "Horario inválido (formato HH:MM)";
    }
    if (hi >= hf) return "El horario de fin debe ser posterior al inicio";
    if (f.duracion_cita_min < 5 || f.duracion_cita_min > 240) {
      return "La duración de cita debe estar entre 5 y 240 minutos";
    }
    return null;
  };

  const handleSaveDoctor = async () => {
    const err = validateDoctorForm();
    if (err) { toast.error(err); return; }
    setSavingDoctor(true);
    const payload = {
      nombre: doctorForm.nombre.trim(),
      apellidos: doctorForm.apellidos.trim(),
      especialidad: doctorForm.especialidad.trim(),
      cedula_profesional: doctorForm.cedula_profesional.trim() || null,
      telefono: doctorForm.telefono.trim() || null,
      horario_inicio: doctorForm.horario_inicio.slice(0, 5) + ":00",
      horario_fin: doctorForm.horario_fin.slice(0, 5) + ":00",
      duracion_cita_min: doctorForm.duracion_cita_min,
      activo: doctorForm.activo,
    };
    let error;
    if (doctorEdit) {
      ({ error } = await supabase.from("doctors").update(payload).eq("id", doctorEdit.id));
    } else {
      ({ error } = await supabase.from("doctors").insert({ ...payload, clinic_id: activeClinicId } as never));
    }
    setSavingDoctor(false);
    if (error) {
      toast.error(error.message || "No se pudo guardar el médico");
      return;
    }
    toast.success(doctorEdit ? "Médico actualizado" : "Médico creado");
    setDoctorDialogOpen(false);
    fetchDoctors();
  };

  const handleDeleteDoctor = async () => {
    if (!doctorDel) return;
    setDeletingDoctor(true);
    const { error } = await supabase.from("doctors").delete().eq("id", doctorDel.id);
    setDeletingDoctor(false);
    if (error) {
      toast.error("No se puede eliminar: el médico tiene registros relacionados. Marca como Inactivo en su lugar.");
      setDoctorDel(null);
      return;
    }
    toast.success("Médico eliminado");
    setDoctorDel(null);
    fetchDoctors();
  };

  // ---- Vinculación de enfermeras ----
  const [linkNurse, setLinkNurse] = useState<NurseRow | null>(null);
  const [linkNurseEmail, setLinkNurseEmail] = useState("");
  const [linkNursePassword, setLinkNursePassword] = useState("");
  const [linkNurseExistingUserId, setLinkNurseExistingUserId] = useState<string>("");
  const [linkNurseMode, setLinkNurseMode] = useState<"new" | "existing">("new");
  const [linkingNurse, setLinkingNurse] = useState(false);
  const [unlinkNurse, setUnlinkNurse] = useState<NurseRow | null>(null);
  const [unlinkingNurse, setUnlinkingNurse] = useState(false);

  const openLinkNurse = (n: NurseRow) => {
    setLinkNurse(n);
    setLinkNurseEmail("");
    setLinkNursePassword("");
    setLinkNurseExistingUserId("");
    setLinkNurseMode("new");
  };

  const handleLinkNurse = async () => {
    if (!linkNurse) return;
    setLinkingNurse(true);
    const payload: Record<string, unknown> = { action: "link_nurse_user", nurse_id: linkNurse.id };
    if (linkNurseMode === "existing") {
      if (!linkNurseExistingUserId) { setLinkingNurse(false); toast.error("Selecciona un usuario"); return; }
      payload.existing_user_id = linkNurseExistingUserId;
    } else {
      if (!linkNurseEmail || linkNursePassword.length < 12) { setLinkingNurse(false); toast.error("Correo y contraseña (mínimo 12 caracteres) requeridos"); return; }
      payload.email = linkNurseEmail;
      payload.password = linkNursePassword;
    }
    const { data, error } = await supabase.functions.invoke("admin-users", { body: payload });
    setLinkingNurse(false);
    const linkPayload = data as AdminUsersPayload | null;
    if (error || linkPayload?.error) {
      toast.error(linkPayload?.error || "No se pudo vincular");
      return;
    }
    toast.success(`Enfermera ${linkNurse.nombre} ${linkNurse.apellidos} vinculada`);
    setLinkNurse(null);
    fetchUsers();
    fetchNurses();
  };

  const handleUnlinkNurse = async () => {
    if (!unlinkNurse) return;
    setUnlinkingNurse(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "unlink_nurse_user", nurse_id: unlinkNurse.id },
    });
    setUnlinkingNurse(false);
    const unlinkPayload = data as AdminUsersPayload | null;
    if (error || unlinkPayload?.error) {
      toast.error(unlinkPayload?.error || "No se pudo desvincular");
      setUnlinkNurse(null);
      return;
    }
    toast.success("Enfermera desvinculada");
    setUnlinkNurse(null);
    fetchNurses();
  };

  // ---- CRUD de enfermeras ----
  type NurseForm = {
    nombre: string;
    apellidos: string;
    categoria: NurseCategoria;
    especialidad: string;
    cedula_profesional: string;
    telefono: string;
    horario_inicio: string;
    horario_fin: string;
    activo: boolean;
  };
  const emptyNurse: NurseForm = {
    nombre: "", apellidos: "", categoria: "auxiliar", especialidad: "", cedula_profesional: "",
    telefono: "", horario_inicio: "08:00", horario_fin: "18:00", activo: true,
  };
  const [nurseEdit, setNurseEdit] = useState<NurseRow | null>(null);
  const [nurseForm, setNurseForm] = useState<NurseForm>(emptyNurse);
  const [nurseDialogOpen, setNurseDialogOpen] = useState(false);
  const [savingNurse, setSavingNurse] = useState(false);
  const [nurseDel, setNurseDel] = useState<NurseRow | null>(null);
  const [deletingNurse, setDeletingNurse] = useState(false);

  const openNurseNew = () => {
    setNurseEdit(null);
    setNurseForm(emptyNurse);
    setNurseDialogOpen(true);
  };
  const openNurseEdit = (n: NurseRow) => {
    setNurseEdit(n);
    setNurseForm({
      nombre: n.nombre ?? "",
      apellidos: n.apellidos ?? "",
      categoria: n.categoria,
      especialidad: n.especialidad ?? "",
      cedula_profesional: n.cedula_profesional ?? "",
      telefono: n.telefono ?? "",
      horario_inicio: (n.horario_inicio ?? "08:00:00").slice(0, 5),
      horario_fin: (n.horario_fin ?? "18:00:00").slice(0, 5),
      activo: n.activo,
    });
    setNurseDialogOpen(true);
  };

  const validateNurseForm = (): string | null => {
    const f = nurseForm;
    if (!f.nombre.trim()) return "El nombre es requerido";
    if (!f.apellidos.trim()) return "Los apellidos son requeridos";
    if (f.nombre.length > 80) return "Nombre demasiado largo";
    if (f.apellidos.length > 80) return "Apellidos demasiado largos";
    if (f.cedula_profesional && !/^[A-Za-z0-9-]{4,20}$/.test(f.cedula_profesional.trim())) {
      return "Cédula profesional: solo letras, números y guiones (4 a 20 caracteres)";
    }
    if (f.telefono && !/^[+\d\s()-]{7,20}$/.test(f.telefono.trim())) {
      return "Teléfono inválido (usa solo dígitos, +, espacios o guiones)";
    }
    const hi = (f.horario_inicio || "").slice(0, 5);
    const hf = (f.horario_fin || "").slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(hi) || !/^\d{2}:\d{2}$/.test(hf)) {
      return "Horario inválido (formato HH:MM)";
    }
    if (hi >= hf) return "El horario de fin debe ser posterior al inicio";
    return null;
  };

  const handleSaveNurse = async () => {
    const err = validateNurseForm();
    if (err) { toast.error(err); return; }
    setSavingNurse(true);
    const payload = {
      nombre: nurseForm.nombre.trim(),
      apellidos: nurseForm.apellidos.trim(),
      categoria: nurseForm.categoria,
      especialidad: nurseForm.especialidad.trim() || null,
      cedula_profesional: nurseForm.cedula_profesional.trim() || null,
      telefono: nurseForm.telefono.trim() || null,
      horario_inicio: nurseForm.horario_inicio.slice(0, 5) + ":00",
      horario_fin: nurseForm.horario_fin.slice(0, 5) + ":00",
      activo: nurseForm.activo,
    };
    let error;
    if (nurseEdit) {
      ({ error } = await supabase.from("nurses").update(payload).eq("id", nurseEdit.id));
    } else {
      ({ error } = await supabase.from("nurses").insert({ ...payload, clinic_id: activeClinicId } as never));
    }
    setSavingNurse(false);
    if (error) {
      toast.error(error.message || "No se pudo guardar la enfermera");
      return;
    }
    toast.success(nurseEdit ? "Enfermera actualizada" : "Enfermera creada");
    setNurseDialogOpen(false);
    fetchNurses();
  };

  const handleDeleteNurse = async () => {
    if (!nurseDel) return;
    setDeletingNurse(true);
    const { error } = await supabase.from("nurses").delete().eq("id", nurseDel.id);
    setDeletingNurse(false);
    if (error) {
      toast.error("No se puede eliminar: la enfermera tiene registros relacionados. Márcala como Inactiva en su lugar.");
      setNurseDel(null);
      return;
    }
    toast.success("Enfermera eliminada");
    setNurseDel(null);
    fetchNurses();
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
          <Button variant="outline" onClick={() => { fetchUsers(); fetchDoctors(); fetchNurses(); }} disabled={loading}>Recargar</Button>
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
          <TabsTrigger value="enfermeras" className="gap-1.5">
            <HeartPulse className="h-4 w-4" /> Enfermeras del registro ({nurses.length})
            {nurses.some((n) => !n.user_id) && (
              <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                {nurses.filter((n) => !n.user_id).length}
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

        {/* TAB: Médicos del registro clínico */}
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
                        ) : GOOGLE_CLIENT_ID_PUBLIC ? (
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

        {/* TAB: Enfermeras del registro clínico */}
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
      </Tabs>

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
            <Button
              disabled={savingPin}
              onClick={async () => {
                if (!pinUser) return;
                if (!pinValue) { toast.error("Ingresa un PIN"); return; }
                if (!/^\d{4,6}$/.test(pinValue)) { toast.error("PIN debe ser 4-6 dígitos"); return; }
                if (pinValue !== pinConfirm) { toast.error("Los PINs no coinciden"); return; }
                setSavingPin(true);
                const { error } = await supabase.rpc("set_supervisor_pin", {
                  p_user_id: pinUser.id,
                  p_pin: pinValue,
                } as never);
                setSavingPin(false);
                if (error) { toast.error(error.message || "No se pudo guardar el PIN"); return; }
                toast.success("PIN actualizado");
                setPinUser(null);
              }}
            >
              {savingPin ? "Guardando…" : "Guardar PIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
