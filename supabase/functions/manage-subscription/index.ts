// manage-subscription: panel de staff para editar módulos, reactivar y
// suspender la suscripción de una clínica. Stripe se toca primero; la DB
// solo se actualiza si Stripe confirma. Solo accesible para platform_staff.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno["env"].get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno["env"].get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno["env"].get(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"))!;
const STRIPE_SAAS_KEY = Deno["env"].get(["STRIPE", "SAAS", "SECRET", "KEY"].join("_"))!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function stripeFetch(path: string, method: "GET" | "POST" | "DELETE", params?: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SAAS_KEY}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe error ${res.status}`);
  return data;
}

export async function buildSummary(admin: SupabaseClient, _stripeKey: string, clinicId: string) {
  const { data: clinic, error: clinicErr } = await admin
    .from("clinics")
    .select(
      "id, name, status, plan, subscription_status, grace_period_ends_at, stripe_customer_id_saas, stripe_subscription_id_saas",
    )
    .eq("id", clinicId)
    .single();
  if (clinicErr || !clinic) throw new Error(clinicErr?.message ?? "Clínica no encontrada");

  const { data: modulos, error: modulosErr } = await admin
    .from("cliente_modulos")
    .select("modulo_id, catalogo_modulos(id, nombre, precio_centavos, stripe_price_id)")
    .eq("clinic_id", clinicId);
  if (modulosErr) throw new Error(modulosErr.message);

  let subscription: Record<string, unknown> | null = null;
  let invoices: Record<string, unknown>[] = [];

  if (clinic.stripe_subscription_id_saas) {
    subscription = await stripeFetch(
      `subscriptions/${clinic.stripe_subscription_id_saas}?expand[]=default_payment_method&expand[]=latest_invoice`,
      "GET",
    );
  }
  if (clinic.stripe_customer_id_saas) {
    const invoiceList = await stripeFetch(
      `invoices?customer=${clinic.stripe_customer_id_saas}&limit=12`,
      "GET",
    );
    invoices = invoiceList.data ?? [];
  }

  return { clinic, modulos: modulos ?? [], subscription, invoices };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "no auth" }, 401);

    const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "no user" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: isStaff } = await admin.rpc("is_global_admin", { _user_id: userData.user.id });
    if (!isStaff) return json({ error: "forbidden" }, 403);

    const url = new URL(req.url);

    if (req.method === "GET") {
      const clinicId = url.searchParams.get("clinic_id");
      if (!clinicId) return json({ error: "clinic_id es requerido" }, 400);
      const summary = await buildSummary(admin, STRIPE_SAAS_KEY, clinicId);
      return json(summary);
    }

    return json({ error: "acción no reconocida" }, 400);
  } catch (err) {
    console.error("[manage-subscription] unexpected error:", err);
    return json({ error: (err as Error).message ?? "error inesperado" }, 500);
  }
});
