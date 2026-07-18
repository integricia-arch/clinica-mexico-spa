// Stub server para el harness local del bot (ver test/README.md).
// Emula en un solo proceso: Telegram Bot API, Anthropic Messages API y
// PostgREST (Supabase) con un store en memoria. NO replica Postgres — solo
// el subconjunto que telegram-webhook usa.

const PORT = 9999;
const seedUrl = new URL("./fixtures/seed.json", import.meta.url);
const SEED: Record<string, Record<string, unknown>[]> = JSON.parse(
  await Deno.readTextFile(seedUrl),
);

// PK por tabla para simular conflicto 23505 (dedup de updates).
const PKS: Record<string, string> = { telegram_updates: "update_id" };

// Defaults de columnas que en Postgres pone el DDL y el código asume presentes.
const DEFAULTS: Record<string, Record<string, unknown>> = {
  conversaciones: { status: "activa", prioridad: "normal", insiste: false, escalated_followup_count: 0 },
  bot_sesiones: { flow_data: {} },
};

let store: Map<string, Record<string, unknown>[]> = new Map();
let captured: { api: string; body: unknown }[] = [];
let msgIdCounter = 1000;

function resetStore() {
  store = new Map();
  for (const [table, rows] of Object.entries(SEED)) {
    store.set(table, rows.map((r) => ({ ...r })));
  }
  captured = [];
}
resetStore();

function tabla(name: string): Record<string, unknown>[] {
  if (!store.has(name)) store.set(name, []);
  return store.get(name)!;
}

// ---------- filtros PostgREST ----------
const NO_FILTER = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function matchFilter(row: Record<string, unknown>, key: string, raw: string): boolean {
  const dot = raw.indexOf(".");
  const op = raw.slice(0, dot);
  let val = raw.slice(dot + 1);
  // columna embebida: "doctors.activo" → row.doctors.activo
  let cell: unknown = row;
  for (const part of key.split(".")) cell = (cell as Record<string, unknown>)?.[part];
  const s = cell === null || cell === undefined ? null : String(cell);
  switch (op) {
    case "eq": return s === val;
    case "neq": return s !== val;
    case "is": return val === "null" ? s === null : s === val;
    case "in": {
      val = val.replace(/^\(/, "").replace(/\)$/, "");
      const items = val.split(",").map((v) => v.replace(/^"|"$/g, ""));
      return s !== null && items.includes(s);
    }
    case "gte": return s !== null && s >= val;
    case "lte": return s !== null && s <= val;
    case "gt": return s !== null && s > val;
    case "lt": return s !== null && s < val;
    default: return true;
  }
}

function applyFilters(rows: Record<string, unknown>[], params: URLSearchParams) {
  let out = rows.filter((r) =>
    [...params.entries()].every(([k, v]) => NO_FILTER.has(k) || matchFilter(r, k, v))
  );
  const order = params.get("order");
  if (order) {
    const [col, dir] = order.split(".");
    out = [...out].sort((a, b) => {
      const av = String(a[col] ?? ""), bv = String(b[col] ?? "");
      return dir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
    });
  }
  const limit = params.get("limit");
  if (limit) out = out.slice(0, parseInt(limit, 10));
  return out;
}

function pgrstResponse(rows: Record<string, unknown>[], accept: string | null): Response {
  const wantsObject = accept?.includes("vnd.pgrst.object") ?? false;
  if (wantsObject) {
    if (rows.length === 0) {
      return Response.json(
        { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: "The result contains 0 rows", hint: null },
        { status: 406 },
      );
    }
    return Response.json(rows[0]);
  }
  return Response.json(rows);
}

function handlePostgrest(req: Request, url: URL, body: unknown): Response {
  const path = url.pathname.replace(/^\/rest\/v1\//, "");
  const accept = req.headers.get("accept");
  const prefer = req.headers.get("prefer") ?? "";

  if (path.startsWith("rpc/")) return Response.json([]);

  const rows = tabla(path);

  if (req.method === "GET") return pgrstResponse(applyFilters(rows, url.searchParams), accept);

  if (req.method === "POST") {
    const incoming = Array.isArray(body) ? body : [body];
    const isUpsert = prefer.includes("resolution=merge-duplicates") || url.searchParams.has("on_conflict");
    const conflictCols = (url.searchParams.get("on_conflict") ?? PKS[path] ?? "").split(",").filter(Boolean);
    const inserted: Record<string, unknown>[] = [];
    for (const raw of incoming) {
      const row: Record<string, unknown> = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...(DEFAULTS[path] ?? {}),
        ...(raw as Record<string, unknown>),
      };
      if (conflictCols.length > 0) {
        const idx = rows.findIndex((r) => conflictCols.every((c) => String(r[c]) === String(row[c])));
        if (idx >= 0) {
          if (!isUpsert) {
            return Response.json(
              { code: "23505", message: `duplicate key value violates unique constraint "${path}_pkey"`, details: null, hint: null },
              { status: 409 },
            );
          }
          rows[idx] = { ...rows[idx], ...row, id: rows[idx].id };
          inserted.push(rows[idx]);
          continue;
        }
      }
      rows.push(row);
      inserted.push(row);
    }
    if (prefer.includes("return=representation")) return pgrstResponse(inserted, accept);
    return new Response(null, { status: 201 });
  }

  if (req.method === "PATCH") {
    const matched = applyFilters(rows, url.searchParams);
    for (const r of matched) Object.assign(r, body);
    if (prefer.includes("return=representation")) return pgrstResponse(matched, accept);
    return new Response(null, { status: 204 });
  }

  if (req.method === "DELETE") {
    const matched = new Set(applyFilters(rows, url.searchParams));
    store.set(path, rows.filter((r) => !matched.has(r)));
    return new Response(null, { status: 204 });
  }

  return new Response("method not supported", { status: 405 });
}

// ---------- Anthropic stub ----------
function anthropicText(text: string): Response {
  return Response.json({
    id: "msg_stub", type: "message", role: "assistant", model: "stub",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    usage: { input_tokens: 1, output_tokens: 1 },
  });
}

async function handleAnthropic(req: Request): Promise<Response> {
  const body = await req.json();
  if (Deno.env.get("RUN_REAL_LLM") === "1") {
    // Proxy al API real — la key viene del env del shell, nunca de un archivo.
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": Deno.env.get("REAL_LLM_KEY") ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    return new Response(await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
  }
  const system = String(body.system ?? "");
  const userText = String(body.messages?.at(-1)?.content ?? "");
  if (system.includes("triage médico")) {
    return anthropicText(JSON.stringify({ urgente: false, tipo: null, motivo: null }));
  }
  if (system.includes("Clasifica el mensaje")) {
    return anthropicText(/\b(cita|agendar|agenda)\b/i.test(userText) ? "booking" : "otro");
  }
  return anthropicText("[STUB-AGENTE]");
}

// ---------- server ----------
Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  let body: unknown = null;
  if (req.method !== "GET" && !url.pathname.startsWith("/v1/")) {
    try { body = await req.json(); } catch { body = null; }
  }

  if (url.pathname === "/__health") return Response.json({ ok: true });
  if (url.pathname === "/__reset") { resetStore(); return Response.json({ ok: true }); }
  if (url.pathname === "/__captured") {
    const out = captured;
    captured = [];
    return Response.json(out);
  }
  if (url.pathname === "/__store") {
    return Response.json(Object.fromEntries(store.entries()));
  }

  // Telegram Bot API: /bot<token>/<metodo>
  const tg = url.pathname.match(/^\/bot[^/]+\/(\w+)$/);
  if (tg) {
    captured.push({ api: tg[1], body });
    return Response.json({ ok: true, result: { message_id: ++msgIdCounter } });
  }

  // Anthropic
  if (url.pathname === "/v1/messages") return handleAnthropic(req);

  // PostgREST
  if (url.pathname.startsWith("/rest/v1/")) return handlePostgrest(req, url, body);

  // supabase-js hace un GET a /auth/v1/... a veces; responder vacío inofensivo
  return Response.json({});
});

console.log(`[stub-server] escuchando en http://localhost:${PORT}`);
