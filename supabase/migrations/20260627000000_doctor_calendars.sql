-- Tabla para tokens OAuth de Google Calendar por doctor
CREATE TABLE IF NOT EXISTS doctor_calendars (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id     uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_id     uuid REFERENCES clinics(id) ON DELETE CASCADE,
  google_email  text NOT NULL,
  calendar_id   text NOT NULL DEFAULT 'primary',
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  token_expiry  timestamptz NOT NULL,
  activo        boolean NOT NULL DEFAULT true,
  connected_at  timestamptz DEFAULT now(),
  CONSTRAINT doctor_calendars_doctor_clinic_unique UNIQUE (doctor_id, clinic_id)
);

ALTER TABLE doctor_calendars ENABLE ROW LEVEL SECURITY;

-- Solo service role puede leer/escribir tokens OAuth
CREATE POLICY "service_role_only_doctor_calendars" ON doctor_calendars
  USING (auth.role() = 'service_role');

-- Campo para ID del evento en Google Calendar del doctor
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_event_id text;

-- Índice para lookups rápidos
CREATE INDEX IF NOT EXISTS idx_doctor_calendars_doctor_id ON doctor_calendars(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_calendars_activo ON doctor_calendars(doctor_id, activo) WHERE activo = true;
