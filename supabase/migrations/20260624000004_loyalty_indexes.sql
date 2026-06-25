-- supabase/migrations/20260624000004_loyalty_indexes.sql
-- FIX 3 [HIGH-PERF]: Composite index on loyalty_movimientos to support
-- loyalty_recalculate_level query: WHERE member_id = ? AND tipo = 'acumulacion' AND created_at >= ?
-- The existing idx_loyalty_movimientos_member (member_id, created_at DESC) lacks the tipo column,
-- causing a post-index filter scan per member. This index eliminates that scan.
CREATE INDEX IF NOT EXISTS idx_loyalty_movimientos_member_tipo
  ON loyalty_movimientos (member_id, tipo, created_at DESC);