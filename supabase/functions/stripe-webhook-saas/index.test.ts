import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { deriveSubscriptionStatus } from "./index.ts";

Deno.test("cancel_at_period_end=true produce status canceling y cancelAt poblado", () => {
  const result = deriveSubscriptionStatus({
    cancel_at_period_end: true,
    status: "active",
    current_period_end: 1735689600,
  });
  assertEquals(result.status, "canceling");
  assertEquals(result.cancelAt, new Date(1735689600 * 1000).toISOString());
});

Deno.test("subscription activa sin cancelacion produce status active y cancelAt null", () => {
  const result = deriveSubscriptionStatus({
    cancel_at_period_end: false,
    status: "active",
    current_period_end: 1735689600,
  });
  assertEquals(result.status, "active");
  assertEquals(result.cancelAt, null);
});

Deno.test("status no-active de Stripe (ej. past_due) se refleja tal cual", () => {
  const result = deriveSubscriptionStatus({
    cancel_at_period_end: false,
    status: "past_due",
    current_period_end: 1735689600,
  });
  assertEquals(result.status, "past_due");
  assertEquals(result.cancelAt, null);
});

Deno.test("cancel_at_period_end=true sin current_period_end deja cancelAt null", () => {
  const result = deriveSubscriptionStatus({
    cancel_at_period_end: true,
    status: "active",
    current_period_end: undefined,
  });
  assertEquals(result.status, "canceling");
  assertEquals(result.cancelAt, null);
});

Deno.test("subscription null/undefined no revienta", () => {
  assertEquals(deriveSubscriptionStatus(null), { status: undefined, cancelAt: null });
  assertEquals(deriveSubscriptionStatus(undefined), { status: undefined, cancelAt: null });
});
