async function getClinicSchedule(): Promise<ClinicSchedule> {
  if (!CLINIC_ID) return SCHEDULE_DEFAULT;
  try {
    const { data } = await supabase
      .from("clinic_settings")
      .select("data")
      .eq("clinic_id", CLINIC_ID)
      .eq("section", "horario")
      .maybeSingle();
    if (!data?.data) return SCHEDULE_DEFAULT;
    const d = data.data as Partial<ClinicSchedule>;
    return {
      dias_laborales: d.dias_laborales ?? SCHEDULE_DEFAULT.dias_laborales,
      hora_apertura: d.hora_apertura ?? SCHEDULE_DEFAULT.hora_apertura,
      hora_cierre: d.hora_cierre ?? SCHEDULE_DEFAULT.hora_cierre,
    };
  } catch {
    return SCHEDULE_DEFAULT;
  }
}

async function buscarFaqTelegram(pregunta: string): Promise<string | null> {
  if (!CLINIC_ID) return null;
  try {
    const { data, error } = await supabase.rpc("faq_buscar", {
      p_pregunta: pregunta,
      p_clinic_id: CLINIC_ID,
      p_ruta: null,
    } as never);
    if (error || !data || (data as { id: string; respuesta: string; uso_count: number }[]).length === 0) return null;
    const match = (data as { id: string; respuesta: string; uso_count: number }[])[0];
    return match.respuesta ?? null;
  } catch {
    return null;
  }
}

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
