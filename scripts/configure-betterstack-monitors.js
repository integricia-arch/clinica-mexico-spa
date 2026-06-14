// Configura todos los monitores BetterStack con settings óptimos para free plan
// Usage: BETTERSTACK_UPTIME_TOKEN=<token> node scripts/configure-betterstack-monitors.js

const TOKEN = process.env.BETTERSTACK_UPTIME_TOKEN;
if (!TOKEN) { console.error("Missing BETTERSTACK_UPTIME_TOKEN"); process.exit(1); }

const BASE = "https://uptime.betterstack.com/api/v2";
const HEADERS = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

// Settings aplicados a todos los monitores
const PATCH = {
  confirmation_period: 60,      // 1 minuto — evita falsos positivos
  recovery_period:     60,      // 1 minuto para marcar como resuelto
  regions:             ["us", "eu"],  // North America + Europe
};

async function listMonitors() {
  const res = await fetch(`${BASE}/monitors?per_page=50`, { headers: HEADERS });
  const data = await res.json();
  return data.data ?? [];
}

async function updateMonitor(id, name) {
  const res = await fetch(`${BASE}/monitors/${id}`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify(PATCH),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`✗ ${name}: ${res.status} ${JSON.stringify(data.errors ?? data)}`);
    return false;
  }
  const attrs = data.data?.attributes ?? {};
  console.log(`✓ ${name}`);
  console.log(`  confirmation: ${attrs.confirmation_period}s | recovery: ${attrs.recovery_period}s | regions: ${attrs.regions?.join(", ")}`);
  return true;
}

async function main() {
  console.log("Listando monitores...\n");
  const monitors = await listMonitors();

  if (!monitors.length) {
    console.log("No se encontraron monitores.");
    return;
  }

  console.log(`${monitors.length} monitores encontrados. Actualizando...\n`);

  for (const m of monitors) {
    const id   = m.id;
    const name = m.attributes?.pronounceable_name ?? m.attributes?.url ?? id;
    await updateMonitor(id, name);
  }

  console.log("\nListo. Abre https://betterstack.com/uptime/monitors para verificar.");
}

main().catch(console.error);
