// Extraído a su propio módulo (sin dependencias de supabase-js) para poder
// testearlo sin necesitar variables de entorno reales.

// El handler original no validaba ningun JWT propio (dependia solo del
// gateway verify_jwt=true) ni cruzaba member_id/clinic_id contra la
// membresia del caller -- cualquier usuario autenticado podia forzar el
// reenvio del email de bienvenida a un member_id/clinic_id ajenos.
export function isClinicAccessForbidden(
  memberships: Array<{ clinic_id: string }> | null,
  clinicId: string | null,
): boolean {
  if (!clinicId) return true;
  return !(memberships ?? []).some((m) => m.clinic_id === clinicId);
}
