// create-tenant: alta de un hospital cliente (clinic + Stripe customer + admin invitado).
// Solo accesible para platform_staff (is_global_admin).
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

interface CreateTenantBody {
  code: string;
  name: string;
  rfc?: string;
  address?: string;
  logo_url?: string;
  contacto_facturacion_email?: string;
  plan?: string;
  admin_email: string;
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

    const body = (await req.json()) as CreateTenantBody;
    if (!body.code || !body.name || !body.admin_email) {
      return json({ error: "code, name y admin_email son requeridos" }, 400);
    }

    const { data: clinic, error: clinicErr } = await admin
      .from("clinics")
      .insert({
        code: body.code,
        name: body.name,
        rfc: body.rfc ?? null,
        address: body.address ?? null,
        logo_url: body.logo_url ?? null,
        contacto_facturacion_email: body.contacto_facturacion_email ?? null,
        plan: body.plan ?? "estandar",
        status: "active",
      })
      .select("id")
      .single();

    if (clinicErr || !clinic) {
      console.error("[create-tenant] error creando clinic:", clinicErr);
      return json({ error: clinicErr?.message ?? "error creando clínica" }, 500);
    }
    const clinicId = clinic.id as string;
    let stripeCustomerId: string | null = null;

    try {
      const stripeRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          name: body.name,
          email: body.contacto_facturacion_email ?? body.admin_email,
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
      console.error("[create-tenant] error Stripe, revirtiendo clinic:", stripeErr);
      await admin.from("clinics").delete().eq("id", clinicId);
      return json({ error: `Error creando cliente Stripe: ${(stripeErr as Error).message}` }, 500);
    }

    const rollback = async () => {
      await admin.from("clinics").delete().eq("id", clinicId);
      if (stripeCustomerId) {
        await fetch(`https://api.stripe.com/v1/customers/${stripeCustomerId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${STRIPE_KEY}` },
        }).catch((e) => console.error("[create-tenant] no se pudo borrar customer Stripe huerfano:", e));
      }
    };

    let adminUserId: string;
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(body.admin_email);
    if (inviteErr || !invited?.user) {
      const alreadyExists = /already.*registered|already.*exists/i.test(inviteErr?.message ?? "");
      if (!alreadyExists) {
        console.error("[create-tenant] error invitando admin, revirtiendo clinic:", inviteErr);
        await rollback();
        return json({ error: inviteErr?.message ?? "error invitando admin" }, 500);
      }
      const { data: existingUsers, error: listErr } = await admin.auth.admin.listUsers();
      const existing = existingUsers?.users.find((u) => u.email === body.admin_email);
      if (listErr || !existing) {
        console.error("[create-tenant] email ya registrado pero no se pudo resolver user_id, revirtiendo clinic:", listErr);
        await rollback();
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
      console.error("[create-tenant] error creando membership, revirtiendo clinic:", membershipErr);
      await rollback();
      return json({ error: membershipErr.message }, 500);
    }

    return json({ clinic_id: clinicId });
  } catch (err) {
    console.error("[create-tenant] unexpected error:", err);
    return json({ error: (err as Error).message ?? "error inesperado" }, 500);
  }
});
