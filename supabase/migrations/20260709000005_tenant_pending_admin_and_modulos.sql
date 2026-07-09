-- Guarda admin_email y modulo_ids elegidos en el wizard mientras la clínica
-- espera verificación por código — se consumen en verify-tenant-code.
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS pending_admin_email text,
  ADD COLUMN IF NOT EXISTS pending_modulo_ids uuid[];
