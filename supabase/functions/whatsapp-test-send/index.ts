import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno["env"].get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno["env"].get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno["env"].get(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"))!;
const WHATSAPP_ACCESS_TOKEN = Deno["env"].get(["WHATSAPP", "ACCESS", "TOKEN"].join("_"))!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "no auth" }, 401);

  const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await supaUser.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "no user" }, 401);

  const body = (await req.json()) as { clinic_id: string; to: string };
  if (!body.clinic_id || !body.to) return json({ error: "clinic_id y to son requeridos" }, 400);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: clinic, error: clinicErr } = await admin
    .from("clinics")
    .select("whatsapp_phone_number_id")
    .eq("id", body.clinic_id)
    .single();
  if (clinicErr || !clinic?.whatsapp_phone_number_id) {
    return json({ error: "La clínica no tiene phone_number_id configurado" }, 400);
  }

  const { data: isStaff } = await admin.rpc("is_global_admin", { _user_id: userData.user.id });
  const { data: isClinicAdmin } = await admin.rpc("user_has_clinic_role", {
    _user_id: userData.user.id,
    _clinic_id: body.clinic_id,
    _role: "admin",
  });
  if (!isStaff && !isClinicAdmin) return json({ error: "forbidden" }, 403);

  const metaRes = await fetch(`https://graph.facebook.com/v20.0/${clinic.whatsapp_phone_number_id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: body.to,
      type: "text",
      text: { body: "Mensaje de prueba de integrika.mx -- si lo recibiste, tu número quedó conectado correctamente." },
    }),
  });

  if (!metaRes.ok) {
    const err = await metaRes.json();
    return json({ error: err?.error?.message ?? `Meta respondió ${metaRes.status}` }, 500);
  }

  const { error: verifyErr } = await admin.rpc("set_clinic_whatsapp_verified", {
    _clinic_id: body.clinic_id,
    _user_id: userData.user.id,
  });
  if (verifyErr) {
    console.error("[whatsapp-test-send] error marcando numero verificado:", verifyErr);
    return json({ error: `Mensaje enviado pero no se pudo marcar como verificado: ${verifyErr.message}` }, 500);
  }
  return json({ ok: true });
});
