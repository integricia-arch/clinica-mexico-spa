// Structured logger for Supabase edge functions → BetterStack Logs
// Set BETTERSTACK_SOURCE_TOKEN in Supabase Secrets to enable.
// Falls back to console if token not set (Supabase native log drain still works).

const TOKEN = Deno.env.get("BETTERSTACK_SOURCE_TOKEN");
const INGEST = "https://in.logs.betterstack.com";

type Level = "info" | "warn" | "error";
type Ctx = Record<string, unknown>;

async function ship(level: Level, message: string, ctx: Ctx): Promise<void> {
  if (!TOKEN) {
    console[level](`[${level}] ${message}`, JSON.stringify(ctx));
    return;
  }
  try {
    await fetch(INGEST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        level,
        message,
        dt: new Date().toISOString(),
        ...ctx,
      }),
    });
  } catch {
    // Never throw from logging
    console[level](`[${level}] ${message}`, JSON.stringify(ctx));
  }
}

export const edgeLogger = {
  info: (msg: string, ctx: Ctx = {}) => ship("info", msg, ctx),
  warn: (msg: string, ctx: Ctx = {}) => ship("warn", msg, ctx),
  error: (msg: string, ctx: Ctx = {}) => ship("error", msg, ctx),
};
