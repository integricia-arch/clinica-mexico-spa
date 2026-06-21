CREATE TABLE IF NOT EXISTS public.pharmacy_sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  sale_id uuid NOT NULL REFERENCES public.pharmacy_sales(id) ON DELETE CASCADE,
  payment_method text NOT NULL CHECK (payment_method IN ('efectivo','tarjeta','transferencia')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  card_type text,
  card_brand text,
  card_last4 text,
  authorization_code text,
  terminal_id text,
  acquirer text,
  transfer_reference text,
  bank_name text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.pharmacy_sale_payments TO authenticated;
GRANT ALL ON public.pharmacy_sale_payments TO service_role;
ALTER TABLE public.pharmacy_sale_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage payments" ON public.pharmacy_sale_payments;
CREATE POLICY "Staff manage payments" ON public.pharmacy_sale_payments
  FOR ALL TO authenticated
  USING (public.is_caja_staff(auth.uid()))
  WITH CHECK (public.is_caja_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_pharmacy_sale_payments_sale ON public.pharmacy_sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_sale_payments_clinic ON public.pharmacy_sale_payments(clinic_id, created_at DESC);
