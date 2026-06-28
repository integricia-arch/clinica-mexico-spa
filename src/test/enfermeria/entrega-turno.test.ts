import { describe, it, expect } from "vitest"
import {
  defaultPacienteRow,
  defaultPendienteRow,
  filterValidPacientes,
  filterValidPendientes,
  type PacienteRow,
  type PendienteRow,
} from "@/features/enfermeria/entregaTurnoHelpers"

describe("defaultPacienteRow", () => {
  it("returns row with estado estable and empty strings", () => {
    const row = defaultPacienteRow()
    expect(row.nombre).toBe("")
    expect(row.estado).toBe("estable")
    expect(row.observacion).toBe("")
  })
})

describe("defaultPendienteRow", () => {
  it("returns row with prioridad media and empty string", () => {
    const row = defaultPendienteRow()
    expect(row.descripcion).toBe("")
    expect(row.prioridad).toBe("media")
  })
})

describe("filterValidPacientes", () => {
  it("removes rows with empty nombre", () => {
    const rows: PacienteRow[] = [
      { nombre: "Juan", estado: "estable", observacion: "" },
      { nombre: "   ", estado: "pendiente", observacion: "algo" },
      { nombre: "", estado: "urgente", observacion: "" },
    ]
    expect(filterValidPacientes(rows)).toHaveLength(1)
    expect(filterValidPacientes(rows)[0].nombre).toBe("Juan")
  })

  it("returns empty array when all nombres are blank", () => {
    const rows: PacienteRow[] = [
      { nombre: "", estado: "estable", observacion: "" },
    ]
    expect(filterValidPacientes(rows)).toHaveLength(0)
  })
})

describe("filterValidPendientes", () => {
  it("removes rows with empty descripcion", () => {
    const rows: PendienteRow[] = [
      { descripcion: "Cambio de suero", prioridad: "alta" },
      { descripcion: "", prioridad: "baja" },
      { descripcion: "  ", prioridad: "media" },
    ]
    expect(filterValidPendientes(rows)).toHaveLength(1)
    expect(filterValidPendientes(rows)[0].descripcion).toBe("Cambio de suero")
  })
})
