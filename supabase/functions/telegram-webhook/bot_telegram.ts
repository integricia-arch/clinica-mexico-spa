import { TELEGRAM_BOT_TOKEN, TELEGRAM_API_BASE } from "./bot_config.ts";

async function telegramSendMessage(payload: Record<string, unknown>, label: string) {
  const send = (body: Record<string, unknown>) =>
    fetch(`${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  let res = await send({ ...payload, parse_mode: "Markdown" });
  if (res.ok) return;

  const errText = await res.text();
  console.error(`${label} (markdown) error, retrying as plain text:`, errText);

  res = await send(payload);
  if (!res.ok) console.error(`${label} (plain) error:`, await res.text());
}

export async function enviarTelegram(chatId: string, text: string) {
  await telegramSendMessage({ chat_id: chatId, text }, "Telegram send");
}

export async function enviarTelegramConBotones(chatId: string, text: string, inlineKeyboard: any[][]) {
  await telegramSendMessage(
    { chat_id: chatId, text, reply_markup: { inline_keyboard: inlineKeyboard } },
    "Telegram send buttons",
  );
}

export async function answerCallback(callbackQueryId: string, text?: string) {
  const payload: any = { callback_query_id: callbackQueryId };
  if (text) payload.notification_text = text;
  await fetch(`${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}
