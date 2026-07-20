// notify-doctor-confirmation
// Llamada por el doctor cuando confirma/rechaza una cita asignada desde Inbox.
// Notifica al paciente vía Telegram y registra audit.
// Body: { appointment_id: string, decision: 'confirmed' | 'declined', reason?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TELEGRAM_BOT_TOKEN   = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
  };
}
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors(), "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "no autorizado" }, 401);
  const { data: userData, error: ue } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (ue || !userData?.user) return json({ error: "token inválido" }, 401);

  const { data: rolesRows } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id);
  const roles = (rolesRows ?? []).map((r: any) => r.role);
  if (!roles.some((r: string) => ["admin", "doctor"].includes(r))) {
    return json({ error: "permiso denegado" }, 403);
  }

  let body: { appointment_id?: string; decision?: string; reason?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const { appointment_id: apptId, decision, reason } = body;
  if (!apptId || (decision !== "confirmed" && decision !== "declined")) {
    return json({ error: "datos inválidos" }, 400);
  }
  if (decision === "declined" && !(reason && reason.trim().length >= 3)) {
    return json({ error: "motivo requerido para rechazar" }, 400);
  }

  const { data: appt, error: ea } = await supabase
    .from("appointments")
    .select(`
      id, fecha_inicio, clinic_id, conversacion_id, doctor_id,
      doctors:doctor_id ( nombre, apellidos, user_id ),
      patients:patient_id ( nombre, apellidos )
    `)
    .eq("id", apptId)
    .maybeSingle();
  if (ea || !appt) return json({ error: "cita no encontrada" }, 404);

  // Verifica que el doctor sea dueño de la cita (admin pasa)
  if (!roles.includes("admin")) {
    if (appt.doctors?.user_id !== userData.user.id) {
      return json({ error: "esta cita no es tuya" }, 403);
    }
  }

  // Actualizar cita. La confirmación del doctor también avanza el status
  // general de la cita (Agenda, listados, filtros leen `status`, no
  // `doctor_confirmation_status`) -- sin esto el toast decía "se movió a tu
  // Agenda" pero la cita seguía apareciendo como "Solicitada" en todo el resto
  // del sistema.
  const { error: eu } = await supabase
    .from("appointments")
    .update({
      doctor_confirmation_status: decision,
      doctor_confirmation_at: new Date().toISOString(),
      doctor_confirmation_reason: decision === "declined" ? reason!.trim() : null,
      ...(decision === "confirmed" ? { status: "confirmada" } : {}),
    })
    .eq("id", apptId);
  if (eu) return json({ error: "no se pudo actualizar: " + eu.message }, 500);

  // Audit
  await supabase.from("audit_logs").insert({
    tabla: "appointments",
    registro_id: apptId,
    accion: decision === "confirmed" ? "doctor_confirmo_cita" : "doctor_rechazo_cita",
    user_id: userData.user.id,
    datos_nuevos: { decision, reason: decision === "declined" ? reason : null },
    clinic_id: appt.clinic_id,
  });

  // Notificar al paciente por Telegram (si la conversación es de ese canal)
  let telegramOk = false;
  let telegramReason = "sin_conversacion";
  if (appt.conversacion_id && TELEGRAM_BOT_TOKEN) {
    const { data: conv } = await supabase
      .from("conversaciones")
      .select("id, identidades_canal:identidad_canal_id ( canal_id, external_id )")
      .eq("id", appt.conversacion_id)
      .maybeSingle();
    const ident: any = (conv as any)?.identidades_canal;
    if (ident?.canal_id === "telegram") {
      const fechaLocal = new Date(appt.fecha_inicio).toLocaleString("es-MX", {
        timeZone: "America/Mexico_City",
        weekday: "long", day: "numeric", month: "long",
        hour: "2-digit", minute: "2-digit",
      });
      const doctorNombre = `Dr(a). ${appt.doctors?.nombre ?? ""} ${appt.doctors?.apellidos ?? ""}`.trim();
      const texto = decision === "confirmed"
        ? `✅ Tu cita fue confirmada por ${doctorNombre} para *${fechaLocal}*.`
        : `Estamos ajustando tu cita. Recepción te confirmará un nuevo horario en breve.`;
      try {
        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: ident.external_id, text: texto, parse_mode: "Markdown" }),
        });
        telegramOk = res.ok;
        if (!res.ok) telegramReason = (await res.text()).slice(0, 200);
        else {
          telegramReason = "ok";
          await supabase.from("mensajes").insert({
            conversacion_id: conv!.id,
            rol: "assistant",
            contenido: texto,
            raw_payload: { sent_by_system: true, appointment_id: apptId, doctor_decision: decision },
            clinic_id: appt.clinic_id,
          });
        }
      } catch (e: any) {
        telegramReason = e?.message ?? String(e);
      }
    } else {
      telegramReason = "canal_no_telegram";
    }
  }

  await supabase.from("audit_logs").insert({
    tabla: "appointments",
    registro_id: apptId,
    accion: "notif_paciente",
    datos_nuevos: { ok: telegramOk, motivo: telegramReason, decision },
    clinic_id: appt.clinic_id,
  });

  return json({ ok: true, decision, telegram: { ok: telegramOk, reason: telegramReason } });
});
