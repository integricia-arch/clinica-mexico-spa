
CREATE TABLE IF NOT EXISTS public.pharmacy_sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  sale_id uuid NOT NULL REFERENCES public.pharmacy_sales(id) ON DELETE CASCADE,
  payment_method text NOT NULL CHECK (payment_method IN ('efectivo','tarjeta','transferencia')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  card_type text CHECK (card_type IS NULL OR card_type IN ('debito','credito')),
  card_brand text CHECK (card_brand IS NULL OR card_brand IN ('Visa','Mastercard','Amex','Otro')),
  card_last4 text CHECK (card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$'),
  authorization_code text,
  terminal_id text,
  acquirer text,
  transfer_reference text,
  bank_name text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pharmacy_sale_payments_sale_idx ON public.pharmacy_sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS pharmacy_sale_payments_clinic_idx ON public.pharmacy_sale_payments(clinic_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacy_sale_payments TO authenticated;
GRANT ALL ON public.pharmacy_sale_payments TO service_role;

ALTER TABLE public.pharmacy_sale_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read pharmacy_sale_payments"
  ON public.pharmacy_sale_payments FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'nurse'::app_role) OR has_role(auth.uid(),'receptionist'::app_role));

CREATE POLICY "Staff insert pharmacy_sale_payments"
  ON public.pharmacy_sale_payments FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'nurse'::app_role) OR has_role(auth.uid(),'receptionist'::app_role))
    AND user_has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "multiclinic_access_restrictive"
  ON public.pharmacy_sale_payments AS RESTRICTIVE FOR ALL TO authenticated
  USING (user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (user_has_clinic_access(auth.uid(), clinic_id));
