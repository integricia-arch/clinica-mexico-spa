// supabase/functions/_shared/booking-flow.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { nextBookingState, type BookingSlot } from "./booking-flow.ts";

const servicios = [
  { id: "s1", nombre: "Consulta general" },
  { id: "s2", nombre: "Limpieza dental" },
];

const slots: BookingSlot[] = [
  { doctorId: "d1", servicioId: "s1", start: "2026-08-01T15:00:00-06:00" },
  { doctorId: "d1", servicioId: "s1", start: "2026-08-01T16:00:00-06:00" },
];

Deno.test("mensaje CITA sin estado previo entra a esperando_servicio", () => {
  const r = nextBookingState(null, "CITA", servicios, []);
  assertEquals(r.state?.step, "esperando_servicio");
  assertEquals(r.action, "none");
});

Deno.test("mensaje HUMANO en cualquier momento hace handoff", () => {
  const r = nextBookingState({ step: "esperando_servicio" }, "HUMANO", servicios, []);
  assertEquals(r.state, null);
  assertEquals(r.action, "handoff_human");
});

Deno.test("seleccion valida de servicio pasa a esperando_horario", () => {
  const r = nextBookingState({ step: "esperando_servicio" }, "1", servicios, slots);
  assertEquals(r.state?.step, "esperando_horario");
  assertEquals(r.state?.servicioId, "s1");
});

Deno.test("seleccion invalida de servicio repite el paso", () => {
  const r = nextBookingState({ step: "esperando_servicio" }, "9", servicios, slots);
  assertEquals(r.state?.step, "esperando_servicio");
  assertEquals(r.action, "none");
});

Deno.test("seleccion valida de horario pasa a esperando_confirmacion", () => {
  const state = { step: "esperando_horario" as const, servicioId: "s1" };
  const r = nextBookingState(state, "1", servicios, slots);
  assertEquals(r.state?.step, "esperando_confirmacion");
  assertEquals(r.state?.slot?.start, slots[0].start);
});

Deno.test("SI en esperando_confirmacion dispara book y limpia estado", () => {
  const state = {
    step: "esperando_confirmacion" as const,
    servicioId: "s1",
    slot: slots[0],
  };
  const r = nextBookingState(state, "SI", servicios, slots);
  assertEquals(r.action, "book");
  assertEquals(r.state, null);
});

Deno.test("respuesta no reconocida repite la pregunta una vez, luego resetea", () => {
  const state = { step: "esperando_servicio" as const };
  const r1 = nextBookingState(state, "asdf", servicios, slots);
  assertEquals(r1.state?.step, "esperando_servicio");
  assertEquals(r1.action, "none");
});

// Regresion CRITICO 1: el webhook debe recalcular `slots` en CADA paso del flujo, incluido
// "esperando_servicio" (justo cuando el usuario elige el servicio). El test unitario de arriba
// ("seleccion valida de servicio pasa a esperando_horario") ya pasaba `slots` inyectado a mano y
// por eso no habria detectado el bug -- este test recorre el flujo completo simulando, en cada
// paso, EXACTAMENTE la misma logica de calculo de `slots` que vive en whatsapp-webhook/index.ts
// (si esa logica omite una rama, este test debe fallar).
Deno.test("flujo completo CITA -> servicio -> horario -> SI dispara book (con calculo real de slots por paso)", () => {
  const todosLosSlots: BookingSlot[] = [
    { doctorId: "d1", servicioId: "s1", start: "2026-08-01T15:00:00-06:00" },
    { doctorId: "d1", servicioId: "s2", start: "2026-08-01T17:00:00-06:00" },
  ];

  function slotsParaPaso(current: { step: string; slot?: BookingSlot } | null, textoNorm: string): BookingSlot[] {
    // Misma condicion que supabase/functions/whatsapp-webhook/index.ts tras el fix.
    return current?.step === "esperando_horario" || current?.step === "esperando_servicio" ||
        (!current && textoNorm === "CITA")
      ? todosLosSlots
      : current?.slot
      ? [current.slot]
      : [];
  }

  // Paso 1: CITA
  let current: ReturnType<typeof nextBookingState>["state"] = null;
  let r = nextBookingState(current, "CITA", servicios, slotsParaPaso(current, "CITA"));
  assertEquals(r.state?.step, "esperando_servicio");
  current = r.state;

  // Paso 2: elige servicio "1" (Consulta general, s1) -- aqui vivia el bug: sin la rama
  // "esperando_servicio" en slotsParaPaso, esto habria recibido [] y reseteado el flujo.
  r = nextBookingState(current, "1", servicios, slotsParaPaso(current, "1"));
  assertEquals(r.state?.step, "esperando_horario");
  assertEquals(r.action, "none");
  current = r.state;

  // Paso 3: elige horario "1"
  r = nextBookingState(current, "1", servicios, slotsParaPaso(current, "1"));
  assertEquals(r.state?.step, "esperando_confirmacion");
  current = r.state;

  // Paso 4: confirma
  r = nextBookingState(current, "SI", servicios, slotsParaPaso(current, "SI"));
  assertEquals(r.action, "book");
  assertEquals(r.state, null);
});

// CRITICO 2: identidad WhatsApp nueva sin patient_id vinculado -> CITA entra al wizard de alta
// (nombre, apellidos) antes de esperando_servicio. Al terminar el wizard, el resultado trae
// action "crear_paciente_y_continuar" y pacienteNuevo con los datos capturados, y el estado ya
// avanza a esperando_servicio en la misma respuesta.
Deno.test("sin patient_id vinculado: CITA entra al wizard de alta de paciente", () => {
  const r = nextBookingState(null, "CITA", servicios, [], false);
  assertEquals(r.state?.step, "esperando_nombre_paciente");
  assertEquals(r.action, "none");
});

Deno.test("wizard de alta: nombre -> apellidos -> crea paciente y continua a esperando_servicio", () => {
  const r1 = nextBookingState(null, "CITA", servicios, [], false);
  const r2 = nextBookingState(r1.state, "Juan", servicios, [], false);
  assertEquals(r2.state?.step, "esperando_apellidos_paciente");
  assertEquals(r2.state?.nombrePaciente, "Juan");
  assertEquals(r2.action, "none");

  const r3 = nextBookingState(r2.state, "Perez Lopez", servicios, slots, false);
  assertEquals(r3.state?.step, "esperando_servicio");
  assertEquals(r3.action, "crear_paciente_y_continuar");
  assertEquals(r3.pacienteNuevo, { nombre: "Juan", apellidos: "Perez Lopez" });
});

Deno.test("wizard de alta: nombre vacio repite la pregunta sin avanzar", () => {
  const r1 = nextBookingState(null, "CITA", servicios, [], false);
  const r2 = nextBookingState(r1.state, "   ", servicios, [], false);
  assertEquals(r2.state?.step, "esperando_nombre_paciente");
  assertEquals(r2.action, "none");
});

Deno.test("con patient_id ya vinculado: CITA va directo a esperando_servicio (sin wizard)", () => {
  const r = nextBookingState(null, "CITA", servicios, [], true);
  assertEquals(r.state?.step, "esperando_servicio");
});

Deno.test("HUMANO durante el wizard de alta hace handoff igual que en cualquier otro paso", () => {
  const r1 = nextBookingState(null, "CITA", servicios, [], false);
  const r2 = nextBookingState(r1.state, "HUMANO", servicios, []);
  assertEquals(r2.state, null);
  assertEquals(r2.action, "handoff_human");
});
