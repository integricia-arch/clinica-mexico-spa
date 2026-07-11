// Extraído a su propio módulo (sin dependencias de supabase-js) para poder
// testearlo sin necesitar variables de entorno reales.

// Un admin/receptionist con rol permitido a nivel global podía disparar un
// recordatorio_id de una clínica ajena (no expone datos al caller, pero
// dispara una notificación no autorizada). Se exige membresía del caller
// en la clínica dueña de la cita del recordatorio.
export function isClinicAccessForbidden(
  memberships: Array<{ clinic_id: string }> | null,
  clinicId: string | null,
): boolean {
  if (!clinicId) return true;
  return !(memberships ?? []).some((m) => m.clinic_id === clinicId);
}
