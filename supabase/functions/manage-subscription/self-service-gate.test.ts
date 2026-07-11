import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isSelfServiceActionForbidden } from "./index.ts";

// Regresión que este test protege: un admin de clínica (no-staff) SÍ puede
// gestionar su propia suscripción vía cancel/update_modules/create_portal_session,
// pero NUNCA suspend/reactivate (esas quedan exclusivas de platform_staff) ni
// ninguna acción sobre una clínica que no es la suya.
Deno.test("gate permite cancel de un admin de su propia clinic", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(isSelfServiceActionForbidden("cancel", membership, "clinic-1"), false);
});

Deno.test("gate permite update_modules de un admin de su propia clinic", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(isSelfServiceActionForbidden("update_modules", membership, "clinic-1"), false);
});

Deno.test("gate permite create_portal_session de un admin de su propia clinic", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(isSelfServiceActionForbidden("create_portal_session", membership, "clinic-1"), false);
});

Deno.test("gate rechaza suspend de un admin de su propia clinic", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(isSelfServiceActionForbidden("suspend", membership, "clinic-1"), true);
});

Deno.test("gate rechaza reactivate de un admin de su propia clinic", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(isSelfServiceActionForbidden("reactivate", membership, "clinic-1"), true);
});

Deno.test("gate rechaza update_modules sobre una clinic ajena", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(isSelfServiceActionForbidden("update_modules", membership, "clinic-2"), true);
});

Deno.test("gate rechaza cuando no hay membership", () => {
  assertEquals(isSelfServiceActionForbidden("cancel", null, "clinic-1"), true);
});
