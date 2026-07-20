-- "Insert propio" en pos_error_logs tenía WITH CHECK(true) — el nombre dice que
-- debería limitarse al propio usuario pero cualquier authenticated podía insertar
-- logs a nombre de cualquier user_id. Impacto bajo (solo logs de error, sin PII
-- sensible) pero corrige para que coincida con la intención del nombre.
-- PuntoDeVenta.tsx (logPosError) manda user_id: userId ?? null — se permite NULL.

DROP POLICY IF EXISTS "Insert propio" ON public.pos_error_logs;

CREATE POLICY "Insert propio" ON public.pos_error_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = (SELECT auth.uid()));
