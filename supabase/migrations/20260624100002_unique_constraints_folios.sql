-- ============================================================
-- Task 2.5: UNIQUE indices on folio columns (per-clinic)
-- ============================================================

-- UNIQUE en folio de movimientos (per-clinic)
-- Prevents duplicate folio assignments in the same clinic.
-- Uses CONCURRENTLY to avoid blocking reads during index creation.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_movimientos_clinic_folio
  ON public.movimientos(clinic_id, folio)
  WHERE folio IS NOT NULL;

-- NOTE: recetas_capturadas UNIQUE index deferred.
-- The table recetas_capturadas does not yet exist in committed migrations
-- (only in supabase/migrations/_tmp_cofepris_libro.sql, an uncommitted draft).
-- This index will be added in Task 3.1 when _tmp_cofepris_libro.sql is
-- properly committed as a formal migration.
-- Planned index:
--   CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_recetas_clinic_folio
--     ON public.recetas_capturadas(clinic_id, folio_secuencial)
--     WHERE folio_secuencial IS NOT NULL;
