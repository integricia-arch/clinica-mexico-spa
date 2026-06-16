// notify-new-user
// Llamada por trigger DB cuando un usuario nuevo se registra.
// Envía email vía Resend a todos los admins del sistema para que asignen rol.
// Body: { user_id, email, full_name?, created_at }

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SVC      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY    = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM       = Deno.env.get("RESEND_FROM") ?? "Integriclinica <onboarding@resend.dev>";
const APP_URL           = "https://integrika.mx";

const headers = { "Content-Type": "application/json" };

async function getAdminEmails(): Promise<string[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_roles?role=eq.admin&select=user_id`, {
    headers: { apikey: SUPABASE_SVC, Authorization: `Bearer ${SUPABASE_SVC}` },
  });
  const rows: { user_id: string }[] = await res.json();
  if (!rows.length) return [];

  const ids = rows.map(r => r.user_id).join(",");
  const usersRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`,
    { headers: { apikey: SUPABASE_SVC, Authorization: `Bearer ${SUPABASE_SVC}` } },
  );
  const usersData: { users: { id: string; email: string }[] } = await usersRes.json();
  return (usersData.users ?? [])
    .filter(u => rows.some(r => r.user_id === u.id))
    .map(u => u.email)
    .filter(Boolean);
}

async function sendResend(to: string[], newEmail: string, newName: string) {
  if (!RESEND_API_KEY) {
    console.warn("[notify-new-user] RESEND_API_KEY no configurado — email omitido");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { ...headers, Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject: "Nuevo usuario pendiente de activación — Integriclinica",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <h2 style="color:#0f172a">Nuevo usuario registrado</h2>
          <p style="color:#475569">Un usuario nuevo se registró y está esperando que le asignes un rol para poder acceder al sistema.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr><td style="padding:8px;color:#64748b;width:120px">Email</td><td style="padding:8px;font-weight:600">${newEmail}</td></tr>
            ${newName ? `<tr><td style="padding:8px;color:#64748b">Nombre</td><td style="padding:8px;font-weight:600">${newName}</td></tr>` : ""}
          </table>
          <a href="${APP_URL}/admin/usuarios" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
            Asignar rol en Integriclinica
          </a>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px">Este correo fue generado automáticamente. No responder.</p>
        </div>
      `,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[notify-new-user] Resend error:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" },
    });
  }

  // Validar service key (llamado desde trigger DB)
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.includes(SUPABASE_SVC.slice(-20))) {
    // permitir también llamadas sin auth para db webhooks internos
    // Solo rechazar si hay un token explícitamente incorrecto
    if (auth && !auth.includes(SUPABASE_SVC)) {
      return new Response(JSON.stringify({ error: "no autorizado" }), { status: 401, headers });
    }
  }

  let body: { user_id?: string; email?: string; full_name?: string; created_at?: string };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "bad json" }), { status: 400, headers }); }

  const { email = "", full_name = "" } = body;
  if (!email) return new Response(JSON.stringify({ error: "email requerido" }), { status: 400, headers });

  try {
    const adminEmails = await getAdminEmails();
    if (adminEmails.length === 0) {
      console.warn("[notify-new-user] Sin admins para notificar");
      return new Response(JSON.stringify({ ok: true, notified: 0 }), { headers });
    }
    await sendResend(adminEmails, email, full_name);
    console.log(`[notify-new-user] Notificado a ${adminEmails.length} admin(s) sobre nuevo usuario ${email}`);
    return new Response(JSON.stringify({ ok: true, notified: adminEmails.length }), { headers });
  } catch (e) {
    console.error("[notify-new-user] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers });
  }
});
