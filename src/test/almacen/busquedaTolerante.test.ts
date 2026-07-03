import { describe, it, expect } from "vitest";
import { normalizarTexto, distanciaLevenshtein } from "@/features/almacen/lib/busquedaTolerante";

describe("normalizarTexto", () => {
  it("quita acentos comunes del español", () => {
    expect(normalizarTexto("Acetaminofén")).toBe("acetaminofen");
    expect(normalizarTexto("María José")).toBe("maria jose");
  });

  it("no quita la ñ (no es diacrítico compuesto)", () => {
    expect(normalizarTexto("Niño")).toBe("niño");
    expect(normalizarTexto("PEQUEÑO")).toBe("pequeño");
  });

  it("pasa a minúsculas y recorta espacios", () => {
    expect(normalizarTexto("  IBUPROFENO  ")).toBe("ibuprofeno");
  });

  it("maneja string vacío", () => {
    expect(normalizarTexto("")).toBe("");
  });
});

describe("distanciaLevenshtein", () => {
  it("true cuando las palabras son idénticas (distancia 0)", () => {
    expect(distanciaLevenshtein("paracetamol", "paracetamol", 1)).toBe(true);
  });

  it("true cuando hay exactamente 1 error de tipeo", () => {
    expect(distanciaLevenshtein("acetaminofen", "acetaminofn", 1)).toBe(true); // falta 1 letra
    expect(distanciaLevenshtein("acetaminofen", "aceteminofen", 1)).toBe(true); // 1 sustitución
    expect(distanciaLevenshtein("acetaminofen", "acetaminofehn", 1)).toBe(true); // 1 letra de más
  });

  it("false cuando hay 2 o más errores de tipeo", () => {
    expect(distanciaLevenshtein("acetaminofen", "aceteminofn", 1)).toBe(false);
  });

  it("false para palabras muy distintas", () => {
    expect(distanciaLevenshtein("paracetamol", "ibuprofeno", 1)).toBe(false);
  });

  it("maneja strings vacíos", () => {
    expect(distanciaLevenshtein("", "", 1)).toBe(true);
    expect(distanciaLevenshtein("a", "", 1)).toBe(true);
    expect(distanciaLevenshtein("ab", "", 1)).toBe(false);
  });

  it("es case-sensitive por diseño — el caller normaliza antes de llamar", () => {
    expect(distanciaLevenshtein("Paracetamol", "paracetamol", 1)).toBe(false);
  });
});
