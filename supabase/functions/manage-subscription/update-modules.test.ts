import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { diffModulos } from "./index.ts";

Deno.test("diffModulos detecta agregados y quitados", () => {
  const result = diffModulos(["a", "b"], ["b", "c"]);
  assertEquals(result.toAdd, ["c"]);
  assertEquals(result.toRemove, ["a"]);
});

Deno.test("diffModulos sin cambios devuelve arrays vacíos", () => {
  const result = diffModulos(["a", "b"], ["b", "a"]);
  assertEquals(result.toAdd, []);
  assertEquals(result.toRemove, []);
});
