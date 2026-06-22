import { describe, it, expect } from "vitest";
import { isStoragePath } from "../features/panel-doctor/services/studiesService";

describe("isStoragePath", () => {
  it("returns true for sb: prefix", () => {
    expect(isStoragePath("sb:estudios-resultados/clinic-id/patient-id/study-id/1234-file.pdf")).toBe(true);
  });

  it("returns false for http URLs", () => {
    expect(isStoragePath("http://localhost:3001/files/test.pdf")).toBe(false);
  });

  it("returns false for https URLs", () => {
    expect(isStoragePath("https://example.com/file.pdf")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isStoragePath("")).toBe(false);
  });

  it("returns false for partial prefix", () => {
    expect(isStoragePath("s:path")).toBe(false);
  });
});
