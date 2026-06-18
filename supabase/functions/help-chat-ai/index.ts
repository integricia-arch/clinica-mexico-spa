import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_KEY     = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ESCALADA_KEYWORDS = ["se trabó", "bloqueado", "urgente", "emergencia", "no funciona", "fallo", "problema grave"];
const MAX_IA_MESSAGES = 3;

interface RequestBody {
  sesion_id: string;
  mensaje: string;
  manual_contexto?: string;
  ruta_activa?: string;
  clinic_id?: string;
  user_role?: string;
}

// ── Tier 0: Saludos hardcoded (0 tokens, 0 DB) ────────────────────────────
const GREETINGS = ["hola", "buenos dias", "buenas tardes", "buenas noches", "hey", "hi", "buen dia"];
function isGreeting(msg: string): boolean {
  const n = normalize(msg);
  return GREETINGS.some(g => n === g || n === g + "!");
}

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,;:]/g, "").trim();
}

// ── Tier 2: Claude Haiku ──────────────────────────────────────────────────
async function callClaude(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemPrompt,
      messages,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Claude API error ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  return data.content?.[0]?.text ?? "";
}

function shouldEscalate(texto: string, iaMessageCount: number): boolean {
  if (iaMessageCount >= MAX_IA_MESSAGES) return true;
  return ESCALADA_KEYWORDS.some(kw => texto.toLowerCase().includes(kw));
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "ANTHROPIC_API_KEY no configurado" }), { status: 500 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), { status: 401 });

  const { data: { user }, error: authErr } = await createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    .auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), { status: 401 });

  const body: RequestBody = await req.json();
  const { sesion_id, mensaje, manual_contexto, ruta_activa, clinic_id, user_role } = body;

  if (!sesion_id || !mensaje?.trim()) {
    return new Response(JSON.stringify({ ok: false, error: "sesion_id y mensaje requeridos" }), { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Verificar sesión
  const { data: sesion } = await supabase
    .from("ayuda_chat_sesiones")
    .select("id, estado, user_id")
    .eq("id", sesion_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sesion) return new Response(JSON.stringify({ ok: false, error: "Sesión no encontrada" }), { status: 404 });
  if (sesion.estado === "cerrada") return new Response(JSON.stringify({ ok: false, error: "Sesión cerrada" }), { status: 400 });
  if (sesion.estado === "escalada") {
    return new Response(JSON.stringify({ ok: true, escalated: true, tier: "human" }), { status: 200 });
  }

  // ── Tier 0: Saludo ────────────────────────────────────────────────────────
  if (isGreeting(mensaje)) {
    const resp = "Hola, soy el asistente de Integriclinica. ¿En qué te puedo ayudar?";
    await supabase.from("ayuda_chat_mensajes").insert({
      sesion_id, rol: "asistente_ia", autor_id: null, contenido: resp,
    });
    return new Response(JSON.stringify({ ok: true, escalated: false, tier: "greeting", respuesta: resp }), {
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  // ── Tier 1: FAQ DB ────────────────────────────────────────────────────────
  const { data: faq } = await supabase.rpc("faq_buscar", {
    p_pregunta:  mensaje,
    p_clinic_id: clinic_id ?? null,
    p_ruta:      ruta_activa ?? null,
    p_rol:       user_role ?? null,
  });

  if (faq && faq.length > 0) {
    const match = faq[0];
    // Incrementar uso en background
    supabase.rpc("faq_incrementar_uso", { p_id: match.id }).then(() => {});

    await supabase.from("ayuda_chat_mensajes").insert({
      sesion_id, rol: "asistente_ia", autor_id: null, contenido: match.respuesta,
    });
    return new Response(JSON.stringify({ ok: true, escalated: false, tier: "faq", respuesta: match.respuesta }), {
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  // ── Verificar escalada antes de gastar tokens ─────────────────────────────
  if (shouldEscalate(mensaje, 0)) {
    const resp = "Voy a conectarte con alguien del equipo que te puede ayudar mejor. Un momento.";
    await supabase.from("ayuda_chat_mensajes").insert({
      sesion_id, rol: "asistente_ia", autor_id: null, contenido: resp,
    });
    await supabase.from("ayuda_chat_sesiones").update({ estado: "escalada" }).eq("id", sesion_id);
    return new Response(JSON.stringify({ ok: true, escalated: true, tier: "keyword", respuesta: resp }), {
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  // ── Tier 2: Claude Haiku ─────────────────────────────────────────────────
  const { data: historial } = await supabase
    .from("ayuda_chat_mensajes")
    .select("rol, contenido")
    .eq("sesion_id", sesion_id)
    .order("created_at", { ascending: true })
    .limit(10);

  const iaMessageCount = (historial ?? []).filter(m => m.rol === "asistente_ia").length;
  if (iaMessageCount >= MAX_IA_MESSAGES) {
    const resp = "Voy a conectarte con alguien del equipo que te puede ayudar mejor. Un momento.";
    await supabase.from("ayuda_chat_mensajes").insert({
      sesion_id, rol: "asistente_ia", autor_id: null, contenido: resp,
    });
    await supabase.from("ayuda_chat_sesiones").update({ estado: "escalada" }).eq("id", sesion_id);
    return new Response(JSON.stringify({ ok: true, escalated: true, tier: "max_ia", respuesta: resp }), {
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const manualSection = manual_contexto
    ? `\n\n## Manual de la pantalla actual (${ruta_activa ?? ""})\n\n${manual_contexto}`
    : "";

  const systemPrompt = `Eres el asistente de soporte interno de Integriclinica, un sistema clínico SaaS para clínicas y spas en México.
Tu rol: responder preguntas operativas del personal sobre cómo usar el sistema.
Responde siempre en español, de forma breve y clara (máximo 3 oraciones). Si la respuesta está en el manual, cítala directamente.
Si no sabes con certeza, dilo y sugiere escalar a un humano.
NO respondas preguntas médicas ni clínicas.${manualSection}`;

  const claudeMessages: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of historial ?? []) {
    if (m.rol === "usuario") claudeMessages.push({ role: "user", content: m.contenido });
    else if (m.rol === "asistente_ia") claudeMessages.push({ role: "assistant", content: m.contenido });
  }
  claudeMessages.push({ role: "user", content: mensaje });

  let respuestaIA = "";
  let escalated = false;

  try {
    respuestaIA = await callClaude(systemPrompt, claudeMessages);
    const lower = respuestaIA.toLowerCase();
    if (lower.includes("no tengo información") || lower.includes("no encuentro") || lower.includes("no puedo ayudarte")) {
      escalated = true;
    }
    // Registrar como candidato para aprendizaje (background, no bloquear respuesta)
    supabase.rpc("chat_registrar_pendiente", {
      p_pregunta:  mensaje,
      p_clinic_id: clinic_id ?? null,
      p_ruta:      ruta_activa ?? null,
      p_respuesta: respuestaIA,
    }).then(() => {});
  } catch (err) {
    console.error("Error Claude:", err);
    respuestaIA = "Tuve un problema al procesar tu consulta. Te conecto con el equipo.";
    escalated = true;
  }

  await supabase.from("ayuda_chat_mensajes").insert({
    sesion_id, rol: "asistente_ia", autor_id: null, contenido: respuestaIA,
  });
  if (escalated) {
    await supabase.from("ayuda_chat_sesiones").update({ estado: "escalada" }).eq("id", sesion_id);
  }

  return new Response(JSON.stringify({ ok: true, escalated, tier: "claude", respuesta: respuestaIA }), {
    headers: { "Content-Type": "application/json", ...cors },
  });
});
