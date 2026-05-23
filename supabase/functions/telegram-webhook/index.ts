// =================================================================
// supabase/functions/telegram-webhook/index.ts  (v7)
//
// v7: Flujo guiado con inline keyboards de Telegram (botones).
//     - 9 categorías → servicios filtrados por doctor disponible
//     - 25 servicios nuevos catalogados por especialidad
//     - Captura ECE mínima (nombre, apellidos, fecha_nac, sexo)
//     - Datos opcionales con [Saltar] en cada paso
//     - Consentimiento y confirmación con botones
//     - Texto libre sigue cayendo en Claude (fuzzy match → botones)
// =================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TELEGRAM_BOT_TOKEN   = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const ANTHROPIC_API_KEY    = Deno.env.get("ANTHROPIC_API_KEY")!;
const WEBHOOK_SECRET       = Deno.env.get("WEBHOOK_SECRET") ?? "";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const MAX_AGENT_ITERATIONS = 8;
const AVISO_PRIVACIDAD_VERSION = "v1.0";
const DIAS_LABORALES = [1, 2, 3, 4, 5];
const MX_TZ_OFFSET = "-06:00";
const MX_TZ_OFFSET_MS = -6 * 3600000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============== CATEGORÍAS DEL MENÚ ==============
const CATEGORIAS: Record<string, { label: string; especialidades: string[] }> = {
  medgen: { label: "🩺 Medicina general", especialidades: ["Medicina general"] },
  odo:    { label: "🦷 Odontología", especialidades: ["Odontología"] },
  derm:   { label: "✨ Dermatología/Estética", especialidades: ["Dermatología", "Estética"] },
  ped:    { label: "👶 Pediatría", especialidades: ["Pediatría"] },
  gine:   { label: "♀️ Ginecología", especialidades: ["Ginecología"] },
  card:   { label: "❤️ Cardiología", especialidades: ["Cardiología"] },
  nut:    { label: "🥗 Nutrición", especialidades: ["Nutrición"] },
  psi:    { label: "🧠 Psicología", especialidades: ["Psicología"] },
  lab:    { label: "🔬 Estudios y laboratorio", especialidades: ["Laboratorio", "Imagenología"] },
};

const SYSTEM_PROMPT = `Eres el asistente virtual de ClínicaMX, una clínica multiespecialidad en México (odontología, dermatología, estética, medicina general, pediatría, ginecología, cardiología, nutrición, psicología y estudios).

REGLAS DURAS:
- Hablas español mexicano natural, cálido y profesional. Mensajes cortos (1-3 oraciones).
- NUNCA das consejo médico. Si el paciente describe síntomas: "Eso lo valora mejor el doctor en consulta. ¿Te ayudo a agendar?"
- Urgencia (dolor severo, sangrado, reacción alérgica): usa escalar_a_humano y pide llamar al 911.
- DEFAULT: siempre que el paciente quiera agendar, llama mostrar_menu_categorias para que el sistema le envíe los botones del catálogo. NO listes servicios en texto plano.
- Si el paciente escribe texto libre como "limpieza", "muela", "lunar", busca con buscar_servicios y propón los candidatos en texto breve (1-2 líneas) pidiéndole que pulse el botón que enviará el sistema.

LAS 9 CATEGORÍAS del menú:
🩺 Medicina general | 🦷 Odontología | ✨ Dermatología/Estética | 👶 Pediatría | ♀️ Ginecología | ❤️ Cardiología | 🥗 Nutrición | 🧠 Psicología | 🔬 Estudios y laboratorio

CUANDO NO ESTÁS SEGURO de qué quiere el paciente, llama mostrar_menu_categorias.

Para hablar con persona: OFRECE escalar_a_humano y espera confirmación textual antes de invocarla.`;

const TOOLS = [
  {
    name: "mostrar_menu_categorias",
    description: "Le pide al sistema enviar el menú de 9 categorías como botones inline. Úsala siempre que el paciente quiera agendar o pedir información de servicios sin haber elegido categoría.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "buscar_servicios",
    description: "Busca servicios por palabra clave (ej: 'limpieza', 'muela', 'lunar', 'embarazo'). Devuelve hasta 5 candidatos para proponer al paciente.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "escalar_a_humano",
    description: "Marca la conversación para recepcionista humano. Solo con confirmación del paciente o urgencia real.",
    input_schema: {
      type: "object",
      properties: { razon: { type: "string" } },
      required: ["razon"],
    },
  },
];

// ============================================================
// ENTRY POINT
// ============================================================
Deno.serve(async (req) => {
  if (WEBHOOK_SECRET) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
  }

  let update: any;
  try { update = await req.json(); }
  catch { return new Response("bad json", { status: 400 }); }

  const work = procesarUpdate(update).catch((err) =>
    console.error("procesarUpdate error:", err)
  );
  // @ts-ignore
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else await work;

  return new Response("ok");
});

async function procesarUpdate(update: any) {
  if (update.callback_query) return manejarCallback(update.callback_query);
  const msg = update.message;
  if (!msg?.chat || msg.chat.type !== "private") return;
  return manejarMensaje(String(msg.chat.id), msg, msg.text ?? "");
}

// ============================================================
// MENSAJES DE TEXTO
// ============================================================
async function manejarMensaje(chatId: string, rawMsg: any, text: string) {
  const identidad = await obtenerOCrearIdentidad(chatId, rawMsg.from);

  if (text === "/nueva") {
    const { data: conv, error } = await supabase
      .from("conversaciones")
      .insert({ identidad_canal_id: identidad.id })
      .select("*").single();
    if (error) throw error;
    await limpiarSesion(conv.id);
    const m = "Nueva consulta iniciada.";
    await guardarMensajeAsistente(conv.id, m);
    await enviarMenuCategorias(chatId, m + " ¿Qué necesitas hoy?");
    return;
  }

  const conv = await obtenerOCrearConversacion(identidad.id);

  if (conv.status === "escalada") {
    await enviarTelegram(chatId, "Recepción ya está al tanto, en breve te contactan.\nPara iniciar una nueva consulta escribe /nueva.");
    return;
  }

  if (text === "/start") {
    await guardarMensajeUsuario(conv.id, text, rawMsg);
    await limpiarSesion(conv.id);
    const bienvenida = "¡Hola! Soy el asistente de ClínicaMX. Te ayudo a agendar tu cita 24/7. Elige una categoría:";
    await guardarMensajeAsistente(conv.id, bienvenida);
    await enviarMenuCategorias(chatId, bienvenida);
    return;
  }
  if (text === "/humano") {
    await guardarMensajeUsuario(conv.id, text, rawMsg);
    await escalarConversacion(conv, { razon: "Solicitado con /humano" });
    await enviarTelegram(chatId, "Listo, recepción te contactará en breve.\nCuando quieras iniciar una nueva consulta escribe /nueva.");
    return;
  }

  await guardarMensajeUsuario(conv.id, text, rawMsg);

  // ¿Estamos en medio del wizard de captura?
  const sesion = await obtenerSesion(conv.id);
  if (sesion?.flow_step && pasoEsperaTexto(sesion.flow_step)) {
    return manejarTextoWizard(chatId, conv, sesion, text);
  }

  // Fallback: Claude
  let respuesta = "";
  try {
    respuesta = await correrAgente(conv, chatId);
  } catch (err) {
    console.error("agente error:", err);
    respuesta = "Tuve un problema técnico. ¿Puedes repetirme tu última frase?";
  }
  if (respuesta) {
    await guardarMensajeAsistente(conv.id, respuesta);
    await enviarTelegram(chatId, respuesta);
  }
}

// ============================================================
// CALLBACK QUERIES (botones)
// ============================================================
async function manejarCallback(cq: any) {
  const chatId = String(cq.message?.chat?.id);
  const data: string = cq.data ?? "";
  const from = cq.from;

  await answerCallback(cq.id);

  if (!chatId) return;
  const identidad = await obtenerOCrearIdentidad(chatId, from);
  const conv = await obtenerOCrearConversacion(identidad.id);
  if (conv.status === "escalada") return;

  const [tag, ...rest] = data.split(":");
  const arg = rest.join(":");

  await guardarMensajeUsuario(conv.id, `[botón] ${data}`, cq);

  switch (tag) {
    case "menu":      return enviarMenuCategorias(chatId, "Elige una categoría:");
    case "cat":       return enviarServiciosDeCategoria(chatId, conv, arg);
    case "srv":       return enviarHorariosDeServicio(chatId, conv, arg);
    case "slot":      return iniciarCapturaPaciente(chatId, conv, arg);
    case "sex":       return wizardSetSexo(chatId, conv, arg);
    case "extra":     return wizardDecisionExtra(chatId, conv, arg);
    case "skip":      return wizardSkip(chatId, conv, arg);
    case "alergias":  return wizardAlergias(chatId, conv, arg);
    case "consent":   return wizardConsent(chatId, conv, arg);
    case "confirm":   return wizardConfirm(chatId, conv, arg);
    default:          return;
  }
}

async function answerCallback(callback_query_id: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ callback_query_id }),
  });
}

// ============================================================
// MENÚS
// ============================================================
async function enviarMenuCategorias(chatId: string, header: string) {
  const keys = Object.keys(CATEGORIAS);
  const rows: any[] = [];
  for (let i = 0; i < keys.length; i += 2) {
    const row = [{ text: CATEGORIAS[keys[i]].label, callback_data: `cat:${keys[i]}` }];
    if (keys[i + 1]) row.push({ text: CATEGORIAS[keys[i + 1]].label, callback_data: `cat:${keys[i + 1]}` });
    rows.push(row);
  }
  await enviarTelegramConBotones(chatId, header, rows);
}

async function enviarServiciosDeCategoria(chatId: string, conv: any, catKey: string) {
  const cat = CATEGORIAS[catKey];
  if (!cat) return enviarMenuCategorias(chatId, "Categoría no reconocida. Elige una:");

  // Solo servicios que tengan al menos un doctor activo asignado
  const { data: servicios } = await supabase
    .from("servicios")
    .select("id, nombre, duracion_minutos, precio_centavos, especialidad, doctor_servicios!inner(doctor_id, doctors!inner(activo))")
    .eq("activo", true)
    .in("especialidad", cat.especialidades)
    .eq("doctor_servicios.doctors.activo", true);

  // Dedupe por id
  const vistos = new Set<string>();
  const lista = (servicios ?? []).filter((s: any) => {
    if (vistos.has(s.id)) return false;
    vistos.add(s.id);
    return true;
  });

  if (lista.length === 0) {
    return enviarTelegramConBotones(chatId, "No hay servicios disponibles en esta categoría ahora.", [
      [{ text: "← Volver al menú", callback_data: "menu:" }],
    ]);
  }

  const rows = lista.map((s: any) => {
    const precio = s.precio_centavos ? `$${(s.precio_centavos / 100).toLocaleString("es-MX")}` : "—";
    return [{ text: `${s.nombre} — ${s.duracion_minutos} min / ${precio}`, callback_data: `srv:${s.id}` }];
  });
  rows.push([{ text: "← Volver al menú", callback_data: "menu:" }]);

  await enviarTelegramConBotones(chatId, `${cat.label}\nElige un servicio:`, rows);
}

async function enviarHorariosDeServicio(chatId: string, conv: any, servicioId: string) {
  const result = await listarHorariosDisponibles({ servicio_id: servicioId, dias_adelante: 14 });
  if ((result as any).error) {
    return enviarTelegram(chatId, "Tuve un error consultando horarios. Intenta de nuevo.");
  }
  const horarios = (result as any).horarios ?? [];
  if (horarios.length === 0) {
    return enviarTelegramConBotones(chatId, "No encontré horarios disponibles en los próximos 14 días.", [
      [{ text: "← Volver al menú", callback_data: "menu:" }],
    ]);
  }

  // Guarda servicio elegido + mapa de slots en flow_data temporal (clave: índice corto)
  const { data: svc } = await supabase
    .from("servicios").select("nombre, duracion_minutos").eq("id", servicioId).single();

  const slotMap: Record<string, any> = {};
  const rows = horarios.slice(0, 8).map((h: any, idx: number) => {
    const key = String(idx);
    slotMap[key] = { fecha_inicio: h.fecha_inicio, doctor_id: h.doctor_id, doctor_nombre: h.doctor_nombre, fecha_local: h.fecha_local };
    return [{ text: `${h.fecha_local} · ${h.doctor_nombre}`, callback_data: `slot:${key}` }];
  });
  rows.push([{ text: "← Volver al menú", callback_data: "menu:" }]);

  await upsertSesion(conv.id, {
    servicio_id: servicioId,
    flow_step: "await_slot_pick",
    flow_data: { servicio_nombre: svc?.nombre, slots: slotMap },
  });

  await enviarTelegramConBotones(chatId, `Horarios disponibles para *${svc?.nombre}*. Elige uno:`, rows);
}

// ============================================================
// WIZARD DE CAPTURA DEL PACIENTE
// ============================================================
async function iniciarCapturaPaciente(chatId: string, conv: any, slotKey: string) {
  const sesion = await obtenerSesion(conv.id);
  const slot = sesion?.flow_data?.slots?.[slotKey];
  if (!slot) {
    return enviarMenuCategorias(chatId, "Ese horario ya no está disponible. Elige otra categoría:");
  }

  const nuevoData = {
    ...(sesion?.flow_data ?? {}),
    fecha_local: slot.fecha_local,
    doctor_nombre: slot.doctor_nombre,
    slot_fecha_iso: slot.fecha_inicio,
  };
  delete (nuevoData as any).slots;

  await upsertSesion(conv.id, {
    doctor_id: slot.doctor_id,
    slot_propuesto: slot.fecha_inicio,
    flow_step: "await_nombre",
    flow_data: nuevoData,
  });

  await enviarTelegram(chatId, `Reservado tentativamente: *${nuevoData.fecha_local}* con *${nuevoData.doctor_nombre}*.\n\nPara confirmar necesito 4 datos. Primero: ¿cuál es tu *nombre* (solo nombre, sin apellidos)?`);
}

function pasoEsperaTexto(step: string): boolean {
  return ["await_nombre", "await_apellidos", "await_fecha", "await_ciudad", "await_email", "await_alergias_texto"].includes(step);
}

async function manejarTextoWizard(chatId: string, conv: any, sesion: any, text: string) {
  const data = sesion.flow_data ?? {};
  const borrador = sesion.borrador_paciente ?? {};

  switch (sesion.flow_step) {
    case "await_nombre": {
      const v = text.trim();
      if (v.length < 2) return enviarTelegram(chatId, "Necesito un nombre válido. ¿Cuál es tu nombre?");
      borrador.nombre = v;
      await upsertSesion(conv.id, { borrador_paciente: borrador, flow_step: "await_apellidos" });
      return enviarTelegram(chatId, "Gracias. ¿Tus *apellidos*?");
    }
    case "await_apellidos": {
      const v = text.trim();
      if (v.length < 2) return enviarTelegram(chatId, "Necesito apellidos válidos. ¿Cuáles son?");
      borrador.apellidos = v;
      await upsertSesion(conv.id, { borrador_paciente: borrador, flow_step: "await_fecha", flow_data: { ...data, fecha_intentos: 0 } });
      return enviarTelegram(chatId, "¿Tu *fecha de nacimiento*? Puedes escribirla en cualquier formato: 12/10/1981, 12-10-81, 12 de octubre 1981, 121081, etc.");
    }
    case "await_fecha": {
      const iso = await parseFechaFlexible(text);
      const intentos = (data.fecha_intentos ?? 0) + 1;
      if (!iso) {
        if (intentos >= 3) {
          await upsertSesion(conv.id, { flow_data: { ...data, fecha_intentos: intentos } });
          return enviarTelegramConBotones(chatId, "No logré entender la fecha después de varios intentos. Continuemos sin ella:", [
            [{ text: "⏭️ Prefiero no decir", callback_data: "skip:fecha" }],
          ]);
        }
        await upsertSesion(conv.id, { flow_data: { ...data, fecha_intentos: intentos } });
        return enviarTelegramConBotones(chatId, "No entendí esa fecha. Puedes escribirla como 12/10/1981 o '12 de octubre de 1981'.", [
          [{ text: "⏭️ Prefiero no decir", callback_data: "skip:fecha" }],
        ]);
      }
      borrador.fecha_nacimiento = iso;
      await upsertSesion(conv.id, { borrador_paciente: borrador, flow_step: "await_sexo" });
      await enviarTelegram(chatId, `Anotado: *${formatFechaMX(iso)}*.`);
      return preguntarSexo(chatId);
    }
    case "await_ciudad": {
      const v = text.trim();
      if (v.length >= 2) borrador.domicilio_ciudad = v;
      await upsertSesion(conv.id, { borrador_paciente: borrador, flow_step: "await_email" });
      return preguntarEmail(chatId);
    }
    case "await_email": {
      const v = text.trim();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        borrador.email = v;
      }
      await upsertSesion(conv.id, { borrador_paciente: borrador, flow_step: "await_alergias_choice" });
      return preguntarAlergias(chatId);
    }
    case "await_alergias_texto": {
      const v = text.trim();
      if (v) borrador.alergias = v;
      await upsertSesion(conv.id, { borrador_paciente: borrador });
      return preguntarConsentimiento(chatId, conv);
    }
  }
}

async function preguntarSexo(chatId: string) {
  await enviarTelegramConBotones(chatId, "¿Cuál es tu sexo?", [[
    { text: "Masculino", callback_data: "sex:masculino" },
    { text: "Femenino", callback_data: "sex:femenino" },
    { text: "Prefiero no decir", callback_data: "sex:skip" },
  ]]);
}

async function wizardSetSexo(chatId: string, conv: any, val: string) {
  const sesion = await obtenerSesion(conv.id);
  const borrador = sesion?.borrador_paciente ?? {};
  if (val !== "skip") borrador.sexo = val;
  await upsertSesion(conv.id, { borrador_paciente: borrador, flow_step: "await_optional_decision" });
  await enviarTelegramConBotones(chatId, "¿Quieres agregar más datos opcionales a tu expediente? Es voluntario — también puedes hacerlo en la consulta.", [[
    { text: "➕ Agregar más datos", callback_data: "extra:yes" },
    { text: "⏭️ Más tarde", callback_data: "extra:no" },
  ]]);
}

async function wizardDecisionExtra(chatId: string, conv: any, val: string) {
  if (val === "no") {
    return preguntarConsentimiento(chatId, conv);
  }
  await upsertSesion(conv.id, { flow_step: "await_ciudad" });
  await enviarTelegramConBotones(chatId, "¿En qué *ciudad* vives?", [[
    { text: "Saltar", callback_data: "skip:ciudad" },
  ]]);
}

async function preguntarEmail(chatId: string) {
  await enviarTelegramConBotones(chatId, "¿Cuál es tu *email*?", [[
    { text: "Saltar", callback_data: "skip:email" },
  ]]);
}

async function preguntarAlergias(chatId: string) {
  await enviarTelegramConBotones(chatId, "¿Tienes *alergias* conocidas?", [[
    { text: "Sin alergias", callback_data: "alergias:none" },
    { text: "Tengo alergias", callback_data: "alergias:yes" },
    { text: "Saltar", callback_data: "alergias:skip" },
  ]]);
}

async function wizardSkip(chatId: string, conv: any, campo: string) {
  const sesion = await obtenerSesion(conv.id);
  switch (campo) {
    case "fecha":
      await upsertSesion(conv.id, { flow_step: "await_sexo" });
      return preguntarSexo(chatId);
    case "ciudad":
      await upsertSesion(conv.id, { flow_step: "await_email" });
      return preguntarEmail(chatId);
    case "email":
      await upsertSesion(conv.id, { flow_step: "await_alergias_choice" });
      return preguntarAlergias(chatId);
    case "alergias":
      return preguntarConsentimiento(chatId, conv);
  }
}

async function wizardAlergias(chatId: string, conv: any, val: string) {
  const sesion = await obtenerSesion(conv.id);
  const borrador = sesion?.borrador_paciente ?? {};
  if (val === "none") {
    borrador.alergias = "Sin alergias";
    await upsertSesion(conv.id, { borrador_paciente: borrador });
    return preguntarConsentimiento(chatId, conv);
  }
  if (val === "skip") {
    return preguntarConsentimiento(chatId, conv);
  }
  // yes
  await upsertSesion(conv.id, { flow_step: "await_alergias_texto" });
  return enviarTelegramConBotones(chatId, "Cuéntame qué alergias tienes:", [[
    { text: "Saltar", callback_data: "skip:alergias" },
  ]]);
}

async function preguntarConsentimiento(chatId: string, conv: any) {
  await upsertSesion(conv.id, { flow_step: "await_consent" });
  await enviarTelegramConBotones(chatId,
    "Tus datos se usan únicamente para tu atención médica, conforme a la NOM-004-SSA3-2012 y la LFPDPPP. ¿Aceptas?",
    [[
      { text: "✅ Sí, acepto", callback_data: "consent:yes" },
      { text: "❌ No", callback_data: "consent:no" },
    ]]
  );
}

async function wizardConsent(chatId: string, conv: any, val: string) {
  if (val === "no") {
    await limpiarSesion(conv.id);
    return enviarTelegram(chatId, "Entendido. Sin tu consentimiento no puedo agendar. Si cambias de opinión escribe /start.");
  }
  await upsertSesion(conv.id, {
    consentimiento_dado: true,
    consentimiento_fecha: new Date().toISOString(),
    flow_step: "await_confirm",
  });
  return mostrarConfirmacion(chatId, conv);
}

async function mostrarConfirmacion(chatId: string, conv: any) {
  const sesion = await obtenerSesion(conv.id);
  const d = sesion?.flow_data ?? {};
  const b = sesion?.borrador_paciente ?? {};
  const resumen =
    `*Resumen de tu cita*\n\n` +
    `🩺 Servicio: ${d.servicio_nombre}\n` +
    `👨‍⚕️ Doctor: ${d.doctor_nombre}\n` +
    `📅 Fecha: ${d.fecha_local}\n\n` +
    `👤 Paciente: ${b.nombre} ${b.apellidos}\n` +
    (b.fecha_nacimiento ? `🎂 Nacimiento: ${formatFechaMX(b.fecha_nacimiento)}\n` : "") +
    (b.sexo ? `⚧ Sexo: ${b.sexo}\n` : "");
  await enviarTelegramConBotones(chatId, resumen, [[
    { text: "✅ Confirmar cita", callback_data: "confirm:yes" },
    { text: "❌ Cancelar", callback_data: "confirm:no" },
  ]]);
}

async function wizardConfirm(chatId: string, conv: any, val: string) {
  if (val === "no") {
    await limpiarSesion(conv.id);
    return enviarTelegram(chatId, "Cita cancelada. Escribe /start si quieres intentar de nuevo.");
  }

  const result = await crearCitaDesdeSesion(conv);
  if ((result as any).error) {
    return enviarTelegram(chatId, `No pude crear la cita: ${(result as any).error}. Escribe /start para intentar de nuevo.`);
  }
  await limpiarSesion(conv.id);
  await enviarTelegram(chatId, "✅ Listo, tu cita queda como *SOLICITADA*. Recepción la confirma en breve. Si necesitas cambiar algo, escríbeme aquí mismo.");
}

async function crearCitaDesdeSesion(conv: any) {
  const sesion = await obtenerSesion(conv.id);
  if (!sesion) return { error: "Sin sesión activa" };
  if (!sesion.consentimiento_dado) return { error: "Falta consentimiento" };
  const b = sesion.borrador_paciente ?? {};
  if (!b.nombre || !b.apellidos) return { error: "Faltan datos básicos" };
  if (!sesion.servicio_id || !sesion.doctor_id || !sesion.slot_propuesto) {
    return { error: "Faltan datos de la cita" };
  }

  const { data: identidad } = await supabase
    .from("identidades_canal").select("*").eq("id", conv.identidad_canal_id).single();

  let patientId = identidad.patient_id;
  if (!patientId) {
    const { data: nuevoPaciente, error: ep } = await supabase
      .from("patients").insert({
        nombre:             b.nombre,
        apellidos:          b.apellidos,
        fecha_nacimiento:   b.fecha_nacimiento ?? null,
        sexo:               b.sexo ?? null,
        email:              b.email ?? null,
        domicilio_ciudad:   b.domicilio_ciudad ?? null,
        alergias:           b.alergias ?? null,
      }).select("id").single();
    if (ep) return { error: "No pude crear paciente: " + ep.message };
    patientId = nuevoPaciente.id;
    await supabase.from("identidades_canal").update({ patient_id: patientId }).eq("id", identidad.id);
    await supabase.from("consentimientos").insert({
      patient_id: patientId,
      identidad_canal_id: identidad.id,
      tipo: "aviso_privacidad",
      version_texto: AVISO_PRIVACIDAD_VERSION,
      otorgado: true,
      otorgado_at: sesion.consentimiento_fecha,
    });
  }

  const { data: svc } = await supabase
    .from("servicios").select("duracion_minutos").eq("id", sesion.servicio_id).single();
  if (!svc) return { error: "Servicio no encontrado" };

  const inicio = new Date(sesion.slot_propuesto);
  const fin    = new Date(inicio.getTime() + svc.duracion_minutos * 60000);

  const { data: cita, error: ea } = await supabase.from("appointments").insert({
    patient_id:     patientId,
    doctor_id:      sesion.doctor_id,
    servicio_id:    sesion.servicio_id,
    fecha_inicio:   inicio.toISOString(),
    fecha_fin:      fin.toISOString(),
    origen:         "telegram",
    creada_por_bot: true,
  }).select("id, fecha_inicio").single();

  if (ea) {
    if (ea.code === "23P01" || /exclude|exclusion/i.test(ea.message)) {
      return { error: "El horario ya fue tomado" };
    }
    return { error: ea.message };
  }

  // Recordatorios T-24h y T-2h
  try {
    const ahora    = new Date();
    const inicioMs = inicio.getTime();
    const rows: any[] = [];
    const rec24h = new Date(inicioMs - 24 * 3600000);
    const rec2h  = new Date(inicioMs -  2 * 3600000);
    if (rec24h > ahora) rows.push({ appointment_id: cita.id, identidad_canal_id: conv.identidad_canal_id, programado_para: rec24h.toISOString(), tipo: "t24h", status: "pendiente" });
    if (rec2h  > ahora) rows.push({ appointment_id: cita.id, identidad_canal_id: conv.identidad_canal_id, programado_para: rec2h.toISOString(),  tipo: "t2h",  status: "pendiente" });
    if (rows.length) await supabase.from("recordatorios_cita").insert(rows);
  } catch (e) {
    console.error("recordatorios:", e);
  }

  return { ok: true, appointment_id: cita.id };
}

// ============================================================
// AGENTE CLAUDE (fallback para texto libre)
// ============================================================
async function correrAgente(conv: any, chatId: string): Promise<string> {
  const messages = await cargarHistorialParaAnthropic(conv.id);

  for (let i = 0; i < MAX_AGENT_ITERATIONS; i++) {
    const resp = await llamarClaude(messages);

    if (resp.stop_reason === "end_turn" || resp.stop_reason === "stop_sequence") {
      const text = resp.content.find((b: any) => b.type === "text")?.text?.trim();
      if (text) return text;
      const hasBlocks = (resp.content?.length ?? 0) > 0;
      if (hasBlocks) {
        messages.push({ role: "assistant", content: resp.content });
        messages.push({ role: "user", content: "Continúa con el siguiente paso." });
        continue;
      }
      break;
    }

    if (resp.stop_reason === "tool_use") {
      const toolUses = resp.content.filter((b: any) => b.type === "tool_use");
      messages.push({ role: "assistant", content: resp.content });

      const toolResults: any[] = [];
      for (const tu of toolUses) {
        const result = await ejecutarToolClaude(tu.name, tu.input, conv, chatId);
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result),
          is_error: !!result.error,
        });
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }
    break;
  }
  return "";
}

async function ejecutarToolClaude(name: string, input: any, conv: any, chatId: string) {
  try {
    switch (name) {
      case "mostrar_menu_categorias":
        await enviarMenuCategorias(chatId, "Aquí está el menú de servicios:");
        return { ok: true, accion: "menú enviado al paciente con botones" };
      case "buscar_servicios":
        return await buscarServicios(input.query, chatId);
      case "escalar_a_humano":
        return await escalarConversacion(conv, input);
      default:
        return { error: "Tool desconocida: " + name };
    }
  } catch (err: any) {
    return { error: err.message ?? String(err) };
  }
}

async function buscarServicios(query: string, chatId: string) {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return { error: "query vacía" };
  const { data } = await supabase
    .from("servicios")
    .select("id, nombre, especialidad, duracion_minutos, precio_centavos")
    .eq("activo", true);
  const filtrados = (data ?? []).filter((s: any) =>
    s.nombre.toLowerCase().includes(q) ||
    (s.especialidad ?? "").toLowerCase().includes(q)
  ).slice(0, 5);

  if (filtrados.length === 0) {
    await enviarMenuCategorias(chatId, `No encontré "${query}". Elige una categoría:`);
    return { ok: true, candidatos: 0, accion: "menú enviado" };
  }

  const rows = filtrados.map((s: any) => {
    const precio = s.precio_centavos ? `$${(s.precio_centavos / 100).toLocaleString("es-MX")}` : "—";
    return [{ text: `${s.nombre} — ${s.duracion_minutos} min / ${precio}`, callback_data: `srv:${s.id}` }];
  });
  rows.push([{ text: "← Ver todas las categorías", callback_data: "menu:" }]);
  await enviarTelegramConBotones(chatId, `Encontré esto para "${query}":`, rows);
  return { ok: true, candidatos: filtrados.length, accion: "botones enviados" };
}

async function llamarClaude(messages: any[]) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    }),
  });
  if (!res.ok) throw new Error("Anthropic " + res.status + ": " + (await res.text()));
  return await res.json();
}

// ============================================================
// LISTAR HORARIOS (reusada)
// ============================================================
async function listarHorariosDisponibles({ servicio_id, dias_adelante = 7 }: any) {
  dias_adelante = Math.min(dias_adelante, 30);

  const { data: ds, error: e1 } = await supabase
    .from("doctor_servicios")
    .select("doctor_id, doctor:doctors(id, nombre, apellidos, horario_inicio, horario_fin, activo)")
    .eq("servicio_id", servicio_id);
  if (e1) return { error: e1.message };

  const doctores = (ds ?? []).filter((r: any) => r.doctor?.activo);
  if (doctores.length === 0) return { horarios: [] };

  const { data: svc, error: e2 } = await supabase
    .from("servicios").select("duracion_minutos").eq("id", servicio_id).single();
  if (e2) return { error: e2.message };
  const durMin: number = svc.duracion_minutos;

  const ahora = new Date();
  const finRango = new Date(ahora.getTime() + dias_adelante * 86400000);
  const docIds = doctores.map((d: any) => d.doctor_id);

  const { data: existentes } = await supabase
    .from("appointments")
    .select("doctor_id, fecha_inicio, fecha_fin, status")
    .in("doctor_id", docIds)
    .gte("fecha_inicio", ahora.toISOString())
    .lte("fecha_inicio", finRango.toISOString());

  const ocupadas = (existentes ?? []).filter((a: any) => {
    const s = String(a.status).toLowerCase();
    return !["cancelada", "cancelado", "no_show", "no_asistio"].includes(s);
  });

  const horarios: any[] = [];
  const ahoraMxMs = ahora.getTime() + MX_TZ_OFFSET_MS;

  for (let d = 0; d < dias_adelante && horarios.length < 16; d++) {
    const diaMx = new Date(ahoraMxMs + d * 86400000);
    if (!DIAS_LABORALES.includes(diaMx.getUTCDay())) continue;
    const yyyy = diaMx.getUTCFullYear();
    const mm   = String(diaMx.getUTCMonth() + 1).padStart(2, "0");
    const dd   = String(diaMx.getUTCDate()).padStart(2, "0");

    for (const doc of doctores) {
      const [sh, sm] = doc.doctor.horario_inicio.split(":").map(Number);
      const [eh, em] = doc.doctor.horario_fin.split(":").map(Number);
      const hi = String(sh).padStart(2, "0") + ":" + String(sm).padStart(2, "0");
      const hf = String(eh).padStart(2, "0") + ":" + String(em).padStart(2, "0");
      const inicioDia = new Date(`${yyyy}-${mm}-${dd}T${hi}:00${MX_TZ_OFFSET}`);
      const finDia    = new Date(`${yyyy}-${mm}-${dd}T${hf}:00${MX_TZ_OFFSET}`);

      for (let t = inicioDia.getTime(); t + durMin * 60000 <= finDia.getTime(); t += durMin * 60000) {
        const slotIni = new Date(t);
        const slotFin = new Date(t + durMin * 60000);
        if (slotIni < ahora) continue;
        const conflicto = ocupadas.find((a: any) =>
          a.doctor_id === doc.doctor_id &&
          new Date(a.fecha_inicio) < slotFin &&
          new Date(a.fecha_fin)   > slotIni
        );
        if (conflicto) continue;

        horarios.push({
          doctor_id: doc.doctor_id,
          doctor_nombre: doc.doctor.nombre + " " + doc.doctor.apellidos,
          fecha_inicio: slotIni.toISOString(),
          fecha_local: slotIni.toLocaleString("es-MX", {
            timeZone: "America/Mexico_City",
            weekday: "short", day: "numeric", month: "short",
            hour: "2-digit", minute: "2-digit",
          }),
        });
        if (horarios.length >= 16) break;
      }
      if (horarios.length >= 16) break;
    }
  }

  return { horarios: horarios.slice(0, 8) };
}

async function escalarConversacion(conv: any, { razon }: { razon: string }) {
  await supabase.from("conversaciones")
    .update({ status: "escalada", intencion_actual: "escalada" })
    .eq("id", conv.id);
  return { ok: true, escalada: true, razon };
}

// ============================================================
// SESIÓN HELPERS
// ============================================================
async function obtenerSesion(convId: string) {
  const { data } = await supabase
    .from("bot_sesiones").select("*").eq("conversacion_id", convId).maybeSingle();
  return data;
}

async function upsertSesion(convId: string, patch: any) {
  const existing = await obtenerSesion(convId);
  if (existing) {
    const merged: any = { ...patch, updated_at: new Date().toISOString() };
    if (patch.flow_data) merged.flow_data = { ...(existing.flow_data ?? {}), ...patch.flow_data };
    await supabase.from("bot_sesiones").update(merged).eq("id", existing.id);
  } else {
    await supabase.from("bot_sesiones").insert({ conversacion_id: convId, ...patch });
  }
}

async function limpiarSesion(convId: string) {
  await supabase.from("bot_sesiones").delete().eq("conversacion_id", convId);
}

// ============================================================
// IDENTIDAD / CONVERSACIÓN / MENSAJES
// ============================================================
async function obtenerOCrearIdentidad(chatId: string, from: any) {
  const { data: existente } = await supabase
    .from("identidades_canal").select("*")
    .eq("canal_id", "telegram").eq("external_id", chatId).maybeSingle();
  if (existente) return existente;

  const display = [from?.first_name, from?.last_name].filter(Boolean).join(" ") || from?.username || "Anónimo";
  const { data: nueva, error } = await supabase
    .from("identidades_canal").insert({
      canal_id:     "telegram",
      external_id:  chatId,
      display_name: display,
      metadata:     { telegram_user: from },
    }).select("*").single();
  if (error) throw error;
  return nueva;
}

async function obtenerOCrearConversacion(identidadId: string) {
  const { data: existente } = await supabase
    .from("conversaciones").select("*")
    .eq("identidad_canal_id", identidadId)
    .in("status", ["activa", "escalada"])
    .order("created_at", { ascending: false })
    .limit(1).maybeSingle();
  if (existente) return existente;

  const { data: nueva, error } = await supabase
    .from("conversaciones").insert({ identidad_canal_id: identidadId })
    .select("*").single();
  if (error) throw error;
  return nueva;
}

async function guardarMensajeUsuario(conversacionId: string, text: string, raw: any) {
  await supabase.from("mensajes").insert({
    conversacion_id: conversacionId, rol: "user", contenido: text, raw_payload: raw,
  });
  await supabase.from("conversaciones")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversacionId);
}

async function guardarMensajeAsistente(conversacionId: string, text: string) {
  await supabase.from("mensajes").insert({
    conversacion_id: conversacionId, rol: "assistant", contenido: text,
  });
}

async function cargarHistorialParaAnthropic(conversacionId: string) {
  const { data } = await supabase
    .from("mensajes").select("rol, contenido")
    .eq("conversacion_id", conversacionId)
    .in("rol", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(40);
  let messages = (data ?? []).reverse().map((m: any) => ({
    role: m.rol, content: m.contenido ?? "",
  }));
  while (messages.length > 0 && messages[0].role !== "user") messages.shift();
  return messages;
}

// ============================================================
// TELEGRAM SEND
// ============================================================
async function enviarTelegram(chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  if (!res.ok) console.error("Telegram send error:", await res.text());
}

async function enviarTelegramConBotones(chatId: string, text: string, inlineKeyboard: any[][]) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: inlineKeyboard },
    }),
  });
  if (!res.ok) console.error("Telegram send buttons error:", await res.text());
}

// ============================================================
// UTILS
// ============================================================
function parseFechaDDMMYYYY(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  if (yyyy < 1900 || yyyy > new Date().getFullYear()) return null;
  const iso = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return iso;
}

function formatFechaMX(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
