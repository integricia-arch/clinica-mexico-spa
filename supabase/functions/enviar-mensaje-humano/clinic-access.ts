// Extraído a su propio módulo (sin dependencias de supabase-js) para poder
// testearlo sin necesitar variables de entorno reales — index.ts crea el
// cliente Supabase a nivel de módulo, lo que rompe la importación en tests.

// El check de rol global (user_roles) solo confirma que el caller es staff
// EN ALGUNA clínica — hay que cruzarlo contra la clínica dueña de la
// conversación antes de dejarlo enviar mensajes a ese paciente.
export function isConversationClinicAccessForbidden(
  memberships: Array<{ clinic_id: string }> | null,
  conversationClinicId: string | null,
): boolean {
  if (!conversationClinicId) return true;
  return !(memberships ?? []).some((m) => m.clinic_id === conversationClinicId);
}
