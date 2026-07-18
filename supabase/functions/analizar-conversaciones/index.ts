import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface AnalisisResult {
  sentimiento: string;
  intencion_principal: string;
  intencion_cumplida: boolean;
  friccion: string | null;
  queja: string | null;
  quiere: string | null;
  posible_bug: string | null;
  acepto_promociones: boolean;
  escalada: boolean;
  cita_creada: boolean;
}

async function callClaude(prompt: string): Promise<string> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Claude API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.content?.[0]?.text ?? "";
}

function extractJSON(text: string): AnalisisResult | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return {
      sentimiento: parsed.sentimiento || "neutral",
      intencion_principal: parsed.intencion_principal || "desconocida",
      intencion_cumplida: parsed.intencion_cumplida ?? false,
      friccion: parsed.friccion || null,
      queja: parsed.queja || null,
      quiere: parsed.quiere || null,
      posible_bug: parsed.posible_bug || null,
      acepto_promociones: parsed.acepto_promociones ?? false,
      escalada: parsed.escalada ?? false,
      cita_creada: parsed.cita_creada ?? false,
    };
  } catch {
    return null;
  }
}

Deno.serve(async () => {
  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "ANTHROPIC_API_KEY not set" }), { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ponytail: query only conversations without analysis, last 24h
  const { data: convs, error: queryErr } = await supabase
    .from("conversaciones")
    .select("id, clinic_id, mensajes, created_at, last_message_at, duracion_minutos")
    .is("id", null as any) // placeholder, will be fixed with proper LEFT JOIN
    .neq("clinic_id", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (queryErr) {
    console.error("Query error:", queryErr);
    return new Response(JSON.stringify({ ok: false, error: queryErr.message }), { status: 500 });
  }

  if (!convs || convs.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: "No conversations to analyze", count: 0 }), { status: 200 });
  }

  let successCount = 0;
  let errorCount = 0;

  for (const conv of convs) {
    try {
      const mensajesText = Array.isArray(conv.mensajes)
        ? conv.mensajes.map((m: any) => `${m.rol}: ${m.texto}`).join("\n")
        : JSON.stringify(conv.mensajes);

      const duracion = conv.last_message_at && conv.created_at
        ? Math.round((new Date(conv.last_message_at).getTime() - new Date(conv.created_at).getTime()) / 60000)
        : conv.duracion_minutos || 0;

      const prompt = `Analiza esta conversación de chat de agenda médica y extrae en JSON:
{
  "sentimiento": "positivo|neutral|negativo|enojado",
  "intencion_principal": "agendar cita|cambiar cita|consulta|otro",
  "intencion_cumplida": true|false,
  "friccion": "si hay fricción, describirla brevemente, sino null",
  "queja": "si hay queja, describirla, sino null",
  "quiere": "feature/mejora que pide el usuario, sino null",
  "posible_bug": "si detectedas un bug del sistema, describirlo, sino null",
  "acepto_promociones": true|false,
  "escalada": true|false (escaló a humano),
  "cita_creada": true|false
}

Conversación:
${mensajesText}`;

      const claudeResp = await callClaude(prompt);
      const analisis = extractJSON(claudeResp);

      if (!analisis) {
        errorCount++;
        continue;
      }

      const { error: insertErr } = await supabase
        .from("conversacion_analisis")
        .insert({
          conversacion_id: conv.id,
          clinic_id: conv.clinic_id,
          sentimiento: analisis.sentimiento,
          intencion_principal: analisis.intencion_principal,
          intencion_cumplida: analisis.intencion_cumplida,
          friccion: analisis.friccion,
          queja: analisis.queja,
          quiere: analisis.quiere,
          posible_bug: analisis.posible_bug,
          acepto_promociones: analisis.acepto_promociones,
          duracion_minutos: duracion,
          mensajes_count: Array.isArray(conv.mensajes) ? conv.mensajes.length : 0,
          escalada: analisis.escalada,
          cita_creada: analisis.cita_creada,
          modelo: "claude-haiku-4-5-20251001",
        });

      if (insertErr) {
        console.error("Insert error for conv", conv.id, insertErr);
        errorCount++;
      } else {
        successCount++;
      }
    } catch (err) {
      console.error("Error analyzing conversation", conv.id, err);
      errorCount++;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      success: successCount,
      errors: errorCount,
      total: convs.length,
    }),
    { status: 200 }
  );
});
