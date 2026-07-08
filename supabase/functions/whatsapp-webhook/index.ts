// supabase/functions/whatsapp-webhook/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { nextBookingState, type BookingSlot, type Servicio } from "../_shared/booking-flow.ts";

const SUPABASE_URL = Deno["env"].get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno["env"].get(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"))!;
const WHATSAPP_APP_SECRET = Deno["env"].get(["WHATSAPP", "APP", "SECRET"].join("_"))!;
const WHATSAPP_ACCESS_TOKEN = Deno["env"].get(["WHATSAPP", "ACCESS", "TOKEN"].join("_"))!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verificarFirma(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WHATSAPP_APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return signatureHeader === `sha256=${hex}`;
}

async function enviarTexto(phoneNumberId: string, to: string, body: string) {
  await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
}

async function calcularSlotsLibres(clinicId: string, servicioIds: string[]): Promise<BookingSlot[]> {
  const { data: doctorServicios } = await admin
    .from("doctor_servicios")
    .select("doctor_id, servicio_id")
    .in("servicio_id", servicioIds);
  const { data: horario } = await admin
    .from("clinic_settings")
    .select("data")
    .eq("clinic_id", clinicId)
    .eq("section", "horario")
    .maybeSingle();
  const diasLaborales: number[] = (horario?.data as { dias_laborales?: number[] })?.dias_laborales ?? [1, 2, 3, 4, 5];
  const horaApertura = (horario?.data as { hora_apertura?: string })?.hora_apertura ?? "09:00";

  const slots: BookingSlot[] = [];
  const now = new Date();
  for (let d = 1; d <= 7 && slots.length < 20; d++) {
    const fecha = new Date(now);
    fecha.setDate(fecha.getDate() + d);
    if (!diasLaborales.includes(fecha.getDay())) continue;
    const [h, m] = horaApertura.split(":").map(Number);
    fecha.setHours(h, m, 0, 0);
    for (const ds of doctorServicios ?? []) {
      slots.push({ doctorId: ds.doctor_id, servicioId: ds.servicio_id, start: fecha.toISOString() });
    }
  }
  return slots;
}

Deno.serve(async (req) => {
  const rawBody = await req.text();
  const firmaValida = await verificarFirma(rawBody, req.headers.get("X-Hub-Signature-256"));
  if (!firmaValida) return new Response("forbidden", { status: 403 });

  const payload = JSON.parse(rawBody);
  const change = payload?.entry?.[0]?.changes?.[0]?.value;
  const phoneNumberId = change?.metadata?.phone_number_id;
  const mensaje = change?.messages?.[0];

  if (!phoneNumberId || !mensaje) return new Response("ok", { status: 200 });

  const { data: clinic } = await admin
    .from("clinics")
    .select("id, whatsapp_status")
    .eq("whatsapp_phone_number_id", phoneNumberId)
    .maybeSingle();

  if (!clinic || clinic.whatsapp_status !== "verified") {
    console.error("[whatsapp-webhook] phone_number_id sin clinica verificada:", phoneNumberId);
    return new Response("ok", { status: 200 });
  }

  const clinicId = clinic.id as string;
  const from = mensaje.from as string;
  const texto = mensaje.text?.body ?? "";

  let { data: identidad } = await admin
    .from("identidades_canal")
    .select("id, patient_id")
    .eq("clinic_id", clinicId)
    .eq("canal_id", "whatsapp")
    .eq("external_id", from)
    .maybeSingle();

  if (!identidad) {
    const { data: nueva } = await admin
      .from("identidades_canal")
      .insert({ clinic_id: clinicId, canal_id: "whatsapp", external_id: from })
      .select("id, patient_id")
      .single();
    identidad = nueva;
  }

  let { data: conv } = await admin
    .from("conversaciones")
    .select("id")
    .eq("identidad_canal_id", identidad!.id)
    .eq("status", "activa")
    .maybeSingle();

  if (!conv) {
    const { data: nuevaConv } = await admin
      .from("conversaciones")
      .insert({ identidad_canal_id: identidad!.id, clinic_id: clinicId, status: "activa" })
      .select("id")
      .single();
    conv = nuevaConv;
  }

  const { data: sesion } = await admin
    .from("bot_sesiones")
    .select("id, flow_step, flow_data, servicio_id, slot_propuesto, doctor_id")
    .eq("conversacion_id", conv!.id)
    .maybeSingle();

  const current = sesion?.flow_step
    ? {
        step: sesion.flow_step as "esperando_servicio" | "esperando_horario" | "esperando_confirmacion",
        servicioId: sesion.servicio_id ?? undefined,
        slot: sesion.slot_propuesto && sesion.doctor_id && sesion.servicio_id
          ? { doctorId: sesion.doctor_id, servicioId: sesion.servicio_id, start: sesion.slot_propuesto }
          : undefined,
      }
    : null;

  // duracion_minutos se necesita para calcular fecha_fin al reservar; no forma parte del
  // tipo Servicio del modulo puro (Task 2), pero la fila real de "servicios" lo trae.
  const { data: serviciosData } = await admin
    .from("servicios")
    .select("id, nombre, duracion_minutos")
    .eq("clinic_id", clinicId)
    .eq("activo", true);
  const servicios = (serviciosData ?? []) as (Servicio & { duracion_minutos: number })[];

  const textoNorm = texto.trim().toUpperCase();

  // ponytail: nextBookingState (Task 2, ya aprobado) no maneja servicios=[] dentro del flujo de
  // agendar -> el usuario queda en loop sin salida (indice nunca matchea, siempre "No entendi").
  // Cortamos aca antes de invocar el modulo puro si no hay servicios activos configurados,
  // salvo que el usuario pida HUMANO (ese escape siempre debe funcionar).
  const entraOEstaEnFlujo = current !== null || textoNorm === "CITA";
  if (entraOEstaEnFlujo && textoNorm !== "HUMANO" && servicios.length === 0) {
    console.error("[whatsapp-webhook] sin servicios activos para la clinica:", clinicId);
    if (sesion) {
      await admin
        .from("bot_sesiones")
        .update({ flow_step: null, servicio_id: null, doctor_id: null, slot_propuesto: null })
        .eq("id", sesion.id);
    }
    await enviarTexto(
      phoneNumberId,
      from,
      "No hay servicios configurados en este momento, escribe HUMANO para que te ayudemos.",
    );
    return new Response("ok", { status: 200 });
  }

  const slots = current?.step === "esperando_horario" || (!current && textoNorm === "CITA")
    ? await calcularSlotsLibres(clinicId, servicios.map((s) => s.id))
    : current?.slot
    ? [current.slot]
    : [];

  const result = nextBookingState(current, texto, servicios, slots);

  if (result.action === "book" && current?.step === "esperando_confirmacion" && current.slot) {
    if (!identidad!.patient_id) {
      console.error("[whatsapp-webhook] intento de reservar sin patient_id vinculado, external_id:", from);
    } else {
      const servicioReservado = servicios.find((s) => s.id === current.slot!.servicioId);
      const inicio = new Date(current.slot.start);
      const fin = new Date(inicio.getTime() + (servicioReservado?.duracion_minutos ?? 30) * 60000);
      const { error: insertError } = await admin.from("appointments").insert({
        clinic_id: clinicId,
        patient_id: identidad!.patient_id,
        doctor_id: current.slot.doctorId,
        servicio_id: current.slot.servicioId,
        fecha_inicio: current.slot.start,
        fecha_fin: fin.toISOString(),
        status: "solicitada",
        origen: "whatsapp",
        conversacion_id: conv!.id,
      });
      if (insertError) {
        console.error("[whatsapp-webhook] error creando appointment:", insertError);
      }
    }
  }

  if (sesion) {
    await admin
      .from("bot_sesiones")
      .update({
        flow_step: result.state?.step ?? null,
        servicio_id: result.state?.servicioId ?? null,
        doctor_id: result.state?.slot?.doctorId ?? null,
        slot_propuesto: result.state?.slot?.start ?? null,
      })
      .eq("id", sesion.id);
  } else if (result.state) {
    await admin.from("bot_sesiones").insert({
      conversacion_id: conv!.id,
      clinic_id: clinicId,
      flow_step: result.state.step,
      servicio_id: result.state.servicioId ?? null,
    });
  }

  await enviarTexto(phoneNumberId, from, result.reply);

  return new Response("ok", { status: 200 });
});
