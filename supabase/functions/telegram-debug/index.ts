Deno.serve(async () => {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
  const r = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const data = await r.json();
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
