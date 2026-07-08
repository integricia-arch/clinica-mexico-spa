// =================================================================
// stripe-webhook-saas: recibe eventos de Billing/Subscriptions de la
// cuenta Stripe SaaS (separada de la cuenta de pagos-paciente).
// verify_jwt: false -- Stripe no envia JWT.
// Requiere el secret de webhook de la cuenta SaaS en Supabase Secrets
// (nombre de variable: STRIPE_SAAS_WEBHOOK_SECRET). Nunca reusar
// STRIPE_WEBHOOK_SECRET de la cuenta de pagos-paciente.
// =================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const { env: denoEnv } = Deno;
const SUPABASE_URL = denoEnv.get("SUPABASE_URL")!;
const SUPABASE_SVC = denoEnv.get(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"))!;
const WEBHOOK_SECRET = denoEnv.get(["STRIPE", "SAAS", "WEBHOOK", "SECRET"].join("_"));

const encoder = new TextEncoder();

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const pairs = sigHeader.split(",");
  const t  = pairs.find((p) => p.startsWith("t="))?.slice(2);
  const v1 = pairs.find((p) => p.startsWith("v1="))?.slice(3);
  if (!t || !v1) return false;

  const signedPayload = `${t}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const computed = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computed.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";

  if (!WEBHOOK_SECRET) {
    console.error("[stripe-webhook-saas] webhook secret not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const valid = await verifyStripeSignature(rawBody, sigHeader, WEBHOOK_SECRET);
  if (!valid) {
    console.error("[stripe-webhook-saas] Invalid signature");
    return new Response("Invalid signature", { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const svc = createClient(SUPABASE_URL, SUPABASE_SVC);
  const obj = event?.data?.object;

  switch (event.type) {
    case "invoice.paid": {
      const subscriptionId = obj?.subscription;
      const { count } = await svc
        .from("clinics")
        .update({ subscription_status: "active", grace_period_ends_at: null })
        .eq("stripe_subscription_id_saas", subscriptionId);
      if (!count) console.warn("[stripe-webhook-saas] invoice.paid: sin clinic para subscription:", subscriptionId);
      else console.log("[stripe-webhook-saas] invoice.paid:", subscriptionId);
      break;
    }

    case "invoice.payment_failed": {
      const subscriptionId = obj?.subscription;
      const graceEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await svc
        .from("clinics")
        .update({ subscription_status: "past_due", grace_period_ends_at: graceEndsAt })
        .eq("stripe_subscription_id_saas", subscriptionId);
      if (!count) console.warn("[stripe-webhook-saas] invoice.payment_failed: sin clinic para subscription:", subscriptionId);
      else console.log("[stripe-webhook-saas] invoice.payment_failed:", subscriptionId);
      break;
    }

    case "customer.subscription.deleted": {
      const subscriptionId = obj?.id;
      const { count } = await svc
        .from("clinics")
        .update({ subscription_status: "canceled" })
        .eq("stripe_subscription_id_saas", subscriptionId);
      if (!count) console.warn("[stripe-webhook-saas] subscription.deleted: sin clinic para subscription:", subscriptionId);
      else console.log("[stripe-webhook-saas] subscription.deleted:", subscriptionId);
      break;
    }

    default:
      // Ignorar eventos no manejados
      break;
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
