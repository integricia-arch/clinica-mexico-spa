// Procesa user_provisioning_queue: crea usuarios en Supabase Auth con email
// confirmado para que puedan entrar directo con Google (auto-link por email).
// Si el usuario ya existe en Auth, lo vincula vía RPC provision_link_by_email.
// Callers: AdminUsuarios.tsx (admin autenticado) o backend con service_role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = authHeader.replace(/^Bearer\s+/i, "");

    // service_role (cron/backend) pasa directo; cualquier otro JWT debe ser admin
    if (token !== SUPABASE_SERVICE_KEY) {
      const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await supaUser.auth.getUser();
      if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (!isAdmin) return json({ error: "Admin role required" }, 403);
    }

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

    const results = { processed: 0, failed: 0, errors: [] as string[] };

    for (const item of queue) {
      try {
        const email = item.email.trim().toLowerCase();

        // email_confirm: true → al entrar con Google (mismo email verificado)
        // Supabase auto-linkea la identidad a esta cuenta.
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password: generateSecurePassword(),
          email_confirm: true,
          user_metadata: {
            full_name: item.nombre_completo,
            entity_type: item.entity_type,
            entity_id: item.entity_id,
          },
        });

        if (createErr) {
          // Ya existe en Auth (entró con Google antes del alta): vincular en DB
          if (/already|registered|exists/i.test(createErr.message)) {
            const { data: linked, error: linkRpcErr } = await admin.rpc(
              "provision_link_by_email",
              { _email: email },
            );
            if (linkRpcErr) throw linkRpcErr;
            if (!linked) throw new Error("Usuario Auth existe pero sin doctor/nurse activo que coincida");
            results.processed++;
            continue;
          }
          throw createErr;
        }

        const userId = created.user?.id;
        if (!userId) throw new Error("No user_id returned");

        // provision_link_user asigna rol + clinic_membership + user_id + marca cola.
        // El trigger JIT en auth.users ya lo intentó al crear; llamada directa
        // como cinturón por si el trigger no corrió (idempotente).
        const { error: linkErr } = await admin.rpc("provision_link_by_email", { _email: email });
        if (linkErr) throw linkErr;

        results.processed++;
        console.log(`Provisioned ${item.entity_type} ${email} (user_id: ${userId})`);
      } catch (err) {
        results.failed++;
        const msg = (err as Error)?.message || "Unknown error";
        results.errors.push(`${item.email}: ${msg}`);

        await admin
          .from("user_provisioning_queue")
          .update({ processed_at: new Date().toISOString(), error_message: msg })
          .eq("id", item.id);

        console.error(`Failed ${item.entity_type} ${item.email}:`, msg);
      }
    }

    return json({ ok: true, ...results });
  } catch (err) {
    console.error("provision-users error:", err);
    return json({ error: (err as Error)?.message || "Unknown error" }, 500);
  }
});

// Password aleatorio criptográficamente seguro. Nunca se comunica: la entrada
// real del usuario es Google OAuth (o "olvidé mi contraseña" si la necesita).
function generateSecurePassword(length = 24): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
