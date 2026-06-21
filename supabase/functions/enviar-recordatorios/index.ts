// =================================================================
// supabase/functions/enviar-recordatorios/index.ts  (v3)
//
// Envía recordatorios de cita vía Telegram.
// - Cron job (sin body): procesa todos los pendientes con programado_para <= now
// - Frontend (body: { recordatorio_id }): procesa uno específico inmediatamente
//
// v3: CORS, soporte recordatorio_id, columna ultimo_error, enums t24h/t2h
// =================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TELEGRAM_BOT_TOKEN   = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth: accept either (a) the service-role key as Bearer (used by cron),
  // or (b) a signed-in staff user (admin or receptionist).
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!bearer) {
    return new Response(JSON.stringify({ ok: false, error: "no autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  let authorized = false;
  if (bearer === SUPABASE_SERVICE_KEY) {
    authorized = true;
  } else {
    const { data: userData } = await supabase.auth.getUser(bearer);
    if (userData?.user) {
      const { data: rolesRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      const roles = (rolesRows ?? []).map((r: any) => r.role);
      authorized = roles.some((r: string) => ["admin", "receptionist"].includes(r));
    }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ ok: false, error: "permiso denegado" }), {
      status: 403,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  try {
    let recordatorioId: string | undefined;
    try {
      const body = await req.json();
      recordatorioId = body?.recordatorio_id;
    } catch { /* sin body, modo cron */ }

    const procesados = await procesarRecordatorios(recordatorioId);
    return new Response(JSON.stringify({ ok: true, procesados }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("enviar-recordatorios error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});


async function procesarRecordatorios(recordatorioId?: string): Promise<number> {
  let query = supabase
    .from("recordatorios_cita")
    .select(`
      id,
      tipo,
      appointment_id,
      identidades_canal!identidad_canal_id (
        canal_id,
        external_id,
        display_name
      ),
      appointments!appointment_id (
        fecha_inicio,
        status,
        patients!patient_id (nombre, apellidos),
        doctors!doctor_id (nombre, apellidos),
        servicios!servicio_id (nombre)
      )
    `);

  if (recordatorioId) {
    query = query.eq("id", recordatorioId);
  } else {
    query = query.eq("status", "pendiente").lte("programado_para", new Date().toISOString());
  }

  const { data: pendientes, error } = await query;
  if (error) throw new Error(`fetch pendientes: ${error.message}`);
  if (!pendientes?.length) return 0;

  for (const r of pendientes) {
    await procesarUno(r);
  }
  return pendientes.length;
}

async function procesarUno(r: any) {
  const identidad = r.identidades_canal;
  const cita      = r.appointments;

  const statusCita = String(cita?.status ?? "").toLowerCase();
  if (["cancelada", "cancelado", "no_show", "no_asistio"].includes(statusCita)) {
    await supabase.from("recordatorios_cita")
      .update({
        status:       "cancelado",
        ultimo_error: "omitido: cita cancelada",
      })
      .eq("id", r.id);
    return;
  }

  if (!identidad || identidad.canal_id !== "telegram") {
    await supabase.from("recordatorios_cita")
      .update({ status: "fallido", ultimo_error: "canal no soportado" })
      .eq("id", r.id);
    return;
  }

  const texto = construirMensaje(r.tipo, cita);
  try {
    await enviarTelegram(identidad.external_id, texto);
    await supabase.from("recordatorios_cita")
      .update({ status: "enviado", enviado_at: new Date().toISOString(), ultimo_error: null })
      .eq("id", r.id);
  } catch (err: any) {
    console.error(`recordatorio ${r.id}:`, err.message);
    await supabase.from("recordatorios_cita")
      .update({ status: "fallido", ultimo_error: err.message?.slice(0, 300) })
      .eq("id", r.id);
  }
}

function construirMensaje(tipo: string, cita: any): string {
  const nombre   = cita?.patients?.nombre ?? "Paciente";
  const servicio = cita?.servicios?.nombre ?? "tu cita";
  const doctor   = cita?.doctors
    ? `Dr(a). ${cita.doctors.nombre} ${cita.doctors.apellidos}`
    : "tu médico";

  if (!cita?.fecha_inicio) {
    return `Hola ${nombre}, tienes una cita próxima en ClínicaMX con ${doctor}. ¡Te esperamos!`;
  }

  const fecha = new Date(cita.fecha_inicio);
  const fechaStr = fecha.toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
    timeZone: "America/Mexico_City",
  });
  const horaStr = fecha.toLocaleTimeString("es-MX", {
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: "America/Mexico_City",
  });

  const t = String(tipo ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (t === "t24h" || t === "24h") {
    return (
      `Hola ${nombre}, te recordamos que tienes cita mañana en ClínicaMX:\n\n` +
      `Servicio: ${servicio}\n` +
      `Médico: ${doctor}\n` +
      `📅 ${fechaStr} a las ${horaStr}\n\n` +
      `Si necesitas cambiar o cancelar, escríbenos aquí mismo.`
    );
  }
  // t2h and any other type
  return (
    `Hola ${nombre}, tu cita es en aproximadamente 2 horas:\n\n` +
    `Servicio: ${servicio}\n` +
    `Médico: ${doctor}\n` +
    `⏰ ${horaStr} de hoy\n\n` +
    `¡Te esperamos en ClínicaMX!`
  );
}

async function enviarTelegram(chatId: string, text: string) {
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    }
  );
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
}
