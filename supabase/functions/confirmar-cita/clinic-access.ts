// Extraído a su propio módulo (sin dependencias de supabase-js) para poder
// testearlo sin necesitar variables de entorno reales — index.ts crea el
// cliente Supabase a nivel de módulo, lo que rompe la importación en tests.

// Un membership con rol permitido en ALGUNA clínica no basta — debe ser
// específicamente en la clínica dueña de la cita que se quiere modificar.
export function isApptClinicAccessForbidden(
  memberships: Array<{ role: string; clinic_id: string }> | null,
  allowedRoles: string[],
  apptClinicId: string | null,
): boolean {
  if (!apptClinicId) return true;
  return !(memberships ?? []).some(
    (m) => allowedRoles.includes(m.role) && m.clinic_id === apptClinicId,
  );
}
