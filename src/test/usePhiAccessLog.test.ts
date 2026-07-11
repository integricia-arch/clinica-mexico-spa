import { describe, it, expect } from "vitest";
import { buildPhiAccessLogArgs } from "@/hooks/usePhiAccessLog";

describe("buildPhiAccessLogArgs", () => {
  it("arma los args con accion 'select' por default", () => {
    expect(buildPhiAccessLogArgs("clinic-1", "patient-1", "notas_consulta")).toEqual({
      p_clinic_id: "clinic-1",
      p_patient_id: "patient-1",
      p_tabla: "notas_consulta",
      p_accion: "select",
    });
  });

  it("respeta accion 'export' explícita", () => {
    expect(buildPhiAccessLogArgs("clinic-1", "patient-1", "prescriptions", "export")).toEqual({
      p_clinic_id: "clinic-1",
      p_patient_id: "patient-1",
      p_tabla: "prescriptions",
      p_accion: "export",
    });
  });
});
