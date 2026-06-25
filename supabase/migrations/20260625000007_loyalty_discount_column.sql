-- supabase/migrations/20260625000007_loyalty_discount_column.sql
-- Agrega columna loyalty_discount a pharmacy_sales para trazabilidad
-- del descuento por puntos canjeados, separado del descuento manual (discount).
ALTER TABLE public.pharmacy_sales
  ADD COLUMN IF NOT EXISTS loyalty_discount numeric(12,2) NOT NULL DEFAULT 0;
