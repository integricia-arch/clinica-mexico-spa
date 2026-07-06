import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseSnapshot } from "@/features/panel-doctor/hooks/useDoctorQueue";

describe("parseSnapshot", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe("JSON válido", () => {
    it("extrae current_step_key y progress_percent de un objeto", () => {
      expect(
        parseSnapshot({ current_step_key: "triage", progress_percent: 42 } as never),
      ).toEqual({ current_step_key: "triage", progress_percent: 42 });
    });

    it("parsea un string JSON válido", () => {
      expect(
        parseSnapshot(JSON.stringify({ current_step_key: "consultation", progress_percent: 80 })),
      ).toEqual({ current_step_key: "consultation", progress_percent: 80 });
    });

    it("convierte progress_percent numérico en string", () => {
      expect(parseSnapshot({ progress_percent: "55" } as never)).toEqual({
        progress_percent: 55,
      });
    });

    it("devuelve objeto vacío para {} ", () => {
      expect(parseSnapshot({} as never)).toEqual({});
    });
  });

  describe("JSON malformado", () => {
    it("devuelve {} y loguea warning cuando el string no es JSON", () => {
      expect(parseSnapshot("no-es-json")).toEqual({});
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it("devuelve {} cuando el string es JSON pero no objeto", () => {
      expect(parseSnapshot("123")).toEqual({});
      expect(parseSnapshot("null")).toEqual({});
      expect(parseSnapshot("[1,2,3]")).toEqual({});
    });
  });

  describe("Tipos inesperados", () => {
    it("devuelve {} para null / undefined", () => {
      expect(parseSnapshot(null)).toEqual({});
      expect(parseSnapshot(undefined)).toEqual({});
    });

    it("devuelve {} cuando la columna snapshot_json falta en la fila", () => {
      const row: { id: string; appointment_id: string; snapshot_json?: undefined } = {
        id: "j-1",
        appointment_id: "appt-1",
      };
      expect(parseSnapshot(row.snapshot_json)).toEqual({});
    });

    it("devuelve {} para arrays", () => {
      expect(parseSnapshot([1, 2, 3] as never)).toEqual({});
    });

    it("devuelve {} para primitivos number/boolean", () => {
      expect(parseSnapshot(42 as never)).toEqual({});
      expect(parseSnapshot(true as never)).toEqual({});
    });

    it("ignora current_step_key no-string", () => {
      expect(parseSnapshot({ current_step_key: 123 } as never)).toEqual({});
    });

    it("ignora progress_percent no-numérico o no-finito", () => {
      expect(parseSnapshot({ progress_percent: "abc" } as never)).toEqual({});
      expect(parseSnapshot({ progress_percent: NaN } as never)).toEqual({});
      expect(parseSnapshot({ progress_percent: Infinity } as never)).toEqual({});
      expect(parseSnapshot({ progress_percent: null } as never)).toEqual({});
    });

    it("conserva solo campos válidos cuando hay mezcla", () => {
      expect(
        parseSnapshot({
          current_step_key: "triage",
          progress_percent: "no-num",
          extra: "ignorar",
        } as never),
      ).toEqual({ current_step_key: "triage" });
    });
  });
});
