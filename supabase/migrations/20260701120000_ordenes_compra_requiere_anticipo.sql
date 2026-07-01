ALTER TABLE ordenes_compra
  ADD COLUMN IF NOT EXISTS requiere_anticipo boolean NOT NULL DEFAULT false;
