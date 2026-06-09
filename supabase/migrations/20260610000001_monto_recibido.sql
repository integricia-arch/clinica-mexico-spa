-- Add cash-received and change-given fields to pharmacy_sale_payments
ALTER TABLE public.pharmacy_sale_payments
  ADD COLUMN IF NOT EXISTS monto_recibido numeric(12,2),
  ADD COLUMN IF NOT EXISTS cambio_entregado numeric(12,2);

COMMENT ON COLUMN public.pharmacy_sale_payments.monto_recibido IS 'Efectivo entregado por el cliente';
COMMENT ON COLUMN public.pharmacy_sale_payments.cambio_entregado IS 'Cambio devuelto al cliente';
