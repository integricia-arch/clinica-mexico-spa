export type AppRole = "admin" | "manager" | "receptionist" | "doctor" | "nurse" | "patient" | "cajero";

export const ROLE_OPTIONS: AppRole[] = ["admin", "manager", "receptionist", "doctor", "nurse", "patient", "cajero"];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  manager: "Gerente",
  receptionist: "Recepción",
  doctor: "Médico",
  nurse: "Enfermería",
  patient: "Paciente",
  cajero: "Cajero",
};

export const ROLE_BADGE: Record<AppRole, string> = {
  admin: "bg-primary text-primary-foreground",
  manager: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  receptionist: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  doctor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  nurse: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  patient: "bg-muted text-muted-foreground",
  cajero: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
};

export interface UsuarioRow {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  roles: AppRole[];
  is_permanent_admin?: boolean;
  banned?: boolean;
}

export interface DoctorRow {
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
  modo_cobro?: "clinica" | "directo";
}

export type NurseCategoria = "licenciada" | "tecnica" | "auxiliar";

export const NURSE_CATEGORIA_LABELS: Record<NurseCategoria, string> = {
  licenciada: "Licenciada",
  tecnica: "Técnica",
  auxiliar: "Auxiliar",
};

export interface NurseRow {
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
export interface AdminUsersPayload {
  error?: string;
  users?: UsuarioRow[];
  user_id?: string;
  updated?: number;
  skipped?: number;
}

export type ServicioCatalog = { id: string; nombre: string; especialidad: string; duracion_minutos: number; precio_centavos: number };

export type UnlinkedDoctorRow = UsuarioRow & {
  _unlinkedDoctor?: DoctorRow; _linkedDoctor?: DoctorRow;
  _unlinkedNurse?: NurseRow; _linkedNurse?: NurseRow;
};

export type DoctorForm = {
  nombre: string;
  apellidos: string;
  email: string;
  especialidad: string;
  cedula_profesional: string;
  telefono: string;
  horario_inicio: string;
  horario_fin: string;
  duracion_cita_min: number;
  activo: boolean;
  modo_cobro: "clinica" | "directo";
};

export type NurseForm = {
  nombre: string;
  apellidos: string;
  email: string;
  categoria: NurseCategoria;
  especialidad: string;
  cedula_profesional: string;
  telefono: string;
  horario_inicio: string;
  horario_fin: string;
  activo: boolean;
};
