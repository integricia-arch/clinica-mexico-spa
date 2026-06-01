-- ==========================================================
-- Índices para escala: 3 gaps críticos identificados en audit
-- ==========================================================

-- 1. consentimientos(patient_id, otorgado)
--    Dashboard y cola de doctor hacen .in(patient_id).eq("otorgado", true)
--    La tabla no tenía NINGÚN índice — scan completo en cada carga.
CREATE INDEX IF NOT EXISTS idx_consentimientos_patient_otorgado
  ON public.consentimientos(patient_id, otorgado);

-- 2. audit_logs(created_at DESC)
--    Dashboard: ORDER BY created_at DESC LIMIT 20
--    Solo existía (tabla, registro_id) — ordenar sin índice escala mal.
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs(created_at DESC);

-- 3. journey_instance_steps(journey_instance_id, step_key)
--    journeyEngine.openJourneyStepByKey(): .eq(journey_instance_id).eq(step_key)
--    Solo había índice simple por journey_instance_id — el filtro compuesto
--    necesita el cubrimiento completo para evitar filter + recheck.
CREATE INDEX IF NOT EXISTS idx_jis_journey_key
  ON public.journey_instance_steps(journey_instance_id, step_key);
