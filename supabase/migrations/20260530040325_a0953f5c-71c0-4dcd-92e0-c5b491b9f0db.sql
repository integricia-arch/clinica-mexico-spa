-- 1) Add manager role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

-- 2) POS metadata on pharmacy_sales
ALTER TABLE public.pharmacy_sales
  ADD COLUMN IF NOT EXISTS cashier_user_id uuid,
  ADD COLUMN IF NOT EXISTS manager_authorized_by uuid,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- 3) Default cashier_user_id from auth.uid() when not provided
CREATE OR REPLACE FUNCTION public.pharmacy_sales_set_cashier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cashier_user_id IS NULL THEN
    NEW.cashier_user_id := COALESCE(NEW.created_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pharmacy_sales_set_cashier ON public.pharmacy_sales;
CREATE TRIGGER trg_pharmacy_sales_set_cashier
BEFORE INSERT ON public.pharmacy_sales
FOR EACH ROW
EXECUTE FUNCTION public.pharmacy_sales_set_cashier();