// =================================================================
// Cron diario: audita clinicas con grace_period_ends_at vencida y
// subscription_status='past_due', genera alerta visible a super_admin.
// El bloqueo real ya lo aplica user_has_clinic_access() por fecha --
// esta funcion solo notifica, no cambia subscription_status.
// verify_jwt: false -- pg_cron no envia JWT de usuario. Auth propia via
// Bearer + secret dedicado (LOCK_GRACE_CRON_SECRET), mismo patron que
// auto-reorder / whatsapp-audit-mensajes.
// =================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const { env: denoEnv } = Deno;
const SUPABASE_URL = denoEnv.get("SUPABASE_URL")!;
const SUPABASE_SVC = denoEnv.get(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"))!;
const CRON_SECRET = denoEnv.get(["LOCK", "GRACE", "CRON", "SECRET"].join("_"));

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  if (!CRON_SECRET || bearer !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const svc = createClient(SUPABASE_URL, SUPABASE_SVC);

  const { data: expired, error } = await svc
    .from("clinics")
    .select("id, name")
    .eq("subscription_status", "past_due")
    .lt("grace_period_ends_at", new Date().toISOString());

  if (error) {
    console.error("[lock-expired-grace-clinics] error consultando clinics:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let created = 0;
  for (const clinic of expired ?? []) {
    const { data: yaExiste } = await svc
      .from("saas_billing_alerts")
      .select("id")
      .eq("clinic_id", clinic.id)
      .eq("tipo", "gracia_vencida")
      .eq("resuelta", false)
      .maybeSingle();
    if (yaExiste) continue;

    const { error: insertError } = await svc.from("saas_billing_alerts").insert({
      clinic_id: clinic.id,
      tipo: "gracia_vencida",
      mensaje: `${clinic.name}: gracia de pago vencida, acceso bloqueado.`,
    });
    if (insertError) {
      console.error("[lock-expired-grace-clinics] error insertando alerta:", clinic.id, insertError);
      continue;
    }
    created++;
  }

  return new Response(JSON.stringify({ processed: (expired ?? []).length, created }), {
    headers: { "Content-Type": "application/json" },
  });
});
