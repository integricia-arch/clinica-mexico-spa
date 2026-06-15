SELECT DISTINCT status FROM public.pharmacy_sales LIMIT 20;
SELECT DISTINCT payment_method FROM public.pharmacy_sale_payments LIMIT 20;
SELECT DISTINCT payment_method FROM public.pharmacy_sales LIMIT 20;
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='pharmacy_shifts'
ORDER BY ordinal_position;
