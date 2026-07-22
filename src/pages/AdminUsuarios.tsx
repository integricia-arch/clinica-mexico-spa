import { useEffect, useMemo, useState } from "react";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, UserPlus, Lock, HeartPulse, Stethoscope, Users as UsersIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AppRole, AdminUsersPayload, DoctorForm, DoctorRow, NurseForm, NurseRow,
  ROLE_LABELS, ServicioCatalog, UnlinkedDoctorRow, UsuarioRow,
} from "./adminUsuarios/types";
import { UsersTab } from "./adminUsuarios/UsersTab";
import { DoctorsTab } from "./adminUsuarios/DoctorsTab";
import { NursesTab } from "./adminUsuarios/NursesTab";
import { UserDialogs } from "./adminUsuarios/UserDialogs";
import { DoctorDialogs } from "./adminUsuarios/DoctorDialogs";
import { NurseDialogs } from "./adminUsuarios/NurseDialogs";

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

  // Servicios por doctor
  const [serviciosDialog, setServiciosDialog] = useState<{ doctor: DoctorRow } | null>(null);
  const [catalogoServicios, setCatalogoServicios] = useState<ServicioCatalog[]>([]);
  const [asignadosIds, setAsignadosIds] = useState<Set<string>>(new Set());
  const [loadingServicios, setLoadingServicios] = useState(false);
  const [savingServicios, setSavingServicios] = useState(false);

  const openServiciosDialog = async (d: DoctorRow) => {
    setServiciosDialog({ doctor: d });
    setLoadingServicios(true);
    try {
      const [catRes, asigRes] = await Promise.all([
        (supabase as any).from("servicios").select("id,nombre,especialidad,duracion_minutos,precio_centavos").eq("activo", true).order("nombre"),
        (supabase as any).from("doctor_servicios").select("servicio_id").eq("doctor_id", d.id),
      ]);
      setCatalogoServicios((catRes.data ?? []) as ServicioCatalog[]);
      setAsignadosIds(new Set(((asigRes.data ?? []) as { servicio_id: string }[]).map((r) => r.servicio_id)));
    } finally {
      setLoadingServicios(false);
    }
  };

  const toggleServicio = (id: string) =>
    setAsignadosIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const saveServicios = async () => {
    if (!serviciosDialog) return;
    setSavingServicios(true);
    try {
      const doctorId = serviciosDialog.doctor.id;
      await (supabase as any).from("doctor_servicios").delete().eq("doctor_id", doctorId);
      if (asignadosIds.size > 0) {
        await (supabase as any).from("doctor_servicios").insert(
          [...asignadosIds].map((sid) => ({ doctor_id: doctorId, servicio_id: sid }))
        );
      }
      toast.success("Servicios actualizados");
      setServiciosDialog(null);
    } catch {
      toast.error("No se pudieron guardar los servicios");
    } finally {
      setSavingServicios(false);
    }
  };

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
    const { data } = await (supabase as any).rpc("get_doctor_calendars", { p_clinic_id: activeClinicId });
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
    const { data, error } = await (supabase as any)
      .from("doctors")
      .select("id, nombre, apellidos, especialidad, cedula_profesional, telefono, activo, user_id, horario_inicio, horario_fin, duracion_cita_min, modo_cobro")
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
    const { data, error } = await (supabase as any)
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

  const pendingAccessCount = useMemo(
    () => users.filter((u) => u.roles.length === 0).length,
    [users],
  );

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
        const { error: pinErr } = await (supabase as any).rpc("set_supervisor_pin", {
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

  const handleSavePin = async () => {
    if (!pinUser) return;
    if (!pinValue) { toast.error("Ingresa un PIN"); return; }
    if (!/^\d{4,6}$/.test(pinValue)) { toast.error("PIN debe ser 4-6 dígitos"); return; }
    if (pinValue !== pinConfirm) { toast.error("Los PINs no coinciden"); return; }
    setSavingPin(true);
    const { error } = await (supabase as any).rpc("set_supervisor_pin", {
      p_user_id: pinUser.id,
      p_pin: pinValue,
    } as never);
    setSavingPin(false);
    if (error) { toast.error(error.message || "No se pudo guardar el PIN"); return; }
    toast.success("PIN actualizado");
    setPinUser(null);
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
  const emptyDoctor: DoctorForm = {
    nombre: "", apellidos: "", email: "", especialidad: "", cedula_profesional: "",
    telefono: "", horario_inicio: "08:00", horario_fin: "18:00",
    duracion_cita_min: 30, activo: true, modo_cobro: "clinica",
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
      email: (d as any).email ?? "",
      especialidad: d.especialidad ?? "",
      cedula_profesional: d.cedula_profesional ?? "",
      telefono: d.telefono ?? "",
      horario_inicio: (d.horario_inicio ?? "08:00:00").slice(0, 5),
      horario_fin: (d.horario_fin ?? "18:00:00").slice(0, 5),
      duracion_cita_min: d.duracion_cita_min ?? 30,
      activo: d.activo,
      modo_cobro: ((d as any).modo_cobro as "clinica" | "directo") ?? "clinica",
    });
    setDoctorDialogOpen(true);
  };

  const validateDoctorForm = (): string | null => {
    const f = doctorForm;
    if (!f.nombre.trim()) return "El nombre es requerido";
    if (!f.apellidos.trim()) return "Los apellidos son requeridos";
    if (!f.email.trim()) return "El email es requerido (se usa para crear cuenta automática)";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return "Email inválido";
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
      email: doctorForm.email.trim().toLowerCase(),
      especialidad: doctorForm.especialidad.trim(),
      cedula_profesional: doctorForm.cedula_profesional.trim() || null,
      telefono: doctorForm.telefono.trim() || null,
      horario_inicio: doctorForm.horario_inicio.slice(0, 5) + ":00",
      horario_fin: doctorForm.horario_fin.slice(0, 5) + ":00",
      duracion_cita_min: doctorForm.duracion_cita_min,
      activo: doctorForm.activo,
      modo_cobro: doctorForm.modo_cobro,
    };
    let error;
    if (doctorEdit) {
      ({ error } = await (supabase as any).from("doctors").update(payload).eq("id", doctorEdit.id));
    } else {
      ({ error } = await (supabase as any).from("doctors").insert({ ...payload, clinic_id: activeClinicId } as never));
    }
    setSavingDoctor(false);
    if (error) {
      toast.error(error.message || "No se pudo guardar el médico");
      return;
    }
    toast.success(doctorEdit ? "Médico actualizado" : "Médico creado");

    // Provisionar usuario automáticamente si es nuevo, activo, y tiene email
    if (!doctorEdit && doctorForm.activo && doctorForm.email.trim()) {
      const email = doctorForm.email.trim().toLowerCase();
      const tId = toast.loading("Creando cuenta de usuario automáticamente...");
      const { data, error: provErr } = await supabase.functions.invoke("provision-users-from-queue", { body: {} });
      toast.dismiss(tId);
      if (provErr || data?.failed > 0) {
        console.error("Provision error:", provErr ?? data?.errors);
        toast.error("Médico creado, pero la cuenta no se pudo crear automáticamente. Se vinculará sola cuando entre con Google, o reintenta guardando de nuevo.");
      } else {
        toast.success(`Cuenta lista: ya puede entrar con Google usando ${email}`);
      }
    }

    setDoctorDialogOpen(false);
    fetchDoctors();
  };

  const handleDeleteDoctor = async () => {
    if (!doctorDel) return;
    setDeletingDoctor(true);
    const { error } = await (supabase as any).from("doctors").delete().eq("id", doctorDel.id);
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
  const emptyNurse: NurseForm = {
    nombre: "", apellidos: "", email: "", categoria: "auxiliar", especialidad: "", cedula_profesional: "",
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
      email: (n as any).email ?? "",
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
    if (!f.email.trim()) return "El email es requerido (se usa para crear cuenta automática)";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return "Email inválido";
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
      email: nurseForm.email.trim().toLowerCase(),
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
      ({ error } = await (supabase as any).from("nurses").update(payload).eq("id", nurseEdit.id));
    } else {
      ({ error } = await (supabase as any).from("nurses").insert({ ...payload, clinic_id: activeClinicId } as never));
    }
    setSavingNurse(false);
    if (error) {
      toast.error(error.message || "No se pudo guardar la enfermera");
      return;
    }
    toast.success(nurseEdit ? "Enfermera actualizada" : "Enfermera creada");

    // Provisionar usuario automáticamente si es nuevo, activo, y tiene email
    if (!nurseEdit && nurseForm.activo && nurseForm.email.trim()) {
      const email = nurseForm.email.trim().toLowerCase();
      const tId = toast.loading("Creando cuenta de usuario automáticamente...");
      const { data, error: provErr } = await supabase.functions.invoke("provision-users-from-queue", { body: {} });
      toast.dismiss(tId);
      if (provErr || data?.failed > 0) {
        console.error("Provision error:", provErr ?? data?.errors);
        toast.error("Enfermera creada, pero la cuenta no se pudo crear automáticamente. Se vinculará sola cuando entre con Google, o reintenta guardando de nuevo.");
      } else {
        toast.success(`Cuenta lista: ya puede entrar con Google usando ${email}`);
      }
    }

    setNurseDialogOpen(false);
    fetchNurses();
  };

  const handleDeleteNurse = async () => {
    if (!nurseDel) return;
    setDeletingNurse(true);
    const { error } = await (supabase as any).from("nurses").delete().eq("id", nurseDel.id);
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
            {pendingAccessCount > 0 && (
              <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                {pendingAccessCount}
              </span>
            )}
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

        <UsersTab
          loading={loading}
          filtered={filtered}
          users={users}
          query={query}
          setQuery={setQuery}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          roleCounts={roleCounts}
          pendingAccessCount={pendingAccessCount}
          busyUser={busyUser}
          busyBan={busyBan}
          fmt={fmt}
          toggleRole={toggleRole}
          handleToggleBan={handleToggleBan}
          openLinkDoctor={openLinkDoctor}
          openLinkNurse={openLinkNurse}
          setEditUser={setEditUser}
          setEditEmail={setEditEmail}
          setPwUser={setPwUser}
          setPwValue={setPwValue}
          setDelUser={setDelUser}
          setPinUser={setPinUser}
          setPinValue={setPinValue}
          setPinConfirm={setPinConfirm}
        />

        <DoctorsTab
          doctorsEnriched={doctorsEnriched}
          loadingDoctors={loadingDoctors}
          doctorCalendars={doctorCalendars}
          googleClientIdPublic={GOOGLE_CLIENT_ID_PUBLIC}
          generateGoogleOAuthUrl={generateGoogleOAuthUrl}
          openDoctorNew={openDoctorNew}
          openDoctorEdit={openDoctorEdit}
          openServiciosDialog={openServiciosDialog}
          setUnlinkDoctor={setUnlinkDoctor}
          openLinkDoctor={openLinkDoctor}
          setDoctorDel={setDoctorDel}
        />

        <NursesTab
          nursesEnriched={nursesEnriched}
          loadingNurses={loadingNurses}
          openNurseNew={openNurseNew}
          openNurseEdit={openNurseEdit}
          setUnlinkNurse={setUnlinkNurse}
          openLinkNurse={openLinkNurse}
          setNurseDel={setNurseDel}
        />
      </Tabs>

      <DoctorDialogs
        doctorDialogOpen={doctorDialogOpen}
        setDoctorDialogOpen={setDoctorDialogOpen}
        doctorEdit={doctorEdit}
        doctorForm={doctorForm}
        setDoctorForm={setDoctorForm}
        savingDoctor={savingDoctor}
        handleSaveDoctor={handleSaveDoctor}
        serviciosDialog={serviciosDialog}
        setServiciosDialog={setServiciosDialog}
        loadingServicios={loadingServicios}
        catalogoServicios={catalogoServicios}
        asignadosIds={asignadosIds}
        toggleServicio={toggleServicio}
        savingServicios={savingServicios}
        saveServicios={saveServicios}
        doctorDel={doctorDel}
        setDoctorDel={setDoctorDel}
        deletingDoctor={deletingDoctor}
        handleDeleteDoctor={handleDeleteDoctor}
        unlinkDoctor={unlinkDoctor}
        setUnlinkDoctor={setUnlinkDoctor}
        unlinking={unlinking}
        handleUnlinkDoctor={handleUnlinkDoctor}
        linkDoctor={linkDoctor}
        setLinkDoctor={setLinkDoctor}
        linkMode={linkMode}
        setLinkMode={setLinkMode}
        linkEmail={linkEmail}
        setLinkEmail={setLinkEmail}
        linkPassword={linkPassword}
        setLinkPassword={setLinkPassword}
        linkExistingUserId={linkExistingUserId}
        setLinkExistingUserId={setLinkExistingUserId}
        linking={linking}
        handleLinkDoctor={handleLinkDoctor}
        users={users}
      />

      <NurseDialogs
        nurseDialogOpen={nurseDialogOpen}
        setNurseDialogOpen={setNurseDialogOpen}
        nurseEdit={nurseEdit}
        nurseForm={nurseForm}
        setNurseForm={setNurseForm}
        savingNurse={savingNurse}
        handleSaveNurse={handleSaveNurse}
        nurseDel={nurseDel}
        setNurseDel={setNurseDel}
        deletingNurse={deletingNurse}
        handleDeleteNurse={handleDeleteNurse}
        unlinkNurse={unlinkNurse}
        setUnlinkNurse={setUnlinkNurse}
        unlinkingNurse={unlinkingNurse}
        handleUnlinkNurse={handleUnlinkNurse}
        linkNurse={linkNurse}
        setLinkNurse={setLinkNurse}
        linkNurseMode={linkNurseMode}
        setLinkNurseMode={setLinkNurseMode}
        linkNurseEmail={linkNurseEmail}
        setLinkNurseEmail={setLinkNurseEmail}
        linkNursePassword={linkNursePassword}
        setLinkNursePassword={setLinkNursePassword}
        linkNurseExistingUserId={linkNurseExistingUserId}
        setLinkNurseExistingUserId={setLinkNurseExistingUserId}
        linkingNurse={linkingNurse}
        handleLinkNurse={handleLinkNurse}
        users={users}
      />

      <UserDialogs
        createOpen={createOpen}
        setCreateOpen={setCreateOpen}
        createEmail={createEmail}
        setCreateEmail={setCreateEmail}
        createPassword={createPassword}
        setCreatePassword={setCreatePassword}
        createRole={createRole}
        setCreateRole={setCreateRole}
        createPin={createPin}
        setCreatePin={setCreatePin}
        createPinConfirm={createPinConfirm}
        setCreatePinConfirm={setCreatePinConfirm}
        creating={creating}
        handleCreate={handleCreate}
        editUser={editUser}
        setEditUser={setEditUser}
        editEmail={editEmail}
        setEditEmail={setEditEmail}
        savingEdit={savingEdit}
        handleEdit={handleEdit}
        pwUser={pwUser}
        setPwUser={setPwUser}
        pwValue={pwValue}
        setPwValue={setPwValue}
        savingPw={savingPw}
        handleSetPassword={handleSetPassword}
        baseOpen={baseOpen}
        setBaseOpen={setBaseOpen}
        basePw={basePw}
        setBasePw={setBasePw}
        applyingBase={applyingBase}
        handleApplyBase={handleApplyBase}
        delUser={delUser}
        setDelUser={setDelUser}
        deleting={deleting}
        handleDelete={handleDelete}
        pinUser={pinUser}
        setPinUser={setPinUser}
        pinValue={pinValue}
        setPinValue={setPinValue}
        pinConfirm={pinConfirm}
        setPinConfirm={setPinConfirm}
        savingPin={savingPin}
        handleSavePin={handleSavePin}
      />
    </div>
  );
}
