-- supabase/migrations/20260701100001_add_missing_indexes.sql
-- Índices faltantes identificados en audit. CONCURRENTLY = no bloquea escrituras.

-- appointment_resources: FK sin index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointment_resources_appointment
  ON public.appointment_resources(appointment_id);

-- pharmacy_sale_items: FK sin index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_psi_medicamento
  ON public.pharmacy_sale_items(medicamento_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_psi_lote
  ON public.pharmacy_sale_items(lote_id)
  WHERE lote_id IS NOT NULL;

-- notas_consulta: FK sin index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notas_doctor
  ON public.notas_consulta(doctor_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notas_appointment
  ON public.notas_consulta(appointment_id)
  WHERE appointment_id IS NOT NULL;

-- has_role() — index compuesto para index-only scans
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_user_role
  ON public.user_roles(user_id, role);

-- appointments — composite para consultas doctor+fecha+status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_clinic_doctor_fecha
  ON public.appointments(clinic_id, doctor_id, fecha_inicio, status)
  WHERE status NOT IN ('cancelada', 'liberada');

-- Reemplazar idx_medicamentos_activo (boolean, baja cardinalidad) con composite
DROP INDEX CONCURRENTLY IF EXISTS public.idx_medicamentos_activo;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicamentos_clinic_activo
  ON public.medicamentos(clinic_id, activo)
  WHERE activo = true;

-- GIN trgm para FAQ similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Wrapper IMMUTABLE para unaccent (requerido para index funcional)
CREATE OR REPLACE FUNCTION public.unaccent_immutable(text)
  RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  RETURN unaccent($1);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_pendientes_pregunta_trgm
  ON public.chat_preguntas_pendientes
  USING GIN (public.unaccent_immutable(pregunta) gin_trgm_ops)
  WHERE aprobado = false;
