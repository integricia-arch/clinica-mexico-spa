-- Create conversacion_analisis table
CREATE TABLE conversacion_analisis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  sentimiento TEXT CHECK (sentimiento IN ('positivo','neutral','negativo','enojado')),
  intencion_principal TEXT,
  intencion_cumplida BOOLEAN,
  friccion TEXT,
  queja TEXT,
  quiere TEXT,
  posible_bug TEXT,
  acepto_promociones BOOLEAN,
  duracion_minutos INTEGER,
  mensajes_count INTEGER,
  escalada BOOLEAN,
  cita_creada BOOLEAN,
  modelo TEXT DEFAULT 'claude-haiku-4-5-20251001',
  analizado_at TIMESTAMPTZ DEFAULT now(),
  clinic_id uuid REFERENCES clinic_settings(id) ON DELETE SET NULL,
  UNIQUE(conversacion_id)
);

ALTER TABLE conversacion_analisis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read" ON conversacion_analisis FOR SELECT
USING (auth.uid() IN (
  SELECT user_id FROM clinic_memberships WHERE clinic_id = conversacion_analisis.clinic_id
));

CREATE INDEX idx_conversacion_analisis_clinic_id ON conversacion_analisis(clinic_id);
CREATE INDEX idx_conversacion_analisis_analizado_at ON conversacion_analisis(analizado_at);
