import { describe, it, expect } from "vitest";
import { aplicaQuickFilter } from "@/features/almacen/CatalogoMedicamentos";
import type { Tables } from "@/integrations/supabase/types";

type Medicamento = Tables<"medicamentos">;
type Lote = Tables<"lotes_medicamento">;

function med(overrides: Partial<Medicamento> = {}): Medicamento {
  return {
    id: "m1", nombre: "Test", categoria: "Otro", unidad: "tableta",
    precio_unitario: 10, stock_minimo: 5, activo: true,
    sale_type: "otc", allow_direct_sale: true, requires_prescription: false,
    is_controlled: false, regulatory_notes: null, descripcion: null,
    ...overrides,
  } as Medicamento;
}

function lote(overrides: Partial<Lote> = {}): Lote {
  const hoy = new Date();
  const en10 = new Date(hoy); en10.setDate(hoy.getDate() + 10);
  return {
    id: "l1", medicamento_id: "m1", numero_lote: "L1",
    existencia: 10, fecha_caducidad: en10.toISOString().slice(0, 10),
    ...overrides,
  } as Lote;
}

describe("aplicaQuickFilter", () => {
  it("sin filtro (null/undefined) siempre pasa", () => {
    expect(aplicaQuickFilter(med(), [], null)).toBe(true);
    expect(aplicaQuickFilter(med(), [], undefined)).toBe(true);
  });

  it("bajo_stock: pasa cuando stockTotal < stock_minimo", () => {
    const m = med({ id: "m1", stock_minimo: 5 });
    const lotes = [lote({ medicamento_id: "m1", existencia: 2 })];
    expect(aplicaQuickFilter(m, lotes, "bajo_stock")).toBe(true);
  });

  it("bajo_stock: no pasa cuando stockTotal >= stock_minimo", () => {
    const m = med({ id: "m1", stock_minimo: 5 });
    const lotes = [lote({ medicamento_id: "m1", existencia: 10 })];
    expect(aplicaQuickFilter(m, lotes, "bajo_stock")).toBe(false);
  });

  it("por_caducar: pasa cuando tiene un lote con existencia>0 y caducidad <=90 dias", () => {
    const m = med({ id: "m1" });
    const lotes = [lote({ medicamento_id: "m1", existencia: 5 })]; // en10 dias, por defecto
    expect(aplicaQuickFilter(m, lotes, "por_caducar")).toBe(true);
  });

  it("por_caducar: no pasa si el lote proximo a vencer tiene existencia 0", () => {
    const m = med({ id: "m1" });
    const lotes = [lote({ medicamento_id: "m1", existencia: 0 })];
    expect(aplicaQuickFilter(m, lotes, "por_caducar")).toBe(false);
  });

  it("por_caducar: no pasa si todos los lotes vencen en mas de 90 dias", () => {
    const hoy = new Date();
    const en200 = new Date(hoy); en200.setDate(hoy.getDate() + 200);
    const m = med({ id: "m1" });
    const lotes = [lote({ medicamento_id: "m1", existencia: 5, fecha_caducidad: en200.toISOString().slice(0, 10) })];
    expect(aplicaQuickFilter(m, lotes, "por_caducar")).toBe(false);
  });
});
