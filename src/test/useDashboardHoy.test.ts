import { describe, it, expect } from "vitest";

import {
  formatHora,
  formatNombrePaciente,
  formatNombreDoctor,
  mapStatusToLabel,
  mapAuditToTexto,
  tiempoRelativo,
} from "../hooks/useDashboardHoy";

describe("formatHora", () => {
  it("extracts HH:mm from ISO string", () => {
    expect(formatHora("2026-06-21T09:30:00+00:00")).toBe("09:30");
  });
  it("handles UTC midnight", () => {
    expect(formatHora("2026-06-21T00:00:00.000Z")).toBe("00:00");
  });
});

describe("formatNombrePaciente", () => {
  it("combines nombre and apellido_paterno", () => {
    expect(formatNombrePaciente("María", "González")).toBe("María González");
  });
  it("returns nombre alone when apellido null", () => {
    expect(formatNombrePaciente("Ana", null)).toBe("Ana");
  });
});

describe("formatNombreDoctor", () => {
  it("prefixes Dr. and combines name", () => {
    expect(formatNombreDoctor("Carlos", "Mendoza Ruiz")).toBe("Dr. Carlos Mendoza Ruiz");
  });
});

describe("mapStatusToLabel", () => {
  it("maps confirmada", () => {
    expect(mapStatusToLabel("confirmada")).toBe("Confirmada");
  });
  it("maps confirmada_paciente", () => {
    expect(mapStatusToLabel("confirmada_paciente")).toBe("Confirmada por paciente");
  });
  it("maps confirmada_medico", () => {
    expect(mapStatusToLabel("confirmada_medico")).toBe("Confirmada por médico");
  });
  it("maps pendiente_formulario", () => {
    expect(mapStatusToLabel("pendiente_formulario")).toBe("Pendiente de formulario");
  });
  it("maps recordatorio_enviado", () => {
    expect(mapStatusToLabel("recordatorio_enviado")).toBe("Recordatorio enviado");
  });
  it("maps solicitada", () => {
    expect(mapStatusToLabel("solicitada")).toBe("Solicitada");
  });
  it("maps cancelada", () => {
    expect(mapStatusToLabel("cancelada")).toBe("Cancelada");
  });
  it("maps tentativa", () => {
    expect(mapStatusToLabel("tentativa")).toBe("Tentativa");
  });
  it("maps liberada", () => {
    expect(mapStatusToLabel("liberada")).toBe("Liberada");
  });
  it("returns raw value for unknown status", () => {
    expect(mapStatusToLabel("unknown_status")).toBe("unknown_status");
  });
});

describe("mapAuditToTexto", () => {
  it("crear + patients", () => {
    expect(mapAuditToTexto("crear", "patients", { nombre: "Ana" })).toBe(
      "Nuevo paciente registrado: Ana"
    );
  });
  it("crear + patients without nombre in datos", () => {
    expect(mapAuditToTexto("crear", "patients", null)).toBe(
      "Nuevo paciente registrado"
    );
  });
  it("crear + appointments", () => {
    expect(mapAuditToTexto("crear", "appointments", null)).toBe("Cita agendada");
  });
  it("actualizar + appointments", () => {
    expect(mapAuditToTexto("actualizar", "appointments", null)).toBe("Cita actualizada");
  });
  it("crear + pharmacy_sales", () => {
    expect(mapAuditToTexto("crear", "pharmacy_sales", null)).toBe(
      "Venta registrada en farmacia"
    );
  });
  it("crear + notas_consulta", () => {
    expect(mapAuditToTexto("crear", "notas_consulta", null)).toBe(
      "Nota clínica registrada"
    );
  });
  it("crear + expedientes", () => {
    expect(mapAuditToTexto("crear", "expedientes", null)).toBe("Expediente creado");
  });
  it("fallback for unknown accion+tabla", () => {
    expect(mapAuditToTexto("consultar", "medicamentos", null)).toBe(
      "Consulta en medicamentos"
    );
  });
});

describe("tiempoRelativo", () => {
  it("returns 'Hace un momento' for < 1 min", () => {
    const now = new Date().toISOString();
    expect(tiempoRelativo(now)).toBe("Hace un momento");
  });
  it("returns 'Hace X min' for < 60 min", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(tiempoRelativo(fiveMinAgo)).toBe("Hace 5 min");
  });
  it("returns 'Hace X h' for >= 60 min", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    expect(tiempoRelativo(twoHoursAgo)).toBe("Hace 2 h");
  });
});
