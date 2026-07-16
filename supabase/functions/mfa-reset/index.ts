// =================================================================
// mfa-reset: borra un factor TOTP propio cuando el usuario perdió
// acceso a su app autenticadora y no puede pasar AAL2 para hacer
// unenroll() desde el cliente (GoTrue exige AAL2 para desenrolar un
// factor 'verified'). Usa service_role para saltar ese check, pero
// solo sobre factores que pertenecen al mismo user_id del JWT.
// =================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY    = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const { factorId } = (await req.json().catch(() => ({}))) as { factorId?: string };
    if (!factorId) return json({ error: "factorId requerido" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Confirmar que el factor pertenece al usuario del JWT antes de borrar.
    const { data: fullUser, error: getErr } = await admin.auth.admin.getUserById(userData.user.id);
    if (getErr || !fullUser?.user) return json({ error: "usuario no encontrado" }, 404);
    const owns = (fullUser.user.factors ?? []).some((f) => f.id === factorId);
    if (!owns) return json({ error: "el factor no pertenece a este usuario" }, 403);

    const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({
      id: factorId,
      userId: userData.user.id,
    });
    if (delErr) throw delErr;

    return json({ ok: true });
  } catch (err: any) {
    console.error("mfa-reset error:", err);
    return json({ error: err?.message ?? "Error desconocido" }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
