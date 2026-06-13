// =================================================================
// stripe-checkout: crea Stripe Checkout Session de suscripción
// para los planes del pitch público (Esencial / Profesional).
// verify_jwt: false — visitantes del pitch no tienen sesión.
// Precios definidos SERVER-SIDE; el cliente solo manda el plan.
// Requiere STRIPE_SECRET_KEY en Supabase Secrets.
// =================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");

// Precios en centavos MXN — nunca confiar en montos del cliente.
const PLANS: Record<string, { name: string; amount: number }> = {
  esencial:    { name: "ClinicaMX — Plan Esencial",    amount: 249900 },
  profesional: { name: "ClinicaMX — Plan Profesional", amount: 599900 },
};

const DEFAULT_SITE = "https://integrika.mx";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  if (!STRIPE_KEY) {
    return json({ error: "STRIPE_SECRET_KEY no configurada en el servidor" }, 500);
  }

  let plan = "";
  try {
    const body = await req.json();
    plan = String(body?.plan ?? "").toLowerCase().trim();
  } catch {
    return json({ error: "Body JSON inválido" }, 400);
  }

  const planDef = PLANS[plan];
  if (!planDef) {
    return json({ error: `Plan inválido. Opciones: ${Object.keys(PLANS).join(", ")}` }, 400);
  }

  // Origin del request para regresar al pitch; fallback a producción.
  const origin = req.headers.get("origin") ?? DEFAULT_SITE;
  const site = /^https?:\/\/(localhost|127\.0\.0\.1|.*integrika\.mx|.*workers\.dev)/.test(origin)
    ? origin
    : DEFAULT_SITE;

  try {
    const params = new URLSearchParams({
      mode: "subscription",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "mxn",
      "line_items[0][price_data][unit_amount]": String(planDef.amount),
      "line_items[0][price_data][product_data][name]": planDef.name,
      "line_items[0][price_data][recurring][interval]": "month",
      success_url: `${site}/pitch?suscripcion=ok&plan=${plan}`,
      cancel_url: `${site}/pitch?suscripcion=cancelada`,
      "metadata[plan]": plan,
      "metadata[source]": "pitch",
      locale: "es-419",
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      const msg = session?.error?.message ?? `Stripe error ${stripeRes.status}`;
      console.error("[stripe-checkout] Stripe error:", msg);
      return json({ error: msg }, 422);
    }

    return json({ ok: true, url: session.url, session_id: session.id });
  } catch (err) {
    console.error("[stripe-checkout] unexpected error:", err);
    return json({ error: (err as Error).message ?? "Error interno" }, 500);
  }
});
