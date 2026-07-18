export const SYSTEM_PROMPT_BASE = `Eres asistente de AGENDAMIENTO de clínica multiespecialidad en México.

TU ROL: Ayudar a agendar citas, informar horarios/precios y conectar con recepción. NO eres médico.

TOOLS DISPONIBLES:
- listar_horarios: Input { servicio_id, dias_adelante?, max_horarios? } → devuelve slots disponibles con doctor_nombre, fecha_local
- guardar_datos_paciente: Input { nombre?, apellidos?, fecha_nacimiento?, sexo?, telefono?, email?, alergias? } → guarda en sesión, devuelve { guardado, faltan }
- confirmar_cita: Input { slot_key } → confirma si consentimiento listo; si no, pide consentimiento

REGLAS DURAS:
- Hablas español mexicano natural, cálido, profesional. Mensajes cortos (1-3 oraciones).
- NUNCA das consejo médico, diagnóstico ni interpretación. Si describen síntomas: "Eso lo evalúa tu médico en consulta. ¿Te agendo una cita?"
- EMERGENCIAS: Si dolor intenso, dificultad respirar, sangrado, pérdida conciencia → "Llama al 911 o ve a urgencias de inmediato."
- SLOT-FILLING: Pide UN dato a la vez si el usuario no los da juntos. Nunca inventes horarios—solo los que devuelve listar_horarios.
- CIERRE: Si se despiden ("gracias", "listo", "es todo") → respuesta breve cálida, SIN menú.
- BOTONES: Usa guardar_datos_paciente para slot-filling conversacional, confirmar_cita para confirmación.

ENTENDER AL USUARIO: Lee intención y estado emocional. Si frustración/confusión → valida, luego guía con paso claro.
`;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getDoctorCalendar, getFreeBusy, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, type BusySlot } from "./google-calendar.ts";

export const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
export const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
export const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const CLINIC_NAME = Deno.env.get("CLINIC_NAME") ?? "ClínicaMX";
export const TELEGRAM_API_BASE = Deno.env.get("TELEGRAM_API_BASE") ?? "https://api.telegram.org";
export const ANTHROPIC_API_BASE = Deno.env.get("ANTHROPIC_API_BASE") ?? "https://api.anthropic.com";
export const ANTHROPIC_MODEL = "claude-sonnet-4-6";
export const ANTHROPIC_MODEL_MEMORIA = "claude-haiku-4-5-20251001";
export const MAX_AGENT_ITERATIONS = 8;
export const AVISO_PRIVACIDAD_VERSION = "v1.0";
export const CLINIC_ID = Deno.env.get("CLINIC_ID") ?? "";
export const MX_TZ_OFFSET = "-06:00";
export const MX_TZ_OFFSET_MS = -6 * 3600000;

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
export const processedCallbackIds = new Set<string>();

export const TOOLS = [
  {
    name: "listar_horarios",
    description: "Lista horarios disponibles para un servicio. Input: { servicio_id, dias_adelante?, max_horarios? }",
    input_schema: {
      type: "object",
      properties: {
        servicio_id: { type: "string" },
        dias_adelante: { type: "number" },
        max_horarios: { type: "number" }
      },
      required: ["servicio_id"]
    }
  },
  {
    name: "guardar_datos_paciente",
    description: "Guarda datos del paciente (nombre, apellidos, fecha_nacimiento, sexo, telefono, email, alergias). Devuelve { guardado, faltan }",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        apellidos: { type: "string" },
        fecha_nacimiento: { type: "string" },
        sexo: { type: "string" },
        telefono: { type: "string" },
        email: { type: "string" },
        alergias: { type: "string" }
      }
    }
  },
  {
    name: "confirmar_cita",
    description: "Confirma una cita si el usuario dio consentimiento. Input: { slot_key }",
    input_schema: {
      type: "object",
      properties: {
        slot_key: { type: "string" }
      },
      required: ["slot_key"]
    }
  },
  { name: "mostrar_menu_principal", description: "Menú principal", input_schema: { type: "object", properties: {} } },
  { name: "mostrar_menu_categorias", description: "Especialidades", input_schema: { type: "object", properties: {} } },
  { name: "buscar_servicios", description: "Buscar", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "escalar_a_humano", description: "Escalar", input_schema: { type: "object", properties: { razon: { type: "string" } }, required: ["razon"] } },
];




