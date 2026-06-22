-- ARCO requests + privacy notice versions
-- LFPDPPP Art. 9 (consentimiento + versión inmutable) + Arts. 21-34 (ARCO)

-- Registro inmutable de versiones publicadas del Aviso de Privacidad
CREATE TABLE IF NOT EXISTS privacy_notice_versions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version      TEXT NOT NULL UNIQUE,          -- "1.0", "1.1", etc.
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash TEXT NOT NULL,                 -- SHA-256 del texto canónico
  summary      TEXT NOT NULL DEFAULT ''       -- primeras 200 chars o descripción
);

-- Versión actual del aviso (borrador legal pendiente de abogado)
INSERT INTO privacy_notice_versions (version, published_at, content_hash, summary)
VALUES (
  '1.0',
  '2026-06-22T00:00:00Z',
  'sha256:placeholder-v1.0-pendiente-texto-final-abogado',
  'Aviso de Privacidad Integriclinica v1.0 — LFPDPPP DOF 20-mar-2025. Responsable: pendiente. Datos sensibles de salud. SAyBG como autoridad.'
)
ON CONFLICT (version) DO NOTHING;

-- Solicitudes ARCO (Acceso, Rectificación, Cancelación, Oposición)
-- LFPDPPP Arts. 21-34: respuesta en 20 días hábiles (~28 calendario)
CREATE TABLE IF NOT EXISTS arco_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio         TEXT NOT NULL UNIQUE DEFAULT 'ARCO-' || upper(substring(gen_random_uuid()::text, 1, 8)),
  tipo          TEXT NOT NULL CHECK (tipo IN ('acceso', 'rectificacion', 'cancelacion', 'oposicion')),
  nombre        TEXT NOT NULL,
  email         TEXT NOT NULL,
  telefono      TEXT,
  descripcion   TEXT NOT NULL,
  clinic_name   TEXT,   -- nombre de la clínica involucrada (texto libre, sin FK)
  patient_id    UUID REFERENCES patients(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '28 days'),
  status        TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (status IN ('pendiente', 'en_proceso', 'resuelto', 'rechazado')),
  resolved_at   TIMESTAMPTZ,
  notas_internas TEXT,
  respuesta     TEXT   -- texto enviado al titular como respuesta formal
);

-- Índices
CREATE INDEX IF NOT EXISTS arco_requests_status_idx     ON arco_requests(status);
CREATE INDEX IF NOT EXISTS arco_requests_created_at_idx ON arco_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS arco_requests_email_idx      ON arco_requests(email);

-- RLS
ALTER TABLE privacy_notice_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE arco_requests           ENABLE ROW LEVEL SECURITY;

-- Aviso: lectura pública (cualquiera puede ver qué versiones existen)
CREATE POLICY "privacy_notice_versions_public_read"
  ON privacy_notice_versions FOR SELECT USING (true);

-- Solo admins pueden insertar/actualizar versiones del aviso
CREATE POLICY "privacy_notice_versions_admin_write"
  ON privacy_notice_versions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ARCO: cualquiera (anon) puede insertar una solicitud
CREATE POLICY "arco_requests_public_insert"
  ON arco_requests FOR INSERT WITH CHECK (true);

-- Solo staff autenticado puede leer solicitudes
CREATE POLICY "arco_requests_staff_read"
  ON arco_requests FOR SELECT
  USING (auth.role() = 'authenticated');

-- Solo admins pueden actualizar (status, respuesta, notas)
CREATE POLICY "arco_requests_admin_update"
  ON arco_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
