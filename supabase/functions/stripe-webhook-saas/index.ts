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
const STRIPE_PACIENTES_KEY = denoEnv.get(["STRIPE", "SECRET", "KEY"].join("_"))!;
const STRIPE_SAAS_KEY = denoEnv.get(["STRIPE", "SAAS", "SECRET", "KEY"].join("_"))!;

async function stripeSaasFetch(path: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SAAS_KEY}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe error ${res.status}`);
  return data;
}

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

// Deriva subscription_status / subscription_cancel_at para clinics a partir
// de un subscription object de Stripe. Pura para poder testear sin red/DB.
export function deriveSubscriptionStatus(
  sub: { cancel_at_period_end?: boolean; status?: string; current_period_end?: number } | null | undefined,
): { status: string | undefined; cancelAt: string | null } {
  const status = sub?.cancel_at_period_end
    ? "canceling"
    : (sub?.status === "active" ? "active" : sub?.status);
  const cancelAt = sub?.cancel_at_period_end && sub?.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;
  return { status, cancelAt };
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
      const { data: updated, error: updateErr } = await svc
        .from("clinics")
        .update({ subscription_status: "canceled", subscription_cancel_at: null })
        .eq("stripe_subscription_id_saas", subscriptionId)
        .select("id");
      if (updateErr) {
        console.error("[stripe-webhook-saas] subscription.deleted: update clinics falló:", subscriptionId, updateErr);
        break;
      }
      const clinicId = updated?.[0]?.id as string | undefined;
      if (!clinicId) {
        console.warn("[stripe-webhook-saas] subscription.deleted: sin clinic para subscription:", subscriptionId);
        break;
      }

      const { error: cmError } = await svc
        .from("cliente_modulos")
        .update({ activo_hasta: new Date().toISOString() })
        .eq("clinic_id", clinicId)
        .is("activo_hasta", null);
      if (cmError) {
        console.error("[stripe-webhook-saas] subscription.deleted: limpiar cliente_modulos falló:", clinicId, cmError);
      }

      console.log("[stripe-webhook-saas] subscription.deleted:", subscriptionId, clinicId);
      break;
    }

    case "customer.subscription.updated": {
      const sub = obj;
      const subscriptionId = sub?.id;
      const { status, cancelAt } = deriveSubscriptionStatus(sub);
      const { count } = await svc
        .from("clinics")
        .update({ subscription_status: status, subscription_cancel_at: cancelAt })
        .eq("stripe_subscription_id_saas", subscriptionId);
      if (!count) console.warn("[stripe-webhook-saas] subscription.updated: sin clinic para subscription:", subscriptionId);
      else console.log("[stripe-webhook-saas] subscription.updated:", subscriptionId, status);
      break;
    }

    case "checkout.session.completed": {
      const session = obj;
      const clinicId = session?.metadata?.clinic_id as string | undefined;
      if (!clinicId) {
        console.error("[stripe-webhook-saas] checkout.session.completed sin clinic_id:", session?.id);
        break;
      }

      const { data: claimed, error: claimErr } = await svc
        .from("clinics")
        .update({ status: "provisionando" })
        .eq("id", clinicId)
        .eq("status", "pendiente_verificacion")
        .select("id, name, contacto_facturacion_email, pending_admin_email, pending_modulo_ids")
        .single();

      if (claimErr || !claimed) {
        console.log("[stripe-webhook-saas] clinic ya reclamada/activada, se ignora:", clinicId);
        break;
      }

      try {
        if (!session.subscription) throw new Error("checkout session sin subscription");

        const adminEmail = claimed.pending_admin_email as string;

        // Fuente de verdad: los ítems reales de la suscripción en Stripe,
        // nunca pending_modulo_ids solo. pending_modulo_ids queda stale en
        // reactivaciones (el checkout se arma desde cliente_modulos actual,
        // no desde este campo) — usarlo ciego desincroniza cliente_modulos
        // de lo que Stripe realmente cobra (bug real, sesión 31: Santo Copo
        // terminó con 4 módulos en DB cobrando solo 1 en Stripe).
        const subscription = await stripeSaasFetch(
          `subscriptions/${session.subscription}?expand[]=items.data.price`,
        );
        const subscriptionPriceIds = ((subscription.items?.data ?? []) as { price?: { id?: string } }[])
          .map((item) => item.price?.id)
          .filter((id): id is string => Boolean(id));

        let moduloIds: string[];
        if (subscriptionPriceIds.length > 0) {
          const { data: matchedModulos, error: matchErr } = await svc
            .from("catalogo_modulos")
            .select("id, stripe_price_id")
            .in("stripe_price_id", subscriptionPriceIds);
          if (matchErr) throw new Error(`match modulos por price_id: ${matchErr.message}`);
          moduloIds = (matchedModulos ?? []).map((m) => m.id as string);
          if (moduloIds.length !== subscriptionPriceIds.length) {
            console.warn(
              "[stripe-webhook-saas] price_id de la subscription sin match en catalogo_modulos:",
              clinicId,
              subscriptionPriceIds,
              moduloIds,
            );
          }
        } else {
          console.warn(
            "[stripe-webhook-saas] subscription sin items, usando pending_modulo_ids como fallback:",
            clinicId,
          );
          moduloIds = (claimed.pending_modulo_ids ?? []) as string[];
        }

        const custRes = await fetch("https://api.stripe.com/v1/customers", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${STRIPE_PACIENTES_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Idempotency-Key": `customer-pacientes-${clinicId}`,
          },
          body: new URLSearchParams({
            name: claimed.name as string,
            email: (claimed.contacto_facturacion_email as string) ?? adminEmail,
            "metadata[clinic_id]": clinicId,
          }),
        });
        const customer = await custRes.json();
        if (!custRes.ok) throw new Error(`customer pacientes: ${customer?.error?.message ?? custRes.status}`);

        let adminUserId: string;
        const { data: invited, error: inviteErr } = await svc.auth.admin.inviteUserByEmail(adminEmail);
        if (inviteErr || !invited?.user) {
          const alreadyExists = /already.*registered|already.*exists/i.test(inviteErr?.message ?? "");
          if (!alreadyExists) throw new Error(`invite admin: ${inviteErr?.message}`);
          let existing: { id: string } | undefined;
          for (let page = 1; page <= 20 && !existing; page++) {
            const { data: pageData, error: listErr } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
            if (listErr) throw new Error(`resolve admin user: ${listErr.message}`);
            existing = pageData.users.find((u) => u.email === adminEmail);
            if (pageData.users.length < 1000) break;
          }
          if (!existing) throw new Error(`resolve admin user: no encontrado ${adminEmail}`);
          adminUserId = existing.id;
        } else {
          adminUserId = invited.user.id;
        }

        const { error: membershipErr } = await svc.from("clinic_memberships").upsert(
          { user_id: adminUserId, clinic_id: clinicId, role: "admin", status: "active" },
          { onConflict: "clinic_id,user_id", ignoreDuplicates: true },
        );
        if (membershipErr) throw new Error(`membership: ${membershipErr.message}`);

        const { error: deleteOldError } = await svc
          .from("cliente_modulos")
          .delete()
          .eq("clinic_id", clinicId);
        if (deleteOldError) throw new Error(`limpiar modulos previos: ${deleteOldError.message}`);

        const { error: cmError } = await svc.from("cliente_modulos")
          .insert(moduloIds.map((modulo_id) => ({ clinic_id: clinicId, modulo_id })));
        if (cmError) throw new Error(`modulos: ${cmError.message}`);

        await svc.from("stripe_webhook_events")
          .insert({ event_id: event.id, event_type: event.type })
          .then(({ error }) => {
            if (error) console.log("[stripe-webhook-saas] event_id ya registrado:", event.id);
          });

        const { error: updateErr } = await svc.from("clinics").update({
          stripe_customer_id: customer.id,
          stripe_customer_id_saas: session.customer,
          stripe_subscription_id_saas: session.subscription,
          subscription_status: "active",
          status: "active",
          verification_code: null,
          verification_code_expires_at: null,
          pending_admin_email: null,
          pending_modulo_ids: null,
        }).eq("id", clinicId);
        if (updateErr) throw new Error(`activate clinic: ${updateErr.message}`);

        console.log("[stripe-webhook-saas] clinic activada:", clinicId);
      } catch (err) {
        console.error("[stripe-webhook-saas] provisioning falló, revirtiendo claim:", clinicId, err);
        await svc.from("clinics").update({ status: "pendiente_verificacion" }).eq("id", clinicId);
        return new Response("provisioning failed", { status: 500 });
      }

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
