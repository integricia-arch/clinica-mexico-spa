-- Agregar email a doctors y nurses para auto-provisioning
-- Estos emails se usan para crear cuentas automáticamente en Supabase Auth

ALTER TABLE public.doctors ADD COLUMN email TEXT UNIQUE;
ALTER TABLE public.nurses ADD COLUMN email TEXT UNIQUE;

-- Crear índices para búsqueda por email
CREATE INDEX idx_doctors_email ON public.doctors(email) WHERE email IS NOT NULL;
CREATE INDEX idx_nurses_email ON public.nurses(email) WHERE email IS NOT NULL;

-- Actualizar trigger: incluir email en la validación
CREATE OR REPLACE FUNCTION enqueue_doctor_user_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo si se activó (activo = true), no tiene usuario vinculado, y tiene email
  IF NEW.activo AND NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    INSERT INTO user_provisioning_queue (entity_type, entity_id, email, nombre_completo)
    VALUES ('doctor', NEW.id, NEW.email, CONCAT(NEW.nombre, ' ', NEW.apellidos))
    ON CONFLICT (entity_type, entity_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION enqueue_nurse_user_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo si se activó (activo = true), no tiene usuario vinculado, y tiene email
  IF NEW.activo AND NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    INSERT INTO user_provisioning_queue (entity_type, entity_id, email, nombre_completo)
    VALUES ('nurse', NEW.id, NEW.email, CONCAT(NEW.nombre, ' ', NEW.apellidos))
    ON CONFLICT (entity_type, entity_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
