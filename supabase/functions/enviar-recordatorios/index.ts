// =================================================================
// supabase/functions/enviar-recordatorios/index.ts  (v2)
//
// Envía recordatorios de cita vía Telegram.
// Debe invocarse con un cron job cada 5 minutos (ver setup-cron.sql).
//
// v2: - Joins PostgREST con hint explícito de FK para evitar ambigüedad
//     - Null-safety en construirMensaje para fecha_inicio nula
// =================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TELEGRAM_BOT_TOKEN   = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

Deno.serve(async (_req) => {
  try {
    const procesados = await procesarRecordatorios();
    return new Response(JSON.stringify({ ok: true, procesados }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("enviar-recordatorios error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});

async function procesarRecordatorios(): Promise<number> {
  const ahora = new Date().toISOString();

  // Joins con hint explícito de FK (tabla!columna_fk) para evitar que
  // PostgREST falle silenciosamente cuando hay múltiples FKs hacia la
  // misma tabla o cuando el nombre de la relación es ambiguo.
  const { data: pendientes, error } = await supabase
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
    `)
    .eq("status", "pendiente")
    .lte("programado_para", ahora);

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
        status:     "enviado",
        enviado_at: new Date().toISOString(),
        error:      "omitido: cita cancelada",
      })
      .eq("id", r.id);
    return;
  }

  if (!identidad || identidad.canal_id !== "telegram") {
    await supabase.from("recordatorios_cita")
      .update({ status: "fallido", error: "canal no soportado" })
      .eq("id", r.id);
    return;
  }

  const texto = construirMensaje(r.tipo, cita);
  try {
    await enviarTelegram(identidad.external_id, texto);
    await supabase.from("recordatorios_cita")
      .update({ status: "enviado", enviado_at: new Date().toISOString() })
      .eq("id", r.id);
  } catch (err: any) {
    console.error(`recordatorio ${r.id}:`, err.message);
    await supabase.from("recordatorios_cita")
      .update({ status: "fallido", error: err.message?.slice(0, 300) })
      .eq("id", r.id);
  }
}

function construirMensaje(tipo: string, cita: any): string {
  const nombre   = cita?.patients?.nombre ?? "Paciente";
  const servicio = cita?.servicios?.nombre ?? "tu cita";
  const doctor   = cita?.doctors
    ? `Dr(a). ${cita.doctors.nombre} ${cita.doctors.apellidos}`
    : "tu médico";

  // Null-safety: si fecha_inicio llega nula (join fallido o dato corrupto)
  // el mensaje genérico evita enviar "Invalid Date" al paciente.
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

  if (tipo === "T-24h") {
    return (
      `Hola ${nombre}, te recordamos que mañana tienes cita en ClínicaMX:\n\n` +
      `Servicio: ${servicio}\n` +
      `Médico: ${doctor}\n` +
      `Fecha: ${fechaStr} a las ${horaStr}\n\n` +
      `Si necesitas cambiar o cancelar, escríbenos aquí mismo.`
    );
  }
  return (
    `Hola ${nombre}, tu cita es en 2 horas:\n\n` +
    `Servicio: ${servicio}\n` +
    `Médico: ${doctor}\n` +
    `Hora: ${horaStr} de hoy\n\n` +
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
