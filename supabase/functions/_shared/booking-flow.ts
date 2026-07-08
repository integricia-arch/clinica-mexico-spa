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

export type BookingStep = "esperando_servicio" | "esperando_horario" | "esperando_confirmacion";

export interface BookingState {
  step: BookingStep;
  servicioId?: string;
  slot?: BookingSlot;
}

export type BookingAction = "none" | "book" | "handoff_human" | "reset";

export interface BookingResult {
  state: BookingState | null;
  reply: string;
  action: BookingAction;
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
): BookingResult {
  const texto = input.trim().toUpperCase();

  if (texto === "HUMANO") {
    return { state: null, reply: "Un miembro del equipo te va a contactar.", action: "handoff_human" };
  }

  if (!current) {
    if (texto === "CITA") {
      return {
        state: { step: "esperando_servicio" },
        reply: `¿Qué servicio necesitas?\n${listarServicios(servicios)}`,
        action: "none",
      };
    }
    return { state: null, reply: MENU_SALUDO, action: "none" };
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
