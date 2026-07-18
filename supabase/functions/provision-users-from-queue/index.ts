// Process user_provisioning_queue: crea usuarios en Supabase Auth automáticamente
// Llamar vía webhook, cron, o desde cliente cuando sea necesario
// Genera password temporal segura para cada usuario
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    // Permitir acceso: service role (backend) O admin autenticado (frontend)
    const authHeader = req.headers.get("Authorization");
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Si hay auth header, verificar que sea admin
    if (authHeader) {
      const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await supaUser.auth.getUser();
      if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

      // Verificar que sea admin
      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (!isAdmin) return json({ error: "Admin role required" }, 403);
    }

    // Traer registros no procesados
    const { data: queue, error: queueErr } = await admin
      .from("user_provisioning_queue")
      .select("id, entity_type, entity_id, email, nombre_completo")
      .is("processed_at", null)
      .order("created_at")
      .limit(50);

    if (queueErr) throw queueErr;
    if (!queue || queue.length === 0) {
      return json({ ok: true, processed: 0, message: "No pending users" });
    }

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const item of queue) {
      try {
        // Generar password temporal segura (12 caracteres: mayús + minús + números + símbol)
        const tempPassword = generateSecurePassword();

        // Crear usuario en Auth
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: item.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: item.nombre_completo,
            entity_type: item.entity_type,
            entity_id: item.entity_id,
          },
        });

        if (createErr) throw createErr;

        const userId = created.user?.id;
        if (!userId) throw new Error("No user_id returned");

        // Asignar rol según tipo
        const role = item.entity_type === "doctor" ? "doctor" : "nurse";
        await admin.from("user_roles").upsert(
          { user_id: userId, role },
          { onConflict: "user_id,role" }
        );

        // Vincular en tabla respectiva (doctors o nurses)
        const tableName = item.entity_type === "doctor" ? "doctors" : "nurses";
        const { error: linkErr } = await admin
          .from(tableName)
          .update({ user_id: userId })
          .eq("id", item.entity_id);

        if (linkErr) throw linkErr;

        // Marcar como procesado
        await admin
          .from("user_provisioning_queue")
          .update({
            processed_at: new Date().toISOString(),
            user_id: userId,
          })
          .eq("id", item.id);

        results.processed++;
        console.log(`✓ Provisioned ${item.entity_type} ${item.email} (user_id: ${userId})`);
      } catch (err: any) {
        results.failed++;
        const msg = err?.message || "Unknown error";
        results.errors.push(`${item.email}: ${msg}`);

        // Registrar error en cola
        await admin
          .from("user_provisioning_queue")
          .update({
            processed_at: new Date().toISOString(),
            error_message: msg,
          })
          .eq("id", item.id);

        console.error(`✗ Failed ${item.entity_type} ${item.email}:`, msg);
      }
    }

    return json({
      ok: true,
      ...results,
    });
  } catch (err: any) {
    console.error("provision-users error:", err);
    return json({ error: err?.message || "Unknown error" }, 500);
  }
});

function generateSecurePassword(length = 16): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  const all = uppercase + lowercase + numbers + symbols;

  let pwd = "";
  pwd += uppercase[Math.floor(Math.random() * uppercase.length)];
  pwd += lowercase[Math.floor(Math.random() * lowercase.length)];
  pwd += numbers[Math.floor(Math.random() * numbers.length)];
  pwd += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = 4; i < length; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }

  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
