// =================================================================
// cfdi-set-credentials: guarda credenciales PAC/CSD en Vault (nunca en texto plano).
// Solo admin de la clínica puede llamar.
// =================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supaUser.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const svc = createClient(SUPABASE_URL, SUPABASE_SVC);

  try {
    const body: { clinic_id?: string; pac_contrasena?: string; csd_contrasena?: string } =
      await req.json();
    const { clinic_id, pac_contrasena, csd_contrasena } = body;

    if (!clinic_id) return json({ error: "clinic_id requerido" }, 400);
    if (!pac_contrasena && !csd_contrasena) return json({ error: "Sin credenciales que guardar" }, 400);

    // Verificar que el usuario es admin de la clínica
    const { data: membership } = await svc
      .from("clinic_memberships")
      .select("role")
      .eq("clinic_id", clinic_id)
      .eq("user_id", userData.user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership || !["admin", "manager"].includes(membership.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    // Leer IDs de secretos existentes
    const { data: cfg } = await svc
      .from("cfdi_config" as never)
      .select("id, pac_secret_id, csd_secret_id")
      .eq("clinic_id", clinic_id)
      .maybeSingle();

    const updates: Record<string, unknown> = {};

    if (pac_contrasena) {
      const { data: pacId, error: pacErr } = await svc.rpc("cfdi_upsert_secret", {
        p_existing_id: (cfg as any)?.pac_secret_id ?? null,
        p_secret: pac_contrasena,
        p_name: `pac_clinica_${clinic_id}`,
        p_description: "Contraseña PAC CFDI",
      });
      if (pacErr) throw new Error("Error guardando secreto PAC: " + pacErr.message);
      updates.pac_secret_id = pacId;
    }

    if (csd_contrasena) {
      const { data: csdId, error: csdErr } = await svc.rpc("cfdi_upsert_secret", {
        p_existing_id: (cfg as any)?.csd_secret_id ?? null,
        p_secret: csd_contrasena,
        p_name: `csd_clinica_${clinic_id}`,
        p_description: "Contraseña CSD CFDI",
      });
      if (csdErr) throw new Error("Error guardando secreto CSD: " + csdErr.message);
      updates.csd_secret_id = csdId;
    }

    if (Object.keys(updates).length > 0 && (cfg as any)?.id) {
      await svc.from("cfdi_config" as never).update(updates).eq("id", (cfg as any).id);
    }

    return json({ ok: true });
  } catch (err: any) {
    console.error("[cfdi-set-credentials]", err);
    return json({ error: err.message ?? "Error interno" }, 500);
  }
});
