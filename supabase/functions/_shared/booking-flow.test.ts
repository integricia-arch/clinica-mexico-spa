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
