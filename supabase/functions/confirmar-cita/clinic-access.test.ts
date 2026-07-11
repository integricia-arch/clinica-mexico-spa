import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isApptClinicAccessForbidden } from "./clinic-access.ts";

// Regresion que este test protege: un receptionist de la Clinica A con rol
// permitido en ALGUNA clinica podia confirmar/cancelar citas de la Clinica B
// solo conociendo el appointment_id, porque el check original no cruzaba el
// rol contra la clinica dueña de la cita. Ver docs/edge-functions-service-role-audit.md.
const allowedRoles = ["admin", "manager", "receptionist"];

Deno.test("receptionist de otra clinica es rechazado", () => {
  const memberships = [{ role: "receptionist", clinic_id: "clinic-2" }];
  assertEquals(isApptClinicAccessForbidden(memberships, allowedRoles, "clinic-1"), true);
});

Deno.test("receptionist de la clinica dueña de la cita es permitido", () => {
  const memberships = [{ role: "receptionist", clinic_id: "clinic-1" }];
  assertEquals(isApptClinicAccessForbidden(memberships, allowedRoles, "clinic-1"), false);
});

Deno.test("rol no permitido en la clinica correcta es rechazado", () => {
  const memberships = [{ role: "nurse", clinic_id: "clinic-1" }];
  assertEquals(isApptClinicAccessForbidden(memberships, allowedRoles, "clinic-1"), true);
});

Deno.test("cita sin clinic_id es rechazada por defecto", () => {
  const memberships = [{ role: "admin", clinic_id: "clinic-1" }];
  assertEquals(isApptClinicAccessForbidden(memberships, allowedRoles, null), true);
});
