import { describe, it, expect } from "vitest";
import { exceedsLimiteEfectivo } from "./cajaLimits";

describe("exceedsLimiteEfectivo", () => {
  it("returns false when limite is empty", () => {
    expect(exceedsLimiteEfectivo(5000, "")).toBe(false);
    expect(exceedsLimiteEfectivo(5000, null)).toBe(false);
    expect(exceedsLimiteEfectivo(5000, undefined)).toBe(false);
  });

  it("returns false when efectivo is below limite", () => {
    expect(exceedsLimiteEfectivo(3000, "5000")).toBe(false);
  });

  it("returns true when efectivo exceeds limite", () => {
    expect(exceedsLimiteEfectivo(6000, "5000")).toBe(true);
  });

  it("returns false when efectivo equals limite exactly", () => {
    expect(exceedsLimiteEfectivo(5000, "5000")).toBe(false);
  });

  it("returns false for non-numeric limite", () => {
    expect(exceedsLimiteEfectivo(6000, "abc")).toBe(false);
  });
});
