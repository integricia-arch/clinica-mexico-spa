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

    // scopeClinicIds === null → procesa la cola global (service_role o platform staff).
    // Set → admin de clínica: solo procesa filas cuyo entity pertenece a SUS clínicas.
    let scopeClinicIds: Set<string> | null = null;

    // service_role (cron/backend) pasa directo; cualquier otro JWT debe ser admin
    if (token !== SUPABASE_SERVICE_KEY) {
      const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await supaUser.auth.getUser();
      if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
      const callerId = userData.user.id;

      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: callerId,
        _role: "admin",
      });
      if (!isAdmin) return json({ error: "Admin role required" }, 403);

      // H2: sin scoping, un admin de la clínica A disparaba el provisioning de la
      // cola de TODAS las clínicas. Platform staff sí procesa global; un admin de
      // clínica queda restringido a los entities de sus propias clínicas.
      const { data: isGlobal } = await admin.rpc("is_global_admin", { _user_id: callerId });
      if (!isGlobal) {
        const { data: memberships, error: mErr } = await admin
          .from("clinic_memberships")
          .select("clinic_id")
          .eq("user_id", callerId)
          .eq("status", "active");
        if (mErr) throw mErr;
        scopeClinicIds = new Set((memberships ?? []).map((m) => m.clinic_id as string));
        if (scopeClinicIds.size === 0) {
          return json({ ok: true, processed: 0, message: "No clinics in scope" });
        }
      }
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

    // Filtrar la cola al scope del caller resolviendo la clínica de cada entity
    // (la cola no guarda clinic_id; vive en doctors/nurses).
    const scopedQueue = scopeClinicIds === null
      ? queue
      : await scopeQueueToClinics(admin, queue, scopeClinicIds);
    if (scopedQueue.length === 0) {
      return json({ ok: true, processed: 0, message: "No pending users in scope" });
    }

    const results = { processed: 0, failed: 0, errors: [] as string[] };

    for (const item of scopedQueue) {
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

// Resuelve la clínica de cada entity (doctors/nurses) y descarta las filas
// que no pertenezcan a las clínicas del caller. La cola no guarda clinic_id.
// deno-lint-ignore no-explicit-any
async function scopeQueueToClinics(admin: any, queue: any[], allowed: Set<string>) {
  const idsByType: Record<string, string[]> = { doctor: [], nurse: [] };
  for (const it of queue) {
    if (idsByType[it.entity_type]) idsByType[it.entity_type].push(it.entity_id);
  }
  const entityClinic = new Map<string, string>(); // entity_id -> clinic_id
  const tableByType: Record<string, string> = { doctor: "doctors", nurse: "nurses" };
  for (const [type, ids] of Object.entries(idsByType)) {
    if (ids.length === 0) continue;
    const { data, error } = await admin
      .from(tableByType[type])
      .select("id, clinic_id")
      .in("id", ids);
    if (error) throw error;
    for (const row of data ?? []) entityClinic.set(row.id as string, row.clinic_id as string);
  }
  return queue.filter((it) => {
    const clinic = entityClinic.get(it.entity_id);
    return clinic != null && allowed.has(clinic);
  });
}

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
