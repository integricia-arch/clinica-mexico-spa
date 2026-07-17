import { supabase } from "./bot_config.ts";

export async function obtenerSesion(convId: string) {
  const { data } = await supabase.from("bot_sesiones").select("*").eq("conversacion_id", convId).maybeSingle();
  return data;
}

export async function upsertSesion(convId: string, patch: any) {
  const existing = await obtenerSesion(convId);
  if (existing) {
    const merged: any = { ...patch, updated_at: new Date().toISOString() };
    if (patch.flow_data) merged.flow_data = { ...(existing.flow_data ?? {}), ...patch.flow_data };
    await supabase.from("bot_sesiones").update(merged).eq("id", existing.id);
  } else {
    await supabase.from("bot_sesiones").insert({ conversacion_id: convId, ...patch });
  }
}

export async function guardarDatosPaciente(convId: string, datos: any) {
  const sesion = await obtenerSesion(convId);
  const borrador = sesion?.borrador_paciente ?? {};
  const guardado: string[] = [];
  const faltan: string[] = [];

  if (datos.nombre) { borrador.nombre = datos.nombre; guardado.push("nombre"); }
  if (datos.apellidos) { borrador.apellidos = datos.apellidos; guardado.push("apellidos"); }
  if (datos.fecha_nacimiento) { borrador.fecha_nacimiento = datos.fecha_nacimiento; guardado.push("fecha_nacimiento"); }
  if (datos.sexo) { borrador.sexo = datos.sexo; guardado.push("sexo"); }
  if (datos.telefono) { borrador.telefono = datos.telefono; guardado.push("telefono"); }
  if (datos.email) { borrador.email = datos.email; guardado.push("email"); }
  if (datos.alergias) { borrador.alergias = datos.alergias; guardado.push("alergias"); }

  if (!borrador.nombre) faltan.push("nombre");
  if (!borrador.apellidos) faltan.push("apellidos");

  await upsertSesion(convId, { borrador_paciente: borrador });
  return { guardado, faltan };
}

export async function confirmarCita(convId: string, slotKey: string) {
  const sesion = await obtenerSesion(convId);
  if (!sesion?.consentimiento_dado) return { error: "Falta consentimiento" };
  const slot = sesion?.flow_data?.slots?.[slotKey];
  if (!slot) return { error: "Slot no disponible" };
  return { ok: true, slot };
}

export async function cargarHistorialParaAnthropic(conversacionId: string) {
  const { data } = await supabase.from("mensajes").select("rol, contenido")
    .eq("conversacion_id", conversacionId).in("rol", ["user", "assistant"])
    .order("created_at", { ascending: false }).limit(40);
  const messages = (data ?? []).reverse().map((m: any) => ({ role: m.rol, content: m.contenido ?? "" }));
  while (messages.length > 0 && messages[0].role !== "user") messages.shift();
  return messages;
}

export async function guardarAccion(conversacionId: string, accion: string) {
  try {
    await supabase.from("mensajes").insert({
      conversacion_id: conversacionId,
      rol: "assistant",
      contenido: `[acción: ${accion}]`,
    });
  } catch (err) {
    console.error("guardarAccion error:", err);
  }
}

export async function guardarClick(conversacionId: string, opcion: string) {
  try {
    await supabase.from("mensajes").insert({
      conversacion_id: conversacionId,
      rol: "user",
      contenido: `[eligió: ${opcion}]`,
    });
  } catch (err) {
    console.error("guardarClick error:", err);
  }
}
