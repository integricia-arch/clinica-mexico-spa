-- Columnas para registrar consentimiento explícito de privacidad (LFPDPPP)
-- Requerido para datos sensibles (datos de salud) bajo Arts. 9 y 16 LFPDPPP.
-- La versión permite invalidar consentimientos previos si se actualiza el Aviso de Privacidad.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS consentimiento_privacidad_at  timestamptz,
  ADD COLUMN IF NOT EXISTS consentimiento_privacidad_version text;

COMMENT ON COLUMN patients.consentimiento_privacidad_at IS
  'Timestamp en que el paciente aceptó el Aviso de Privacidad vigente (LFPDPPP Art. 9)';

COMMENT ON COLUMN patients.consentimiento_privacidad_version IS
  'Versión del Aviso de Privacidad aceptado (ej. "1.0"). Permite detectar pacientes con versión desactualizada.';
