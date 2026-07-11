// confirmar-cita
// Cambia status de appointment → confirmada y notifica al paciente vía Telegram.
// Body: { appointment_id: string, nuevo_status?: string }
// nuevo_status default = "confirmada"; también acepta "cancelada" | "liberada"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isApptClinicAccessForbidden } from "./clinic-access.ts";

const TELEGRAM_BOT_TOKEN   = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

async function telegramSend(chatId: number | string, text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return;
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  if (!res.ok) {
    // retry without markdown
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.replace(/[*_`[\]()~>#+=|{}.!-]/g, "\\$&") }),
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "no autorizado" }, 401);

  const { data: userData, error: ue } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (ue || !userData?.user) return json({ error: "token inválido" }, 401);

  const { data: memberships } = await supabase
    .from("clinic_memberships")
    .select("role, clinic_id")
    .eq("user_id", userData.user.id);

  const allowedRoles = ["admin", "manager", "receptionist"];
  const isAllowed = (memberships ?? []).some((m: { role: string }) => allowedRoles.includes(m.role));
  if (!isAllowed) return json({ error: "permiso denegado" }, 403);

  let body: { appointment_id?: string; nuevo_status?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const { appointment_id: apptId } = body;
  const nuevoStatus = body.nuevo_status ?? "confirmada";

  const VALID_STATUSES = ["confirmada", "cancelada", "liberada", "recordatorio_enviado", "confirmada_paciente", "confirmada_medico"];
  if (!apptId) return json({ error: "appointment_id requerido" }, 400);
  if (!VALID_STATUSES.includes(nuevoStatus)) return json({ error: "status inválido" }, 400);

  // Verificar que la cita pertenece a una clínica donde el caller tiene rol permitido
  // (antes solo se validaba que el usuario tuviera el rol EN ALGUNA clínica, sin
  // cruzarlo contra la clínica dueña de la cita — permitía confirmar/cancelar
  // citas de cualquier clínica conociendo el appointment_id).
  const { data: apptClinic } = await supabase
    .from("appointments")
    .select("clinic_id")
    .eq("id", apptId)
    .maybeSingle();
  if (isApptClinicAccessForbidden(memberships, allowedRoles, apptClinic?.clinic_id ?? null)) {
    return json({ error: "permiso denegado" }, 403);
  }

  // Update appointment status
  const { error: updateErr } = await supabase
    .from("appointments")
    .update({ status: nuevoStatus, updated_at: new Date().toISOString() })
    .eq("id", apptId);
  if (updateErr) return json({ error: updateErr.message }, 500);

  // Load appointment + patient for notification
  const { data: appt } = await supabase
    .from("appointments")
    .select(`
      id, fecha_inicio, fecha_fin, patient_id, doctor_id,
      patients:patient_id ( nombre, apellidos ),
      doctors:doctor_id   ( nombre, apellidos ),
      servicios:servicio_id ( nombre )
    `)
    .eq("id", apptId)
    .maybeSingle();

  if (!appt) return json({ ok: true, notificado: false });

  const fechaLocal = new Date(appt.fecha_inicio).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit",
  });

  const patientNombre = `${appt.patients?.nombre ?? ""} ${appt.patients?.apellidos ?? ""}`.trim();
  const doctorNombre = `Dr(a). ${appt.doctors?.nombre ?? ""} ${appt.doctors?.apellidos ?? ""}`.trim();
  const servicio = appt.servicios?.nombre ?? "Consulta";

  // Look up patient Telegram chat_id via identidad_canal
  const { data: identidad } = await supabase
    .from("identidad_canal")
    .select("canal_id")
    .eq("patient_id", appt.patient_id)
    .eq("canal", "telegram")
    .maybeSingle();

  let notificado = false;
  if (identidad?.canal_id && TELEGRAM_BOT_TOKEN) {
    let mensaje = "";
    if (nuevoStatus === "confirmada") {
      mensaje = `✅ *Cita confirmada*\n\nHola ${patientNombre},\n\nTu cita ha sido confirmada:\n📅 ${fechaLocal}\n👨‍⚕️ ${doctorNombre}\n🏥 ${servicio}\n\nSi necesitas cancelar o cambiar tu cita, contáctanos con anticipación.`;
    } else if (nuevoStatus === "cancelada") {
      mensaje = `❌ *Cita cancelada*\n\nHola ${patientNombre},\n\nTu cita del ${fechaLocal} con ${doctorNombre} ha sido cancelada.\n\nPor favor contáctanos para reagendar.`;
    } else {
      mensaje = `📅 *Actualización de cita*\n\nHola ${patientNombre},\n\nTu cita del ${fechaLocal} ha sido actualizada. Estado: ${nuevoStatus}.`;
    }
    await telegramSend(identidad.canal_id, mensaje);
    notificado = true;
  }

  return json({ ok: true, notificado, nuevo_status: nuevoStatus });
});
