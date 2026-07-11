import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isStaffClinicAccessForbidden } from "./index.ts";

// Regresion que este test protege: create-appointment no validaba que el
// doctor_id enviado perteneciera a una clinica donde el staff caller tiene
// membresia, ni seteaba clinic_id en el insert — un receptionist de la
// Clinica A podia crear citas para un doctor de la Clinica B. Ver
// docs/edge-functions-service-role-audit.md.
Deno.test("staff sin membresia en la clinica del doctor es rechazado", () => {
  const memberships = [{ clinic_id: "clinic-2" }];
  assertEquals(isStaffClinicAccessForbidden(memberships, "clinic-1"), true);
});

Deno.test("staff con membresia en la clinica del doctor es permitido", () => {
  const memberships = [{ clinic_id: "clinic-1" }, { clinic_id: "clinic-2" }];
  assertEquals(isStaffClinicAccessForbidden(memberships, "clinic-1"), false);
});

Deno.test("doctor sin clinic_id es rechazado por defecto", () => {
  const memberships = [{ clinic_id: "clinic-1" }];
  assertEquals(isStaffClinicAccessForbidden(memberships, null), true);
});
