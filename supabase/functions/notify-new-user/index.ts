// notify-new-user
// Llamada por trigger DB cuando un usuario nuevo se registra.
// Envía email vía Resend a todos los admins del sistema para que asignen rol.
// Body: { user_id, email, full_name?, created_at }

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SVC      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NOTIFY_SHARED_SECRET = Deno.env.get("NOTIFY_SHARED_SECRET") ?? "";
const RESEND_API_KEY    = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM       = Deno.env.get("RESEND_FROM") ?? "Integriclinica <onboarding@resend.dev>";
const APP_URL           = "https://integrika.mx";

const headers = { "Content-Type": "application/json" };

async function getAdminEmails(): Promise<{ emails: string[]; debug: Record<string, unknown> }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_roles?role=eq.admin&select=user_id`, {
    headers: { apikey: SUPABASE_SVC, Authorization: `Bearer ${SUPABASE_SVC}` },
  });
  const rowsRaw = await res.text();
  let rows: { user_id: string }[] = [];
  try { rows = JSON.parse(rowsRaw); } catch { /* noop */ }

  if (!Array.isArray(rows) || !rows.length) {
    return { emails: [], debug: { step: "roles", status: res.status, body: rowsRaw, hasSvcKey: !!SUPABASE_SVC, svcKeyLen: SUPABASE_SVC.length } };
  }

  const emails: string[] = [];
  const errors: Record<string, unknown>[] = [];
  for (const row of rows) {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${row.user_id}`, {
      headers: { apikey: SUPABASE_SVC, Authorization: `Bearer ${SUPABASE_SVC}` },
    });
    const userRaw = await userRes.text();
    if (!userRes.ok) {
      errors.push({ user_id: row.user_id, status: userRes.status, body: userRaw });
      continue;
    }
    try {
      const u = JSON.parse(userRaw);
      if (u.email) emails.push(u.email);
    } catch { /* noop */ }
  }
  return { emails, debug: { step: "ok", rolesFound: rows.length, emailsFound: emails.length, errors } };
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

  // Validar secreto compartido (enviado por el trigger DB desde vault.notify_new_user_secret)
  const auth = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!NOTIFY_SHARED_SECRET || auth !== NOTIFY_SHARED_SECRET) {
    return new Response(JSON.stringify({ error: "no autorizado" }), { status: 401, headers });
  }

  let body: { user_id?: string; email?: string; full_name?: string; created_at?: string };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "bad json" }), { status: 400, headers }); }

  const { email = "", full_name = "" } = body;
  if (!email) return new Response(JSON.stringify({ error: "email requerido" }), { status: 400, headers });

  try {
    // Check notification_rules: only send if rule exists and is enabled
    const rulesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/notification_rules?event_type=eq.usuario_nuevo&channel=eq.email&enabled=eq.true&limit=1&select=id`,
      { headers: { apikey: SUPABASE_SVC, Authorization: `Bearer ${SUPABASE_SVC}` } },
    );
    const rulesRaw = await rulesRes.text();
    let rulesData: { id: string }[] = [];
    try { rulesData = JSON.parse(rulesRaw); } catch { /* noop */ }
    if (!Array.isArray(rulesData) || rulesData.length === 0) {
      return new Response(JSON.stringify({ ok: true, notified: 0, reason: "notification_rule disabled" }), { headers });
    }

    const { emails: adminEmails, debug } = await getAdminEmails();
    if (adminEmails.length === 0) {
      console.warn("[notify-new-user] Sin admins para notificar", debug);
      return new Response(JSON.stringify({ ok: true, notified: 0, debug }), { headers });
    }
    await sendResend(adminEmails, email, full_name);
    console.log(`[notify-new-user] Notificado a ${adminEmails.length} admin(s) sobre nuevo usuario ${email}`);
    return new Response(JSON.stringify({ ok: true, notified: adminEmails.length, hasResendKey: !!RESEND_API_KEY }), { headers });
  } catch (e) {
    console.error("[notify-new-user] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers });
  }
});
