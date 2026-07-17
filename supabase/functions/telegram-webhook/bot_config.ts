import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getDoctorCalendar,
  getFreeBusy,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  type BusySlot,
} from "./google-calendar.ts";

const TELEGRAM_BOT_TOKEN   = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const ANTHROPIC_API_KEY    = Deno.env.get("ANTHROPIC_API_KEY")!;
const WEBHOOK_SECRET       = Deno.env.get("WEBHOOK_SECRET") ?? "";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLINIC_NAME          = Deno.env.get("CLINIC_NAME") ?? "ClínicaMX";

// Overridables por env para el harness de pruebas local (test/README.md).
const TELEGRAM_API_BASE  = Deno.env.get("TELEGRAM_API_BASE")  ?? "https://api.telegram.org";
const ANTHROPIC_API_BASE = Deno.env.get("ANTHROPIC_API_BASE") ?? "https://api.anthropic.com";

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_MODEL_MEMORIA = "claude-haiku-4-5-20251001"; // barato: resumen de memoria del paciente
const MAX_AGENT_ITERATIONS = 8;
const AVISO_PRIVACIDAD_VERSION = "v1.0";
const CLINIC_ID = Deno.env.get("CLINIC_ID") ?? "";
const MX_TZ_OFFSET = "-06:00";
const MX_TZ_OFFSET_MS = -6 * 3600000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// In-process dedup for callback_query_id — prevents double-tap on buttons
// within the same isolate invocation window.
const processedCallbackIds = new Set<string>();

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
export const processedCallbackIds = new Set<string>();

const TOOLS = [
  {
    name: "mostrar_menu_principal",
    description: "Envía el menú principal completo. Usar cuando el paciente no sepa qué quiere o termine una consulta.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "mostrar_menu_categorias",
    description: "Envía el menú de 9 especialidades como botones. Usar cuando el paciente quiera agendar.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "buscar_servicios",
    description: "Busca servicios por palabra clave. Devuelve hasta 5 candidatos.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "escalar_a_humano",
    description: "Marca conversación para recepcionista. Solo con confirmación o urgencia.",
    input_schema: {
      type: "object",
      properties: { razon: { type: "string" } },
      required: ["razon"],
    },
  },
];
