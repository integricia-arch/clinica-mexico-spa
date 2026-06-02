// =================================================================
// notify-appointment-assigned
//
// Llamada desde el frontend autenticado tras crear una cita desde
// /inbox. Notifica al paciente vía Telegram (si la conversación es
// de ese canal) y al doctor por email (usando auth.users.email).
//
// Body: { appointment_id: string }
// =================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TELEGRAM_BOT_TOKEN   = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY       = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM          = Deno.env.get("RESEND_FROM") ?? "ClínicaMX <onboarding@resend.dev>";

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
    status,
    headers: { ...cors(), "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "no autorizado" }, 401);
  const { data: userData, error: userErr } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (userErr || !userData?.user) return json({ error: "token inválido" }, 401);
  const { data: rolesRows } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id);
  const roles = (rolesRows ?? []).map((r: any) => r.role);
  if (!roles.some((r: string) => ["admin", "receptionist"].includes(r))) {
    return json({ error: "permiso denegado" }, 403);
  }

  let body: { appointment_id?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const appointmentId = body.appointment_id;
  if (!appointmentId) return json({ error: "appointment_id requerido" }, 400);

  // Cargar cita con joins
  const { data: appt, error: ea } = await supabase
    .from("appointments")
    .select(`
      id, fecha_inicio, fecha_fin, conversacion_id, clinic_id,
      patient_id, doctor_id, room_id, servicio_id,
      patients:patient_id ( nombre, apellidos ),
      doctors:doctor_id   ( nombre, apellidos, user_id ),
      rooms:room_id       ( nombre ),
      servicios:servicio_id ( nombre )
    `)
    .eq("id", appointmentId)
    .maybeSingle();
  if (ea || !appt) return json({ error: "cita no encontrada" }, 404);

  const fechaLocal = new Date(appt.fecha_inicio).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const doctorNombre = `Dr(a). ${appt.doctors?.nombre ?? ""} ${appt.doctors?.apellidos ?? ""}`.trim();
  const roomNombre = appt.rooms?.nombre ?? "—";
  const servicioNombre = appt.servicios?.nombre ?? "Consulta";
  const pacienteNombre = `${appt.patients?.nombre ?? ""} ${appt.patients?.apellidos ?? ""}`.trim();

  // ---- 1) Notificar al paciente vía Telegram (si la conv es Telegram) ----
  let telegramOk = false;
  let telegramReason = "";
  if (appt.conversacion_id) {
    const { data: conv } = await supabase
      .from("conversaciones")
      .select("id, identidad_canal_id, identidades_canal:identidad_canal_id ( canal_id, external_id )")
      .eq("id", appt.conversacion_id)
      .maybeSingle();
    const ident: any = (conv as any)?.identidades_canal;
    if (ident?.canal_id === "telegram" && TELEGRAM_BOT_TOKEN) {
      const texto =
        `✅ Tu cita fue asignada para *${fechaLocal}* con *${doctorNombre}*, consultorio *${roomNombre}*.\n\n` +
        `Servicio: ${servicioNombre}.\n` +
        `Si tus síntomas empeoran, acude a urgencias o llama al 911.`;
      try {
        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: ident.external_id, text: texto, parse_mode: "Markdown" }),
        });
        telegramOk = res.ok;
        if (!res.ok) telegramReason = (await res.text()).slice(0, 200);
        else {
          await supabase.from("mensajes").insert({
            conversacion_id: conv!.id,
            rol: "assistant",
            contenido: texto,
            raw_payload: { sent_by_system: true, appointment_id: appt.id },
            clinic_id: appt.clinic_id,
          });
        }
      } catch (e: any) {
        telegramReason = e?.message ?? String(e);
      }
    } else {
      telegramReason = "canal_no_telegram_o_token_ausente";
    }
  } else {
    telegramReason = "sin_conversacion";
  }

  await supabase.from("audit_logs").insert({
    tabla: "appointments",
    registro_id: appt.id,
    accion: "notif_paciente",
    datos_nuevos: { ok: telegramOk, motivo: telegramReason },
    clinic_id: appt.clinic_id,
  });

  // ---- 2) Notificar al doctor por email ----
  let emailOk = false;
  let emailReason = "";
  let doctorEmail: string | null = null;

  if (appt.doctors?.user_id) {
    const { data: userRes } = await supabase.auth.admin.getUserById(appt.doctors.user_id);
    doctorEmail = userRes?.user?.email ?? null;
  }

  if (doctorEmail && RESEND_API_KEY) {
    const subject = `Nueva cita asignada — ${fechaLocal}`;
    const html =
      `<p>Hola ${doctorNombre},</p>` +
      `<p>Se te asignó una nueva cita:</p>` +
      `<ul>` +
      `<li><strong>Paciente:</strong> ${pacienteNombre}</li>` +
      `<li><strong>Servicio:</strong> ${servicioNombre}</li>` +
      `<li><strong>Fecha y hora:</strong> ${fechaLocal}</li>` +
      `<li><strong>Consultorio:</strong> ${roomNombre}</li>` +
      `</ul>` +
      `<p>Revisa el contexto clínico completo en el sistema. No se envían datos sensibles por correo.</p>`;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ from: RESEND_FROM, to: [doctorEmail], subject, html }),
      });
      emailOk = res.ok;
      if (!res.ok) emailReason = (await res.text()).slice(0, 200);
    } catch (e: any) {
      emailReason = e?.message ?? String(e);
    }
  } else {
    emailReason = !doctorEmail ? "doctor_sin_email" : "resend_no_configurado";
  }

  await supabase.from("audit_logs").insert({
    tabla: "appointments",
    registro_id: appt.id,
    accion: "notif_doctor",
    datos_nuevos: { ok: emailOk, motivo: emailReason, email: doctorEmail },
    clinic_id: appt.clinic_id,
  });

  return json({ ok: true, telegram: { ok: telegramOk, reason: telegramReason }, email: { ok: emailOk, reason: emailReason } });
});
