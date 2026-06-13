// =================================================================
// stripe-payment-intent: crea Stripe PaymentIntent, guarda transacción
// STRIPE_SECRET_KEY debe estar en Supabase Secrets (nunca en BD).
// =================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_KEY    = Deno.env.get("STRIPE_SECRET_KEY");

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface PIRequest {
  clinic_id:      string;
  amount_cents:   number;   // importe en centavos MXN
  description:    string;
  appointment_id?: string;
  sale_id?:        string;
  metodo?:         string;  // "card" | "oxxo" | "spei"
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!STRIPE_KEY) {
    return json({ error: "STRIPE_SECRET_KEY no configurada en variables de entorno del servidor" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supaUser.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const svc = createClient(SUPABASE_URL, SUPABASE_SVC);

  // admin o receptionist pueden cobrar
  const { data: roles } = await svc
    .from("user_roles").select("role").eq("user_id", userData.user.id);
  const allowed = (roles ?? []).some((r: any) => ["admin", "receptionist"].includes(r.role));
  if (!allowed) return json({ error: "Forbidden" }, 403);

  try {
    const body: PIRequest = await req.json();
    const { clinic_id, amount_cents, description, appointment_id, sale_id, metodo = "card" } = body;

    if (!clinic_id || !amount_cents || amount_cents < 1) {
      return json({ error: "clinic_id y amount_cents (≥1) son obligatorios" }, 400);
    }

    // Cargar config Stripe de la clínica para verificar ambiente
    const { data: gwCfg } = await svc
      .from("payment_gateway_config")
      .select("proveedor, ambiente, activo")
      .eq("clinic_id", clinic_id)
      .maybeSingle();

    if (!gwCfg?.activo || gwCfg?.proveedor !== "stripe") {
      return json({ error: "Stripe no está configurado o no está activo para esta clínica" }, 400);
    }

    // Crear PaymentIntent en Stripe (API directa, sin SDK)
    const params = new URLSearchParams({
      amount:              String(amount_cents),
      currency:            "mxn",
      description,
      "payment_method_types[]": metodo === "oxxo" ? "oxxo" : metodo === "spei" ? "customer_balance" : "card",
      "metadata[clinic_id]":    clinic_id,
      ...(appointment_id ? { "metadata[appointment_id]": appointment_id } : {}),
      ...(sale_id        ? { "metadata[sale_id]":        sale_id }        : {}),
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${STRIPE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const piData = await stripeRes.json();

    if (!stripeRes.ok) {
      const msg = piData?.error?.message ?? `Stripe error ${stripeRes.status}`;
      console.error("[stripe-payment-intent] Stripe error:", msg);
      return json({ error: msg }, 422);
    }

    // Guardar transacción pendiente en BD
    const { data: txn, error: txnErr } = await svc
      .from("payment_transactions")
      .insert({
        clinic_id,
        appointment_id:    appointment_id ?? null,
        sale_id:           sale_id ?? null,
        proveedor:         "stripe",
        payment_intent_id: piData.id,
        amount:            amount_cents / 100,
        currency:          "MXN",
        metodo,
        status:            "pending",
        metadata:          { description },
      })
      .select("id")
      .single();

    if (txnErr) {
      console.error("[stripe-payment-intent] DB insert error:", txnErr.message);
      // No bloquear — devolver igual para que el pago pueda continuar
    }

    return json({
      ok:                true,
      client_secret:     piData.client_secret,
      payment_intent_id: piData.id,
      transaction_id:    txn?.id ?? null,
      amount_cents,
    });

  } catch (err: any) {
    console.error("[stripe-payment-intent] unexpected error:", err);
    return json({ error: err.message ?? "Error interno" }, 500);
  }
});
