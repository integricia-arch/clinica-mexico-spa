-- Red de seguridad final: ningún item de Compras puede persistir con cantidad
-- o precio en cero, sin importar qué componente/hook lo inserte.
-- Root cause: el guard de validación vivía solo en un componente de UI
-- (PuntoReorden.tsx), no en la capa compartida ni en la DB — permitió que
-- otra vía de creación (dialog "Nueva OC") colara una OC con 32 items a $0.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ordenes_compra_items_cantidad_precio_check'
  ) THEN
    ALTER TABLE ordenes_compra_items
      ADD CONSTRAINT ordenes_compra_items_cantidad_precio_check
      CHECK (cantidad_pedida > 0 AND precio_unitario_centavos > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cotizaciones_items_cantidad_precio_check'
  ) THEN
    ALTER TABLE cotizaciones_items
      ADD CONSTRAINT cotizaciones_items_cantidad_precio_check
      CHECK (cantidad > 0 AND precio_unitario_centavos > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recepciones_items_cantidad_precio_check'
  ) THEN
    ALTER TABLE recepciones_items
      ADD CONSTRAINT recepciones_items_cantidad_precio_check
      CHECK (cantidad_recibida > 0 AND precio_unitario_centavos > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facturas_proveedor_subtotal_check'
  ) THEN
    ALTER TABLE facturas_proveedor
      ADD CONSTRAINT facturas_proveedor_subtotal_check
      CHECK (subtotal_centavos > 0);
  END IF;
END $$;
