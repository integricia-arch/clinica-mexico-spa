import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isCfdiDownloadForbidden } from "./index.ts";

// Regresion que este test protege: un receptionist SIN clinic_memberships
// (ej. membresia revocada pero rol legado en user_roles) podia descargar el
// CFDI de CUALQUIER clinica porque el check original solo se aplicaba
// cuando userClinicIds.length > 0. Ver docs/edge-functions-service-role-audit.md.
Deno.test("receptionist sin membresias es rechazado (antes se saltaba el check)", () => {
  assertEquals(isCfdiDownloadForbidden(["receptionist"], [], "clinic-1"), true);
});

Deno.test("receptionist con membresia de otra clinica es rechazado", () => {
  assertEquals(isCfdiDownloadForbidden(["receptionist"], ["clinic-2"], "clinic-1"), true);
});

Deno.test("receptionist con membresia de la clinica correcta es permitido", () => {
  assertEquals(isCfdiDownloadForbidden(["receptionist"], ["clinic-1"], "clinic-1"), false);
});

Deno.test("admin es rol global y siempre es permitido", () => {
  assertEquals(isCfdiDownloadForbidden(["admin"], [], "clinic-1"), false);
});
