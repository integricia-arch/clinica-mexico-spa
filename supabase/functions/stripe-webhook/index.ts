// =================================================================
// stripe-webhook: recibe eventos Stripe, actualiza payment_transactions
// verify_jwt: false — Stripe no envía JWT.
// Requiere STRIPE_WEBHOOK_SECRET en Supabase Secrets.
// =================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

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

  // Constant-time comparison (basic)
  return computed === v1;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody  = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";

  if (!WEBHOOK_SECRET) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const valid = await verifyStripeSignature(rawBody, sigHeader, WEBHOOK_SECRET);
  if (!valid) {
    console.error("[stripe-webhook] Invalid signature");
    return new Response("Invalid signature", { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const svc = createClient(SUPABASE_URL, SUPABASE_SVC);
  const pi  = event?.data?.object;

  switch (event.type) {
    case "payment_intent.succeeded": {
      await svc
        .from("payment_transactions")
        .update({ status: "completed" })
        .eq("payment_intent_id", pi.id);
      console.log("[stripe-webhook] payment_intent.succeeded:", pi.id);
      break;
    }

    case "payment_intent.payment_failed": {
      await svc
        .from("payment_transactions")
        .update({
          status:   "failed",
          metadata: { failure_message: pi.last_payment_error?.message ?? "Error desconocido" },
        })
        .eq("payment_intent_id", pi.id);
      console.log("[stripe-webhook] payment_intent.payment_failed:", pi.id);
      break;
    }

    case "payment_intent.canceled": {
      await svc
        .from("payment_transactions")
        .update({ status: "cancelled" })
        .eq("payment_intent_id", pi.id);
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
