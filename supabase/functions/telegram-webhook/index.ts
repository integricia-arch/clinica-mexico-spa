// =================================================================
// supabase/functions/telegram-webhook/index.ts  (v6)
//
// Webhook de Telegram para ClínicaMX.
//
// v6: - Fix "(sin respuesta)": cuando Claude termina end_turn sin texto
//       (típicamente tras un tool_use exitoso), nudgea para que genere
//       la siguiente pregunta en lugar de devolver el literal
//       "(sin respuesta)" al paciente.
// v5: - Fix timezone: slots y día-de-semana se calculan en hora México (UTC-6)
//     - listarHorariosDisponibles devuelve fecha_local pre-formateado
//     - SYSTEM_PROMPT instruye al LLM usar fecha_local para mostrar
// v4: - Fix ciclado: separar check de escalada vs búsqueda de conv activa
//     - Añadir /nueva para escapar estado escalado sin cambios de schema
//     - Clarificar uso de escalar_a_humano (solo con confirmación)
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
const MX_TZ_OFFSET = "-06:00";          // México sin DST desde 2022
const MX_TZ_OFFSET_MS = -6 * 3600000;   // mismo valor en milisegundos

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const SYSTEM_PROMPT = `Eres el asistente virtual de ClínicaMX, una clínica de odontología, dermatología y medicina estética en México. Tu trabajo: ayudar a pacientes a agendar citas vía Telegram.

REGLAS DURAS:
- Hablas español mexicano natural, cálido y profesional. Mensajes cortos (1-3 oraciones). Sin emojis excesivos (máximo 1 cuando aplique).
- NUNCA das consejo médico, diagnóstico ni recomendaciones de tratamiento. Si el paciente describe síntomas, di: "Eso lo valora mejor el doctor en consulta. ¿Te ayudo a agendar?"
- Si detectas urgencia (dolor severo, sangrado, reacción alérgica): usa escalar_a_humano con razón "urgencia médica" y pide al paciente llamar al 911 o ir a urgencias.
- ANTES de agendar_cita debes tener: (1) datos del paciente (nombre, apellidos, fecha_nacimiento, telefono), (2) consentimiento del aviso de privacidad otorgado, (3) un horario concreto elegido por el paciente.
- DESPUÉS de cada tool_use exitoso, SIEMPRE genera un mensaje de texto al paciente avanzando al siguiente paso del flujo. Nunca termines tu turno solo con un tool_use silencioso.

FLUJO TÍPICO:
1. Saluda y pregunta qué necesita.
2. Para agendar: usa listar_servicios. Si el paciente menciona especialidad ("quiero algo dental"), filtra.
3. Confirma el servicio elegido. Usa listar_horarios_disponibles para los próximos 7 días.
4. Presenta 3-4 opciones usando el campo "fecha_local" de cada horario (ya formateado en hora México). Para agendar usa "fecha_inicio" (ISO UTC). Espera elección.
5. Recolecta datos UNO A UNO:
   - "¿Cuál es tu nombre? (solo el nombre, sin apellidos)"
   - "¿Tus apellidos?"
   - "¿Tu fecha de nacimiento? (día/mes/año)"
   - "¿Un teléfono donde podamos contactarte?"
   Usa guardar_borrador_paciente cada vez que el paciente comparte un dato, y EN EL MISMO TURNO continúa con la siguiente pregunta.
6. ANTES de agendar, presenta este aviso y pide confirmación textual:
   "Antes de continuar: tus datos se usan únicamente para gestionar tu cita y atención médica, conforme a la LFPDPPP. ¿Aceptas? (sí/no)"
   Si dice "sí" → registrar_consentimiento(otorgado=true).
7. Confirma el resumen: "Te agendo {servicio} con {doctor} el {fecha} a las {hora}. ¿Confirmas?"
8. Si confirma → agendar_cita. Si la tool devuelve error de conflicto, ofrece otro horario.
9. Tras éxito: "Listo, tu cita queda como SOLICITADA. Recepción la confirma en breve. Si necesitas cambiar algo, escríbeme aquí mismo."

OTROS CASOS:
- Cambiar/cancelar: usa cancelar_cita.
- Hablar con persona: OFRECE escalar_a_humano y espera confirmación textual del paciente ("sí", "ok", "quiero hablar con alguien"). NUNCA llames escalar_a_humano sin que el paciente lo confirme explícitamente con un "sí" o equivalente.
- Si la conversación lleva 3 intercambios sin avanzar: ofrece escalar_a_humano; úsalo SOLO si el paciente confirma.
- Urgencia médica (dolor severo, sangrado, reacción alérgica): en este único caso sí puedes llamar escalar_a_humano de inmediato.
- Al escalar por cualquier motivo, añade siempre al final: "Cuando quieras iniciar una nueva consulta, escribe /nueva."

NUNCA inventes precios, horarios o doctores. Siempre lee de las tools.`;

const TOOLS = [
  {
    name: "listar_servicios",
    description: "Lista servicios/tratamientos activos. Filtra por especialidad si el paciente la mencionó.",
    input_schema: {
      type: "object",
      properties: {
        especialidad: {
          type: "string",
          description: "Filtro opcional: Odontología, Dermatología, Medicina Estética",
        },
      },
    },
  },
  {
    name: "listar_horarios_disponibles",
    description: "Devuelve hasta 6 horarios disponibles para un servicio, los próximos N días. Llama DESPUÉS de que el paciente eligió un servicio.",
    input_schema: {
      type: "object",
      properties: {
        servicio_id: { type: "string", description: "UUID del servicio" },
        dias_adelante: { type: "integer", description: "Cuántos días buscar hacia adelante (default 7, max 30)" },
      },
      required: ["servicio_id"],
    },
  },
  {
    name: "guardar_borrador_paciente",
    description: "Guarda datos parciales del paciente. Llama cada vez que el paciente comparte un dato nuevo.",
    input_schema: {
      type: "object",
      properties: {
        nombre:           { type: "string" },
        apellidos:        { type: "string" },
        fecha_nacimiento: { type: "string", description: "YYYY-MM-DD" },
        telefono:         { type: "string" },
        sexo:             { type: "string", description: "M, F u otro" },
        motivo:           { type: "string" },
      },
    },
  },
  {
    name: "registrar_consentimiento",
    description: "Registra que el paciente aceptó o rechazó el aviso de privacidad. OBLIGATORIO antes de agendar_cita.",
    input_schema: {
      type: "object",
      properties: { otorgado: { type: "boolean" } },
      required: ["otorgado"],
    },
  },
  {
    name: "agendar_cita",
    description: "Crea la cita final. Requiere datos completos, consentimiento y horario exacto.",
    input_schema: {
      type: "object",
      properties: {
        servicio_id:  { type: "string" },
        doctor_id:    { type: "string" },
        fecha_inicio: { type: "string", description: "ISO 8601, ej 2026-05-14T10:30:00-06:00" },
      },
      required: ["servicio_id", "doctor_id", "fecha_inicio"],
    },
  },
  {
    name: "cancelar_cita",
    description: "Cancela una cita existente.",
    input_schema: {
      type: "object",
      properties: {
        appointment_id: { type: "string" },
        motivo:         { type: "string" },
      },
      required: ["appointment_id"],
    },
  },
  {
    name: "escalar_a_humano",
    description: "Marca la conversación para que un recepcionista humano tome control. Úsala SOLO cuando el paciente confirme querer hablar con alguien, o en urgencia médica real.",
    input_schema: {
      type: "object",
      properties: { razon: { type: "string" } },
      required: ["razon"],
    },
  },
];

Deno.serve(async (req) => {
  if (WEBHOOK_SECRET) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
  }

  let update: any;
  try { update = await req.json(); }
  catch { return new Response("bad json", { status: 400 }); }

  const msg = update.message;
  if (!msg?.chat || msg.chat.type !== "private") return new Response("ok");

  const chatId = String(msg.chat.id);
  const text = msg.text ?? "";

  const work = manejarMensaje(chatId, msg, text).catch((err) =>
    console.error("manejarMensaje error:", err)
  );
  // @ts-ignore
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else await work;

  return new Response("ok");
});

async function manejarMensaje(chatId: string, rawMsg: any, text: string) {
  const identidad = await obtenerOCrearIdentidad(chatId, rawMsg.from);

  // /nueva: crea una conversación fresca sin tocar la escalada.
  if (text === "/nueva") {
    const { data: conv, error } = await supabase
      .from("conversaciones")
      .insert({ identidad_canal_id: identidad.id })
      .select("*").single();
    if (error) throw error;
    const msg = "Nueva consulta iniciada. ¿En qué te puedo ayudar?";
    await guardarMensajeAsistente(conv.id, msg);
    await enviarTelegram(chatId, msg);
    return;
  }

  // La conv MÁS RECIENTE (activa o escalada) determina el comportamiento.
  const conv = await obtenerOCrearConversacion(identidad.id);

  if (conv.status === "escalada") {
    await enviarTelegram(
      chatId,
      "Recepción ya está al tanto, en breve te contactan.\nPara iniciar una nueva consulta escribe /nueva."
    );
    return;
  }

  if (text === "/start") {
    await guardarMensajeUsuario(conv.id, text, rawMsg);
    const bienvenida = "¡Hola! Soy el asistente de ClínicaMX. Te ayudo a agendar tu cita 24/7. ¿Qué necesitas? (limpieza dental, valoración dermatológica, medicina estética...)";
    await guardarMensajeAsistente(conv.id, bienvenida);
    await enviarTelegram(chatId, bienvenida);
    return;
  }
  if (text === "/humano") {
    await guardarMensajeUsuario(conv.id, text, rawMsg);
    await escalarConversacion(conv, { razon: "Solicitado con /humano" });
    await enviarTelegram(
      chatId,
      "Listo, recepción te contactará en breve.\nCuando quieras iniciar una nueva consulta escribe /nueva."
    );
    return;
  }

  await guardarMensajeUsuario(conv.id, text, rawMsg);

  let respuesta = "";
  try {
    respuesta = await correrAgente(conv);
  } catch (err) {
    console.error("agente error:", err);
    respuesta = "Tuve un problema técnico. ¿Puedes repetirme tu última frase?";
  }

  await guardarMensajeAsistente(conv.id, respuesta);
  await enviarTelegram(chatId, respuesta);
}

// ============================================================
// FIX v6: cuando el modelo termina end_turn SIN texto (típicamente
// tras un tool_use exitoso donde "se conformó" con haber guardado los
// datos), en lugar de devolver "(sin respuesta)" hacemos un nudge:
// pusheamos el turno vacío del asistente + un user prompt sintético
// pidiendo continuar, y dejamos que el loop itere una vez más para que
// genere la siguiente pregunta del flujo.
// ============================================================
async function correrAgente(conv: any): Promise<string> {
  const messages = await cargarHistorialParaAnthropic(conv.id);

  for (let i = 0; i < MAX_AGENT_ITERATIONS; i++) {
    const resp = await llamarClaude(messages);

    if (resp.stop_reason === "end_turn" || resp.stop_reason === "stop_sequence") {
      const text = resp.content.find((b: any) => b.type === "text")?.text?.trim();
      if (text) return text;

      // FIX v6: end_turn sin texto. Nudgeamos para que continúe el flujo.
      console.warn("correrAgente: end_turn sin texto en iteración " + i + ", aplicando nudge");
      const hasBlocks = (resp.content?.length ?? 0) > 0;
      if (hasBlocks) {
        messages.push({ role: "assistant", content: resp.content });
        messages.push({
          role: "user",
          content: "Continúa con el siguiente paso del flujo (haz la siguiente pregunta o acción que corresponda).",
        });
        continue;
      }
      // Contenido realmente vacío — no podemos nudgear sin romper alternancia.
      break;
    }

    if (resp.stop_reason === "tool_use") {
      const toolUses = resp.content.filter((b: any) => b.type === "tool_use");
      messages.push({ role: "assistant", content: resp.content });

      const toolResults: any[] = [];
      for (const tu of toolUses) {
        const result = await ejecutarTool(tu.name, tu.input, conv);
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
  return "Disculpa, me trabé un poco. ¿Me repites qué necesitas?";
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

async function ejecutarTool(name: string, input: any, conv: any) {
  try {
    switch (name) {
      case "listar_servicios":            return await listarServicios(input);
      case "listar_horarios_disponibles": return await listarHorariosDisponibles(input);
      case "guardar_borrador_paciente":   return await guardarBorradorPaciente(input, conv);
      case "registrar_consentimiento":    return await registrarConsentimiento(input, conv);
      case "agendar_cita":                return await agendarCita(input, conv);
      case "cancelar_cita":               return await cancelarCita(input);
      case "escalar_a_humano":            return await escalarConversacion(conv, input);
      default: return { error: "Tool desconocida: " + name };
    }
  } catch (err: any) {
    return { error: err.message ?? String(err) };
  }
}

async function listarServicios({ especialidad }: { especialidad?: string }) {
  let q = supabase
    .from("servicios")
    .select("id, nombre, especialidad, duracion_minutos, precio_centavos, descripcion")
    .eq("activo", true);
  if (especialidad) q = q.ilike("especialidad", "%" + especialidad + "%");

  const { data, error } = await q;
  if (error) return { error: error.message };
  return {
    servicios: (data ?? []).map((s: any) => ({
      id: s.id,
      nombre: s.nombre,
      especialidad: s.especialidad,
      duracion_min: s.duracion_minutos,
      precio_mxn: s.precio_centavos ? s.precio_centavos / 100 : null,
      descripcion: s.descripcion,
    })),
  };
}

async function listarHorariosDisponibles({ servicio_id, dias_adelante = 7 }: any) {
  dias_adelante = Math.min(dias_adelante, 30);

  const { data: ds, error: e1 } = await supabase
    .from("doctor_servicios")
    .select("doctor_id, doctor:doctors(id, nombre, apellidos, horario_inicio, horario_fin, activo)")
    .eq("servicio_id", servicio_id);
  if (e1) return { error: e1.message };

  const doctores = (ds ?? []).filter((r: any) => r.doctor?.activo);
  if (doctores.length === 0) {
    return { horarios: [], nota: "No hay doctor disponible para este servicio." };
  }

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

  const horarios: Array<{
    doctor_id: string;
    doctor_nombre: string;
    fecha_inicio: string;
    fecha_local: string;
  }> = [];

  const ahoraMxMs = ahora.getTime() + MX_TZ_OFFSET_MS;

  for (let d = 0; d < dias_adelante && horarios.length < 12; d++) {
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

      const inicioDia = new Date(yyyy + "-" + mm + "-" + dd + "T" + hi + ":00" + MX_TZ_OFFSET);
      const finDia    = new Date(yyyy + "-" + mm + "-" + dd + "T" + hf + ":00" + MX_TZ_OFFSET);

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
            weekday: "long", day: "numeric", month: "long",
            hour: "2-digit", minute: "2-digit",
          }),
        });
        if (horarios.length >= 12) break;
      }
      if (horarios.length >= 12) break;
    }
  }

  return { horarios: horarios.slice(0, 6) };
}

async function guardarBorradorPaciente(input: any, conv: any) {
  const { data: sesion } = await supabase
    .from("bot_sesiones").select("*").eq("conversacion_id", conv.id).maybeSingle();

  const borrador = Object.assign({}, sesion?.borrador_paciente ?? {}, input);

  if (sesion) {
    await supabase.from("bot_sesiones")
      .update({ borrador_paciente: borrador, updated_at: new Date().toISOString() })
      .eq("id", sesion.id);
  } else {
    await supabase.from("bot_sesiones")
      .insert({ conversacion_id: conv.id, borrador_paciente: borrador });
  }
  return { ok: true, borrador_paciente: borrador };
}

async function registrarConsentimiento({ otorgado }: { otorgado: boolean }, conv: any) {
  const { data: sesion } = await supabase
    .from("bot_sesiones").select("id").eq("conversacion_id", conv.id).maybeSingle();

  const payload = {
    consentimiento_dado: otorgado,
    consentimiento_fecha: otorgado ? new Date().toISOString() : null,
  };

  if (sesion) {
    await supabase.from("bot_sesiones").update(payload).eq("id", sesion.id);
  } else {
    await supabase.from("bot_sesiones")
      .insert(Object.assign({ conversacion_id: conv.id }, payload));
  }
  return { ok: true, otorgado };
}

async function agendarCita(
  input: { servicio_id: string; doctor_id: string; fecha_inicio: string },
  conv: any
) {
  const { data: sesion } = await supabase
    .from("bot_sesiones").select("*").eq("conversacion_id", conv.id).maybeSingle();
  if (!sesion) return { error: "No hay sesión activa" };
  if (!sesion.consentimiento_dado) {
    return { error: "Falta consentimiento del aviso de privacidad. Pregúntale al paciente." };
  }

  const b = sesion.borrador_paciente ?? {};
  if (!b.nombre || !b.apellidos || !b.telefono || !b.fecha_nacimiento) {
    return {
      error: "Faltan datos del paciente",
      faltantes: [
        !b.nombre           && "nombre",
        !b.apellidos        && "apellidos",
        !b.fecha_nacimiento && "fecha_nacimiento",
        !b.telefono         && "telefono",
      ].filter(Boolean),
    };
  }

  const { data: identidad } = await supabase
    .from("identidades_canal").select("*").eq("id", conv.identidad_canal_id).single();

  let patientId = identidad.patient_id;
  if (!patientId) {
    const { data: nuevoPaciente, error: ep } = await supabase
      .from("patients").insert({
        nombre:           b.nombre,
        apellidos:        b.apellidos,
        fecha_nacimiento: b.fecha_nacimiento,
        telefono:         b.telefono,
        sexo:             b.sexo ?? null,
      }).select("id").single();
    if (ep) return { error: "No pude crear paciente: " + ep.message };
    patientId = nuevoPaciente.id;

    await supabase.from("identidades_canal")
      .update({ patient_id: patientId }).eq("id", identidad.id);

    await supabase.from("consentimientos").insert({
      patient_id:         patientId,
      identidad_canal_id: identidad.id,
      tipo:               "aviso_privacidad",
      version_texto:      AVISO_PRIVACIDAD_VERSION,
      otorgado:           true,
      otorgado_at:        sesion.consentimiento_fecha,
    });
  }

  const { data: svc } = await supabase
    .from("servicios").select("duracion_minutos").eq("id", input.servicio_id).single();
  if (!svc) return { error: "Servicio no encontrado" };

  const inicio = new Date(input.fecha_inicio);
  const fin    = new Date(inicio.getTime() + svc.duracion_minutos * 60000);

  const { data: solapes } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("doctor_id", input.doctor_id)
    .lt("fecha_inicio", fin.toISOString())
    .gt("fecha_fin", inicio.toISOString());

  const vivos = (solapes ?? []).filter((a: any) => {
    const s = String(a.status).toLowerCase();
    return !["cancelada", "cancelado", "no_show", "no_asistio"].includes(s);
  });
  if (vivos.length > 0) {
    return { error: "El horario ya fue tomado mientras conversábamos. Ofrece otro." };
  }

  const { data: cita, error: ea } = await supabase.from("appointments").insert({
    patient_id:      patientId,
    doctor_id:       input.doctor_id,
    servicio_id:     input.servicio_id,
    fecha_inicio:    inicio.toISOString(),
    fecha_fin:       fin.toISOString(),
    motivo_consulta: b.motivo ?? null,
    origen:          "telegram",
    creada_por_bot:  true,
  }).select("id, fecha_inicio, status").single();

  if (ea) {
    if (ea.code === "23P01" || /exclude|exclusion/i.test(ea.message)) {
      return { error: "El horario ya fue tomado mientras conversábamos. Ofrece otro." };
    }
    return { error: ea.message };
  }

  // Programa recordatorios T-24h y T-2h
  try {
    const inicioMs = inicio.getTime();
    const ahora    = new Date();
    const rows: any[] = [];

    const rec24h = new Date(inicioMs - 24 * 3600000);
    const rec2h  = new Date(inicioMs -  2 * 3600000);

    if (rec24h > ahora) {
      rows.push({
        appointment_id:     cita.id,
        identidad_canal_id: conv.identidad_canal_id,
        programado_para:    rec24h.toISOString(),
        tipo:               "T-24h",
        status:             "pendiente",
      });
    }
    if (rec2h > ahora) {
      rows.push({
        appointment_id:     cita.id,
        identidad_canal_id: conv.identidad_canal_id,
        programado_para:    rec2h.toISOString(),
        tipo:               "T-2h",
        status:             "pendiente",
      });
    }
    if (rows.length > 0) {
      const { error: er } = await supabase.from("recordatorios_cita").insert(rows);
      if (er) console.error("recordatorios insert:", er.message);
    }
  } catch (e) {
    console.error("programar recordatorios:", e);
  }

  return {
    ok:             true,
    appointment_id: cita.id,
    fecha_inicio:   cita.fecha_inicio,
    status:         cita.status,
    nota:           "Cita creada como SOLICITADA. Recepción la confirma desde el dashboard.",
  };
}

async function cancelarCita({ appointment_id, motivo }: any) {
  const { error } = await supabase.from("appointments").update({
    status: "cancelada",
    notas:  motivo ? "Cancelada por bot: " + motivo : "Cancelada por bot",
  }).eq("id", appointment_id);
  if (error) return { error: error.message };
  return { ok: true };
}

async function escalarConversacion(conv: any, { razon }: { razon: string }) {
  await supabase.from("conversaciones")
    .update({ status: "escalada", intencion_actual: "escalada" })
    .eq("id", conv.id);
  return { ok: true, escalada: true, razon };
}

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
    conversacion_id: conversacionId,
    rol:             "user",
    contenido:       text,
    raw_payload:     raw,
  });
  await supabase.from("conversaciones")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversacionId);
}

async function guardarMensajeAsistente(conversacionId: string, text: string) {
  await supabase.from("mensajes").insert({
    conversacion_id: conversacionId,
    rol:             "assistant",
    contenido:       text,
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
    role:    m.rol,
    content: m.contenido ?? "",
  }));

  while (messages.length > 0 && messages[0].role !== "user") {
    messages.shift();
  }

  return messages;
}

async function enviarTelegram(chatId: string, text: string) {
  const url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) console.error("Telegram send error:", await res.text());
}
