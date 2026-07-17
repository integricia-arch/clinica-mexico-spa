async function answerCallback(callback_query_id: string) {
  await fetch(`${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ callback_query_id }),
  });
}

// Remove inline keyboard from a previously sent message.
// Called after navigation buttons so double-taps on the same button do nothing.
async function limpiarTeclado(chatId: string, messageId: number) {
  try {
    await fetch(`${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
    });
  } catch { /* non-critical */ }
}

// ============================================================
// v8: CONSULTA ABIERTA
// ============================================================
async function iniciarConsultaAbierta(chatId: string, conv: any) {
  await upsertSesion(conv.id, { flow_step: "consulta_abierta" });
  await enviarTelegramConBotones(
    chatId,
    "Cuéntame en qué te puedo ayudar. Puedes preguntarme sobre servicios, precios, preparación para estudios, o lo que necesites 💬",
    [
      [
        { text: "💊 Precios", callback_data: "consulta_tema:precios" },
        { text: "📍 Ubicación / Horarios", callback_data: "consulta_tema:ubicacion" },
      ],
      [
        { text: "🗓 Mejor agendar cita", callback_data: "menu_agendar:" },
        { text: "🧑 Hablar con alguien", callback_data: "humano:" },
      ],
      [{ text: "← Menú principal", callback_data: "menu_principal:" }],
    ]
  );
}

async function manejarTemaCon(chatId: string, conv: any, tema: string) {
  const textoTema = tema === "precios"
    ? "Quiero saber sobre precios y servicios disponibles"
    : "Quiero saber la ubicación y horarios de la clínica";
  await guardarMensajeUsuario(conv.id, textoTema, { type: "button" });
  await manejarConsultaAbierta(chatId, conv, textoTema);
}

async function manejarConsultaAbierta(chatId: string, conv: any, text: string) {
  let respuesta = "";
  try {
    respuesta = await correrAgenteConsulta(conv, chatId, text);
  } catch (err) {
    console.error("consulta abierta error:", err);
    respuesta = "No pude procesar tu consulta. ¿Te ayudo a agendar una cita?";
  }
  if (respuesta) {
    await guardarMensajeAsistente(conv.id, respuesta);
    await enviarTelegramConBotones(chatId, respuesta, [
      [
        { text: "🗓 Agendar cita", callback_data: "menu_agendar:" },
        { text: "🧑 Hablar con alguien", callback_data: "humano:" },
      ],
      [{ text: "← Menú principal", callback_data: "menu_principal:" }],
    ]);
  }
  await actualizarMemoria(conv.identidad_canal_id, conv.id);
}

// ============================================================
// v8: OTRO
// ============================================================
async function manejarOtro(chatId: string, conv: any) {
  await enviarTelegramConBotones(chatId, "¿En qué te puedo ayudar?", [
    [
      { text: "🔄 Reagendar mi cita", callback_data: "reagendar:" },
      { text: "💳 Información de pagos", callback_data: "humano_razon:pagos" },
    ],
    [
      { text: "📋 Resultados de estudios", callback_data: "humano_razon:resultados" },
      { text: "🔁 Receta / Medicamentos", callback_data: "humano_razon:receta" },
    ],
    [
      { text: "💬 Escribir mi consulta", callback_data: "consulta:" },
      { text: "🧑 Hablar con alguien", callback_data: "humano:" },
    ],
    [{ text: "← Menú principal", callback_data: "menu_principal:" }],
  ]);
}

// ============================================================
// v8: HABLAR CON HUMANO
// ============================================================
async function manejarSolicitudHumano(chatId: string, conv: any) {
  await escalarConversacion(conv, { razon: "Solicitado por botón" });
  await guardarMensajeAsistente(conv.id, "Listo, recepción te contactará en breve.");
  await enviarTelegram(chatId, "✅ Listo. Recepción te contactará en breve.\n\nSi quieres iniciar otra consulta, solo dime \"nueva consulta\".");
}

async function manejarSolicitudHumanoConRazon(chatId: string, conv: any, razon: string) {
  const razones: Record<string, string> = {
    cambio_cita: "Paciente quiere cambiar una cita",
    pagos: "Consulta sobre pagos",
    resultados: "Solicita resultados de estudios",
    receta: "Solicita receta o información de medicamentos",
  };
  await escalarConversacion(conv, { razon: razones[razon] ?? razon });
  await guardarMensajeAsistente(conv.id, "Listo, recepción te contactará en breve.");
  await enviarTelegram(chatId, "✅ Listo. Recepción te contactará en breve.\n\nSi quieres iniciar otra consulta, solo dime \"nueva consulta\".");
}

// ============================================================
// v8: VER MI CITA
// ============================================================
async function verMiCita(chatId: string, conv: any) {
  const { data: identidad } = await supabase
    .from("identidades_canal").select("patient_id").eq("id", conv.identidad_canal_id).single();

  if (!identidad?.patient_id) {
    return enviarTelegramConBotones(chatId, "No encontré citas registradas a tu nombre.", [
      [{ text: "🗓 Agendar cita", callback_data: "menu_agendar:" }],
      [{ text: "← Menú principal", callback_data: "menu_principal:" }],
    ]);
  }

  const { data: citas } = await supabase
    .from("appointments")
    .select("id, fecha_inicio, status, doctors(nombre, apellidos), servicios(nombre)")
    .eq("patient_id", identidad.patient_id)
    .gte("fecha_inicio", new Date().toISOString())
    .not("status", "in", "(cancelada,liberada)")
    .order("fecha_inicio", { ascending: true })
    .limit(3);

  if (!citas || citas.length === 0) {
    return enviarTelegramConBotones(chatId, "No tienes citas próximas registradas.", [
      [{ text: "🗓 Agendar nueva cita", callback_data: "menu_agendar:" }],
      [{ text: "← Menú principal", callback_data: "menu_principal:" }],
    ]);
  }

  let msg = "*Tus próximas citas:*\n\n";
  for (const c of citas) {
    const fecha = new Date(c.fecha_inicio).toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    });
    const doc = c.doctors ? `Dr. ${(c.doctors as any).nombre} ${(c.doctors as any).apellidos}` : "—";
    msg += `📅 ${fecha}\n🩺 ${(c.servicios as any)?.nombre ?? "—"}\n👨‍⚕️ ${doc}\nEstado: *${c.status}*\n\n`;
  }

  await enviarTelegramConBotones(chatId, msg, [
    [
      { text: "🗓 Agendar otra cita", callback_data: "menu_agendar:" },
      { text: "🔄 Cambiar fecha/hora", callback_data: "reagendar:" },
    ],
    [
      { text: "❌ Cancelar cita", callback_data: "cancelar_cita:" },
      { text: "🧑 Hablar con alguien", callback_data: "humano:" },
    ],
    [{ text: "← Menú principal", callback_data: "menu_principal:" }],
  ]);
}

// ============================================================
// v8: CANCELAR CITA
// ============================================================
async function iniciarCancelacionCita(chatId: string, conv: any) {
  const { data: identidad } = await supabase
    .from("identidades_canal").select("patient_id").eq("id", conv.identidad_canal_id).single();

  if (!identidad?.patient_id) {
    return enviarTelegramConBotones(chatId, "No encontré citas a tu nombre.", [
      [{ text: "← Menú principal", callback_data: "menu_principal:" }],
    ]);
  }

  const { data: citas } = await supabase
    .from("appointments")
    .select("id, fecha_inicio, servicios(nombre)")
    .eq("patient_id", identidad.patient_id)
    .gte("fecha_inicio", new Date().toISOString())
    .not("status", "in", "(cancelada,liberada)")
    .order("fecha_inicio", { ascending: true })
    .limit(3);

  if (!citas || citas.length === 0) {
    return enviarTelegramConBotones(chatId, "No tienes citas próximas para cancelar.", [
      [{ text: "← Menú principal", callback_data: "menu_principal:" }],
    ]);
  }

  const rows = citas.map((c: any) => {
    const fecha = new Date(c.fecha_inicio).toLocaleString("es-MX", {
      timeZone: "America/Mexico_City", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    });
    return [{ text: `❌ ${fecha} — ${c.servicios?.nombre ?? "Cita"}`, callback_data: `cancelar_id:${c.id}` }];
  });
  rows.push([{ text: "← Menú principal", callback_data: "menu_principal:" }]);

  await enviarTelegramConBotones(chatId, "¿Qué cita quieres cancelar?", rows);
}

async function confirmarCancelacionCita(chatId: string, conv: any, citaId: string) {
  const { data: identidad } = await supabase
    .from("identidades_canal").select("patient_id").eq("id", conv.identidad_canal_id).single();
  const { data: cita } = await supabase
    .from("appointments").select("id, patient_id, fecha_inicio, servicios(nombre)").eq("id", citaId).single();

  if (!cita || cita.patient_id !== identidad?.patient_id) {
    return enviarTelegram(chatId, "No encontré esa cita.");
  }

  const { data: citaPreCancel } = await supabase
    .from("appointments").select("google_event_id, doctor_id").eq("id", citaId).maybeSingle();

  const { error } = await supabase.from("appointments").update({ status: "cancelada" }).eq("id", citaId);
  if (error) return enviarTelegram(chatId, "No pude cancelar. Por favor llama a recepción.");

  // Cancel pending reminders so they don't fire after the appointment is cancelled.
  await supabase.from("recordatorios_cita")
    .update({ status: "cancelado" })
    .eq("appointment_id", citaId)
    .eq("status", "pendiente");

  // Eliminar evento de Google Calendar del doctor (await — IIFE fire-and-forget muere con el runtime)
  try {
    if (citaPreCancel?.google_event_id && citaPreCancel?.doctor_id) {
      const cal = await getDoctorCalendar(citaPreCancel.doctor_id);
      if (cal) await deleteCalendarEvent(cal, citaPreCancel.google_event_id);
    }
  } catch (e) {
    console.error("[GCal] cancelar evento", citaId, e);
    await supabase.from("appointments").update({ gcal_last_error: String(e) }).eq("id", citaId).catch(() => {});
  }

  await registrarAudit(conv, "cita_cancelada_bot", { cita_id: citaId });

  const fecha = new Date(cita.fecha_inicio).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City", weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });

  await enviarTelegramConBotones(chatId,
    `✅ Cita cancelada:\n📅 ${fecha}\n🩺 ${(cita.servicios as any)?.nombre ?? "—"}\n\n¿Quieres agendar otra?`,
    [
      [{ text: "🗓 Agendar nueva cita", callback_data: "menu_agendar:" }],
      [{ text: "← Menú principal", callback_data: "menu_principal:" }],
    ]
  );
}

// ============================================================
// REAGENDAR
// ============================================================
async function iniciarReagendarCita(chatId: string, conv: any) {
  const { data: identidad } = await supabase
    .from("identidades_canal").select("patient_id").eq("id", conv.identidad_canal_id).single();

  if (!identidad?.patient_id) {
    return enviarTelegramConBotones(chatId, "No encontré citas a tu nombre.", [
      [{ text: "← Menú principal", callback_data: "menu_principal:" }],
    ]);
  }

  const { data: citas } = await supabase
    .from("appointments")
    .select("id, fecha_inicio, servicio_id, servicios(nombre)")
    .eq("patient_id", identidad.patient_id)
    .gte("fecha_inicio", new Date().toISOString())
    .not("status", "in", "(cancelada,liberada)")
    .order("fecha_inicio", { ascending: true })
    .limit(3);

  if (!citas || citas.length === 0) {
    return enviarTelegramConBotones(chatId, "No tienes citas próximas para reagendar.", [
      [{ text: "← Menú principal", callback_data: "menu_principal:" }],
    ]);
  }

  const rows = citas.map((c: any) => {
    const fecha = new Date(c.fecha_inicio).toLocaleString("es-MX", {
      timeZone: "America/Mexico_City", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    });
    return [{ text: `🔄 ${fecha} — ${c.servicios?.nombre ?? "Cita"}`, callback_data: `reagendar_pick:${c.id}` }];
  });
  rows.push([{ text: "← Menú principal", callback_data: "menu_principal:" }]);

  await enviarTelegramConBotones(chatId, "¿Qué cita quieres cambiar de fecha?", rows);
}

async function mostrarSlotsReagendar(chatId: string, conv: any, citaId: string) {
  const { data: identidad } = await supabase
    .from("identidades_canal").select("patient_id").eq("id", conv.identidad_canal_id).single();
  const { data: cita } = await supabase
    .from("appointments").select("id, patient_id, servicio_id, servicios(nombre)").eq("id", citaId).single();

  if (!cita || cita.patient_id !== identidad?.patient_id) {
    return enviarTelegram(chatId, "No encontré esa cita.");
  }

  const result = await listarHorariosDisponibles({ servicio_id: cita.servicio_id, dias_adelante: 14 });
  if ((result as any).error) return enviarTelegram(chatId, "Error consultando horarios. Intenta de nuevo.");

  const horarios = (result as any).horarios ?? [];
  if (horarios.length === 0) {
    return enviarTelegramConBotones(chatId, "No hay horarios disponibles en los próximos 14 días.", [
      [{ text: "← Volver", callback_data: "reagendar:" }],
      [{ text: "🧑 Hablar con alguien", callback_data: "humano:" }],
    ]);
  }

  const slotMap: Record<string, any> = {};
  const rows = horarios.slice(0, 8).map((h: any, idx: number) => {
    const key = String(idx);
    slotMap[key] = { fecha_inicio: h.fecha_inicio, doctor_id: h.doctor_id, doctor_nombre: h.doctor_nombre, fecha_local: h.fecha_local };
    return [{ text: `${h.fecha_local} · ${h.doctor_nombre}`, callback_data: `reagendar_slot:${citaId}:${key}` }];
  });
  rows.push([
    { text: "← Volver", callback_data: "reagendar:" },
    { text: "🧑 Hablar con alguien", callback_data: "humano:" },
  ]);

  await upsertSesion(conv.id, {
    flow_data: { ...(await obtenerSesion(conv.id))?.flow_data ?? {}, reagendar_slots: slotMap, reagendar_cita_id: citaId },
  });

  const svcNombre = (cita.servicios as any)?.nombre ?? "tu cita";
  await enviarTelegramConBotones(chatId, `Elige el nuevo horario para *${svcNombre}*:`, rows);
}

async function confirmarReagendar(chatId: string, conv: any, arg: string) {
  const [citaId, slotKey] = arg.split(":");
  if (!citaId || slotKey === undefined) return enviarTelegram(chatId, "Dato inválido. Intenta de nuevo.");

  const { data: identidad } = await supabase
    .from("identidades_canal").select("patient_id").eq("id", conv.identidad_canal_id).single();
  const { data: cita } = await supabase
    .from("appointments").select("id, patient_id, servicio_id, servicios(nombre, duracion_minutos)").eq("id", citaId).single();

  if (!cita || cita.patient_id !== identidad?.patient_id) {
    return enviarTelegram(chatId, "No encontré esa cita.");
  }

  const sesion = await obtenerSesion(conv.id);
  const slot = sesion?.flow_data?.reagendar_slots?.[slotKey];
  if (!slot) return enviarTelegramConBotones(chatId, "El horario ya no está disponible.", [
    [{ text: "🔄 Elegir otro horario", callback_data: `reagendar_pick:${citaId}` }],
    [{ text: "← Menú principal", callback_data: "menu_principal:" }],
  ]);

  const duracion = (cita.servicios as any)?.duracion_minutos ?? 30;
  const inicio   = new Date(slot.fecha_inicio);
  const fin      = new Date(inicio.getTime() + duracion * 60000);

  const { error: eu } = await supabase.from("appointments").update({
    fecha_inicio: inicio.toISOString(),
    fecha_fin:    fin.toISOString(),
    doctor_id:    slot.doctor_id,
  }).eq("id", citaId);

  if (eu) {
    if (eu.code === "23P01" || /exclude|exclusion/i.test(eu.message)) {
      // Fetch next available slots and offer them immediately
      const nextResult = await listarHorariosDisponibles({ servicio_id: cita.servicio_id, dias_adelante: 14 });
      const siguientes = (nextResult as any).horarios ?? [];
      if (siguientes.length > 0) {
        const slotMap2: Record<string, any> = {};
        const rows2 = siguientes.slice(0, 6).map((h: any, idx: number) => {
          const k = String(idx);
          slotMap2[k] = { fecha_inicio: h.fecha_inicio, doctor_id: h.doctor_id, doctor_nombre: h.doctor_nombre, fecha_local: h.fecha_local };
          return [{ text: `${h.fecha_local} · ${h.doctor_nombre}`, callback_data: `reagendar_slot:${citaId}:${k}` }];
        });
        rows2.push([{ text: "← Volver", callback_data: "reagendar:" }]);
        await upsertSesion(conv.id, {
          flow_data: { ...(await obtenerSesion(conv.id))?.flow_data ?? {}, reagendar_slots: slotMap2, reagendar_cita_id: citaId },
        });
        return enviarTelegramConBotones(chatId, "⚠️ Ese horario acaba de ser tomado. Elige otro:", rows2);
      }
      return enviarTelegramConBotones(chatId, "⚠️ Ese horario ya fue tomado y no hay más en 14 días.", [
        [{ text: "🧑 Hablar con alguien", callback_data: "humano:" }],
      ]);
    }
    return enviarTelegram(chatId, "No pude reagendar. Por favor llama a recepción.");
  }

  // Actualizar recordatorios: cancelar los viejos e insertar nuevos
  await supabase.from("recordatorios_cita").update({ status: "cancelado" }).eq("appointment_id", citaId).eq("status", "pendiente");
  const ahora = new Date();
  const nuevosRecs: any[] = [];
  const rec24h = new Date(inicio.getTime() - 24 * 3600000);
  if (rec24h > ahora) nuevosRecs.push({ appointment_id: citaId, identidad_canal_id: conv.identidad_canal_id, programado_para: rec24h.toISOString(), tipo: "t24h", status: "pendiente" });
  const rec2h = new Date(inicio.getTime() - 2 * 3600000);
  if (rec2h > ahora) nuevosRecs.push({ appointment_id: citaId, identidad_canal_id: conv.identidad_canal_id, programado_para: rec2h.toISOString(), tipo: "t2h", status: "pendiente" });
  if (nuevosRecs.length) await supabase.from("recordatorios_cita").insert(nuevosRecs);

  await registrarAudit(conv, "cita_reagendada_bot", { cita_id: citaId, nuevo_slot: slot.fecha_inicio });

  // Actualizar evento de Google Calendar del doctor (await — IIFE fire-and-forget muere con el runtime)
  try {
    const { data: citaGcal } = await supabase
      .from("appointments").select("google_event_id, doctor_id").eq("id", citaId).maybeSingle();
    if (citaGcal?.google_event_id && citaGcal?.doctor_id) {
      const cal = await getDoctorCalendar(citaGcal.doctor_id);
      if (cal) {
        await updateCalendarEvent(cal, citaGcal.google_event_id, {
          summary: `Cita: ${(cita.servicios as any)?.nombre ?? "Consulta"} (reagendada)`,
          description: `Cita reagendada vía Bot Telegram`,
          startIso: inicio.toISOString(),
          endIso: fin.toISOString(),
        });
      }
    }
  } catch (e) {
    console.error("[GCal] reagendar evento", citaId, e);
    await supabase.from("appointments").update({ gcal_last_error: String(e) }).eq("id", citaId).catch(() => {});
  }

  const fechaStr = inicio.toLocaleString("es-MX", {
    timeZone: "America/Mexico_City", weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });

  await enviarTelegramConBotones(chatId,
    `✅ Cita reagendada:\n📅 ${fechaStr}\n👨‍⚕️ ${slot.doctor_nombre}\n🩺 ${(cita.servicios as any)?.nombre ?? "—"}`,
    [
      [{ text: "🗓 Ver mis citas", callback_data: "ver_cita:" }],
      [{ text: "← Menú principal", callback_data: "menu_principal:" }],
    ]
  );
}

// ============================================================
// SERVICIOS
// ============================================================
async function enviarServiciosDeCategoria(chatId: string, conv: any, catKey: string) {
  const cat = CATEGORIAS[catKey];
  if (!cat) return enviarMenuCategorias(chatId, "Categoría no reconocida:");

  const [validIds, svcResult] = await Promise.all([
    getServiciosConDoctorActivo(),
    supabase
      .from("servicios")
      .select("id, nombre, duracion_minutos, precio_centavos, especialidad")
      .eq("activo", true)
      .in("especialidad", cat.especialidades),
  ]);

  const vistos = new Set<string>();
  const lista = ((svcResult.data ?? []) as any[]).filter((s) => {
    if (!validIds.has(s.id) || vistos.has(s.id)) return false;
    vistos.add(s.id);
    return true;
  });

  if (lista.length === 0) {
    return enviarTelegramConBotones(chatId, "No hay servicios disponibles en esta categoría ahora.", [
      [{ text: "← Volver", callback_data: "menu_agendar:" }],
      [{ text: "🧑 Hablar con alguien", callback_data: "humano:" }],
    ]);
  }

  const rows = lista.map((s: any) => {
    const precio = s.precio_centavos ? `$${(s.precio_centavos / 100).toLocaleString("es-MX")}` : "—";
    return [{ text: `${s.nombre} — ${s.duracion_minutos} min / ${precio}`, callback_data: `srv:${s.id}` }];
  });
  rows.push([
    { text: "← Volver", callback_data: "menu_agendar:" },
    { text: "🧑 Hablar con alguien", callback_data: "humano:" },
  ]);

  await enviarTelegramConBotones(chatId, `${cat.label}\nElige un servicio:`, rows);
}

function formatDayLabel(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00" + MX_TZ_OFFSET);
  return d.toLocaleDateString("es-MX", {
    weekday: "short", day: "numeric", month: "short", timeZone: "America/Mexico_City",
  });
}

async function enviarHorariosDeServicio(chatId: string, conv: any, servicioId: string) {
  const result = await listarHorariosDisponibles({ servicio_id: servicioId, dias_adelante: 14, max_horarios: 200 });
  if ((result as any).error) return enviarTelegram(chatId, "Error consultando horarios. Intenta de nuevo.");

  const horarios: any[] = (result as any).horarios ?? [];
  if (horarios.length === 0) {
    return enviarTelegramConBotones(chatId, "No encontré horarios disponibles en los próximos 14 días.", [
      [{ text: "← Volver", callback_data: "menu_agendar:" }],
      [{ text: "🧑 Hablar con alguien", callback_data: "humano:" }],
    ]);
  }

  const { data: svc } = await supabase.from("servicios").select("nombre").eq("id", servicioId).single();

  // Store ALL slots indexed so mostrarSlotsDia can look them up by key
  const slotMap: Record<string, any> = {};
  for (let i = 0; i < horarios.length; i++) {
    const h = horarios[i];
    slotMap[String(i)] = {
      fecha_inicio: h.fecha_inicio,
      doctor_id: h.doctor_id,
      doctor_nombre: h.doctor_nombre,
      fecha_local: h.fecha_local,
    };
  }

  await upsertSesion(conv.id, {
    servicio_id: servicioId,
    flow_step: "await_day_pick",
    flow_data: { servicio_nombre: svc?.nombre, slots: slotMap },
  });

  // Group slots by CDMX calendar date
  const byDay: Record<string, boolean> = {};
  for (const h of horarios) {
    const dayKey = new Date(h.fecha_inicio).toLocaleDateString("sv-SE", { timeZone: "America/Mexico_City" });
    byDay[dayKey] = true;
  }
  const days = Object.keys(byDay).sort();

  // Build day selection buttons (2 per row)
  const rows: any[] = [];
  for (let i = 0; i < days.length; i += 2) {
    const row: any[] = [{ text: formatDayLabel(days[i]), callback_data: `dia:${days[i]}:${servicioId}` }];
    if (days[i + 1]) row.push({ text: formatDayLabel(days[i + 1]), callback_data: `dia:${days[i + 1]}:${servicioId}` });
    rows.push(row);
  }
  rows.push([
    { text: "← Volver", callback_data: "menu_agendar:" },
    { text: "🧑 Hablar con alguien", callback_data: "humano:" },
  ]);

  await enviarTelegramConBotones(chatId, `*${svc?.nombre ?? ""}* — ¿Qué día te viene mejor?`, rows);
}

async function mostrarSlotsDia(chatId: string, conv: any, arg: string) {
  // arg = "YYYY-MM-DD:servicio-uuid"
  const colonIdx = arg.indexOf(":");
  const dayKey = arg.slice(0, colonIdx);
  const servicioId = arg.slice(colonIdx + 1);

  const sesion = await obtenerSesion(conv.id);
  const slotMap: Record<string, any> = sesion?.flow_data?.slots ?? {};

  // Filter slots for this CDMX date
  const daySlots = Object.entries(slotMap)
    .filter(([, h]) => {
      const d = new Date((h as any).fecha_inicio)
        .toLocaleDateString("sv-SE", { timeZone: "America/Mexico_City" });
      return d === dayKey;
    })
    .sort(([, a], [, b]) => (a as any).fecha_inicio.localeCompare((b as any).fecha_inicio));

  if (daySlots.length === 0) {
    return enviarTelegramConBotones(chatId, "Ya no hay horarios disponibles ese día.", [
      [{ text: "← Ver otros días", callback_data: `srv:${servicioId}` }],
    ]);
  }

  const diaLabel = new Date(dayKey + "T12:00:00" + MX_TZ_OFFSET).toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", timeZone: "America/Mexico_City",
  });

  // Multiple doctors on same day? Show doctor name in button text
  const doctoresUnicos = new Set(daySlots.map(([, h]) => (h as any).doctor_id));
  const mostrarDoc = doctoresUnicos.size > 1;

  const rows: any[] = [];
  for (let i = 0; i < daySlots.length; i += 2) {
    const [key0, slot0] = daySlots[i] as [string, any];
    const hora0 = new Date(slot0.fecha_inicio).toLocaleTimeString("es-MX", {
      hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Mexico_City",
    });
    const lbl0 = mostrarDoc ? `${hora0} · ${slot0.doctor_nombre.split("·")[0].trim()}` : hora0;
    const row: any[] = [{ text: lbl0, callback_data: `slot:${key0}` }];

    if (daySlots[i + 1]) {
      const [key1, slot1] = daySlots[i + 1] as [string, any];
      const hora1 = new Date(slot1.fecha_inicio).toLocaleTimeString("es-MX", {
        hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Mexico_City",
      });
      const lbl1 = mostrarDoc ? `${hora1} · ${slot1.doctor_nombre.split("·")[0].trim()}` : hora1;
      row.push({ text: lbl1, callback_data: `slot:${key1}` });
    }
    rows.push(row);
  }
  rows.push([{ text: "← Ver otros días", callback_data: `srv:${servicioId}` }]);

  await upsertSesion(conv.id, { flow_step: "await_slot_pick" });
  await enviarTelegramConBotones(chatId, `📅 *${diaLabel}* — Elige un horario:`, rows);
}

// ============================================================
// WIZARD DE CAPTURA
// ============================================================
async function iniciarCapturaPaciente(chatId: string, conv: any, slotKey: string) {
  const sesion = await obtenerSesion(conv.id);
  const slot = sesion?.flow_data?.slots?.[slotKey];
  if (!slot) return enviarMenuCategorias(chatId, "Horario no disponible. Elige otra categoría:");

  const nuevoData = { ...(sesion?.flow_data ?? {}), fecha_local: slot.fecha_local, doctor_nombre: slot.doctor_nombre, slot_fecha_iso: slot.fecha_inicio };
  delete (nuevoData as any).slots;

  await upsertSesion(conv.id, { doctor_id: slot.doctor_id, slot_propuesto: slot.fecha_inicio, flow_data: nuevoData });

  // Si ya conocemos al paciente, pre-llenar y saltar al consentimiento
  const { data: identidad } = await supabase.from("identidades_canal").select("patient_id").eq("id", conv.identidad_canal_id).single();
  if (identidad?.patient_id) {
    const { data: pac } = await supabase.from("patients").select("nombre, apellidos, fecha_nacimiento, sexo").eq("id", identidad.patient_id).single();
    if (pac?.nombre && pac?.apellidos) {
      const borrador = { nombre: pac.nombre, apellidos: pac.apellidos, fecha_nacimiento: pac.fecha_nacimiento ?? null, sexo: pac.sexo ?? null };
      await upsertSesion(conv.id, { borrador_paciente: borrador, flow_step: "await_consent" });
      const resumenPac = `*${pac.nombre} ${pac.apellidos}*${pac.fecha_nacimiento ? ` · ${formatFechaMX(pac.fecha_nacimiento)}` : ""}${pac.sexo ? ` · ${pac.sexo}` : ""}`;
      return enviarTelegramConBotones(
        chatId,
        `Reservado: *${nuevoData.fecha_local}* con *${nuevoData.doctor_nombre}*.\n\n✅ Te reconocemos: ${resumenPac}\n\nTus datos se usan únicamente para tu atención médica, conforme a la NOM-004-SSA3-2012 y la LFPDPPP. ¿Aceptas?`,
        [[{ text: "✅ Sí, acepto", callback_data: "consent:yes" }, { text: "❌ No", callback_data: "consent:no" }]]
      );
    }
  }

  await upsertSesion(conv.id, { flow_step: "await_nombre" });
  await enviarTelegramConBotones(
    chatId,
    `Reservado: *${nuevoData.fecha_local}* con *${nuevoData.doctor_nombre}*.\n\nNecesito 4 datos. Primero: ¿cuál es tu *nombre*?`,
    [[{ text: "❌ Cancelar", callback_data: "menu_principal:" }]]
  );
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
      const palabras = v.split(/\s+/);
      const pareceNombre = v.length >= 2 && v.length <= 30 && palabras.length <= 3 && /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/i.test(v);
      if (!pareceNombre) return enviarTelegramConBotones(chatId, "Solo escribe tu *nombre*, por ejemplo: María\n¿Cuál es tu nombre?", [[{ text: "❌ Cancelar", callback_data: "menu_principal:" }]]);
      borrador.nombre = v;
      await upsertSesion(conv.id, { borrador_paciente: borrador, flow_step: "await_apellidos" });
      return enviarTelegram(chatId, "Gracias. ¿Tus *apellidos*?");
    }
    case "await_apellidos": {
      const v = text.trim();
      const palabrasAp = v.split(/\s+/);
      const pareceApellido = v.length >= 2 && v.length <= 40 && palabrasAp.length <= 3 && /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/i.test(v);
      if (!pareceApellido) return enviarTelegram(chatId, "Solo escribe tus *apellidos*, por ejemplo: García López");
      if (v.length < 2) return enviarTelegram(chatId, "Necesito apellidos válidos.");
      borrador.apellidos = v;
      await upsertSesion(conv.id, { borrador_paciente: borrador, flow_step: "await_fecha", flow_data: { ...data, fecha_intentos: 0 } });
      return enviarTelegram(chatId, "¿Tu *fecha de nacimiento*? Formato libre: 12/10/1981, 12 de octubre 1981, etc.");
    }
    case "await_fecha": {
      const iso = await parseFechaFlexible(text);
      const intentos = (data.fecha_intentos ?? 0) + 1;
      if (!iso) {
        if (intentos >= 3) {
          await upsertSesion(conv.id, { flow_data: { ...data, fecha_intentos: intentos } });
          return enviarTelegramConBotones(chatId, "No logré entender la fecha. Continuemos sin ella:", [[{ text: "⏭️ Omitir", callback_data: "skip:fecha" }]]);
        }
        await upsertSesion(conv.id, { flow_data: { ...data, fecha_intentos: intentos } });
        return enviarTelegramConBotones(chatId, "No entendí esa fecha. Intenta: 12/10/1981", [[{ text: "⏭️ Omitir", callback_data: "skip:fecha" }]]);
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
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) borrador.email = v;
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
  await enviarTelegramConBotones(chatId, "¿Quieres agregar datos opcionales a tu expediente?", [[
    { text: "➕ Agregar más datos", callback_data: "extra:yes" },
    { text: "⏭️ Más tarde", callback_data: "extra:no" },
  ]]);
}

async function wizardDecisionExtra(chatId: string, conv: any, val: string) {
  if (val === "no") return preguntarConsentimiento(chatId, conv);
  await upsertSesion(conv.id, { flow_step: "await_ciudad" });
  await enviarTelegramConBotones(chatId, "¿En qué *ciudad* vives?", [[{ text: "Saltar", callback_data: "skip:ciudad" }]]);
}

async function preguntarEmail(chatId: string) {
  await enviarTelegramConBotones(chatId, "¿Cuál es tu *email*?", [[{ text: "Saltar", callback_data: "skip:email" }]]);
}

async function preguntarAlergias(chatId: string) {
  await enviarTelegramConBotones(chatId, "¿Tienes *alergias* conocidas?", [[
    { text: "Sin alergias", callback_data: "alergias:none" },
    { text: "Tengo alergias", callback_data: "alergias:yes" },
    { text: "Saltar", callback_data: "alergias:skip" },
  ]]);
}

async function wizardSkip(chatId: string, conv: any, campo: string) {
  switch (campo) {
    case "fecha":    await upsertSesion(conv.id, { flow_step: "await_sexo" }); return preguntarSexo(chatId);
    case "ciudad":   await upsertSesion(conv.id, { flow_step: "await_email" }); return preguntarEmail(chatId);
    case "email":    await upsertSesion(conv.id, { flow_step: "await_alergias_choice" }); return preguntarAlergias(chatId);
    case "alergias": return preguntarConsentimiento(chatId, conv);
  }
}

async function wizardAlergias(chatId: string, conv: any, val: string) {
  const sesion = await obtenerSesion(conv.id);
  const borrador = sesion?.borrador_paciente ?? {};
  if (val === "none") { borrador.alergias = "Sin alergias"; await upsertSesion(conv.id, { borrador_paciente: borrador }); return preguntarConsentimiento(chatId, conv); }
  if (val === "skip") return preguntarConsentimiento(chatId, conv);
  await upsertSesion(conv.id, { flow_step: "await_alergias_texto" });
  return enviarTelegramConBotones(chatId, "Cuéntame qué alergias tienes:", [[{ text: "Saltar", callback_data: "skip:alergias" }]]);
}

async function preguntarConsentimiento(chatId: string, conv: any) {
  await upsertSesion(conv.id, { flow_step: "await_consent" });
  await enviarTelegramConBotones(chatId,
    "Tus datos se usan únicamente para tu atención médica, conforme a la NOM-004-SSA3-2012 y la LFPDPPP. ¿Aceptas?",
    [[{ text: "✅ Sí, acepto", callback_data: "consent:yes" }, { text: "❌ No", callback_data: "consent:no" }]]
  );
}

async function wizardConsent(chatId: string, conv: any, val: string) {
  if (val === "no") {
    await limpiarSesion(conv.id);
    return enviarTelegram(chatId, "Entendido. Sin consentimiento no puedo agendar. Cuando quieras retomar, solo escríbeme \"hola\".");
  }
  await upsertSesion(conv.id, { consentimiento_dado: true, consentimiento_fecha: new Date().toISOString(), flow_step: "await_confirm" });
  return mostrarConfirmacion(chatId, conv);
}

async function mostrarConfirmacion(chatId: string, conv: any) {
  const sesion = await obtenerSesion(conv.id);
  const d = sesion?.flow_data ?? {};
  const b = sesion?.borrador_paciente ?? {};
  const resumen =
    `*Resumen de tu cita*\n\n🩺 ${d.servicio_nombre}\n👨‍⚕️ ${d.doctor_nombre}\n📅 ${d.fecha_local}\n\n` +
    `👤 ${b.nombre} ${b.apellidos}\n` +
    (b.fecha_nacimiento ? `🎂 ${formatFechaMX(b.fecha_nacimiento)}\n` : "") +
    (b.sexo ? `⚧ ${b.sexo}\n` : "");
  await enviarTelegramConBotones(chatId, resumen, [[
    { text: "✅ Confirmar", callback_data: "confirm:yes" },
    { text: "❌ Cancelar", callback_data: "confirm:no" },
  ]]);
}

async function wizardConfirm(chatId: string, conv: any, val: string) {
  if (val === "no") {
    await limpiarSesion(conv.id);
    return enviarTelegramConBotones(chatId, "Cita cancelada. ¿Qué más puedo hacer por ti?", [
      [{ text: "🗓 Agendar otra", callback_data: "menu_agendar:" }],
      [{ text: "← Menú principal", callback_data: "menu_principal:" }],
    ]);
  }
  // Optimistic lock: atomically flip flow_step to "procesando_cita".
  // Telegram can retry the same callback to a different Edge Function instance where
  // processedCallbackIds Set is empty. Only the first update wins; retries get nothing.
  const { data: locked } = await supabase
    .from("bot_sesiones")
    .update({ flow_step: "procesando_cita" })
    .eq("conversacion_id", conv.id)
    .eq("flow_step", "await_confirm")
    .select("id")
    .maybeSingle();
  if (!locked) return; // already processed by a concurrent/retry request

  // Read session data before creating — needed to build GCal link
  const sesionParaGcal = await obtenerSesion(conv.id);
  const result = await crearCitaDesdeSesion(conv);
  if ((result as any).error) {
    const esSlotTomado = (result as any).slotTomado === true;
    if (esSlotTomado) {
      // Slot taken: re-fetch next available slots for same service and offer them
      const sesion = await obtenerSesion(conv.id);
      const servicioId = sesion?.servicio_id;
      if (servicioId) {
        const nextResult = await listarHorariosDisponibles({ servicio_id: servicioId, dias_adelante: 14 });
        const siguientes = (nextResult as any).horarios ?? [];
        if (siguientes.length > 0) {
          const slotMap: Record<string, any> = {};
          const rows = siguientes.slice(0, 6).map((h: any, idx: number) => {
            const key = String(idx);
            slotMap[key] = { fecha_inicio: h.fecha_inicio, doctor_id: h.doctor_id, doctor_nombre: h.doctor_nombre, fecha_local: h.fecha_local };
            return [{ text: `${h.fecha_local} · ${h.doctor_nombre}`, callback_data: `slot:${key}` }];
          });
          rows.push([{ text: "← Ver categorías", callback_data: "menu_agendar:" }]);
          await upsertSesion(conv.id, { flow_step: "await_slot_pick", flow_data: { ...(sesion?.flow_data ?? {}), slots: slotMap } });
          return enviarTelegramConBotones(chatId,
            "⚠️ Ese horario acaba de ser tomado por otro paciente. Elige uno disponible:",
            rows
          );
        }
      }
      return enviarTelegramConBotones(chatId, "⚠️ Ese horario ya fue tomado. No encontré más slots en los próximos días.", [
        [{ text: "🔄 Buscar otra fecha", callback_data: "menu_agendar:" }],
        [{ text: "🧑 Hablar con alguien", callback_data: "humano:" }],
      ]);
    }
    return enviarTelegramConBotones(chatId, `No pude crear la cita: ${(result as any).error}.`, [
      [{ text: "🔄 Intentar de nuevo", callback_data: "menu_agendar:" }],
      [{ text: "🧑 Hablar con alguien", callback_data: "humano:" }],
    ]);
  }
  await limpiarSesion(conv.id);

  let mensajeConfirmacion =
    "✅ ¡Tu cita quedó *CONFIRMADA*! Te enviaremos un recordatorio antes de tu cita.\n\nSi necesitas cambiar algo o hablar con una persona, solo dímelo.";

  try {
    const slotInicio = sesionParaGcal?.slot_propuesto;
    const servicioNombre = sesionParaGcal?.flow_data?.servicio_nombre ?? "Cita médica";
    const doctorNombre = sesionParaGcal?.flow_data?.doctor_nombre ?? "";
    if (slotInicio) {
      const { data: svcDur } = await supabase
        .from("servicios")
        .select("duracion_minutos")
        .eq("id", sesionParaGcal?.servicio_id)
        .single();
      const durMin = svcDur?.duracion_minutos ?? 30;
      const finIso = new Date(new Date(slotInicio).getTime() + durMin * 60000).toISOString();
      const gcalLink = buildGCalLink({
        titulo: `Cita: ${servicioNombre}`,
        fechaInicio: slotInicio,
        fechaFin: finIso,
        descripcion: doctorNombre ? `${doctorNombre} · ${CLINIC_NAME}` : CLINIC_NAME,
        ubicacion: CLINIC_NAME,
      });
      mensajeConfirmacion += `\n\n📅 [Agregar a Google Calendar](${gcalLink})`;
    }
  } catch (e) {
    console.error("gcal link error:", e);
  }

  await enviarTelegramConBotones(chatId,
    mensajeConfirmacion,
    [[{ text: "← Menú principal", callback_data: "menu_principal:" }]]
  );
}

function normalizeSexo(v: any): string | null {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "m" || s === "masculino" || s === "hombre") return "M";
  if (s === "f" || s === "femenino" || s === "mujer") return "F";
  return "Otro";
}

async function crearCitaDesdeSesion(conv: any) {
  const sesion = await obtenerSesion(conv.id);
  if (!sesion) return { error: "Sin sesión activa" };
  if (!sesion.consentimiento_dado) return { error: "Falta consentimiento" };
  const b = sesion.borrador_paciente ?? {};
  if (!b.nombre || !b.apellidos) return { error: "Faltan datos básicos" };
  if (!sesion.servicio_id || !sesion.doctor_id || !sesion.slot_propuesto) return { error: "Faltan datos de la cita" };

  const { data: identidad } = await supabase.from("identidades_canal").select("*").eq("id", conv.identidad_canal_id).single();

  let patientId = identidad.patient_id;
  if (!patientId) {
    const { data: nuevoPaciente, error: ep } = await supabase.from("patients").insert({
      nombre: b.nombre, apellidos: b.apellidos, fecha_nacimiento: b.fecha_nacimiento ?? null,
      sexo: normalizeSexo(b.sexo), email: b.email ?? null, municipio: b.domicilio_ciudad ?? null, alergias: b.alergias ?? null,
    }).select("id").single();
    if (ep) return { error: "No pude crear paciente: " + ep.message };
    patientId = nuevoPaciente.id;
    await supabase.from("identidades_canal").update({ patient_id: patientId }).eq("id", identidad.id);
    await supabase.from("consentimientos").insert({
      patient_id: patientId, identidad_canal_id: identidad.id, tipo: "aviso_privacidad",
      version_texto: AVISO_PRIVACIDAD_VERSION, otorgado: true, otorgado_at: sesion.consentimiento_fecha,
    });
  }

  const { data: svc, error: esvc } = await supabase.from("servicios").select("duracion_minutos").eq("id", sesion.servicio_id).single();
  if (!svc) { console.error("servicio no encontrado:", sesion.servicio_id, esvc?.message); return { error: "Servicio no encontrado: " + (esvc?.message ?? sesion.servicio_id) }; }

  const inicio = new Date(sesion.slot_propuesto);
  const fin    = new Date(inicio.getTime() + svc.duracion_minutos * 60000);

  const { data: cita, error: ea } = await supabase.from("appointments").insert({
    patient_id: patientId, doctor_id: sesion.doctor_id, servicio_id: sesion.servicio_id,
    fecha_inicio: inicio.toISOString(), fecha_fin: fin.toISOString(), origen: "telegram", creada_por_bot: true,
    // Auto-confirmación: el slot ya pasó la validación de disponibilidad (constraint de exclusión
    // bloquea doble-booking). No requiere intervención humana de recepción — esa es la automatización.
    // El cliente puede pedir un humano explícitamente vía escalar_a_humano si lo necesita.
    status: "confirmada",
  }).select("id, fecha_inicio").single();

  if (ea) {
    if (ea.code === "23P01" || /exclude|exclusion/i.test(ea.message)) {
      return { error: "El horario ya fue tomado", slotTomado: true };
    }
    return { error: ea.message };
  }

  try {
    const ahora = new Date();
    const rows: any[] = [];
    const rec24h = new Date(inicio.getTime() - 24 * 3600000);
    if (rec24h > ahora) {
      rows.push({ appointment_id: cita.id, identidad_canal_id: conv.identidad_canal_id, programado_para: rec24h.toISOString(), tipo: "t24h", status: "pendiente" });
    }
    const rec2h = new Date(inicio.getTime() - 2 * 3600000);
    if (rec2h > ahora) {
      rows.push({ appointment_id: cita.id, identidad_canal_id: conv.identidad_canal_id, programado_para: rec2h.toISOString(), tipo: "t2h", status: "pendiente" });
    }
    if (rows.length) await supabase.from("recordatorios_cita").insert(rows);
  } catch (e) { console.error("recordatorios:", e); }

  // Crear evento en Google Calendar del doctor.
  // Awaited (no IIFE) — el IIFE fire-and-forget muere cuando el runtime Deno termina,
  // porque no está registrado en EdgeRuntime.waitUntil. Await dentro del scope de waitUntil garantiza que corre hasta el final.
  try {
    const cal = await getDoctorCalendar(sesion.doctor_id);
    if (cal) {
      const { data: svcNombre } = await supabase.from("servicios").select("nombre").eq("id", sesion.servicio_id).single();
      const eventId = await createCalendarEvent(cal, {
        summary: `Cita: ${svcNombre?.nombre ?? "Consulta"} — ${b.nombre} ${b.apellidos}`,
        description: `Paciente: ${b.nombre} ${b.apellidos}\nServicio: ${svcNombre?.nombre ?? ""}\nOrigen: Bot Telegram`,
        startIso: inicio.toISOString(),
        endIso: fin.toISOString(),
      });
      if (eventId) {
        await supabase.from("appointments").update({ google_event_id: eventId }).eq("id", cita.id);
      }
    }
  } catch (e) {
    console.error("[GCal] crear evento", cita.id, e);
    await supabase.from("appointments").update({ gcal_last_error: String(e) }).eq("id", cita.id).catch(() => {});
  }

  return { ok: true, appointment_id: cita.id };
}

// ============================================================
// AGENTE CLAUDE
// ============================================================
async function correrAgente(conv: any, chatId: string, userText?: string): Promise<string> {
  const messages = await cargarHistorialParaAnthropic(conv.id);
  return ejecutarAgenteLoop(conv, chatId, messages, userText);
}

async function correrAgenteConsulta(conv: any, chatId: string, texto: string): Promise<string> {
  const messages = await cargarHistorialParaAnthropic(conv.id);
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    messages.push({ role: "user", content: texto });
  }
  return ejecutarAgenteLoop(conv, chatId, messages, texto);
}

async function ejecutarAgenteLoop(conv: any, chatId: string, messages: any[], userText?: string): Promise<string> {
  const memoria = await cargarMemoria(conv.identidad_canal_id);
  const systemPrompt = buildSystemPrompt(memoria);
  for (let i = 0; i < MAX_AGENT_ITERATIONS; i++) {
    const resp = await llamarClaude(messages, systemPrompt);

    if (resp.stop_reason === "end_turn" || resp.stop_reason === "stop_sequence") {
      const text = resp.content.find((b: any) => b.type === "text")?.text?.trim();
      if (text) {
        if (userText && text && userText.length >= 10) {
          // PostgrestBuilder no implementa .catch (solo .then) — usar .then(ok, err).
          // Con .catch() esto tronaba con TypeError y TODA respuesta del agente se
          // convertía en "Tuve un problema técnico" (bug encontrado por el harness).
          supabase.rpc("chat_registrar_pendiente", {
            p_pregunta: userText,
            p_clinic_id: CLINIC_ID || null,
            p_ruta: null,
            p_respuesta: text,
          } as never).then(undefined, () => {});
        }
        return text;
      }
      if ((resp.content?.length ?? 0) > 0) {
        messages.push({ role: "assistant", content: resp.content });
        messages.push({ role: "user", content: "Continúa." });
        continue;
      }
      break;
    }

    if (resp.stop_reason === "tool_use") {
      const toolUses = resp.content.filter((b: any) => b.type === "tool_use");
      messages.push({ role: "assistant", content: resp.content });
      const toolResults: any[] = [];
      let menuEnviado = false;
      for (const tu of toolUses) {
        const result = await ejecutarToolClaude(tu.name, tu.input, conv, chatId);
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result), is_error: !!result.error });
        if (tu.name === "mostrar_menu_principal" || tu.name === "mostrar_menu_categorias") menuEnviado = true;
      }
      // Menu tools send their own Telegram message — don't let agent add text on top
      if (menuEnviado) return "";
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
      case "mostrar_menu_principal":
        await enviarMenuPrincipal(chatId, "¿En qué más te puedo ayudar?");
        return { ok: true, accion: "menú principal enviado" };
      case "mostrar_menu_categorias":
        await enviarMenuCategorias(chatId, "Elige la especialidad:");
        return { ok: true, accion: "menú especialidades enviado" };
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
  const [validIds, svcResult] = await Promise.all([
    getServiciosConDoctorActivo(),
    supabase.from("servicios").select("id, nombre, especialidad, duracion_minutos, precio_centavos").eq("activo", true),
  ]);

  const vistos = new Set<string>();
  const filtrados = ((svcResult.data ?? []) as any[]).filter((s) => {
    if (!validIds.has(s.id) || vistos.has(s.id)) return false;
    vistos.add(s.id);
    return s.nombre.toLowerCase().includes(q) || (s.especialidad ?? "").toLowerCase().includes(q);
  }).slice(0, 5);

  if (filtrados.length === 0) {
    await enviarMenuCategorias(chatId, `No encontré "${query}". Elige una especialidad:`);
    return { ok: true, candidatos: 0 };
  }

  const rows = filtrados.map((s: any) => {
    const precio = s.precio_centavos ? `$${(s.precio_centavos / 100).toLocaleString("es-MX")}` : "—";
    return [{ text: `${s.nombre} — ${s.duracion_minutos} min / ${precio}`, callback_data: `srv:${s.id}` }];
  });
  rows.push([{ text: "← Ver todas las categorías", callback_data: "menu_agendar:" }]);
  await enviarTelegramConBotones(chatId, `Encontré para "${query}":`, rows);
  return { ok: true, candidatos: filtrados.length };
}

async function llamarClaude(messages: any[], systemPrompt: string = SYSTEM_PROMPT_BASE) {
  const res = await fetch(`${ANTHROPIC_API_BASE}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1024, system: systemPrompt, tools: TOOLS, messages }),
  });
  if (!res.ok) throw new Error("Anthropic " + res.status + ": " + (await res.text()));
  return await res.json();
}

// ============================================================
// LISTAR HORARIOS
// ============================================================
async function listarHorariosDisponibles({ servicio_id, dias_adelante = 7, max_horarios = 8 }: any) {
  dias_adelante = Math.min(dias_adelante, 30);
  const MAX = Math.min(max_horarios, 300);
  const { data: ds, error: e1 } = await supabase
    .from("doctor_servicios")
    .select("doctor_id, doctor:doctors(id, nombre, apellidos, especialidad, horario_inicio, horario_fin, activo)")
    .eq("servicio_id", servicio_id);
  if (e1) return { error: e1.message };

  const doctores = (ds ?? []).filter((r: any) => r.doctor?.activo);
  if (doctores.length === 0) return { horarios: [] };

  const { data: svc, error: e2 } = await supabase.from("servicios").select("duracion_minutos").eq("id", servicio_id).single();
  if (e2) return { error: e2.message };
  const durMin: number = svc.duracion_minutos;

  const ahora = new Date();
  const finRango = new Date(ahora.getTime() + dias_adelante * 86400000);
  const docIds = doctores.map((d: any) => d.doctor_id);

  const { data: existentes } = await supabase
    .from("appointments").select("doctor_id, fecha_inicio, fecha_fin, status")
    .in("doctor_id", docIds).gte("fecha_inicio", ahora.toISOString()).lte("fecha_inicio", finRango.toISOString());

  const ocupadas = (existentes ?? []).filter((a: any) => !["cancelada", "liberada"].includes(String(a.status).toLowerCase()));

  // Pre-cargar Google Calendar busy slots de cada doctor (fire concurrentemente)
  const gcalBusy: Record<string, BusySlot[]> = {};
  const windowStart = ahora.toISOString();
  const windowEnd = finRango.toISOString();
  await Promise.all(doctores.map(async (ds: any) => {
    const cal = await getDoctorCalendar(ds.doctor_id);
    if (cal) gcalBusy[ds.doctor_id] = await getFreeBusy(cal, windowStart, windowEnd);
  }));

  const schedule = await getClinicSchedule();
  const DIAS_LABORALES = schedule.dias_laborales;
  const horarios: any[] = [];
  const ahoraMxMs = ahora.getTime() + MX_TZ_OFFSET_MS;

  for (let d = 0; d < dias_adelante && horarios.length < MAX; d++) {
    const diaMx = new Date(ahoraMxMs + d * 86400000);
    if (!DIAS_LABORALES.includes(diaMx.getUTCDay())) continue;
    const yyyy = diaMx.getUTCFullYear();
    const mm = String(diaMx.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(diaMx.getUTCDate()).padStart(2, "0");

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
          a.doctor_id === doc.doctor_id && new Date(a.fecha_inicio) < slotFin && new Date(a.fecha_fin) > slotIni
        );
        if (conflicto) continue;
        // Filtrar slots ocupados en Google Calendar del doctor
        const googleBusy = gcalBusy[doc.doctor_id] ?? [];
        const googleConflicto = googleBusy.some((b) => {
          const bs = new Date(b.start).getTime();
          const be = new Date(b.end).getTime();
          return slotIni.getTime() < be && slotFin.getTime() > bs;
        });
        if (googleConflicto) continue;
        horarios.push({
          doctor_id: doc.doctor_id,
          doctor_nombre: `Dr(a). ${doc.doctor.nombre} ${doc.doctor.apellidos}${doc.doctor.especialidad ? ` · ${doc.doctor.especialidad}` : ""}`,
          fecha_inicio: slotIni.toISOString(),
          fecha_local: slotIni.toLocaleString("es-MX", {
            timeZone: "America/Mexico_City", weekday: "short", day: "numeric", month: "short",
            hour: "2-digit", minute: "2-digit",
          }),
        });
        if (horarios.length >= MAX) break;
      }
      if (horarios.length >= MAX) break;
    }
  }
  return { horarios };
}

async function escalarConversacion(conv: any, { razon }: { razon: string }) {
  await supabase.from("conversaciones").update({ status: "escalada", intencion_actual: "escalada" }).eq("id", conv.id);
  await registrarAudit(conv, "conv_escalada", { razon });
  return { ok: true, escalada: true, razon };
}

// ============================================================
// SESIÓN HELPERS
// ============================================================
async function obtenerSesion(convId: string) {
  const { data } = await supabase.from("bot_sesiones").select("*").eq("conversacion_id", convId).maybeSingle();
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
// Vincula el chat_id de Telegram de un miembro del staff (enfermería, etc.)
// usando un código corto generado desde /enfermeria/vincular-telegram.
async function vincularStaffTelegram(chatId: string, code: string) {
  const { data: link } = await supabase
    .from("staff_link_codes")
    .select("user_id, clinic_id, expires_at, used_at")
    .eq("code", code)
    .maybeSingle();

  if (!link || link.used_at || new Date(link.expires_at) < new Date()) {
    await enviarTelegram(chatId, "Código inválido o vencido. Genera uno nuevo desde tu perfil.");
    return;
  }

  await supabase.from("staff_identidades_canal").upsert({
    user_id: link.user_id,
    canal_id: "telegram",
    external_id: chatId,
    clinic_id: link.clinic_id,
  }, { onConflict: "user_id,canal_id" });

  await supabase.from("staff_link_codes").update({ used_at: new Date().toISOString() }).eq("code", code);

  await enviarTelegram(chatId, "Listo, tu cuenta quedó vinculada. Recibirás avisos de asignación aquí.");
}

async function obtenerOCrearIdentidad(chatId: string, from: any) {
  const { data: existente } = await supabase.from("identidades_canal").select("*")
    .eq("canal_id", "telegram").eq("external_id", chatId).maybeSingle();
  if (existente) return existente;

  const display = [from?.first_name, from?.last_name].filter(Boolean).join(" ") || from?.username || "Anónimo";
  const { data: nueva, error } = await supabase.from("identidades_canal").insert({
    canal_id: "telegram", external_id: chatId, display_name: display, metadata: { telegram_user: from },
  }).select("*").single();
  if (error) throw error;
  return nueva;
}

async function obtenerOCrearConversacion(identidadId: string) {
  const { data: existente } = await supabase.from("conversaciones").select("*")
    .eq("identidad_canal_id", identidadId).in("status", ["activa", "escalada"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existente) return existente;

  const { data: nueva, error } = await supabase.from("conversaciones").insert({ identidad_canal_id: identidadId }).select("*").single();
  if (error) throw error;
  return nueva;
}

async function guardarMensajeUsuario(conversacionId: string, text: string, raw: any) {
  await supabase.from("mensajes").insert({ conversacion_id: conversacionId, rol: "user", contenido: text, raw_payload: raw });
  await supabase.from("conversaciones").update({ last_message_at: new Date().toISOString() }).eq("id", conversacionId);
}

async function guardarMensajeAsistente(conversacionId: string, text: string) {
  await supabase.from("mensajes").insert({ conversacion_id: conversacionId, rol: "assistant", contenido: text });
}

// ============================================================
// MEMORIA DEL PACIENTE (cross-sesión, en identidades_canal.metadata.memoria)
// El bot "aprende" lo que la persona necesita y lo recuerda entre chats.
// ============================================================
async function cargarMemoria(identidadId: string): Promise<any> {
  if (!identidadId) return null;
  const { data } = await supabase.from("identidades_canal").select("metadata").eq("id", identidadId).maybeSingle();
  return data?.metadata?.memoria ?? null;
}

async function guardarMemoria(identidadId: string, memoria: any) {
  if (!identidadId) return;
  const { data } = await supabase.from("identidades_canal").select("metadata").eq("id", identidadId).maybeSingle();
  const metadata = { ...(data?.metadata ?? {}), memoria };
  await supabase.from("identidades_canal").update({ metadata }).eq("id", identidadId);
}

// Resume la conversación reciente y la fusiona con lo aprendido antes.
// Llamar en segundo plano (waitUntil) para no agregar latencia a la respuesta.
async function actualizarMemoria(identidadId: string, conversacionId: string) {
  try {
    if (!identidadId || !conversacionId) return;
    const { data } = await supabase.from("mensajes").select("rol, contenido")
      .eq("conversacion_id", conversacionId).in("rol", ["user", "assistant"])
      .order("created_at", { ascending: false }).limit(20);
    const msgs = (data ?? []).reverse();
    if (msgs.length < 2) return;

    const memoriaActual = await cargarMemoria(identidadId) as MemoriaPaciente | null;
    const resumenPrevio = (memoriaActual?.resumen ?? "").toString().trim();
    const transcript = msgs.map((m: any) => `${m.rol === "user" ? "Paciente" : "Bot"}: ${(m.contenido ?? "").slice(0, 300)}`).join("\n");

    const systemPromptHaiku = `Mantén una nota estructurada sobre este paciente de clínica en JSON estricto.
Extrae SOLO lo que el paciente mencionó explícitamente en la conversación:
- resumen: narrativo breve (máximo 80 palabras) sobre quién es y sus necesidades
- preferencias.especialidad_favorita: especialidad preferida si la mencionó
- preferencias.doctor_favorito_nombre: nombre del doctor si pidió al mismo más de una vez
- datos_clinicos.condiciones_cronicas: condición SOLO si el paciente lo dijo explícitamente (NUNCA diagnostiques)
- historial.ultima_cita_servicio: nombre del servicio agendado en esta sesión (si se agendó)
- historial.veces_agendado: cuántas veces ha agendado (suma 1 si agendó en esta sesión)
REGLA CRÍTICA: NO eres médico. NO interpretes síntomas. Solo registra lo que el paciente dijo textualmente.
Responde SOLO con JSON válido, sin explicación ni markdown.`;

    const input = `MEMORIA ACTUAL:\n${resumenPrevio || "(vacía)"}\n\nCONVERSACIÓN RECIENTE:\n${transcript}\n\nDevuelve la memoria actualizada como JSON:`;

    const res = await fetch(`${ANTHROPIC_API_BASE}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: ANTHROPIC_MODEL_MEMORIA, max_tokens: 400, system: systemPromptHaiku, messages: [{ role: "user", content: input }] }),
    });
    if (!res.ok) { console.error("actualizarMemoria Anthropic", res.status, await res.text()); return; }
    const json = await res.json();
    const haikuResponseText = json.content?.find((b: any) => b.type === "text")?.text?.trim();
    if (!haikuResponseText) return;

    try {
      const parsed = JSON.parse(haikuResponseText) as Partial<MemoriaPaciente>;
      const nuevaMemoria: MemoriaPaciente = {
        resumen: parsed.resumen ?? memoriaActual?.resumen ?? "",
        preferencias: { ...MEMORIA_DEFAULT.preferencias, ...(memoriaActual?.preferencias ?? {}), ...(parsed.preferencias ?? {}) },
        datos_clinicos: { ...MEMORIA_DEFAULT.datos_clinicos, ...(memoriaActual?.datos_clinicos ?? {}), ...(parsed.datos_clinicos ?? {}) },
        historial: {
          ...MEMORIA_DEFAULT.historial,
          ...(memoriaActual?.historial ?? {}),
          ...(parsed.historial ?? {}),
          ultima_interaccion: new Date().toISOString(),
        },
        meta: {
          interacciones: (memoriaActual?.meta?.interacciones ?? 0) + 1,
          updated_at: new Date().toISOString(),
        },
      };
      await guardarMemoria(identidadId, nuevaMemoria);
    } catch {
      // JSON parse failed — skip silently
    }
  } catch (err) {
    console.error("actualizarMemoria error:", err);
  }
}

async function cargarHistorialParaAnthropic(conversacionId: string) {
  const { data } = await supabase.from("mensajes").select("rol, contenido")
    .eq("conversacion_id", conversacionId).in("rol", ["user", "assistant"])
    .order("created_at", { ascending: false }).limit(40);
  const messages = (data ?? []).reverse().map((m: any) => ({ role: m.rol, content: m.contenido ?? "" }));
  while (messages.length > 0 && messages[0].role !== "user") messages.shift();
  return messages;
}

// ============================================================
// TELEGRAM SEND
// ============================================================
async function telegramSendMessage(payload: Record<string, unknown>, label: string) {
  // First attempt with Markdown. If Telegram rejects malformed entities (400),
  // retry as plain text so dynamic values (names, fechas, errores) never silence the bot.
  const send = (body: Record<string, unknown>) =>
    fetch(`${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  let res = await send({ ...payload, parse_mode: "Markdown" });
  if (res.ok) return;

  const errText = await res.text();
  console.error(`${label} (markdown) error, retrying as plain text:`, errText);

  res = await send(payload);
  if (!res.ok) console.error(`${label} (plain) error:`, await res.text());
}

async function enviarTelegram(chatId: string, text: string) {
  await telegramSendMessage({ chat_id: chatId, text }, "Telegram send");
}

async function enviarTelegramConBotones(chatId: string, text: string, inlineKeyboard: any[][]) {
  await telegramSendMessage(
    { chat_id: chatId, text, reply_markup: { inline_keyboard: inlineKeyboard } },
    "Telegram send buttons",
  );
}
