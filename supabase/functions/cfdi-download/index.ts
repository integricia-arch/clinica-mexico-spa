// =================================================================
// cfdi-download: descarga XML o PDF de un CFDI desde Facturama
// Solo admin/receptionist. XML se sirve desde BD si está cacheado.
// =================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supaUser.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const svc = createClient(SUPABASE_URL, SUPABASE_SVC);

  // Verificar rol permitido
  const { data: roles } = await svc
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  const allowed = (roles ?? []).some((r: { role: string }) => ["admin", "receptionist"].includes(r.role));
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  const url    = new URL(req.url);
  const cfdiId = url.searchParams.get("cfdi_id");
  const format = url.searchParams.get("format") ?? "xml"; // xml | pdf

  if (!cfdiId) {
    return new Response(JSON.stringify({ error: "cfdi_id requerido" }), { status: 400, headers: corsHeaders });
  }
  if (!["xml", "pdf"].includes(format)) {
    return new Response(JSON.stringify({ error: "format inválido — usar xml o pdf" }), { status: 400, headers: corsHeaders });
  }

  // Obtener clinic_id del usuario autenticado para verificar pertenencia
  const { data: userRolesWithClinic } = await svc
    .from("clinic_memberships")
    .select("clinic_id")
    .eq("user_id", userData.user.id);
  const userClinicIds = (userRolesWithClinic ?? []).map((m: any) => m.clinic_id);

  // Obtener registro del CFDI
  const { data: doc } = await svc
    .from("cfdi_documentos")
    .select("clinic_id, pac_id_externo, xml_contenido, uuid_fiscal, serie, folio")
    .eq("id", cfdiId)
    .single();

  if (doc && userClinicIds.length > 0 && !userClinicIds.includes(doc.clinic_id)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  if (!doc) {
    return new Response(JSON.stringify({ error: "CFDI no encontrado" }), { status: 404, headers: corsHeaders });
  }

  // XML — servir desde BD si está cacheado y parece XML real
  if (format === "xml") {
    const contenido = doc.xml_contenido as string | null;
    if (contenido && contenido.trimStart().startsWith("<?xml")) {
      const filename = `CFDI_${doc.serie ?? "A"}_${doc.folio ?? ""}_${doc.uuid_fiscal ?? cfdiId}.xml`;
      return new Response(contenido, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }
    // Si no hay XML real, intentar desde Facturama
  }

  // Para PDF (o XML no cacheado) → llamar a Facturama
  if (!doc.pac_id_externo) {
    return new Response(
      JSON.stringify({ error: "No hay ID del PAC para descargar — el CFDI puede no estar timbrado correctamente" }),
      { status: 422, headers: corsHeaders }
    );
  }

  const { data: cfg } = await svc
    .from("cfdi_config")
    .select("pac_ambiente, pac_usuario, pac_contrasena")
    .eq("clinic_id", doc.clinic_id)
    .maybeSingle();

  if (!cfg?.pac_usuario) {
    return new Response(JSON.stringify({ error: "Configuración PAC no disponible" }), { status: 400, headers: corsHeaders });
  }

  const facBase = cfg.pac_ambiente === "produccion"
    ? "https://api.facturama.mx"
    : "https://apisandbox.facturama.mx";
  const creds   = btoa(`${cfg.pac_usuario}:${cfg.pac_contrasena}`);

  // Facturama download endpoint
  const downloadUrl = `${facBase}/api/cfdi-downloads/${format}/${doc.pac_id_externo}`;
  const facRes = await fetch(downloadUrl, {
    headers: { Authorization: `Basic ${creds}` },
  });

  if (!facRes.ok) {
    const text = await facRes.text();
    return new Response(JSON.stringify({ error: `PAC error ${facRes.status}: ${text}` }), {
      status: 502,
      headers: corsHeaders,
    });
  }

  const filename = `CFDI_${doc.serie ?? "A"}_${doc.folio ?? ""}_${doc.uuid_fiscal ?? cfdiId}.${format}`;
  const contentType = format === "pdf" ? "application/pdf" : "application/xml; charset=utf-8";
  const fileBody = format === "pdf" ? await facRes.arrayBuffer() : await facRes.text();

  // Cachear XML en BD para futuros downloads
  if (format === "xml" && typeof fileBody === "string" && fileBody.trimStart().startsWith("<?xml")) {
    await svc.from("cfdi_documentos").update({ xml_contenido: fileBody }).eq("id", cfdiId);
  }

  return new Response(fileBody, {
    headers: {
      ...corsHeaders,
      "Content-Type":        contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
