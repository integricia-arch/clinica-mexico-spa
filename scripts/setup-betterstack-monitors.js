// Setup BetterStack Uptime monitors for Integriclinica
// Usage: BETTERSTACK_UPTIME_TOKEN=<token> node scripts/setup-betterstack-monitors.js
//
// Get token: BetterStack → Uptime → Settings → API

const TOKEN = process.env.BETTERSTACK_UPTIME_TOKEN;
if (!TOKEN) {
  console.error("Missing BETTERSTACK_UPTIME_TOKEN");
  process.exit(1);
}

const SUPABASE_URL = "https://kyfkvdyxpvpiacyymldc.supabase.co";
const PROD_URL     = "https://integrika.mx";
const CF_URL       = "https://clinica-mexico-spa.integric-ia.workers.dev";

const MONITORS = [
  {
    url:              PROD_URL,
    pronounceable_name: "Integriclinica — Producción",
    check_frequency:  60,
    request_timeout:  15,
    expected_status_codes: [200],
    follow_redirects: true,
    regions: ["us", "eu"],
  },
  {
    url:              CF_URL,
    pronounceable_name: "Integriclinica — Cloudflare Worker",
    check_frequency:  120,
    request_timeout:  15,
    expected_status_codes: [200],
    follow_redirects: true,
    regions: ["us"],
  },
  {
    url:              `${SUPABASE_URL}/rest/v1/`,
    pronounceable_name: "Supabase REST API",
    check_frequency:  60,
    request_timeout:  10,
    expected_status_codes: [200],
    follow_redirects: false,
    regions: ["us"],
  },
  {
    url:              `${SUPABASE_URL}/functions/v1/cfdi-timbrar`,
    pronounceable_name: "Edge Fn — cfdi-timbrar",
    check_frequency:  300,
    request_timeout:  10,
    expected_status_codes: [401, 403],
    follow_redirects: false,
    regions: ["us"],
  },
  {
    url:              `${SUPABASE_URL}/functions/v1/cfdi-email`,
    pronounceable_name: "Edge Fn — cfdi-email",
    check_frequency:  300,
    request_timeout:  10,
    expected_status_codes: [401, 403],
    follow_redirects: false,
    regions: ["us"],
  },
];

async function createMonitor(monitor) {
  const res = await fetch("https://uptime.betterstack.com/api/v2/monitors", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(monitor),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`✗ ${monitor.pronounceable_name}: ${res.status} ${JSON.stringify(data)}`);
    return;
  }

  console.log(`✓ ${monitor.pronounceable_name} — id: ${data.data?.id}`);
}

async function listExisting() {
  const res = await fetch("https://uptime.betterstack.com/api/v2/monitors", {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await res.json();
  return (data.data ?? []).map((m) => m.attributes?.url);
}

async function main() {
  console.log("Fetching existing monitors...");
  const existing = await listExisting();
  console.log(`Found ${existing.length} existing monitors\n`);

  for (const monitor of MONITORS) {
    if (existing.includes(monitor.url)) {
      console.log(`- ${monitor.pronounceable_name} ya existe, skip`);
      continue;
    }
    await createMonitor(monitor);
  }

  console.log("\nDone. Open https://betterstack.com/uptime to configure alerts.");
}

main().catch(console.error);
