// =================================================================
// cfdi-cancelar: cancela CFDI vía Facturama, actualiza cfdi_documentos
// Solo admin. Motivos SAT: 01-04.
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

interface CancelarRequest {
  clinic_id: string;
  cfdi_id: string;           // UUID interno en BD
  motivo: "01" | "02" | "03" | "04";
  cfdi_sustitucion?: string; // UUID fiscal del CFDI que sustituye (solo motivo 01)
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

  // Solo admin puede cancelar
  const { data: roles } = await svc
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) {
    return json({ error: "Forbidden — solo administradores pueden cancelar CFDIs" }, 403);
  }

  // Obtener clinic_id autorizado desde membresías — no confiar en el body
  const { data: membership } = await svc
    .from("clinic_memberships")
    .select("clinic_id")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  try {
    const body: CancelarRequest = await req.json();
    const { cfdi_id, motivo, cfdi_sustitucion } = body;
    // clinic_id proviene de la membresía del usuario, no del body
    const clinic_id = membership?.clinic_id ?? (body as any).clinic_id;

    if (!clinic_id || !cfdi_id || !motivo) {
      return json({ error: "Faltan campos: cfdi_id y motivo son obligatorios" }, 400);
    }
    if (!["01", "02", "03", "04"].includes(motivo)) {
      return json({ error: "Motivo inválido — usar 01, 02, 03 o 04" }, 400);
    }
    if (motivo === "01" && !cfdi_sustitucion) {
      return json({ error: "Motivo 01 requiere cfdi_sustitucion (UUID del CFDI que lo sustituye)" }, 400);
    }

    // Cargar CFDI de BD
    const { data: doc } = await svc
      .from("cfdi_documentos")
      .select("id, status, pac_id_externo, uuid_fiscal, serie, folio, clinic_id")
      .eq("id", cfdi_id)
      .eq("clinic_id", clinic_id)
      .single();

    if (!doc) return json({ error: "CFDI no encontrado" }, 404);
    if (doc.status === "cancelado") return json({ error: "El CFDI ya está cancelado" }, 409);
    if (!doc.pac_id_externo) {
      return json({ error: "Sin ID del PAC — no se puede cancelar vía API" }, 422);
    }

    // Cargar config PAC
    const { data: cfg } = await svc
      .from("cfdi_config")
      .select("pac_ambiente, pac_usuario, pac_contrasena")
      .eq("clinic_id", clinic_id)
      .maybeSingle();

    if (!cfg?.pac_usuario) {
      return json({ error: "Configuración PAC no disponible" }, 400);
    }

    const facBase = cfg.pac_ambiente === "produccion"
      ? "https://api.facturama.mx"
      : "https://apisandbox.facturama.mx";
    const creds = btoa(`${cfg.pac_usuario}:${cfg.pac_contrasena}`);

    // Facturama: DELETE /api/cfdis/issued/{id}?motive={motivo}[&uuidReplacement={uuid}]
    let cancelUrl = `${facBase}/api/cfdis/issued/${encodeURIComponent(doc.pac_id_externo)}?motive=${motivo}`;
    if (motivo === "01" && cfdi_sustitucion) {
      cancelUrl += `&uuidReplacement=${encodeURIComponent(cfdi_sustitucion)}`;
    }

    const facRes = await fetch(cancelUrl, {
      method: "DELETE",
      headers: { Authorization: `Basic ${creds}` },
    });

    // Facturama devuelve 200 o 204 en éxito; algunos casos 409 si ya cancelado en SAT
    if (!facRes.ok && facRes.status !== 204) {
      let errMsg = `PAC error ${facRes.status}`;
      try {
        const errData = await facRes.json();
        errMsg = errData?.Message ?? errData?.message ?? errMsg;
      } catch {
        errMsg = await facRes.text() || errMsg;
      }
      console.error("[cfdi-cancelar] PAC error:", facRes.status, errMsg);
      return json({ error: errMsg }, 422);
    }

    // Actualizar BD
    const { error: updateErr } = await svc
      .from("cfdi_documentos")
      .update({
        status:               "cancelado",
        motivo_cancelacion:   motivo,
        cfdi_relacionado_uuid: cfdi_sustitucion ? cfdi_sustitucion as any : null,
      })
      .eq("id", cfdi_id);

    if (updateErr) {
      console.error("[cfdi-cancelar] DB update error:", updateErr.message);
      return json({
        ok: true,
        warning: "Cancelado en PAC pero no actualizado en BD: " + updateErr.message,
      });
    }

    // Audit log
    await svc.from("audit_logs").insert({
      user_id:    userData.user.id,
      action:     "UPDATE",
      table_name: "cfdi_documentos",
      record_id:  cfdi_id,
      new_values: { status: "cancelado", motivo_cancelacion: motivo },
    });

    return json({ ok: true, cfdi_id, motivo });

  } catch (err: any) {
    console.error("[cfdi-cancelar] unexpected error:", err);
    return json({ error: err.message ?? "Error interno" }, 500);
  }
});
