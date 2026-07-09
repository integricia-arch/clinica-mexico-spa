-- Verificación por email al dar de alta un tenant: create-tenant ya no cobra
-- ni inscribe módulos de una — deja la clínica en 'pendiente_verificacion' y
-- manda un código de 6 dígitos. verify-tenant-code confirma y recién ahí
-- corre Stripe + invite + módulos.
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS verification_code text,
  ADD COLUMN IF NOT EXISTS verification_code_expires_at timestamptz;
