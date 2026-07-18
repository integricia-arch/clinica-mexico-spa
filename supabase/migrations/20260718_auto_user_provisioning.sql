-- Auto-provision usuarios en Auth cuando se da de alta doctor/enfermera
-- Tabla: registra doctors/nurses que necesitan cuenta
-- Trigger: inserta en cola cuando new.activo = true y new.user_id is null
-- Edge Function: procesa cola cada 30s y crea usuarios

CREATE TABLE IF NOT EXISTS user_provisioning_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('doctor', 'nurse')),
  entity_id UUID NOT NULL,
  email TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  processed_at TIMESTAMP,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  error_message TEXT,

  UNIQUE(entity_type, entity_id)
);

ALTER TABLE user_provisioning_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_access" ON user_provisioning_queue FOR ALL TO service_role USING (TRUE);

-- Trigger: cuando se activa un doctor sin usuario, encolar para creación automática
CREATE OR REPLACE FUNCTION enqueue_doctor_user_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo si se activó (activo = true) y no tiene usuario vinculado
  IF NEW.activo AND NEW.user_id IS NULL THEN
    INSERT INTO user_provisioning_queue (entity_type, entity_id, email, nombre_completo)
    VALUES ('doctor', NEW.id, NEW.email, CONCAT(NEW.nombre, ' ', NEW.apellidos))
    ON CONFLICT (entity_type, entity_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER doctor_user_enqueue
AFTER INSERT OR UPDATE ON doctors
FOR EACH ROW
EXECUTE FUNCTION enqueue_doctor_user_creation();

-- Trigger: cuando se activa una enfermera sin usuario, encolar para creación automática
CREATE OR REPLACE FUNCTION enqueue_nurse_user_creation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.activo AND NEW.user_id IS NULL THEN
    INSERT INTO user_provisioning_queue (entity_type, entity_id, email, nombre_completo)
    VALUES ('nurse', NEW.id, NEW.email, CONCAT(NEW.nombre, ' ', NEW.apellidos))
    ON CONFLICT (entity_type, entity_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER nurse_user_enqueue
AFTER INSERT OR UPDATE ON nurses
FOR EACH ROW
EXECUTE FUNCTION enqueue_nurse_user_creation();

-- Índice: procesa cola en FIFO
CREATE INDEX idx_user_queue_pending ON user_provisioning_queue(created_at)
WHERE processed_at IS NULL;

COMMIT;
