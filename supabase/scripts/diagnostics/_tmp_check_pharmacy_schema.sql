SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('pharmacy_sale_payments', 'pharmacy_sales')
ORDER BY table_name, ordinal_position;
