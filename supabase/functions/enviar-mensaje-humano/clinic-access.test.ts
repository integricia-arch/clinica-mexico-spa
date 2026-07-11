import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isConversationClinicAccessForbidden } from "./clinic-access.ts";

// Regresion que este test protege: enviar-mensaje-humano solo verificaba un
// rol global (admin/receptionist/doctor/nurse EN ALGUNA clinica) sin cruzarlo
// contra la clinica dueña de la conversacion — cualquier staff podia enviar
// mensajes de Telegram a pacientes de otra clinica conociendo el
// conversacion_id. Ver docs/edge-functions-service-role-audit.md.
Deno.test("staff sin membresia en la clinica de la conversacion es rechazado", () => {
  const memberships = [{ clinic_id: "clinic-2" }];
  assertEquals(isConversationClinicAccessForbidden(memberships, "clinic-1"), true);
});

Deno.test("staff con membresia en la clinica de la conversacion es permitido", () => {
  const memberships = [{ clinic_id: "clinic-1" }];
  assertEquals(isConversationClinicAccessForbidden(memberships, "clinic-1"), false);
});

Deno.test("conversacion sin clinic_id es rechazada por defecto", () => {
  const memberships = [{ clinic_id: "clinic-1" }];
  assertEquals(isConversationClinicAccessForbidden(memberships, null), true);
});
