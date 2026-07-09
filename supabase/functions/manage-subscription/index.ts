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

export function diffModulos(current: string[], next: string[]): { toAdd: string[]; toRemove: string[] } {
  const currentSet = new Set(current);
  const nextSet = new Set(next);
  return {
    toAdd: next.filter((id) => !currentSet.has(id)),
    toRemove: current.filter((id) => !nextSet.has(id)),
  };
}

interface ActionBody {
  action: "update_modules" | "reactivate" | "suspend";
  clinic_id: string;
  modulo_ids?: string[];
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

    if (req.method === "POST") {
      const body = (await req.json()) as ActionBody;
      if (!body.clinic_id) return json({ error: "clinic_id es requerido" }, 400);

      if (body.action === "update_modules") {
        const nextIds = Array.isArray(body.modulo_ids) ? body.modulo_ids : [];
        if (nextIds.length === 0) return json({ error: "Selecciona al menos un módulo" }, 400);

        const { data: nextModulos, error: modulosErr } = await admin
          .from("catalogo_modulos")
          .select("id, stripe_price_id")
          .in("id", nextIds)
          .eq("activo", true);
        if (modulosErr || !nextModulos?.length || nextModulos.length !== nextIds.length) {
          return json({ error: "Módulos inválidos" }, 400);
        }
        if (nextModulos.some((m) => !m.stripe_price_id)) {
          return json({ error: "Un módulo no tiene stripe_price_id configurado" }, 400);
        }

        const { data: clinic, error: clinicErr } = await admin
          .from("clinics")
          .select("stripe_subscription_id_saas")
          .eq("id", body.clinic_id)
          .single();
        if (clinicErr || !clinic?.stripe_subscription_id_saas) {
          return json({ error: "Esta clínica no tiene una suscripción activa en Stripe" }, 400);
        }

        const { data: currentRows } = await admin
          .from("cliente_modulos")
          .select("modulo_id")
          .eq("clinic_id", body.clinic_id);
        const currentIds = (currentRows ?? []).map((r) => r.modulo_id as string);
        const { toAdd, toRemove } = diffModulos(currentIds, nextIds);

        const subscription = await stripeFetch(
          `subscriptions/${clinic.stripe_subscription_id_saas}`,
          "GET",
        );
        const items = (subscription.items?.data ?? []) as { id: string; price: { id: string } }[];

        const { data: removedModulos } = await admin
          .from("catalogo_modulos")
          .select("id, stripe_price_id")
          .in("id", toRemove.length ? toRemove : ["__none__"]);

        try {
          for (const priceId of toAdd.length
            ? nextModulos.filter((m) => toAdd.includes(m.id as string)).map((m) => m.stripe_price_id as string)
            : []) {
            await stripeFetch(
              "subscription_items",
              "POST",
              new URLSearchParams({
                subscription: clinic.stripe_subscription_id_saas as string,
                price: priceId,
                proration_behavior: "create_prorations",
              }),
            );
          }
          for (const modulo of removedModulos ?? []) {
            const item = items.find((it) => it.price.id === modulo.stripe_price_id);
            if (!item) continue;
            await stripeFetch(
              `subscription_items/${item.id}?proration_behavior=create_prorations`,
              "DELETE",
            );
          }
        } catch (stripeErr) {
          return json({ error: `Stripe: ${(stripeErr as Error).message}` }, 502);
        }

        const { error: deleteErr } = await admin.from("cliente_modulos").delete().eq("clinic_id", body.clinic_id);
        if (deleteErr) return json({ error: deleteErr.message }, 500);
        const { error: insertErr } = await admin
          .from("cliente_modulos")
          .insert(nextIds.map((modulo_id) => ({ clinic_id: body.clinic_id, modulo_id })));
        if (insertErr) return json({ error: insertErr.message }, 500);

        const summary = await buildSummary(admin, STRIPE_SAAS_KEY, body.clinic_id);
        return json(summary);
      }

      return json({ error: "acción no reconocida" }, 400);
    }

    return json({ error: "método no soportado" }, 405);
  } catch (err) {
    console.error("[manage-subscription] unexpected error:", err);
    return json({ error: (err as Error).message ?? "error inesperado" }, 500);
  }
});
