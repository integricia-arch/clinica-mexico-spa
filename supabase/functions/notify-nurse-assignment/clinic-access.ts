// Extraído a su propio módulo (sin dependencias de supabase-js) para poder
// testearlo sin necesitar variables de entorno reales.

// El handler original solo exigia un JWT valido (de cualquier usuario
// autenticado, sin verificar rol ni clinica) para disparar la notificacion
// a la enfermera asignada de una cita -- se exige membresia del caller en
// la clinica dueña de la cita.
export function isClinicAccessForbidden(
  memberships: Array<{ clinic_id: string }> | null,
  clinicId: string | null,
): boolean {
  if (!clinicId) return true;
  return !(memberships ?? []).some((m) => m.clinic_id === clinicId);
}
