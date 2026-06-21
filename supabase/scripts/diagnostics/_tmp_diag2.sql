SELECT psp.sale_id, psp.payment_method, psp.amount, psp.created_at
FROM public.pharmacy_sale_payments psp
ORDER BY psp.created_at DESC LIMIT 10;
