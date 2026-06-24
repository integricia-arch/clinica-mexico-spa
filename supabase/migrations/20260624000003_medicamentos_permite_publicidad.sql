-- Migration: permite_publicidad en medicamentos
-- Requerimiento COFEPRIS Art. 307 LGS: medicamentos controlados/receta no pueden ser publicidad

ALTER TABLE medicamentos
  ADD COLUMN IF NOT EXISTS permite_publicidad boolean NOT NULL DEFAULT false;

-- OTC sin receta y no controlados pueden recibir publicidad
UPDATE medicamentos
   SET permite_publicidad = true
 WHERE requires_prescription = false
   AND is_controlled = false;
