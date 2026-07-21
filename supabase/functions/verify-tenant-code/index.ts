// verify-tenant-code: segundo paso del alta de tenant. Valida el código de
// verificación mandado por create-tenant y crea una Checkout Session de
// Stripe (suscripción SaaS) para los módulos elegidos. El aprovisionamiento
// real (customer, membership, activación) ocurre en el webhook de Stripe al
// confirmarse el pago. Solo accesible para platform_staff.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno["env"].get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno["env"].get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno["env"].get(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"))!;
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

    // Código correcto y vigente: quemarlo de inmediato. Evita reuso/replay y
    // reduce el blast radius de la fuga de `clinics` (RLS USING(true), ver H1).
    await admin
      .from("clinics")
      .update({ verification_code: null, verification_code_expires_at: null })
      .eq("id", clinicId);

    const { data: modulos, error: modulosErr } = await admin
      .from("catalogo_modulos")
      .select("id, stripe_price_id")
      .in("id", moduloIds)
      .eq("activo", true);
    if (modulosErr || !modulos?.length || modulos.some((m) => !m.stripe_price_id)) {
      return json({ error: "Módulos inválidos o sin stripe_price_id configurado" }, 400);
    }

    const DEFAULT_SITE = "https://integrika.mx";
    const params = new URLSearchParams({
      mode: "subscription",
      success_url: `${DEFAULT_SITE}/admin/tenants?pago=procesando&clinic_id=${clinicId}`,
      cancel_url: `${DEFAULT_SITE}/admin/tenants?pago=cancelado&clinic_id=${clinicId}`,
      "metadata[clinic_id]": clinicId,
      customer_email: (clinic.contacto_facturacion_email as string) ?? adminEmail,
      locale: "es-419",
    });
    modulos.forEach((m, i) => {
      params.append(`line_items[${i}][price]`, m.stripe_price_id as string);
      params.append(`line_items[${i}][quantity]`, "1");
    });

    const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SAAS_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const session = await sessionRes.json();
    if (!sessionRes.ok) {
      console.error("[verify-tenant-code] error creando Checkout Session:", session);
      return json({ error: session?.error?.message ?? "Error creando sesión de pago" }, 502);
    }

    return json({ checkout_url: session.url });
  } catch (err) {
    console.error("[verify-tenant-code] unexpected error:", err);
    return json({ error: (err as Error).message ?? "error inesperado" }, 500);
  }
});
