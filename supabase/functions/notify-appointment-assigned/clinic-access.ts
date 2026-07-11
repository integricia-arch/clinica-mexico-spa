// Extraído a su propio módulo (sin dependencias de supabase-js) para poder
// testearlo sin necesitar variables de entorno reales.

// El rol admin/receptionist se validaba a nivel global -- un admin de la
// clinica A podia disparar la notificacion de una cita de la clinica B solo
// conociendo el appointment_id (no expone datos al caller, pero dispara una
// notificacion Telegram/email no autorizada). Se exige membresia del caller
// en la clinica dueña de la cita.
export function isClinicAccessForbidden(
  memberships: Array<{ clinic_id: string }> | null,
  clinicId: string | null,
): boolean {
  if (!clinicId) return true;
  return !(memberships ?? []).some((m) => m.clinic_id === clinicId);
}
