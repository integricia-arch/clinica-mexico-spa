declare var EdgeRuntime: any;
import { WEBHOOK_SECRET } from "./bot_config.ts";
import { procesarUpdate } from "./bot_handlers.ts";

Deno.serve(async (req) => {
  if (req.method === "GET") return new Response(JSON.stringify({ status: "ok", fn: "telegram-webhook" }), { status: 200, headers: { "Content-Type": "application/json" } });
  if (!WEBHOOK_SECRET) return new Response("misconfigured", { status: 500 });
  const got = req.headers.get("x-telegram-bot-api-secret-token");
  if (got !== WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
  let update: any;
  try { update = await req.json(); } catch { return new Response("bad json", { status: 400 }); }
  const work = procesarUpdate(update).catch((err) => console.error("procesarUpdate error:", err));
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else await work;
  return new Response("ok");
});

