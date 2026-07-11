import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isClinicAccessForbidden } from "./index.ts";

// Regresion que este test protege: el check de rol (admin/receptionist) era
// global, sin cruzarlo contra la clinica del cobro — cualquier admin/
// receptionist podia generar un PaymentIntent atribuido a otra clinica solo
// cambiando clinic_id en el body. Ver docs/edge-functions-service-role-audit.md.
Deno.test("caller sin membresia en la clinica del cobro es rechazado", () => {
  const memberships = [{ clinic_id: "clinic-2" }];
  assertEquals(isClinicAccessForbidden(memberships, "clinic-1"), true);
});

Deno.test("caller con membresia en la clinica del cobro es permitido", () => {
  const memberships = [{ clinic_id: "clinic-1" }, { clinic_id: "clinic-2" }];
  assertEquals(isClinicAccessForbidden(memberships, "clinic-1"), false);
});

Deno.test("sin membresias en absoluto es rechazado", () => {
  assertEquals(isClinicAccessForbidden(null, "clinic-1"), true);
});
