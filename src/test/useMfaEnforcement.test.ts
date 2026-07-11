import { describe, it, expect } from "vitest";
import { mfaGateStatus } from "@/hooks/useMfaEnforcement";

describe("mfaGateStatus", () => {
  it("ok si el rol no requiere MFA", () => {
    expect(mfaGateStatus("aal1", "aal1", false)).toBe("ok");
  });

  it("needs-enroll si requiere MFA y no hay factor (nextLevel se queda en aal1)", () => {
    expect(mfaGateStatus("aal1", "aal1", true)).toBe("needs-enroll");
  });

  it("needs-challenge si requiere MFA, hay factor enrolado pero sesión sigue en aal1", () => {
    expect(mfaGateStatus("aal1", "aal2", true)).toBe("needs-challenge");
  });

  it("ok si requiere MFA y la sesión ya está en aal2", () => {
    expect(mfaGateStatus("aal2", "aal2", true)).toBe("ok");
  });
});
