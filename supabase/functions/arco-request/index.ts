// arco-request — recibe solicitud ARCO pública, inserta en BD y notifica al admin vía Telegram
// LFPDPPP Arts. 21-34: derecho de acceso, rectificación, cancelación, oposición

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { enforceRateLimit, rateLimitResponse, clientIp } from "../_shared/rateLimit.ts";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN   = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TIPO_LABELS: Record<string, string> = {
  acceso:        "Acceso (conocer qué datos tiene integrika)",
  rectificacion: "Rectificación (corregir datos incorrectos)",
  cancelacion:   "Cancelación (eliminar mis datos)",
  oposicion:     "Oposición (oponerme a cierto uso de mis datos)",
};

async function notificarAdmin(req: {
  folio: string; tipo: string; nombre: string; email: string;
  clinic_name?: string; deadline_at: string;
}) {
  if (!TELEGRAM_BOT_TOKEN) return;

  const { data: clinics } = await supabase
    .from("clinic_settings")
    .select("data")
    .limit(20);

  const chatIds: string[] = [];
  for (const c of clinics ?? []) {
    const chatId = (c.data as Record<string, string> | null)?.telegram_admin_chat_id;
    if (chatId) chatIds.push(chatId);
  }
  if (!chatIds.length) return;

  const deadline = new Date(req.deadline_at).toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City", day: "2-digit", month: "short", year: "numeric",
  });

  const text =
    `⚖️ Nueva solicitud ARCO\n\n` +
    `Folio: ${req.folio}\n` +
    `Tipo: ${TIPO_LABELS[req.tipo] ?? req.tipo}\n` +
    `De: ${req.nombre} <${req.email}>\n` +
    (req.clinic_name ? `Clínica: ${req.clinic_name}\n` : "") +
    `\n⏰ Plazo legal: ${deadline} (20 días hábiles)\n\n` +
    `Revisar en: /admin/arco`;

  await Promise.allSettled(
    chatIds.map((chatId) =>
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      })
    )
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const corsHeaders = { "Access-Control-Allow-Origin": "*" };
  const ip = clientIp(req);
  const okRate = await enforceRateLimit(supabase, `arco:${ip}`, 3, 3600);
  if (!okRate) return rateLimitResponse(corsHeaders, 3600);

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400, headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const { tipo, nombre, email, telefono, descripcion, clinic_name } = body;

  // Validar campos requeridos
  if (!tipo || !["acceso", "rectificacion", "cancelacion", "oposicion"].includes(tipo)) {
    return new Response(JSON.stringify({ error: "tipo inválido" }), {
      status: 400, headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  if (!nombre?.trim() || !email?.trim() || !descripcion?.trim()) {
    return new Response(JSON.stringify({ error: "nombre, email y descripción son obligatorios" }), {
      status: 400, headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "email inválido" }), {
      status: 400, headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const { data, error } = await supabase
    .from("arco_requests")
    .insert({
      tipo,
      nombre:      nombre.trim(),
      email:       email.trim().toLowerCase(),
      telefono:    telefono?.trim() || null,
      descripcion: descripcion.trim(),
      clinic_name: clinic_name?.trim() || null,
    })
    .select("folio, deadline_at")
    .single();

  if (error) {
    console.error("arco-request insert error:", error);
    return new Response(JSON.stringify({ error: "Error al registrar solicitud" }), {
      status: 500, headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // Notificar admin sin bloquear la respuesta
  notificarAdmin({ folio: data.folio, tipo, nombre, email, clinic_name, deadline_at: data.deadline_at })
    .catch((e) => console.error("telegram notify error:", e));

  return new Response(
    JSON.stringify({ folio: data.folio, deadline_at: data.deadline_at }),
    { status: 201, headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" } }
  );
});
