import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isSelfServiceActionForbidden } from "./index.ts";

// create_portal_session debe ser self-service (el cliente lo dispara desde
// /configuracion/pagos sin ser staff) pero SOLO sobre su propia clínica.
Deno.test("create_portal_session: permitido self-service en la propia clinic", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(isSelfServiceActionForbidden("create_portal_session", membership, "clinic-1"), false);
});

Deno.test("create_portal_session: rechazado sobre clinic ajena", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(isSelfServiceActionForbidden("create_portal_session", membership, "clinic-2"), true);
});
