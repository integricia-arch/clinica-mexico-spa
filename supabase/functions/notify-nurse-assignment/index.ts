import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { isClinicAccessForbidden } from "./clinic-access.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

async function enviarTelegram(chatId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) console.error("[notify-nurse-assignment] Telegram error:", await res.text());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { appointment_id } = await req.json();
    if (!appointment_id) {
      return new Response(JSON.stringify({ error: "Falta appointment_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: appointment } = await supabase
      .from("appointments")
      .select("assigned_nurse_id, patient_id, fecha_inicio, clinic_id")
      .eq("id", appointment_id)
      .maybeSingle();

    if (!appointment) {
      return new Response(JSON.stringify({ ok: true, skipped: "cita no encontrada" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // El handler original solo exigia un JWT valido (de cualquier usuario
    // autenticado, sin verificar rol ni clinica) -- se exige membresia del
    // caller en la clinica dueña de la cita.
    const { data: memberships } = await supabase
      .from("clinic_memberships")
      .select("clinic_id")
      .eq("user_id", user.id);
    if (isClinicAccessForbidden(memberships, appointment.clinic_id)) {
      return new Response(JSON.stringify({ error: "Permiso denegado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!appointment.assigned_nurse_id) {
      return new Response(JSON.stringify({ ok: true, skipped: "sin enfermera asignada" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Regla configurable por rol/evento/canal (panel /configuracion/notificaciones).
    // Si no hay regla o está deshabilitada, no se manda -- default seguro: enviar
    // solo si existe una regla explícita habilitada para nurse+telegram en esta clínica.
    const { data: rule } = await supabase
      .from("notification_rules")
      .select("enabled")
      .eq("clinic_id", appointment.clinic_id)
      .eq("role", "nurse")
      .eq("event_type", "cita_asignada_enfermera")
      .eq("channel", "telegram")
      .maybeSingle();
    if (rule && !rule.enabled) {
      return new Response(JSON.stringify({ ok: true, skipped: "regla deshabilitada" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: nurseChat } = await supabase
      .from("staff_identidades_canal")
      .select("external_id")
      .eq("user_id", appointment.assigned_nurse_id)
      .eq("canal_id", "telegram")
      .maybeSingle();

    if (nurseChat?.external_id) {
      const { data: patient } = await supabase
        .from("patients")
        .select("nombre, apellidos")
        .eq("id", appointment.patient_id)
        .maybeSingle();
      const nombrePaciente = patient ? `${patient.nombre} ${patient.apellidos}` : "paciente";
      const horaStr = new Date(appointment.fecha_inicio).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
      await enviarTelegram(
        nurseChat.external_id,
        `Nueva asignación: ${nombrePaciente}, ${horaStr}. Confirma con /ok.`,
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[notify-nurse-assignment]", err);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
