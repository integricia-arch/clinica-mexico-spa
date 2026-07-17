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
  { name: "mostrar_menu_principal", description: "Menú principal", input_schema: { type: "object", properties: {} } },
  { name: "mostrar_menu_categorias", description: "Especialidades", input_schema: { type: "object", properties: {} } },
  { name: "buscar_servicios", description: "Buscar", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "escalar_a_humano", description: "Escalar", input_schema: { type: "object", properties: { razon: { type: "string" } }, required: ["razon"] } },
];

