-- supabase/migrations/20260701100002_drop_duplicate_indexes.sql
-- Eliminar índices redundantes identificados en audit (M12).

-- lotes_medicamento: idx_lotes_medicamento es prefijo de idx_lotes_fifo
DROP INDEX CONCURRENTLY IF EXISTS public.idx_lotes_medicamento;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_lotes_med;

-- movimientos_inventario: idx_movimientos_medicamento es prefijo de idx_movs_med
DROP INDEX CONCURRENTLY IF EXISTS public.idx_movimientos_medicamento;

-- journey_instance_steps: idx_jis_journey es prefijo de idx_jis_journey_key
DROP INDEX CONCURRENTLY IF EXISTS public.idx_jis_journey;
