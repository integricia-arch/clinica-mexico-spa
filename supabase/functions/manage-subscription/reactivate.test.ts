import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { needsNewCheckout } from "./index.ts";

Deno.test("sin subscription en Stripe, necesita checkout nuevo", () => {
  assertEquals(needsNewCheckout(null), true);
});

Deno.test("subscription canceled, necesita checkout nuevo", () => {
  assertEquals(needsNewCheckout({ status: "canceled" }), true);
});

Deno.test("subscription con cancel_at_period_end, se puede reanudar in-place", () => {
  assertEquals(needsNewCheckout({ status: "active", cancel_at_period_end: true }), false);
});

Deno.test("subscription paused, se puede reanudar in-place", () => {
  assertEquals(needsNewCheckout({ status: "paused", cancel_at_period_end: false }), false);
});
