import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { suspendClinic } from "./index.ts";

Deno.test("suspendClinic no actualiza la DB si Stripe falla", async () => {
  let dbUpdateCalled = false;
  const admin = {
    from(table: string) {
      if (table === "clinics") {
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: { id: "c1", stripe_subscription_id_saas: "sub_1" }, error: null }) }),
          }),
          update: () => {
            dbUpdateCalled = true;
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      throw new Error(`tabla inesperada: ${table}`);
    },
  } as unknown as import("https://esm.sh/@supabase/supabase-js@2.45.0").SupabaseClient;

  const failingStripeFetch = () => {
    throw new Error("Stripe caído (simulado)");
  };

  await suspendClinic(admin, failingStripeFetch as never, "c1").catch(() => {});
  assertEquals(dbUpdateCalled, false);
});
