import { describe, it, expect } from "vitest";
import { deriveIvaTratamiento, REGIMEN_TIPO_PERSONA } from "@/features/contabilidad/ivaRules";

describe("REGIMEN_TIPO_PERSONA", () => {
  it("clasifica regímenes no ambiguos de persona moral", () => {
    expect(REGIMEN_TIPO_PERSONA["601"]).toBe("moral");
    expect(REGIMEN_TIPO_PERSONA["603"]).toBe("moral");
    expect(REGIMEN_TIPO_PERSONA["620"]).toBe("moral");
    expect(REGIMEN_TIPO_PERSONA["623"]).toBe("moral");
  });

  it("clasifica regímenes no ambiguos de persona física", () => {
    for (const clave of ["605", "606", "608", "611", "612", "614", "616", "621", "625"]) {
      expect(REGIMEN_TIPO_PERSONA[clave]).toBe("fisica");
    }
  });

  it("marca como ambiguos (null) los regímenes que aplican a ambos tipos", () => {
    for (const clave of ["610", "622", "624", "626"]) {
      expect(REGIMEN_TIPO_PERSONA[clave]).toBeNull();
    }
  });
});

describe("deriveIvaTratamiento", () => {
  it("ING_FARMACIA siempre es tasa_0, sin importar tipo de persona", () => {
    expect(deriveIvaTratamiento("601", "moral", "402")).toEqual({ tratamiento: "tasa_0", tasaPct: 0 });
    expect(deriveIvaTratamiento("612", "fisica", "402")).toEqual({ tratamiento: "tasa_0", tasaPct: 0 });
  });

  it("ING_FARMACIA es tasa_0 incluso si tipoPersona es null (no depende de persona)", () => {
    expect(deriveIvaTratamiento("626", null, "402")).toEqual({ tratamiento: "tasa_0", tasaPct: 0 });
  });

  it("ING_CONSULTAS es exento para persona física (Art. 15-XIV LIVA)", () => {
    expect(deriveIvaTratamiento("612", "fisica", "401")).toEqual({ tratamiento: "exento", tasaPct: null });
  });

  it("ING_CONSULTAS es tasa_general 16% para persona moral", () => {
    expect(deriveIvaTratamiento("601", "moral", "401")).toEqual({ tratamiento: "tasa_general", tasaPct: 16 });
  });

  it("ING_CONSULTAS retorna null si tipoPersona es null (régimen ambiguo sin resolver)", () => {
    expect(deriveIvaTratamiento("626", null, "401")).toBeNull();
  });

  it("ING_OTROS siempre es tasa_general 16%, sin importar tipo de persona", () => {
    expect(deriveIvaTratamiento("612", "fisica", "403")).toEqual({ tratamiento: "tasa_general", tasaPct: 16 });
    expect(deriveIvaTratamiento("601", "moral", "403")).toEqual({ tratamiento: "tasa_general", tasaPct: 16 });
  });

  it("ING_OTROS retorna null si tipoPersona es null", () => {
    expect(deriveIvaTratamiento("610", null, "403")).toBeNull();
  });
});
