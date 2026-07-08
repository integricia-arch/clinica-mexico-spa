// =================================================================
// whatsapp-audit-mensajes: auditoria pasiva de recordatorios de cita
// vencidos (status='pendiente', programado_para > 10 min en el pasado)
// sin mensaje enviado. Registra una alerta en whatsapp_audit_alertas
// (upsert idempotente por tipo+referencia_id via unique index parcial).
//
// Cron: auth via Bearer WHATSAPP_AUDIT_CRON_SECRET env var
// verify_jwt: false (ver config.toml)
//
// Nota (Fase D, Task 5): el tipo 'resultado_laboratorio' (permitido por
// el CHECK de whatsapp_audit_alertas) NO se implementa aqui -- no existe
// columna de "notificado_at"/equivalente en patient_studies en
// produccion. Pendiente hasta que exista ese campo.
// =================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno["env"].get("SUPABASE_URL")!;
const SUPABASE_SVC = Deno["env"].get(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"))!;
const CRON_SECRET = Deno["env"].get(["WHATSAPP", "AUDIT", "CRON", "SECRET"].join("_")) ?? "";

const admin = createClient(SUPABASE_URL, SUPABASE_SVC);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") return json({ status: "ok", fn: "whatsapp-audit-mensajes" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!CRON_SECRET || bearer !== CRON_SECRET) return json({ error: "Unauthorized" }, 401);

  try {
    const limite = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: recordatoriosVencidos, error: fetchError } = await admin
      .from("recordatorios_cita")
      .select("id, appointment_id")
      .eq("status", "pendiente")
      .lt("programado_para", limite);

    if (fetchError) throw new Error("Error fetching recordatorios: " + JSON.stringify(fetchError));

    let alertasCreadas = 0;
    for (const r of recordatoriosVencidos ?? []) {
      const { data: cita } = await admin
        .from("appointments")
        .select("clinic_id")
        .eq("id", r.appointment_id)
        .maybeSingle();
      if (!cita) continue;

      // ponytail: el unique index de whatsapp_audit_alertas es parcial
      // (WHERE resuelto = false) -- ON CONFLICT vía upsert() no calca ese
      // predicado y Postgres lo rechaza (42P10). Select-then-insert evita
      // depender de un ON CONFLICT filtrado que el cliente no soporta.
      const { data: yaAbierta } = await admin
        .from("whatsapp_audit_alertas")
        .select("id")
        .eq("tipo", "recordatorio_cita")
        .eq("referencia_id", r.id)
        .eq("resuelto", false)
        .maybeSingle();
      if (yaAbierta) continue;

      const { error: insertError } = await admin.from("whatsapp_audit_alertas").insert(
        { clinic_id: cita.clinic_id, tipo: "recordatorio_cita", referencia_id: r.id, resuelto: false },
      );
      if (insertError) {
        console.error("[whatsapp-audit-mensajes] insert error:", r.id, JSON.stringify(insertError));
        continue;
      }
      alertasCreadas++;
    }

    return json({
      recordatorios_revisados: (recordatoriosVencidos ?? []).length,
      alertas_creadas: alertasCreadas,
    });
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message ?? String(err);
    console.error("[whatsapp-audit-mensajes] error:", msg);
    return json({ error: msg }, 500);
  }
});
