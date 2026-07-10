import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { canManageOwnSubscription } from "./index.ts";

Deno.test("admin de la propia clinic puede cancelar", () => {
  assertEquals(
    canManageOwnSubscription({ role: "admin", clinic_id: "abc" }, "abc"),
    true,
  );
});

Deno.test("admin de OTRA clinic no puede cancelar", () => {
  assertEquals(
    canManageOwnSubscription({ role: "admin", clinic_id: "xyz" }, "abc"),
    false,
  );
});

Deno.test("rol no-admin no puede cancelar", () => {
  assertEquals(
    canManageOwnSubscription({ role: "viewer", clinic_id: "abc" }, "abc"),
    false,
  );
});
