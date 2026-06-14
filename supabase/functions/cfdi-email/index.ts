// =================================================================
// cfdi-email: envía CFDI timbrado por email (XML + PDF adjuntos)
// vía Resend. Solo admin. El email se toma de cfdi_receptores o
// del parámetro email_override del body.
// =================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM    = Deno.env.get("RESEND_FROM") ?? "Integriclinica <onboarding@resend.dev>";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

async function getPacCredentials(svc: ReturnType<typeof createClient>, cfg: Record<string, any>) {
  if (cfg.pac_secret_id) {
    const { data: secret, error } = await svc.rpc("cfdi_get_secret", { p_id: cfg.pac_secret_id });
    if (error) throw new Error("Error leyendo secreto PAC: " + error.message);
    return { pac_contrasena: secret as string };
  }
  if (cfg.pac_contrasena) return { pac_contrasena: cfg.pac_contrasena as string };
  throw new Error("Credenciales PAC no configuradas");
}

interface EmailRequest {
  clinic_id: string;
  cfdi_id: string;
  email_override?: string; // si no está en cfdi_receptores
}

const TIPO_LABEL: Record<string, string> = {
  I: "Factura de Ingreso",
  E: "Nota de Crédito",
  P: "Complemento de Recepción de Pagos",
};

const fmt = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") return json({ status: "ok", fn: "cfdi-email" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supaUser.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const svc = createClient(SUPABASE_URL, SUPABASE_SVC);

  const { data: roles } = await svc
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) {
    return json({ error: "Forbidden" }, 403);
  }

  if (!RESEND_API_KEY) {
    return json({ error: "Servicio de email no configurado — agrega RESEND_API_KEY en Supabase Secrets" }, 503);
  }

  try {
    const body: EmailRequest = await req.json();
    const { clinic_id, cfdi_id, email_override } = body;

    if (!clinic_id || !cfdi_id) {
      return json({ error: "clinic_id y cfdi_id son obligatorios" }, 400);
    }

    // Cargar CFDI
    const { data: doc } = await svc
      .from("cfdi_documentos")
      .select("id, uuid_fiscal, serie, folio, tipo, rfc_receptor, nombre_receptor, total, fecha_emision, xml_contenido, pac_id_externo, clinic_id")
      .eq("id", cfdi_id)
      .eq("clinic_id", clinic_id)
      .single();

    if (!doc) return json({ error: "CFDI no encontrado" }, 404);
    if (!doc.xml_contenido) return json({ error: "CFDI sin XML almacenado — no se puede enviar" }, 422);

    // Cargar config clínica (emisor + PAC)
    const { data: cfg } = await svc
      .from("cfdi_config")
      .select("rfc, nombre_razon_social, pac_ambiente, pac_usuario, pac_secret_id, pac_contrasena")
      .eq("clinic_id", clinic_id)
      .maybeSingle();

    // Cargar configuración de email por clínica
    const { data: emailSettings } = await svc
      .from("clinic_settings")
      .select("data")
      .eq("clinic_id", clinic_id)
      .eq("section", "email")
      .maybeSingle();
    const emailCfg = (emailSettings as any)?.data as {
      from_name?: string;
      from_email?: string;
      reply_to?: string;
    } | null;

    // Determinar email destino
    let destinatario = email_override?.trim() ?? "";
    if (!destinatario) {
      const { data: receptor } = await svc
        .from("cfdi_receptores")
        .select("email_envio")
        .eq("clinic_id", clinic_id)
        .eq("rfc", doc.rfc_receptor)
        .maybeSingle();
      destinatario = (receptor as any)?.email_envio ?? "";
    }

    if (!destinatario) {
      return json({ error: "Sin email registrado para este receptor — proporciona email_override o actualiza el catálogo de receptores" }, 422);
    }

    // Validación básica de formato email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinatario)) {
      return json({ error: `Email inválido: ${destinatario}` }, 400);
    }

    // Construir nombre del archivo
    const folio = doc.serie ? `${doc.serie}-${doc.folio ?? "0"}` : (doc.folio ?? "0");
    const baseFilename = `CFDI_${folio}_${(doc.uuid_fiscal ?? doc.id).substring(0, 8).toUpperCase()}`;

    // Adjuntos
    const attachments: Array<{ filename: string; content: string }> = [];

    // XML (siempre disponible desde BD)
    attachments.push({
      filename: `${baseFilename}.xml`,
      content:  toBase64(doc.xml_contenido),
    });

    // PDF desde Facturama (opcional — no bloquea si falla)
    if (doc.pac_id_externo && cfg?.pac_usuario) {
      try {
        const facBase = cfg.pac_ambiente === "produccion"
          ? "https://api.facturama.mx"
          : "https://apisandbox.facturama.mx";
        const { pac_contrasena } = await getPacCredentials(svc, cfg);
        const creds = btoa(`${cfg.pac_usuario}:${pac_contrasena}`);

        const pdfRes = await fetch(
          `${facBase}/api/cfdi-downloads/pdf/${encodeURIComponent(doc.pac_id_externo)}`,
          { headers: { Authorization: `Basic ${creds}` } }
        );

        if (pdfRes.ok) {
          const pdfBuffer = await pdfRes.arrayBuffer();
          const pdfBytes  = new Uint8Array(pdfBuffer);
          let pdfB64 = "";
          for (let i = 0; i < pdfBytes.length; i += 3000) {
            pdfB64 += btoa(String.fromCharCode(...pdfBytes.subarray(i, i + 3000)));
          }
          attachments.push({ filename: `${baseFilename}.pdf`, content: pdfB64 });
        }
      } catch (e) {
        console.warn("[cfdi-email] No se pudo obtener PDF:", e);
      }
    }

    const hasPdf = attachments.length > 1;
    const emisorNombre = cfg?.nombre_razon_social ?? cfg?.rfc ?? "Integriclinica";

    // Determinar remitente: config por clínica → env var fallback
    const fromName  = emailCfg?.from_name?.trim()  || emisorNombre;
    const fromEmail = emailCfg?.from_email?.trim();
    const resendFrom = fromEmail
      ? `${fromName} <${fromEmail}>`
      : RESEND_FROM;
    const replyTo = emailCfg?.reply_to?.trim() || undefined;
    const tipoLabel = TIPO_LABEL[doc.tipo] ?? `CFDI tipo ${doc.tipo}`;
    const fechaEmision = new Date(doc.fecha_emision).toLocaleDateString("es-MX", {
      day: "2-digit", month: "long", year: "numeric",
    });

    const subject = `${tipoLabel} — Folio ${folio} — ${emisorNombre}`;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;margin:0;padding:0;background:#f5f5f5">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.12)">
    <div style="background:#1e3a5f;padding:24px 32px">
      <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700">${emisorNombre}</h1>
      <p style="margin:4px 0 0;color:#a8c4e0;font-size:13px">Comprobante Fiscal Digital por Internet (CFDI 4.0)</p>
    </div>
    <div style="padding:28px 32px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr>
          <td style="padding:6px 0;color:#666;width:140px">Tipo</td>
          <td style="padding:6px 0;font-weight:600">${tipoLabel}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#666">Folio</td>
          <td style="padding:6px 0;font-weight:600">${folio}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#666">Fecha</td>
          <td style="padding:6px 0">${fechaEmision}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#666">Receptor</td>
          <td style="padding:6px 0">${doc.nombre_receptor} (${doc.rfc_receptor})</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#666">Total</td>
          <td style="padding:6px 0;font-weight:700;font-size:16px;color:#1e3a5f">${fmt(doc.total)}</td>
        </tr>
        ${doc.uuid_fiscal ? `
        <tr>
          <td style="padding:6px 0;color:#666;vertical-align:top">UUID SAT</td>
          <td style="padding:6px 0;font-family:monospace;font-size:12px;color:#444;word-break:break-all">${doc.uuid_fiscal}</td>
        </tr>` : ""}
      </table>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
      <p style="font-size:13px;color:#555;margin:0">
        Se adjunta${hasPdf ? "n el XML y el PDF" : " el XML"} del comprobante.
        ${hasPdf ? "" : "El PDF estará disponible en el portal una vez procesado por el SAT."}
      </p>
    </div>
    <div style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #e5e7eb">
      <p style="font-size:11px;color:#999;margin:0">
        Este correo fue generado automáticamente por Integriclinica.
        No responder a este mensaje.
      </p>
    </div>
  </div>
</body>
</html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:        resendFrom,
        to:          [destinatario],
        subject,
        html,
        attachments,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      const errMsg = resendData?.message ?? resendData?.name ?? JSON.stringify(resendData);
      console.error("[cfdi-email] Resend error:", resendRes.status, errMsg);
      return json({ error: `Error enviando email: ${errMsg}` }, 502);
    }

    // Audit log
    await svc.from("audit_logs").insert({
      user_id:    userData.user.id,
      action:     "EMAIL",
      table_name: "cfdi_documentos",
      record_id:  cfdi_id,
      new_values: { destinatario, has_pdf: hasPdf, resend_id: resendData?.id },
    });

    return json({
      ok:          true,
      email_sent:  destinatario,
      has_pdf:     hasPdf,
      resend_id:   resendData?.id,
    });

  } catch (err: any) {
    console.error("[cfdi-email] unexpected error:", err);
    return json({ error: err.message ?? "Error interno" }, 500);
  }
});
