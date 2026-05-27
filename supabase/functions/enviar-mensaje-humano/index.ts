// =================================================================
// supabase/functions/enviar-mensaje-humano/index.ts
//
// Permite al recepcionista enviar mensajes a un paciente vía Telegram
// desde el dashboard de Lovable. Se llama autenticado desde el frontend.
//
// Body: { conversacion_id: string, mensaje: string }
//
// Deploy SIN --no-verify-jwt (requiere JWT del usuario logueado).
// =================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TELEGRAM_BOT_TOKEN   = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

Deno.serve(async (req) => {
  // CORS preflight (Lovable corre en dominio distinto)
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  // Require staff role (admin, receptionist, doctor, nurse).
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "no autorizado" }, 401);
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json({ error: "token inválido" }, 401);
  }
  const { data: rolesRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  const roles = (rolesRows ?? []).map((r: any) => r.role);
  const isStaff = roles.some((r: string) =>
    ["admin", "receptionist", "doctor", "nurse"].includes(r)
  );
  if (!isStaff) {
    return json({ error: "permiso denegado" }, 403);
  }

  let body: { conversacion_id?: string; mensaje?: string };
  try { body = await req.json(); }
  catch { return json({ error: "bad json" }, 400); }

  const conversacion_id = body.conversacion_id;
  const mensaje = body.mensaje?.trim();
  if (!conversacion_id || !mensaje) {
    return json({ error: "conversacion_id y mensaje requeridos" }, 400);
  }


  // 1. Cargar conversación + identidad para obtener chat_id de Telegram
  const { data: conv, error: ec } = await supabase
    .from("conversaciones")
    .select("id, identidad_canal_id, status, identidades_canal:identidad_canal_id(canal_id, external_id)")
    .eq("id", conversacion_id)
    .single();
  if (ec || !conv) return json({ error: "conversación no encontrada" }, 404);

  const ident: any = (conv as any).identidades_canal;
  if (ident?.canal_id !== "telegram") {
    return json({ error: "esta conversación no es de Telegram" }, 400);
  }
  const chatId = ident.external_id;

  // 2. Enviar a Telegram
  const tgRes = await fetch(
    "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: mensaje }),
    }
  );
  if (!tgRes.ok) {
    const txt = (await tgRes.text()).slice(0, 300);
    return json({ error: "Telegram error: " + txt }, 502);
  }

  // 3. Guardar en BD con flag sent_by_human (para distinguirlo del bot en el UI)
  await supabase.from("mensajes").insert({
    conversacion_id,
    rol: "assistant",
    contenido: mensaje,
    raw_payload: { sent_by_human: true },
  });
  await supabase.from("conversaciones")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversacion_id);

  return json({ ok: true });
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "content-type": "application/json" },
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
  };
}
