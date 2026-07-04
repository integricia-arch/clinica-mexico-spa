-- 12 funciones SECURITY DEFINER sin search_path fijo: combinación clásica de
-- "search_path hijacking" -- un atacante con permiso de crear objetos en un
-- schema que preceda a 'public' en el search_path de la sesión podría hacer
-- que la función resuelva a una tabla/función suplantada. Fix: fijar el
-- search_path explícito en cada una (mismo patrón ya usado en el resto del
-- codebase, ver /aprende 2026-06-24 "RPCs SECURITY DEFINER").

ALTER FUNCTION public.cancelar_citas_prueba(integer) SET search_path = public;
ALTER FUNCTION public.chat_registrar_pendiente(text, uuid, text, text) SET search_path = public;
ALTER FUNCTION public.faq_buscar(text, uuid, text) SET search_path = public;
ALTER FUNCTION public.faq_buscar(text, uuid, text, text) SET search_path = public;
ALTER FUNCTION public.faq_incrementar_uso(uuid) SET search_path = public;
ALTER FUNCTION public.firmar_acta_merma(uuid, uuid, text) SET search_path = public;
ALTER FUNCTION public.fn_audit_log() SET search_path = public;
ALTER FUNCTION public.generate_prescription_number_for_doctor(uuid) SET search_path = public;
ALTER FUNCTION public.get_medicamentos_en_reorden(uuid) SET search_path = public;
ALTER FUNCTION public.pharmacy_open_shift(uuid, numeric, text) SET search_path = public;
ALTER FUNCTION public.turno_close(uuid, numeric, text, boolean, uuid) SET search_path = public;
ALTER FUNCTION public.turno_corte_x(uuid) SET search_path = public;
ALTER FUNCTION public.update_journey_progress(uuid) SET search_path = public;
