// =================================================================
// notify-cxp-vencimiento: alerta a admin/manager cuando facturas de
// proveedor vencen en ≤3 días o están vencidas sin pagar.
//
// Cron: auth via Bearer NOTIFY_CXP_CRON_SECRET env var
// Manual: Bearer <service_role_key> o JWT de admin/manager
// verify_jwt: false (ver config.toml)
// =================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM   = Deno.env.get("RESEND_FROM") ?? "Integriclinica <onboarding@resend.dev>";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const CRON_SECRET   = Deno.env.get("NOTIFY_CXP_CRON_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const svc = createClient(SUPABASE_URL, SUPABASE_SVC);

async function getEnabledChannels(clinicId: string, eventType: string): Promise<Set<string>> {
  const { data } = await svc
    .from("notification_rules")
    .select("channel")
    .eq("clinic_id", clinicId)
    .eq("event_type", eventType)
    .eq("enabled", true);
  return new Set((data ?? []).map((r: { channel: string }) => r.channel));
}

interface FacturaRow {
  id: string;
  clinic_id: string;
  serie_folio_proveedor: string;
  fecha_vencimiento: string;
  saldo_pendiente_centavos: number;
  total_centavos: number;
  concepto: string;
  proveedor_id: string;
  proveedores: { nombre: string } | null;
}

interface ClinicGroup {
  clinic_id: string;
  facturas: FacturaRow[];
  emails: string[];
  telegram_chat_id: string | null;
}

const fmtMXN = (c: number) =>
  (c / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET")     return json({ status: "ok", fn: "notify-cxp-vencimiento" });

  // Auth: cron secret OR service role key OR valid admin JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  let authorized = false;

  // 1. Cron secret
  if (CRON_SECRET && bearer === CRON_SECRET) {
    authorized = true;
  }
  // 2. Service role key
  else if (bearer === SUPABASE_SVC) {
    authorized = true;
  }
  // 3. Valid admin/manager JWT
  else if (bearer) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (userData?.user) {
      const { data: roles } = await svc
        .from("clinic_memberships")
        .select("role")
        .eq("user_id", userData.user.id)
        .in("role", ["admin", "manager"]);
      if ((roles ?? []).length > 0) authorized = true;
    }
  }

  if (!authorized) return json({ error: "Unauthorized" }, 401);

  try {
    const result = await procesarNotificaciones();
    return json({ ok: true, ...result });
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message ?? String(err);
    console.error("[notify-cxp-vencimiento] error:", msg);
    return json({ error: msg }, 500);
  }
});

async function procesarNotificaciones() {
  const now = new Date();
  // Ventana: ya vencidas O que vencen en los próximos 3 días
  const limit3d = new Date(now);
  limit3d.setDate(limit3d.getDate() + 3);

  // Buscar facturas no notificadas (o notificadas hace >24h) con saldo pendiente
  const { data: facturas, error } = await (svc as unknown as {
    from: (t: string) => {
      select: (q: string) => {
        lte: (col: string, val: string) => {
          gt: (col: string, val: number) => {
            or: (expr: string) => Promise<{ data: FacturaRow[] | null; error: unknown }>;
          };
        };
      };
    };
  }).from("facturas_proveedor").select(`
    id, clinic_id, serie_folio_proveedor, fecha_vencimiento,
    saldo_pendiente_centavos, total_centavos, concepto, proveedor_id,
    proveedores ( nombre )
  `)
    .lte("fecha_vencimiento", limit3d.toISOString().split("T")[0])
    .gt("saldo_pendiente_centavos", 0)
    .or(`ultima_notificacion_vencimiento_at.is.null,ultima_notificacion_vencimiento_at.lt.${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}`);

  if (error) throw new Error("Error fetching facturas: " + JSON.stringify(error));
  if (!facturas?.length) return { enviadas: 0, facturas_procesadas: 0 };

  // Agrupar por clínica
  const clinicMap: Record<string, ClinicGroup> = {};
  for (const f of facturas) {
    if (!clinicMap[f.clinic_id]) {
      clinicMap[f.clinic_id] = { clinic_id: f.clinic_id, facturas: [], emails: [], telegram_chat_id: null };
    }
    clinicMap[f.clinic_id].facturas.push(f);
  }

  // Para cada clínica, obtener emails admin/manager y telegram_chat_id
  await Promise.all(Object.values(clinicMap).map(async (group) => {
    // Emails: clinic_memberships → auth.users
    const { data: members } = await svc
      .from("clinic_memberships")
      .select("user_id")
      .eq("clinic_id", group.clinic_id)
      .in("role", ["admin", "manager"]);

    for (const m of (members ?? [])) {
      const { data: u } = await svc.auth.admin.getUserById(m.user_id);
      if (u?.user?.email) group.emails.push(u.user.email);
    }

    // Telegram chat_id desde clinic_settings
    const { data: settings } = await svc
      .from("clinic_settings")
      .select("data")
      .eq("clinic_id", group.clinic_id)
      .eq("section", "notifications")
      .maybeSingle();
    group.telegram_chat_id = (settings?.data as Record<string, string> | null)?.telegram_admin_chat_id ?? null;
  }));

  let totalEnviadas = 0;

  // Enviar notificaciones por clínica
  for (const group of Object.values(clinicMap)) {
    const vencidas   = group.facturas.filter((f) => f.fecha_vencimiento < now.toISOString().split("T")[0]);
    const porVencer  = group.facturas.filter((f) => f.fecha_vencimiento >= now.toISOString().split("T")[0]);
    const totalSaldo = group.facturas.reduce((s, f) => s + f.saldo_pendiente_centavos, 0);

    const channels   = await getEnabledChannels(group.clinic_id, "cxp_vencimiento");
    const emailSent  = channels.has("email")    ? await enviarEmail(group, vencidas, porVencer, totalSaldo)    : false;
    const tgSent     = channels.has("telegram") ? await enviarTelegram(group, vencidas, porVencer, totalSaldo) : false;

    if (emailSent || tgSent) {
      totalEnviadas++;
      // Marcar facturas como notificadas
      const ids = group.facturas.map((f) => f.id);
      await svc
        .from("facturas_proveedor")
        .update({ ultima_notificacion_vencimiento_at: now.toISOString() })
        .in("id", ids);
    }
  }

  return {
    enviadas: totalEnviadas,
    facturas_procesadas: facturas.length,
    clinicas: Object.keys(clinicMap).length,
  };
}

async function enviarEmail(
  group: ClinicGroup,
  vencidas: FacturaRow[],
  porVencer: FacturaRow[],
  totalSaldo: number,
): Promise<boolean> {
  if (!RESEND_API_KEY || !group.emails.length) return false;

  const rows = (arr: FacturaRow[], labelColor: string) =>
    arr.map((f) => {
      const dias = Math.round((new Date(f.fecha_vencimiento).getTime() - Date.now()) / 86400000);
      const diasStr = dias < 0 ? `${Math.abs(dias)}d vencida` : dias === 0 ? "vence hoy" : `vence en ${dias}d`;
      const proveedor = f.proveedores?.nombre ?? f.proveedor_id.slice(0, 8);
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${proveedor}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;font-family:monospace">${f.serie_folio_proveedor}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;color:${labelColor};font-weight:600">${diasStr}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600">${fmtMXN(f.saldo_pendiente_centavos)}</td>
      </tr>`;
    }).join("");

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#1a1a1a;margin:0;padding:0;background:#f5f5f5">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.12)">
    <div style="background:#dc2626;padding:20px 28px">
      <h1 style="margin:0;color:#fff;font-size:18px">⚠️ Alerta CxP — Facturas por vencer</h1>
      <p style="margin:4px 0 0;color:#fca5a5;font-size:13px">Integriclinica · Cuentas por Pagar</p>
    </div>
    <div style="padding:24px 28px">
      <p style="font-size:14px;color:#555;margin-top:0">
        Se detectaron <strong>${group.facturas.length} factura${group.facturas.length !== 1 ? "s" : ""}</strong>
        de proveedor con saldo pendiente que requieren atención:
      </p>
      ${vencidas.length > 0 ? `
      <h3 style="font-size:13px;color:#dc2626;margin-bottom:4px">🔴 Vencidas (${vencidas.length})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
        <thead><tr style="background:#fef2f2;color:#dc2626;text-align:left">
          <th style="padding:6px 8px">Proveedor</th><th style="padding:6px 8px">Folio</th>
          <th style="padding:6px 8px">Estado</th><th style="padding:6px 8px;text-align:right">Saldo</th>
        </tr></thead>
        <tbody>${rows(vencidas, "#dc2626")}</tbody>
      </table>` : ""}
      ${porVencer.length > 0 ? `
      <h3 style="font-size:13px;color:#d97706;margin-bottom:4px">🟡 Por vencer en ≤3 días (${porVencer.length})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
        <thead><tr style="background:#fffbeb;color:#d97706;text-align:left">
          <th style="padding:6px 8px">Proveedor</th><th style="padding:6px 8px">Folio</th>
          <th style="padding:6px 8px">Estado</th><th style="padding:6px 8px;text-align:right">Saldo</th>
        </tr></thead>
        <tbody>${rows(porVencer, "#d97706")}</tbody>
      </table>` : ""}
      <div style="background:#f9f9f9;border-radius:6px;padding:12px 16px;margin-top:8px;text-align:right">
        <span style="font-size:13px;color:#666">Total pendiente a pagar: </span>
        <span style="font-size:18px;font-weight:700;color:#dc2626">${fmtMXN(totalSaldo)}</span>
      </div>
    </div>
    <div style="background:#f9f9f9;padding:14px 28px;border-top:1px solid #e5e7eb">
      <p style="font-size:11px;color:#999;margin:0">
        Este correo es generado automáticamente por Integriclinica. Ingresa al sistema para registrar pagos.
      </p>
    </div>
  </div>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: group.emails,
      subject: `⚠️ CxP: ${group.facturas.length} factura${group.facturas.length !== 1 ? "s" : ""} por vencer — ${fmtMXN(totalSaldo)} pendiente`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[notify-cxp-vencimiento] Resend error:", err);
    return false;
  }
  return true;
}

async function enviarTelegram(
  group: ClinicGroup,
  vencidas: FacturaRow[],
  porVencer: FacturaRow[],
  totalSaldo: number,
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !group.telegram_chat_id) return false;

  const lines: string[] = [
    `⚠️ *Alerta CxP — Facturas Proveedores*`,
    ``,
  ];

  if (vencidas.length > 0) {
    lines.push(`🔴 *Vencidas (${vencidas.length}):*`);
    for (const f of vencidas) {
      const dias = Math.round((Date.now() - new Date(f.fecha_vencimiento).getTime()) / 86400000);
      const prov = f.proveedores?.nombre ?? "—";
      lines.push(`• ${f.serie_folio_proveedor} · ${prov} · ${dias}d vencida · ${fmtMXN(f.saldo_pendiente_centavos)}`);
    }
    lines.push(``);
  }

  if (porVencer.length > 0) {
    lines.push(`🟡 *Por vencer ≤3 días (${porVencer.length}):*`);
    for (const f of porVencer) {
      const dias = Math.round((new Date(f.fecha_vencimiento).getTime() - Date.now()) / 86400000);
      const prov = f.proveedores?.nombre ?? "—";
      const diasStr = dias === 0 ? "hoy" : `${dias}d`;
      lines.push(`• ${f.serie_folio_proveedor} · ${prov} · vence ${diasStr} · ${fmtMXN(f.saldo_pendiente_centavos)}`);
    }
    lines.push(``);
  }

  lines.push(`💰 *Total pendiente: ${fmtMXN(totalSaldo)}*`);

  const text = lines.join("\n");

  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: group.telegram_chat_id,
        text,
        parse_mode: "Markdown",
      }),
    },
  );

  if (!res.ok) {
    // Retry without Markdown
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: group.telegram_chat_id, text: text.replace(/\*/g, "") }),
      },
    );
  }

  return true;
}
