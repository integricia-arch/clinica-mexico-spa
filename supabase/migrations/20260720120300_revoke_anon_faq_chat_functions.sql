-- Auditoría de acceso 2026-07-20, grupo D: FAQ/chat de ayuda interna.
-- ayuda_chat_resolver_usuarios se llama desde AyudaInterna.tsx (panel admin,
-- requiere sesión). faq_buscar/faq_incrementar_uso/chat_registrar_pendiente no
-- tienen ningún caller en src/ hoy (feature de chat con IA sigue sin UI, ver
-- CLAUDE.md "Chat de ayuda... UI pendiente") pero están pensadas para el botón
-- "?" dentro de la app ya logueada, no para el sitio público /manual — sin
-- motivo para exponerlas a anon.

REVOKE EXECUTE ON FUNCTION public.ayuda_chat_resolver_usuarios(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ayuda_chat_resolver_usuarios(uuid[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.faq_buscar(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.faq_buscar(text, uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.faq_buscar(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.faq_buscar(text, uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.faq_incrementar_uso(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.faq_incrementar_uso(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.chat_registrar_pendiente(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_registrar_pendiente(text, uuid, text, text) TO authenticated;
