import { ANTHROPIC_API_KEY, ANTHROPIC_API_BASE, ANTHROPIC_MODEL, SYSTEM_PROMPT_BASE, TOOLS, MAX_AGENT_ITERATIONS, supabase, CLINIC_ID } from "./bot_config.ts";
import { listarHorariosDisponibles } from "./bot_horarios.ts";
import { guardarDatosPaciente, confirmarCita } from "./bot_db.ts";
import { enviarTelegram, enviarTelegramConBotones } from "./bot_telegram.ts";

export async function llamarClaude(messages: any[], systemPrompt: string = SYSTEM_PROMPT_BASE) {
  const res = await fetch(`${ANTHROPIC_API_BASE}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1024, system: systemPrompt, tools: TOOLS, messages }),
  });
  if (!res.ok) throw new Error("Anthropic " + res.status + ": " + (await res.text()));
  return await res.json();
}

export async function ejecutarAgenteLoop(chatId: string, messages: any[], userText?: string): Promise<string> {
  const systemPrompt = SYSTEM_PROMPT_BASE;
  for (let i = 0; i < MAX_AGENT_ITERATIONS; i++) {
    const resp = await llamarClaude(messages, systemPrompt);

    if (resp.stop_reason === "end_turn" || resp.stop_reason === "stop_sequence") {
      const text = resp.content.find((b: any) => b.type === "text")?.text?.trim();
      if (text) {
        if (userText && text && userText.length >= 10) {
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
        const result = await ejecutarToolClaude(tu.name, tu.input, chatId);
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result), is_error: !!(result as any).error });
        if (tu.name === "mostrar_menu_principal" || tu.name === "mostrar_menu_categorias") menuEnviado = true;
      }
      if (menuEnviado) return "";
      messages.push({ role: "user", content: toolResults });
      continue;
    }
    break;
  }
  return "";
}

export async function ejecutarToolClaude(name: string, input: any, chatId: string) {
  switch (name) {
    case "listar_horarios":
      return await listarHorariosDisponibles(input);
    case "guardar_datos_paciente":
      return await guardarDatosPaciente("", input);
    case "confirmar_cita":
      return await confirmarCita("", input.slot_key);
    case "mostrar_menu_principal":
      await enviarTelegram(chatId, "¿En qué te puedo ayudar?");
      return { ok: true, accion: "menú principal enviado" };
    case "mostrar_menu_categorias":
      await enviarTelegram(chatId, "Elige la especialidad:");
      return { ok: true, accion: "menú especialidades enviado" };
    default:
      return { error: "Tool desconocida: " + name };
  }
}
