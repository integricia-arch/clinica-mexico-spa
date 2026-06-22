import { describe, it, expect } from "vitest";

// Pure logic extracted for testability
export function buildDoctorOrFilter(myDoctorId: string, sharedIds: string[]): string {
  const ownFilter = `doctor_id.eq.${myDoctorId}`;
  if (sharedIds.length === 0) return `or=(${ownFilter})`;
  return `or=(${ownFilter},id.in.(${sharedIds.join(",")}))`;
}

describe("buildDoctorOrFilter", () => {
  it("returns own filter only when no shared ids", () => {
    expect(buildDoctorOrFilter("abc-123", [])).toBe("or=(doctor_id.eq.abc-123)");
  });

  it("includes shared ids in IN clause", () => {
    expect(buildDoctorOrFilter("abc-123", ["id1", "id2"])).toBe(
      "or=(doctor_id.eq.abc-123,id.in.(id1,id2))"
    );
  });

  it("handles single shared id", () => {
    expect(buildDoctorOrFilter("abc-123", ["id1"])).toBe(
      "or=(doctor_id.eq.abc-123,id.in.(id1))"
    );
  });
});
