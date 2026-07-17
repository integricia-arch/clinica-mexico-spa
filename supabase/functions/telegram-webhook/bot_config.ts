import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getDoctorCalendar,
  getFreeBusy,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  type BusySlot,
} from "./google-calendar.ts";

export const TELEGRAM_BOT_TOKEN   = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
export const ANTHROPIC_API_KEY    = Deno.env.get("ANTHROPIC_API_KEY")!;
export const WEBHOOK_SECRET       = Deno.env.get("WEBHOOK_SECRET") ?? "";
export const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
export const CLINIC_NAME          = Deno.env.get("CLINIC_NAME") ?? "ClínicaMX";

// Overridables por env para el harness de pruebas local (test/README.md).
export const TELEGRAM_API_BASE  = Deno.env.get("TELEGRAM_API_BASE")  ?? "https://api.telegram.org";
export const ANTHROPIC_API_BASE = Deno.env.get("ANTHROPIC_API_BASE") ?? "https://api.anthropic.com";

export const ANTHROPIC_MODEL= "claude-sonnet-4-6";
export const ANTHROPIC_MODELMEMORIA = "claude-haiku-4-5-20251001"; // barato: resumen de memoria del paciente
export const MAX_AGENT_ITERATIONS = 8;
export const AVISO_PRIVACIDAD_VERSION = "v1.0";
export const CLINIC_ID = Deno.env.get("CLINIC_ID") ?? "";
export const MX_TZ_OFFSET= "-06:00";
export const MX_TZ_OFFSETMS = -6 * 3600000;


// within the same isolate invocation window.

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
export const processedCallbackIds = new Set<string>();

export const TOOLS = [
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



