import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isClinicMembershipMissing } from "./index.ts";

// Regresion que este test protege: cfdi-parse aceptaba clinic_id del body
// sin cruzarlo contra clinic_memberships — un usuario autenticado de la
// Clinica A podia leer/escribir datos de facturacion de la Clinica B con
// solo cambiar el clinic_id enviado. Ver docs/edge-functions-service-role-audit.md.
Deno.test("usuario sin membresia en la clinica solicitada es rechazado", () => {
  const memberships = [{ clinic_id: "clinic-2" }];
  assertEquals(isClinicMembershipMissing(memberships, "clinic-1"), true);
});

Deno.test("usuario con membresia activa en la clinica solicitada es permitido", () => {
  const memberships = [{ clinic_id: "clinic-1" }, { clinic_id: "clinic-2" }];
  assertEquals(isClinicMembershipMissing(memberships, "clinic-1"), false);
});

Deno.test("sin membresias en absoluto es rechazado", () => {
  assertEquals(isClinicMembershipMissing(null, "clinic-1"), true);
  assertEquals(isClinicMembershipMissing([], "clinic-1"), true);
});
