-- Tabla sin RLS habilitado (ERROR level, get_advisors). Solo se escribe vía
-- next_receta_folio() SECURITY DEFINER, llamada desde el trigger
-- assign_receta_folio en prescriptions -- ningún cliente necesita acceso
-- directo. Enable RLS sin policies bloquea todo acceso vía REST/GraphQL;
-- la función sigue funcionando porque SECURITY DEFINER salta RLS.
ALTER TABLE public.recetas_folio_contadores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recetas_folio_contadores FROM PUBLIC, anon, authenticated;
