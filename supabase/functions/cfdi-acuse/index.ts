// =================================================================
// cfdi-acuse: consulta el estatus de cancelación en Facturama y
// actualiza cfdi_documentos si el receptor ya aceptó la cancelación.
// Solo admin. Endpoint: GET /api/cfdis/issued/{pac_id_externo}
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

// Normaliza el Status string de Facturama a uno de 3 valores
function parseFacturamaStatus(raw: string): "vigente" | "cancelacion_pendiente" | "cancelado" {
  const s = raw.toLowerCase();
  if (s.includes("request") || s.includes("pending") || s.includes("pendiente")) {
    return "cancelacion_pendiente";
  }
  if (s.includes("cancel") || s.includes("cancell")) {
    return "cancelado";
  }
  return "vigente";
}

interface AcuseRequest {
  clinic_id: string;
  cfdi_id: string; // UUID interno BD
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

  try {
    const body: AcuseRequest = await req.json();
    const { clinic_id, cfdi_id } = body;

    if (!clinic_id || !cfdi_id) {
      return json({ error: "clinic_id y cfdi_id son obligatorios" }, 400);
    }

    // Cargar CFDI
    const { data: doc } = await svc
      .from("cfdi_documentos")
      .select("id, status, pac_id_externo, uuid_fiscal, motivo_cancelacion, clinic_id")
      .eq("id", cfdi_id)
      .eq("clinic_id", clinic_id)
      .single();

    if (!doc) return json({ error: "CFDI no encontrado" }, 404);
    if (doc.status === "cancelado") {
      return json({ ok: true, status: "cancelado", changed: false, message: "El CFDI ya está marcado como cancelado" });
    }
    if (!doc.pac_id_externo) {
      return json({ error: "Sin ID del PAC — no se puede consultar el acuse" }, 422);
    }

    // Cargar config PAC
    const { data: cfg } = await svc
      .from("cfdi_config")
      .select("pac_ambiente, pac_usuario, pac_secret_id, pac_contrasena")
      .eq("clinic_id", clinic_id)
      .maybeSingle();

    if (!cfg?.pac_usuario || (!cfg.pac_secret_id && !cfg.pac_contrasena)) {
      return json({ error: "Configuración PAC no disponible" }, 400);
    }

    const facBase = cfg.pac_ambiente === "produccion"
      ? "https://api.facturama.mx"
      : "https://apisandbox.facturama.mx";
    const { pac_contrasena } = await getPacCredentials(svc, cfg);
    const creds = btoa(`${cfg.pac_usuario}:${pac_contrasena}`);

    // Consultar estatus en Facturama
    const facRes = await fetch(
      `${facBase}/api/cfdis/issued/${encodeURIComponent(doc.pac_id_externo)}`,
      { headers: { Authorization: `Basic ${creds}` } }
    );

    if (!facRes.ok) {
      const errText = await facRes.text().catch(() => `HTTP ${facRes.status}`);
      console.error("[cfdi-acuse] Facturama error:", facRes.status, errText);
      return json({ error: `Error consultando Facturama: ${facRes.status}` }, 422);
    }

    const facData = await facRes.json();
    const rawStatus: string = facData?.Status ?? facData?.status ?? "";
    console.log("[cfdi-acuse] Facturama Status:", rawStatus);

    const nuevoStatus = parseFacturamaStatus(rawStatus);

    // Solo actualizar BD si cambió a cancelado (nunca retroceder de cancelado a pendiente)
    const changed = nuevoStatus === "cancelado" && doc.status !== "cancelado";
    if (changed) {
      await svc
        .from("cfdi_documentos")
        .update({ status: "cancelado" })
        .eq("id", cfdi_id);

      await svc.from("audit_logs").insert({
        user_id:    userData.user.id,
        action:     "UPDATE",
        table_name: "cfdi_documentos",
        record_id:  cfdi_id,
        new_values: { status: "cancelado", source: "acuse_receptor" },
      });
    }

    // Mensaje legible para el usuario
    const message = nuevoStatus === "cancelado"
      ? changed
        ? "El receptor aceptó la cancelación. CFDI cancelado."
        : "CFDI ya estaba cancelado."
      : nuevoStatus === "cancelacion_pendiente"
        ? "Cancelación pendiente de aceptación por el receptor. El SAT la aplicará automáticamente si no hay respuesta en 72 h."
        : `Estado Facturama: ${rawStatus || "(sin estado)"}`;

    return json({
      ok:      true,
      cfdi_id,
      status:  nuevoStatus,
      changed,
      message,
      facturama_status: rawStatus,
    });

  } catch (err: any) {
    console.error("[cfdi-acuse] unexpected error:", err);
    return json({ error: err.message ?? "Error interno" }, 500);
  }
});
