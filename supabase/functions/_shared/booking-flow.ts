// supabase/functions/_shared/booking-flow.ts

export interface BookingSlot {
  doctorId: string;
  servicioId: string;
  start: string;
}

export interface Servicio {
  id: string;
  nombre: string;
}

export type BookingStep =
  | "esperando_nombre_paciente"
  | "esperando_apellidos_paciente"
  | "esperando_servicio"
  | "esperando_horario"
  | "esperando_confirmacion";

export interface BookingState {
  step: BookingStep;
  servicioId?: string;
  slot?: BookingSlot;
  nombrePaciente?: string;
}

export type BookingAction = "none" | "book" | "handoff_human" | "reset" | "crear_paciente_y_continuar";

export interface BookingResult {
  state: BookingState | null;
  reply: string;
  action: BookingAction;
  // Solo presente cuando action === "crear_paciente_y_continuar": datos capturados en el
  // wizard de alta para que el caller (webhook) inserte la fila en `patients`.
  pacienteNuevo?: { nombre: string; apellidos: string };
}

const MENU_SALUDO = "Escribe *CITA* para agendar, o *HUMANO* para hablar con alguien del equipo.";

function listarServicios(servicios: Servicio[]): string {
  return servicios.map((s, i) => `${i + 1}. ${s.nombre}`).join("\n");
}

function listarSlots(slots: BookingSlot[]): string {
  return slots
    .slice(0, 5)
    .map((s, i) => `${i + 1}. ${new Date(s.start).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}`)
    .join("\n");
}

export function nextBookingState(
  current: BookingState | null,
  input: string,
  servicios: Servicio[],
  slots: BookingSlot[],
  // Identidad WhatsApp nueva nace con patient_id = null (ver CLAUDE.md). Sin paciente
  // vinculado, CITA entra primero al wizard de alta en vez de esperando_servicio.
  tienePacienteVinculado = true,
): BookingResult {
  const texto = input.trim().toUpperCase();

  if (texto === "HUMANO") {
    return { state: null, reply: "Un miembro del equipo te va a contactar.", action: "handoff_human" };
  }

  if (!current) {
    if (texto === "CITA") {
      if (!tienePacienteVinculado) {
        return {
          state: { step: "esperando_nombre_paciente" },
          reply: "Para agendar tu primera cita necesitamos algunos datos. ¿Cuál es tu nombre?",
          action: "none",
        };
      }
      return {
        state: { step: "esperando_servicio" },
        reply: `¿Qué servicio necesitas?\n${listarServicios(servicios)}`,
        action: "none",
      };
    }
    return { state: null, reply: MENU_SALUDO, action: "none" };
  }

  if (current.step === "esperando_nombre_paciente") {
    const nombre = input.trim();
    if (!nombre) {
      return { state: current, reply: "No entendí. ¿Cuál es tu nombre?", action: "none" };
    }
    return {
      state: { step: "esperando_apellidos_paciente", nombrePaciente: nombre },
      reply: "¿Cuáles son tus apellidos?",
      action: "none",
    };
  }

  if (current.step === "esperando_apellidos_paciente") {
    const apellidos = input.trim();
    if (!apellidos) {
      return { state: current, reply: "No entendí. ¿Cuáles son tus apellidos?", action: "none" };
    }
    return {
      state: { step: "esperando_servicio" },
      reply: `¿Qué servicio necesitas?\n${listarServicios(servicios)}`,
      action: "crear_paciente_y_continuar",
      pacienteNuevo: { nombre: current.nombrePaciente ?? "", apellidos },
    };
  }

  if (current.step === "esperando_servicio") {
    const idx = parseInt(texto, 10) - 1;
    const servicio = servicios[idx];
    if (!servicio) {
      return {
        state: current,
        reply: `No entendí. ¿Qué servicio necesitas?\n${listarServicios(servicios)}`,
        action: "none",
      };
    }
    const slotsServicio = slots.filter((s) => s.servicioId === servicio.id);
    if (slotsServicio.length === 0) {
      return { state: null, reply: "No hay horarios disponibles por ahora. Escribe HUMANO para que te ayudemos.", action: "reset" };
    }
    return {
      state: { step: "esperando_horario", servicioId: servicio.id },
      reply: `¿Qué horario prefieres?\n${listarSlots(slotsServicio)}`,
      action: "none",
    };
  }

  if (current.step === "esperando_horario") {
    const slotsServicio = slots.filter((s) => s.servicioId === current.servicioId).slice(0, 5);
    const idx = parseInt(texto, 10) - 1;
    const slot = slotsServicio[idx];
    if (!slot) {
      return {
        state: current,
        reply: `No entendí. ¿Qué horario prefieres?\n${listarSlots(slotsServicio)}`,
        action: "none",
      };
    }
    return {
      state: { step: "esperando_confirmacion", servicioId: current.servicioId, slot },
      reply: `Confirmo tu cita para el ${new Date(slot.start).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}. Responde *SI* para confirmar.`,
      action: "none",
    };
  }

  // esperando_confirmacion
  if (texto === "SI") {
    return { state: null, reply: "¡Listo! Tu cita quedó registrada.", action: "book" };
  }
  return {
    state: current,
    reply: "Responde *SI* para confirmar tu cita, o *HUMANO* para hablar con alguien.",
    action: "none",
  };
}
