import { supabase, processedCallbackIds } from "./bot_config.ts";
import { obtenerSesion, upsertSesion } from "./bot_db.ts";
import { ejecutarAgenteLoop } from "./bot_agent.ts";
import { enviarTelegram, answerCallback } from "./bot_telegram.ts";
import { detectarUrgencia, triageLLM, mensajeContencion } from "./bot_triage.ts";

export async function manejarCallback(cq: any) {
  const callbackQueryId = cq.id;
  const chatId = String(cq.from?.id ?? cq.message?.chat?.id);
  const data = cq.data ?? "";

  await answerCallback(callbackQueryId);
}

export async function manejarMensaje(chatId: string, rawMsg: any, text: string) {
  // Triage interceptor (seguridad)
  let triage = detectarUrgencia(text ?? "");
  if (!triage.urgente && (text ?? "").trim().length >= 10) {
    const llm = await triageLLM(text ?? "");
    if (llm.urgente) triage = { urgente: true, motivo: llm.motivo, dolor: triage.dolor, tipo: llm.tipo };
  }

  if (triage.urgente) {
    const aviso = mensajeContencion(triage.tipo);
    await enviarTelegram(chatId, aviso);
    return;
  }

  // Agente maneja todo demás
  const sesion = await obtenerSesion(chatId);
  // Para este harness, usar chatId como conversacionId (en prod sería distinto)
  const conversacionId = chatId;
  const messages = [{ role: "user", content: text }];

  try {
    const respuesta = await ejecutarAgenteLoop(chatId, conversacionId, messages, text);
    if (respuesta) {
      await enviarTelegram(chatId, respuesta);
    }
  } catch (err: any) {
    console.error("manejarMensaje error:", err);
    await enviarTelegram(chatId, "Tuve un problema técnico. ¿Puedes repetirme tu última frase?");
  }
}

export async function procesarUpdate(update: any) {
  const chatId = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id ?? update.callback_query?.from?.id;
  if (!chatId) return;

  const chatIdStr = String(chatId);

  // Dedup via Telegram API (update_id)
  const updateId = update.update_id;
  if (updateId) {
    const { error: dedupErr } = await supabase.from("telegram_updates").insert({ update_id: updateId });
    if (dedupErr?.code === "23505") return; // Duplicado, ignorar
  }

  if (update.message?.text) {
    const text = update.message.text.trim();
    if (text) await manejarMensaje(chatIdStr, update.message, text);
  } else if (update.callback_query) {
    await manejarCallback(update.callback_query);
  }
}
