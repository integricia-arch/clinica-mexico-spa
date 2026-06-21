// supabase/functions/google-oauth-callback/index.ts
// Handles Google Calendar OAuth callback for doctor calendar connection.
// State param = base64("doctorId:clinicId")
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const html = (title: string, body: string) =>
    new Response(
      `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font-family:sans-serif;max-width:480px;margin:60px auto;padding:0 20px;text-align:center}
      h2{color:#1a7f5a}p{color:#555}</style></head>
      <body><h2>${title}</h2>${body}</body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );

  if (error) {
    return html("Error al conectar", `<p>Google Calendar no pudo conectarse: <strong>${error}</strong></p><p>Puedes cerrar esta ventana.</p>`);
  }

  if (!code || !state) {
    return new Response("Parámetros inválidos", { status: 400 });
  }

  let doctorId: string, clinicId: string;
  try {
    const decoded = atob(state);
    [doctorId, clinicId] = decoded.split(":");
    if (!doctorId) throw new Error("sin doctorId");
  } catch {
    return new Response("State inválido", { status: 400 });
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return html("Configuración pendiente", "<p>El administrador del sistema aún no ha configurado las credenciales de Google. Contacta al administrador.</p>");
  }

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResp.ok) {
    const err = await tokenResp.text();
    console.error("Token exchange failed:", err);
    return html("Error de autenticación", "<p>No se pudo completar la autenticación con Google.</p>");
  }

  const tokens = await tokenResp.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!tokens.refresh_token) {
    return html("Permiso necesario", `<p>Google no devolvió acceso de larga duración.</p>
    <p>Revoca el acceso en <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> y vuelve a intentarlo.</p>`);
  }

  const profileResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileResp.json() as { email?: string };
  const googleEmail = profile.email ?? "desconocido@google.com";

  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error: dbError } = await supabase.from("doctor_calendars").upsert({
    doctor_id: doctorId,
    clinic_id: clinicId || null,
    google_email: googleEmail,
    calendar_id: "primary",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expiry: tokenExpiry,
    activo: true,
    connected_at: new Date().toISOString(),
  }, { onConflict: "doctor_id,clinic_id" });

  if (dbError) {
    console.error("DB error:", dbError);
    return html("Error interno", "<p>No se pudo guardar la conexión. Inténtalo de nuevo.</p>");
  }

  // Health check: verify Calendar API is enabled in the GCP project.
  // Common failure: OAuth works fine but calendar-json.googleapis.com is disabled → silent 403 on all calendar ops.
  const calCheck = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!calCheck.ok) {
    const calErr = await calCheck.text();
    console.error("[GCal] health check failed", calCheck.status, calErr);
    if (calCheck.status === 403) {
      return html(
        "⚠️ Google Calendar API deshabilitada",
        `<p>La cuenta <strong>${googleEmail}</strong> se conectó correctamente, pero la API de Google Calendar no está habilitada en el proyecto de Google Cloud.</p>
        <p>El administrador del sistema debe habilitar <strong>calendar-json.googleapis.com</strong> en Google Cloud Console (proyecto 545467181522).</p>
        <p>La conexión se guardó — vuelve a intentar una vez habilitada la API.</p>`,
      );
    }
    return html(
      "⚠️ Error verificando Google Calendar",
      `<p>La cuenta <strong>${googleEmail}</strong> se conectó, pero no se pudo verificar el acceso al calendario (status ${calCheck.status}).</p>
      <p>Contacta al administrador del sistema.</p>`,
    );
  }

  return html(
    "✅ Google Calendar conectado",
    `<p>Cuenta: <strong>${googleEmail}</strong></p>
    <p>Tus citas en la clínica aparecerán automáticamente en tu Google Calendar.</p>
    <p style="margin-top:30px;color:#888;font-size:0.9em">Puedes cerrar esta ventana.</p>`,
  );
});
