import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isClinicAccessForbidden } from "./clinic-access.ts";

// Regresion que este test protege: un admin/receptionist con rol permitido
// a nivel global podia disparar notify-appointment-assigned para una cita
// de otra clinica solo conociendo el appointment_id. Ver
// docs/edge-functions-service-role-audit.md.

Deno.test("caller sin membresia en la clinica de la cita es rechazado", () => {
  const memberships = [{ clinic_id: "clinic-2" }];
  assertEquals(isClinicAccessForbidden(memberships, "clinic-1"), true);
});

Deno.test("caller con membresia en la clinica de la cita es permitido", () => {
  const memberships = [{ clinic_id: "clinic-1" }];
  assertEquals(isClinicAccessForbidden(memberships, "clinic-1"), false);
});

Deno.test("cita sin clinic_id resoluble es rechazada", () => {
  const memberships = [{ clinic_id: "clinic-1" }];
  assertEquals(isClinicAccessForbidden(memberships, null), true);
});

Deno.test("caller sin ninguna membresia es rechazado", () => {
  assertEquals(isClinicAccessForbidden(null, "clinic-1"), true);
});
