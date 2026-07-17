// Runner del harness: lanza stub-server + webhook local, alimenta transcripts
// y verifica lo que el bot manda a Telegram. Ver test/README.md.
//
//   deno run --allow-net --allow-env --allow-run --allow-read test/run-transcripts.ts
//
// Cada transcript: { "name": ..., "steps": [ { "send": {...}, "expect": [...], "notExpect": [...] } ] }
// send.text → update de mensaje; send.callback_data → callback_query.
// send.update_id (opcional) → fuerza update_id (para probar dedup).
// expect: regex (string) o { "pattern": ..., "max": n } contra los textos capturados del paso.

const STUB = "http://localhost:9999";
const WEBHOOK = "http://localhost:8000";
const SECRET = "test-secret";
const testDir = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const fnDir = testDir.replace(/test\/?$/, "");

const envComun = {
  SUPABASE_URL: STUB,
  SUPABASE_SERVICE_ROLE_KEY: "stub-service-key",
  TELEGRAM_API_BASE: STUB,
  ANTHROPIC_API_BASE: STUB,
  TELEGRAM_BOT_TOKEN: "stub-token",
  ANTHROPIC_API_KEY: "stub-key",
  WEBHOOK_SECRET: SECRET,
  CLINIC_NAME: "Clínica Test",
};

const DEBUG = Deno.env["get"]("HARNESS_DEBUG") === "1";

function spawn(script: string, extraEnv: Record<string, string> = {}) {
  return new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net", "--allow-env", "--allow-read", script],
    env: { ...envComun, ...extraEnv },
    cwd: fnDir,
    stdout: DEBUG ? "inherit" : "piped",
    stderr: DEBUG ? "inherit" : "piped",
  }).spawn();
}

async function esperar(url: string, intentos = 50): Promise<void> {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url);
      await r.body?.cancel();
      if (r.status < 500) return;
    } catch { /* aún no arriba */ }
    await new Promise((res) => setTimeout(res, 200));
  }
  throw new Error(`No arrancó: ${url}`);
}

let updateSeq = 1;
let cqSeq = 1;

function buildUpdate(send: Record<string, unknown>, chatId: number) {
  const update_id = (send.update_id as number) ?? updateSeq++;
  const from = { id: chatId, is_bot: false, first_name: "Paciente", username: "paciente_test" };
  const chat = { id: chatId, type: "private" };
  if (send.callback_data) {
    return {
      update_id,
      callback_query: {
        id: String(cqSeq++),
        from,
        message: { message_id: 1, chat },
        data: send.callback_data,
      },
    };
  }
  return { update_id, message: { message_id: updateSeq, from, chat, text: send.text ?? "" } };
}

interface Expect { pattern: string; min?: number; max?: number }

function normalizarExpects(list: unknown[]): Expect[] {
  return (list ?? []).map((e) =>
    typeof e === "string" ? { pattern: e, min: 1 } : { min: 1, ...(e as Expect) }
  );
}

async function correrTranscript(file: string): Promise<boolean> {
  const t = JSON.parse(await Deno.readTextFile(`${testDir}/transcripts/${file}`));
  await fetch(`${STUB}/__reset`).then((r) => r.body?.cancel());
  const chatId = 5000000 + Math.floor(Math.random() * 1000000);
  let ok = true;

  for (const [i, step] of (t.steps as Record<string, unknown>[]).entries()) {
    const update = buildUpdate(step.send as Record<string, unknown>, chatId);
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": SECRET },
      body: JSON.stringify(update),
    });
    await res.body?.cancel();
    if (res.status !== 200) {
      console.error(`  ✗ [${t.name}] paso ${i + 1}: webhook devolvió ${res.status}`);
      ok = false;
      continue;
    }
    // Sin EdgeRuntime, el handler hace await del procesamiento antes de responder,
    // pero damos margen a fire-and-forgets.
    await new Promise((r) => setTimeout(r, 150));
    const captura = await (await fetch(`${STUB}/__captured`)).json() as { api: string; body: { text?: string } }[];
    const textos = captura.map((c) => c.body?.text ?? "").filter(Boolean);

    for (const exp of normalizarExpects(step.expect as unknown[])) {
      const rx = new RegExp(exp.pattern, "i");
      const n = textos.filter((tx) => rx.test(tx)).length;
      if (exp.min !== undefined && n < exp.min) {
        console.error(`  ✗ [${t.name}] paso ${i + 1}: esperaba /${exp.pattern}/ (min ${exp.min}), hubo ${n}.\n    Capturado: ${JSON.stringify(textos)}`);
        ok = false;
      }
      if (exp.max !== undefined && n > exp.max) {
        console.error(`  ✗ [${t.name}] paso ${i + 1}: /${exp.pattern}/ apareció ${n} veces (max ${exp.max}).\n    Capturado: ${JSON.stringify(textos)}`);
        ok = false;
      }
    }
    for (const ne of (step.notExpect as string[] | undefined) ?? []) {
      const rx = new RegExp(ne, "i");
      if (textos.some((tx) => rx.test(tx))) {
        console.error(`  ✗ [${t.name}] paso ${i + 1}: NO esperaba /${ne}/.\n    Capturado: ${JSON.stringify(textos)}`);
        ok = false;
      }
    }
  }
  console.log(`${ok ? "✓" : "✗"} ${t.name}`);
  return ok;
}

// --- main ---
const stub = spawn(`${testDir}/stub-server.ts`, {
  RUN_REAL_LLM: Deno.env.get("RUN_REAL_LLM") ?? "",
  REAL_LLM_KEY: Deno.env.get("REAL_LLM_KEY") ?? "",
});
await esperar(`${STUB}/__health`);
const webhook = spawn(`${fnDir}/index.ts`);
await esperar(WEBHOOK);

let fallas = 0;
try {
  const files: string[] = [];
  for await (const f of Deno.readDir(`${testDir}/transcripts`)) {
    if (f.name.endsWith(".json")) files.push(f.name);
  }
  files.sort();
  for (const f of files) {
    if (!(await correrTranscript(f))) fallas++;
  }
} finally {
  stub.kill();
  webhook.kill();
}

console.log(fallas === 0 ? "\nTodos los transcripts en verde." : `\n${fallas} transcript(s) fallaron.`);
Deno.exit(fallas === 0 ? 0 : 1);
