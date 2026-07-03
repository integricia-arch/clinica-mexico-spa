import { describe, it, expect } from "vitest";
import { matchTolerante } from "@/features/almacen/CatalogoMedicamentos";

describe("matchTolerante", () => {
  it("encuentra por includes simple ignorando mayúsculas", () => {
    expect(matchTolerante("Acetaminofén", "acetaminofen")).toBe(true);
  });

  it("ignora acentos en el campo comparado", () => {
    expect(matchTolerante("Acetaminofén 500mg", "acetaminofen")).toBe(true);
  });

  it("tolera 1 error de tipeo en palabras largas (>4 caracteres)", () => {
    expect(matchTolerante("Acetaminofén 500mg", "acetaminofn")).toBe(true);
  });

  it("no aplica Levenshtein a palabras cortas (evita falsos positivos)", () => {
    // "IVA" (3 chars) vs "iba" tienen distancia 1 pero no deben matchear
    // por Levenshtein — solo por includes exacto tras normalizar.
    expect(matchTolerante("IVA incluido", "iba")).toBe(false);
  });

  it("campo vacío o null no matchea término no vacío", () => {
    expect(matchTolerante("", "acetaminofen")).toBe(false);
  });

  it("término vacío matchea cualquier campo (comportamiento includes)", () => {
    expect(matchTolerante("Acetaminofén", "")).toBe(true);
  });
});
