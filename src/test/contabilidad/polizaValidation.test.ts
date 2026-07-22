import { describe, it, expect } from "vitest";
import {
  calcularTotales,
  polizaCuadra,
  lineasValidas,
  construirPartidas,
  type LineaDraft,
} from "../../features/contabilidad/polizaValidation";

function linea(overrides: Partial<LineaDraft> = {}): LineaDraft {
  return { cuentaId: "cta-1", lado: "cargo", monto: "100", ...overrides };
}

describe("calcularTotales", () => {
  it("suma cargo y abono por separado", () => {
    const { totalCargo, totalAbono } = calcularTotales([
      linea({ lado: "cargo", monto: "150" }),
      linea({ lado: "abono", monto: "150" }),
    ]);
    expect(totalCargo).toBe(150);
    expect(totalAbono).toBe(150);
  });

  it("ignora montos no numéricos como 0", () => {
    const { totalCargo } = calcularTotales([linea({ lado: "cargo", monto: "" })]);
    expect(totalCargo).toBe(0);
  });
});

// Espeja la regla dura de crear_poliza(): SUM(debe) = SUM(haber), > 0.
describe("polizaCuadra", () => {
  it("cuadra cuando cargo == abono y > 0", () => {
    expect(polizaCuadra(500, 500)).toBe(true);
  });

  it("no cuadra si cargo != abono", () => {
    expect(polizaCuadra(500, 499)).toBe(false);
  });

  it("no cuadra si todo es 0 (póliza vacía)", () => {
    expect(polizaCuadra(0, 0)).toBe(false);
  });
});

describe("lineasValidas", () => {
  it("false si no hay líneas", () => {
    expect(lineasValidas([])).toBe(false);
  });

  it("false si falta cuenta o monto en alguna línea", () => {
    expect(lineasValidas([linea(), linea({ cuentaId: "" })])).toBe(false);
    expect(lineasValidas([linea(), linea({ monto: "0" })])).toBe(false);
  });

  it("true si todas las líneas tienen cuenta y monto > 0", () => {
    expect(lineasValidas([linea({ lado: "cargo" }), linea({ lado: "abono" })])).toBe(true);
  });
});

describe("construirPartidas", () => {
  it("mapea cargo a debe_centavos y abono a haber_centavos, redondeando a centavos", () => {
    const partidas = construirPartidas([
      linea({ cuentaId: "cta-cargo", lado: "cargo", monto: "123.456" }),
      linea({ cuentaId: "cta-abono", lado: "abono", monto: "123.45" }),
    ]);
    expect(partidas).toEqual([
      { cuenta_id: "cta-cargo", debe_centavos: 12346, haber_centavos: 0 },
      { cuenta_id: "cta-abono", debe_centavos: 0, haber_centavos: 12345 },
    ]);
  });
});
