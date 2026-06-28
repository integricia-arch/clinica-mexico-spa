export interface PacienteRow {
  nombre: string
  estado: "estable" | "pendiente" | "urgente"
  observacion: string
}

export interface PendienteRow {
  descripcion: string
  prioridad: "alta" | "media" | "baja"
}

export function defaultPacienteRow(): PacienteRow {
  return { nombre: "", estado: "estable", observacion: "" }
}

export function defaultPendienteRow(): PendienteRow {
  return { descripcion: "", prioridad: "media" }
}

export function filterValidPacientes(rows: PacienteRow[]): PacienteRow[] {
  return rows.filter((r) => r.nombre.trim() !== "")
}

export function filterValidPendientes(rows: PendienteRow[]): PendienteRow[] {
  return rows.filter((r) => r.descripcion.trim() !== "")
}
