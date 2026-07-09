import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildSummary } from "./index.ts";

function fakeAdminClient(clinicRow: Record<string, unknown>, modulosRows: Record<string, unknown>[]) {
  return {
    from(table: string) {
      if (table === "clinics") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: clinicRow, error: null }),
            }),
          }),
        };
      }
      if (table === "cliente_modulos") {
        return {
          select: () => ({
            eq: async () => ({ data: modulosRows, error: null }),
          }),
        };
      }
      throw new Error(`tabla inesperada en test: ${table}`);
    },
  } as unknown as import("https://esm.sh/@supabase/supabase-js@2.45.0").SupabaseClient;
}

Deno.test("buildSummary sin suscripción activa devuelve subscription=null", async () => {
  const admin = fakeAdminClient(
    {
      id: "clinic-1",
      name: "Clínica Test",
      status: "active",
      subscription_status: "active",
      grace_period_ends_at: null,
      stripe_customer_id_saas: null,
      stripe_subscription_id_saas: null,
    },
    [],
  );
  const result = await buildSummary(admin, "sk_test_fake", "clinic-1");
  assertEquals(result.subscription, null);
  assertEquals(result.invoices, []);
  assertEquals(result.clinic.name, "Clínica Test");
});
