import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isSelfServiceActionForbidden } from "./index.ts";

// Regresión que este test protege: un admin de clínica (no-staff) NO puede
// llamar update_modules/suspend/reactivate sobre su PROPIA clínica, aunque su
// membership sea válido. Solo "cancel" debe pasar el gate. Un `||` → `&&`
// (o quitar la comparación de action) haría pasar este test a rojo.
Deno.test("gate rechaza update_modules de un admin de su propia clinic", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(
    isSelfServiceActionForbidden("update_modules", membership, "clinic-1"),
    true,
  );
});

Deno.test("gate rechaza suspend de un admin de su propia clinic", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(
    isSelfServiceActionForbidden("suspend", membership, "clinic-1"),
    true,
  );
});

Deno.test("gate rechaza reactivate de un admin de su propia clinic", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(
    isSelfServiceActionForbidden("reactivate", membership, "clinic-1"),
    true,
  );
});

Deno.test("gate permite cancel de un admin de su propia clinic", () => {
  const membership = { role: "admin", clinic_id: "clinic-1" };
  assertEquals(
    isSelfServiceActionForbidden("cancel", membership, "clinic-1"),
    false,
  );
});
