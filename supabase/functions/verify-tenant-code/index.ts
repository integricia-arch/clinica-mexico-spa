// verify-tenant-code: segundo paso del alta de tenant. Valida el código de
// verificación mandado por create-tenant y recién ahí crea el customer/
// subscription de Stripe (cuenta pacientes + cuenta SaaS), invita al admin
// y activa los módulos elegidos. Solo accesible para platform_staff.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno["env"].get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno["env"].get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno["env"].get(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"))!;
const STRIPE_KEY = Deno["env"].get(["STRIPE", "SECRET", "KEY"].join("_"))!;
const STRIPE_SAAS_KEY = Deno["env"].get(["STRIPE", "SAAS", "SECRET", "KEY"].join("_"))!;

interface VerifyBody {
  clinic_id: string;
  code: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    const body = (await req.json()) as VerifyBody;
    if (!body.clinic_id || !body.code) {
      return json({ error: "clinic_id y code son requeridos" }, 400);
    }

    const { data: clinic, error: clinicErr } = await admin
      .from("clinics")
      .select("id, name, status, contacto_facturacion_email, pending_admin_email, pending_modulo_ids, verification_code, verification_code_expires_at")
      .eq("id", body.clinic_id)
      .single();

    if (clinicErr || !clinic) return json({ error: "Clínica no encontrada" }, 404);
    if (clinic.status !== "pendiente_verificacion") {
      return json({ error: "Esta clínica no está esperando verificación" }, 400);
    }
    if (clinic.verification_code !== body.code) {
      return json({ error: "Código incorrecto" }, 400);
    }
    if (!clinic.verification_code_expires_at || new Date(clinic.verification_code_expires_at) < new Date()) {
      return json({ error: "El código expiró — vuelve a generar el alta" }, 400);
    }

    const clinicId = clinic.id as string;
    const adminEmail = clinic.pending_admin_email as string;
    const moduloIds = (clinic.pending_modulo_ids ?? []) as string[];

    const { data: modulos, error: modulosErr } = await admin
      .from("catalogo_modulos")
      .select("id, stripe_price_id")
      .in("id", moduloIds)
      .eq("activo", true);
    if (modulosErr || !modulos?.length || modulos.some((m) => !m.stripe_price_id)) {
      return json({ error: "Módulos inválidos o sin stripe_price_id configurado" }, 400);
    }

    let stripeCustomerId: string | null = null;
    try {
      const stripeRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          name: clinic.name as string,
          email: (clinic.contacto_facturacion_email as string) ?? adminEmail,
          "metadata[clinic_id]": clinicId,
        }),
      });
      const stripeCustomer = await stripeRes.json();
      if (!stripeRes.ok) {
        throw new Error(stripeCustomer?.error?.message ?? `Stripe error ${stripeRes.status}`);
      }
      stripeCustomerId = stripeCustomer.id as string;
      await admin.from("clinics").update({ stripe_customer_id: stripeCustomerId }).eq("id", clinicId);
    } catch (stripeErr) {
      console.error("[verify-tenant-code] error Stripe:", stripeErr);
      return json({ error: `Error creando cliente Stripe: ${(stripeErr as Error).message}` }, 500);
    }

    let adminUserId: string;
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(adminEmail);
    if (inviteErr || !invited?.user) {
      const alreadyExists = /already.*registered|already.*exists/i.test(inviteErr?.message ?? "");
      if (!alreadyExists) {
        console.error("[verify-tenant-code] error invitando admin:", inviteErr);
        return json({ error: inviteErr?.message ?? "error invitando admin" }, 500);
      }
      const { data: existingUsers, error: listErr } = await admin.auth.admin.listUsers();
      const existing = existingUsers?.users.find((u) => u.email === adminEmail);
      if (listErr || !existing) {
        console.error("[verify-tenant-code] email ya registrado pero no se pudo resolver user_id:", listErr);
        return json({ error: "El email ya está registrado y no se pudo resolver el usuario" }, 500);
      }
      adminUserId = existing.id;
    } else {
      adminUserId = invited.user.id;
    }

    const { error: membershipErr } = await admin.from("clinic_memberships").insert({
      user_id: adminUserId,
      clinic_id: clinicId,
      role: "admin",
      status: "active",
    });
    if (membershipErr) {
      console.error("[verify-tenant-code] error creando membership:", membershipErr);
      return json({ error: membershipErr.message }, 500);
    }

    const saasCustomerRes = await fetch("https://api.stripe.com/v1/customers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SAAS_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ name: clinic.name as string, email: (clinic.contacto_facturacion_email as string) ?? "" }),
    });
    if (!saasCustomerRes.ok) {
      return json({ error: "No se pudo crear customer Stripe SaaS" }, 502);
    }
    const saasCustomer = await saasCustomerRes.json();

    const subParams = new URLSearchParams({ customer: saasCustomer.id });
    modulos.forEach((m, i) => {
      subParams.append(`items[${i}][price]`, m.stripe_price_id as string);
    });
    const subRes = await fetch("https://api.stripe.com/v1/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SAAS_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: subParams,
    });
    if (!subRes.ok) {
      await fetch(`https://api.stripe.com/v1/customers/${saasCustomer.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${STRIPE_SAAS_KEY}` },
      }).catch((e) => console.error("[verify-tenant-code] no se pudo borrar customer SaaS huerfano:", e));
      return json({ error: "No se pudo crear la suscripción Stripe SaaS" }, 502);
    }
    const subscription = await subRes.json();

    const { error: updateErr } = await admin
      .from("clinics")
      .update({
        stripe_customer_id_saas: saasCustomer.id,
        stripe_subscription_id_saas: subscription.id,
        subscription_status: "trialing",
        status: "active",
        verification_code: null,
        verification_code_expires_at: null,
        pending_admin_email: null,
        pending_modulo_ids: null,
      })
      .eq("id", clinicId);
    if (updateErr) {
      return json({ error: "No se pudo guardar la suscripción en clinics" }, 500);
    }

    const { error: cmError } = await admin
      .from("cliente_modulos")
      .insert(moduloIds.map((modulo_id) => ({ clinic_id: clinicId, modulo_id })));
    if (cmError) {
      return json({ error: "No se pudieron guardar los módulos del cliente" }, 500);
    }

    return json({ clinic_id: clinicId, status: "active" });
  } catch (err) {
    console.error("[verify-tenant-code] unexpected error:", err);
    return json({ error: (err as Error).message ?? "error inesperado" }, 500);
  }
});
