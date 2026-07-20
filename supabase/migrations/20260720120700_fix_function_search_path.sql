-- Auditoría de acceso 2026-07-20, medio: 15 funciones (triggers de updated_at y
-- validadores) sin search_path fijo (get_advisors "Function Search Path Mutable").
-- Riesgo: schema poisoning si algún rol puede crear objetos en un schema anterior
-- en el search_path de la sesión. Fix trivial, ya en checklist propio de CLAUDE.md.

ALTER FUNCTION public.assign_receta_folio() SET search_path = public;
ALTER FUNCTION public.fn_check_temp_rango() SET search_path = public;
ALTER FUNCTION public.fn_set_updated_at() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_clinic_settings_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.trg_set_updated_at() SET search_path = public;
ALTER FUNCTION public.update_actas_merma_updated_at() SET search_path = public;
ALTER FUNCTION public.update_antecedentes_updated_at() SET search_path = public;
ALTER FUNCTION public.update_devoluciones_proveedor_updated_at() SET search_path = public;
ALTER FUNCTION public.update_libro_ctrl_updated_at() SET search_path = public;
ALTER FUNCTION public.update_sc_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.validate_bot_settings() SET search_path = public;
