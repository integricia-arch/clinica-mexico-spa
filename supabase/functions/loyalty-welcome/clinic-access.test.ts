import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isClinicAccessForbidden } from "./clinic-access.ts";

// Regresion que este test protege: loyalty-welcome no validaba ningun JWT
// propio ni cruzaba member_id/clinic_id contra la membresia del caller --
// cualquier usuario autenticado podia forzar el reenvio del email de
// bienvenida a un miembro/clinica ajenos. Ver
// docs/edge-functions-service-role-audit.md.

Deno.test("caller sin membresia en la clinica del miembro es rechazado", () => {
  const memberships = [{ clinic_id: "clinic-2" }];
  assertEquals(isClinicAccessForbidden(memberships, "clinic-1"), true);
});

Deno.test("caller con membresia en la clinica del miembro es permitido", () => {
  const memberships = [{ clinic_id: "clinic-1" }];
  assertEquals(isClinicAccessForbidden(memberships, "clinic-1"), false);
});

Deno.test("clinic_id ausente en el body es rechazado", () => {
  const memberships = [{ clinic_id: "clinic-1" }];
  assertEquals(isClinicAccessForbidden(memberships, null), true);
});

Deno.test("caller sin ninguna membresia es rechazado", () => {
  assertEquals(isClinicAccessForbidden(null, "clinic-1"), true);
});
