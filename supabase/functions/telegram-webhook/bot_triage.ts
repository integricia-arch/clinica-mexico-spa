import { ANTHROPIC_API_KEY, ANTHROPIC_API_BASE, ANTHROPIC_MODEL } from "./bot_config.ts";

type TipoUrgencia = "fisica" | "mental";

const URGENCIA_REGEX_FISICA = [
  /\b(dolor intenso|mucho dolor|dolor severo|duele mucho)\b/i,
  /\b(no puedo respirar|dificultad para respirar|ahogo|asfixia)\b/i,
  /\b(sangrado|hemorragia|desangrando)\b/i,
  /\b(inconsciencia|desmayo|pérdida de conciencia|me desmayé)\b/i,
  /\b(convulsión|convulsiones|epilepsia)\b/i,
  /\b(veneno|intoxicación|envenenamiento)\b/i,
  /\b(golpe en (cabeza|cráneo)|trauma)\b/i,
  /\b(accidente|choque|colisión)\b/i,
];

const URGENCIA_REGEX_MENTAL = [
  /\b(suicida|suicidio|matarme|quitarme la vida)\b/i,
  /\b(autolesión|cortarme|cortadas|lastimarme)\b/i,
  /\b(alucinaciones|veo cosas|escucho voces)\b/i,
  /\b(crisis|pánico severo|ataque de pánico)\b/i,
];

export function detectarUrgencia(text: string): { urgente: boolean; motivo?: string; dolor?: number; tipo?: TipoUrgencia } {
  const t = (text ?? "").toLowerCase();
  let dolor: number | undefined;
  const m1 = t.match(/\b(?:dolor|intensidad|nivel)\D{0,8}(\d{1,2})\b/);
  const m2 = t.match(/\b(\d{1,2})\s*\/\s*10\b/);
  const m3 = t.match(/^\s*(\d{1,2})\s*$/);
  const cand = m1?.[1] ?? m2?.[1] ?? m3?.[1];
  if (cand) { const n = parseInt(cand, 10); if (n >= 0 && n <= 10) dolor = n; }
  if (dolor !== undefined && dolor >= 8) return { urgente: true, motivo: `Dolor reportado ${dolor}/10`, dolor, tipo: "fisica" };
  for (const rx of URGENCIA_REGEX_MENTAL) { const m = t.match(rx); if (m) return { urgente: true, motivo: m[0], dolor, tipo: "mental" }; }
  for (const rx of URGENCIA_REGEX_FISICA) { const m = t.match(rx); if (m) return { urgente: true, motivo: m[0], dolor, tipo: "fisica" }; }
  return { urgente: false, dolor };
}

export async function triageLLM(text: string): Promise<{ urgente: boolean; tipo?: TipoUrgencia; motivo?: string }> {
  try {
    const res = await fetch(`${ANTHROPIC_API_BASE}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 100,
        system: `Eres un sistema de triage médico. Analiza si el mensaje indica una emergencia médica.
Responde SOLO con JSON: {"urgente": true/false, "tipo": "fisica"|"mental"|null, "motivo": "breve o null"}`,
        messages: [{ role: "user", content: `Mensaje: "${text.slice(0, 300)}"` }],
      }),
    });
    if (!res.ok) return { urgente: false };
    const data = await res.json();
    const raw = data.content?.[0]?.text ?? "{}";
    const parsed = JSON.parse(raw);
    return { urgente: !!parsed.urgente, tipo: parsed.tipo ?? undefined, motivo: parsed.motivo ?? undefined };
  } catch {
    return { urgente: false };
  }
}

export function mensajeContencion(tipo: TipoUrgencia | undefined): string {
  if (tipo === "mental") {
    return "Recepción ya fue notificada.\n\n🆘 SAPTEL 55 5259-8121 (24h, gratuito).";
  }
  return "Si tienes emergencia médica, llama al 911. Recepción ya fue notificada.";
}
