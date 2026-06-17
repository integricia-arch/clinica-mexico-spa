-- Sistema FAQ para chat IA — 3 tiers: greeting → FAQ DB → Claude Haiku
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Tabla FAQ ──────────────────────────────────────────────────────────────
CREATE TABLE faq_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    uuid        REFERENCES clinics(id) ON DELETE CASCADE,
  pregunta     text        NOT NULL,
  respuesta    text        NOT NULL,
  triggers     text[]      NOT NULL DEFAULT '{}',
  ruta_activa  text,
  activo       boolean     NOT NULL DEFAULT true,
  uso_count    integer     NOT NULL DEFAULT 0,
  origen       text        NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual','aprendido')),
  aprobado     boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX faq_items_clinic_idx ON faq_items(clinic_id);
CREATE INDEX faq_items_activo_idx ON faq_items(activo) WHERE activo = true;
CREATE INDEX faq_items_uso_idx    ON faq_items(uso_count DESC);

-- ── Candidatos de aprendizaje (preguntas que fueron a Claude) ──────────────
CREATE TABLE chat_preguntas_pendientes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    uuid        REFERENCES clinics(id) ON DELETE CASCADE,
  pregunta     text        NOT NULL,
  ruta_activa  text,
  repeticiones integer     NOT NULL DEFAULT 1,
  respuesta_ia text,
  aprobado     boolean     NOT NULL DEFAULT false,
  faq_id       uuid        REFERENCES faq_items(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_pendientes_clinic_idx ON chat_preguntas_pendientes(clinic_id);
CREATE INDEX chat_pendientes_aprobado   ON chat_preguntas_pendientes(aprobado) WHERE aprobado = false;

CREATE TRIGGER faq_items_updated_at        BEFORE UPDATE ON faq_items                 FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER chat_pendientes_updated_at  BEFORE UPDATE ON chat_preguntas_pendientes  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ── RPC: buscar FAQ por mensaje ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION faq_buscar(
  p_pregunta   text,
  p_clinic_id  uuid DEFAULT NULL,
  p_ruta       text DEFAULT NULL
)
RETURNS TABLE(id uuid, respuesta text, uso_count int)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT f.id, f.respuesta, f.uso_count
  FROM   faq_items f
  WHERE  f.activo = true AND f.aprobado = true
    AND  (f.clinic_id IS NULL OR f.clinic_id = p_clinic_id)
    AND  (f.ruta_activa IS NULL OR f.ruta_activa = p_ruta)
    AND  EXISTS (
           SELECT 1 FROM unnest(f.triggers) t(tr)
           WHERE unaccent(p_pregunta) ILIKE '%' || unaccent(tr) || '%'
         )
  ORDER BY array_length(f.triggers, 1) DESC,
           CASE WHEN f.ruta_activa = p_ruta THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION faq_incrementar_uso(p_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE faq_items SET uso_count = uso_count + 1 WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION chat_registrar_pendiente(
  p_pregunta   text,
  p_clinic_id  uuid,
  p_ruta       text    DEFAULT NULL,
  p_respuesta  text    DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM   chat_preguntas_pendientes
  WHERE  (clinic_id = p_clinic_id OR (clinic_id IS NULL AND p_clinic_id IS NULL))
    AND  aprobado = false
    AND  similarity(unaccent(pregunta), unaccent(p_pregunta)) > 0.55
  ORDER  BY similarity(unaccent(pregunta), unaccent(p_pregunta)) DESC
  LIMIT  1;

  IF v_id IS NOT NULL THEN
    UPDATE chat_preguntas_pendientes
    SET    repeticiones = repeticiones + 1,
           respuesta_ia = COALESCE(p_respuesta, respuesta_ia),
           updated_at   = now()
    WHERE  id = v_id;
  ELSE
    INSERT INTO chat_preguntas_pendientes(clinic_id, pregunta, ruta_activa, respuesta_ia)
    VALUES (p_clinic_id, p_pregunta, p_ruta, p_respuesta);
  END IF;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE faq_items                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_preguntas_pendientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY faq_read  ON faq_items FOR SELECT USING (true);
CREATE POLICY faq_admin ON faq_items FOR ALL
  USING (is_clinic_staff(auth.uid())) WITH CHECK (is_clinic_staff(auth.uid()));

CREATE POLICY pendientes_read  ON chat_preguntas_pendientes FOR SELECT
  USING (is_clinic_staff(auth.uid()));
CREATE POLICY pendientes_write ON chat_preguntas_pendientes FOR ALL
  USING (is_clinic_staff(auth.uid())) WITH CHECK (is_clinic_staff(auth.uid()));
